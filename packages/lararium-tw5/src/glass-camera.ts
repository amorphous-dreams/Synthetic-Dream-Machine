import type { TW5ChangeRecord, TW5FakeElement, TW5Instance } from "./types/tiddlywiki.js";
import { TW5_PAGE_STYLESHEET, TW5_ROOT_TEMPLATE } from "./tw5-camera.js";

/** The parts of a TW5 widget the camera reads to find the editor a person types in. */
type EditorWidget = { children?: EditorWidget[]; editTitle?: string; editField?: string; editIndex?: string;
  engine?: { domNode?: HTMLElement; updateDomNodeText?: (text: string) => void };
  saveChanges?: (text: string) => void };
/** The text control a person types in, and what of it belongs to them: which record it edits, its words, its caret. */
type HeldEdit = { node: HTMLInputElement | HTMLTextAreaElement; title: string; field: string; index: string | undefined;
  value: string; start: number | null; end: number | null; direction: "forward" | "backward" | "none" | null; scrollTop: number };

const textControl = (node: Element | null | undefined): node is HTMLInputElement | HTMLTextAreaElement =>
  !!node && (node.tagName === "TEXTAREA" || node.tagName === "INPUT");
/** The focused element inside the shadow root, reaching into a framed editor's own document. */
const focusedIn = (shadowRoot: ShadowRoot): Element | null => {
  const active = shadowRoot.activeElement;
  return active?.tagName === "IFRAME" ? (active as HTMLIFrameElement).contentDocument?.activeElement ?? null : active;
};
/** A control still on the page: a framed editor's node stays connected to its own document after its iframe leaves. */
const onPage = (node: Element, doc: Document): boolean =>
  node.isConnected && (node.ownerDocument === doc || !!node.ownerDocument.defaultView?.frameElement?.isConnected);
const editorWidgets = function* (widget: EditorWidget | undefined): Generator<EditorWidget> {
  if (!widget) return;
  if (widget.engine?.domNode && widget.editTitle !== undefined) yield widget;
  for (const child of widget.children ?? []) yield* editorWidgets(child);
};

/**
 * Mount TW5's real widget tree inside a page-owned shadow root.
 *
 * THE FOCUSED CONTROL BELONGS TO THE HUMAN (`dreamdom#/what-a-sink-keeps`). A refresh `keepsFocus` names (the mirror names each
 * one a landing caused: the promotion's snapshot, a peer's record) may re-render the edit frame a person types in, and
 * TW5's editor takes focus on render, so the keys that follow would land in another field. The draft lives in the wiki
 * as a tiddler like any other, so a re-rendered editor reads the person's words back from it; what the page keeps is
 * the control: the camera notes the focused text control before such a refresh and, when the refresh moved focus off it,
 * gives focus, caret and scroll back to the editor of the same record (the same node when it still stands), and keeps
 * the person's words on it if the re-rendered editor reads other words. A refresh the person's own act caused keeps
 * TW5's own focus law, so a new editor still takes focus at its title.
 */
export function mountGlassCamera({ tw, shadowRoot, template = TW5_ROOT_TEMPLATE,
  stylesheet = TW5_PAGE_STYLESHEET, keepsFocus }: {
  tw: TW5Instance; shadowRoot: ShadowRoot; template?: string; stylesheet?: string;
  keepsFocus?: (changes: Record<string, TW5ChangeRecord>) => boolean;
}): { unmount(): void } {
  const doc = shadowRoot.ownerDocument;
  const style = doc.createElement("style");
  const container = doc.createElement("div");
  container.className = "lar-mirror";
  shadowRoot.append(style, container);
  // Setup is one act: a throw anywhere below gives back every assignment made so far.
  const twAny = tw as unknown as Record<string, any>;
  const priorBrowser = twAny.browser;
  const lent: string[] = [];
  let root: ReturnType<typeof tw.wiki.makeWidget> | undefined;
  let widget: { removeChildDomNodes?: () => void; render: (...args: any[]) => void; refresh: (changes: any) => void } | undefined;
  let styleWidget: typeof widget;
  let onChange: ((changes: Record<string, TW5ChangeRecord>) => void) | undefined;
  const release = (): void => {
    if (onChange) tw.wiki.removeEventListener("change", onChange);
    widget?.removeChildDomNodes?.();
    styleWidget?.removeChildDomNodes?.();
    container.remove();
    style.remove();
    for (const name of lent) delete twAny[name];
    twAny.browser = priorBrowser;
    if (root && tw.rootWidget === root) tw.rootWidget = undefined as never;
  };
  try {
  // The third runtime has no browser startup root; create a real widget root deliberately.
  root = tw.wiki.makeWidget(tw.wiki.parseText("text/vnd.tiddlywiki", ""), { document: doc as never });
  tw.rootWidget = root;
  // Core's browser startup builds the scroller, popup layer and focus handler the story views read; the third runtime
  // skips that startup, so the glass builds the same three over its own container.
  // Widgets read `$tw.browser` for their real-DOM branches (scrolling, framed editing, popups) long after startup
  // has finished, so the glass sets it once it mounts and gives it back at unmount.
  const agent = doc.defaultView?.navigator?.userAgent ?? "";
  twAny.browser = { isFirefox: /Firefox/.test(agent), isSafari: /Safari/.test(agent) && !/Chrome/.test(agent), isIE: false,
    isMobile: /Mobile|Android/.test(agent), hasTouch: "ontouchstart" in (doc.defaultView ?? {}) };
  const lend = (name: string, value: unknown): void => { twAny[name] = value; lent.push(name); };
  if (twAny.utils?.PageScroller) {
    lend("pageScroller", new twAny.utils.PageScroller());
    root.addEventListener("tm-scroll", (event: unknown) => twAny.pageScroller.handleEvent(event));
  }
  if (twAny.utils?.Popup) lend("popup", new twAny.utils.Popup({ rootElement: container }));
  root.addEventListener("tm-focus-selector", (event: { param?: string; paramObject?: FocusOptions }) => {
    const target = event.param ? shadowRoot.querySelector<HTMLElement>(event.param) : null;
    target?.focus?.(event.paramObject);
  });
  widget = tw.wiki.makeTranscludeWidget(template, { document: doc, parentWidget: root });
  styleWidget = tw.wiki.makeTranscludeWidget(stylesheet, { document: doc, parentWidget: root });
  // The sheet renders into a detached holder; its text lands in the shadow root's one <style>, as core's own page render does.
  const sheet = doc.createElement("div");
  styleWidget.render(sheet as unknown as TW5FakeElement, null);
  style.textContent = sheet.textContent;
  widget.render(container as unknown as TW5FakeElement, null);
  const hold = (): HeldEdit | null => {
    const node = focusedIn(shadowRoot);
    if (!textControl(node)) return null;
    for (const editor of editorWidgets(widget as EditorWidget)) {
      if (editor.engine!.domNode !== node) continue;
      return { node, title: editor.editTitle!, field: editor.editField ?? "text", index: editor.editIndex, value: node.value,
        start: node.selectionStart, end: node.selectionEnd, direction: node.selectionDirection, scrollTop: node.scrollTop };
    }
    return null;
  };
  const giveBack = (held: HeldEdit): void => {
    const standing = onPage(held.node, doc);
    if (standing && focusedIn(shadowRoot) === held.node) return;
    let node: HTMLInputElement | HTMLTextAreaElement | null = standing ? held.node : null;
    let editor: EditorWidget | undefined;
    if (!node) {
      for (const candidate of editorWidgets(widget as EditorWidget)) {
        const dom = candidate.engine!.domNode!;
        if (candidate.editTitle === held.title && (candidate.editField ?? "text") === held.field &&
          candidate.editIndex === held.index && dom.tagName === held.node.tagName) { editor = candidate; node = dom as HTMLInputElement | HTMLTextAreaElement; break; }
      }
    }
    if (!node) return;   // the record's editor left the page (the draft saved or was dropped): nothing to give back
    if (editor && node.value !== held.value) { editor.engine!.updateDomNodeText?.(held.value); editor.saveChanges?.(held.value); }
    node.focus({ preventScroll: true });
    if (held.start !== null && held.end !== null) {
      try { node.setSelectionRange(held.start, held.end, held.direction ?? "none"); } catch { /* a control kind with no selection */ }
    }
    node.scrollTop = held.scrollTop;
  };
  onChange = (changes: Record<string, TW5ChangeRecord>) => {
    const held = keepsFocus?.(changes) ? hold() : null;
    widget!.refresh(changes);
    if (held) giveBack(held);
    styleWidget!.refresh(changes);
    if (style.textContent !== sheet.textContent) style.textContent = sheet.textContent;
  };
  tw.wiki.addEventListener("change", onChange);
  } catch (error) { release(); throw error; }
  let mounted = true;
  return { unmount() {
    if (!mounted) return;
    mounted = false;
    release();
  } };
}
