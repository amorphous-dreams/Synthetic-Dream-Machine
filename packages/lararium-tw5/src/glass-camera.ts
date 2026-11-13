import type { TW5ChangeRecord, TW5FakeElement, TW5Instance } from "./types/tiddlywiki.js";
import { TW5_PAGE_STYLESHEET, TW5_ROOT_TEMPLATE } from "./tw5-camera.js";
import { shadowSheet } from "./glass-sheet.js";
import { installGlassRoot, makePaneScroller } from "./glass-root.js";
import type { GlassDoor } from "./glass-root.js";

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
  stylesheet = TW5_PAGE_STYLESHEET, keepsFocus, door }: {
  tw: TW5Instance; shadowRoot: ShadowRoot; template?: string; stylesheet?: string;
  keepsFocus?: (changes: Record<string, TW5ChangeRecord>) => boolean;
  /** The surface's host doors (clipboard, download, route, ...); absent, every door ask refuses by name. */
  door?: GlassDoor;
}): { unmount(): void } {
  const doc = shadowRoot.ownerDocument;
  const style = doc.createElement("style");
  // THE PANE'S DOCUMENT SHAPE mirrors a stock page: `container` stands where `body.tc-body` stands (the theme's ground and fonts
  // reach it, `glass-sheet.ts`), `page` stands where stock's `$tw.pageContainer` stands (its first child), and modals and
  // notifications append beside `page`, as stock appends them to the body.
  const container = doc.createElement("div");
  container.className = "lar-mirror tc-body";
  const page = doc.createElement("div");
  page.className = "tc-page-container-wrapper";
  container.append(page);
  shadowRoot.append(style, container);
  // Setup is one act: a throw anywhere below gives back every assignment made so far.
  const twAny = tw as unknown as Record<string, any>;
  const lent: Array<[string, unknown]> = [];
  const lend = (name: string, value: unknown): void => { lent.push([name, twAny[name]]); twAny[name] = value; };
  const priorRoot = tw.rootWidget;
  let root: ReturnType<typeof tw.wiki.makeWidget> | undefined;
  let widget: { removeChildDomNodes?: () => void; render: (...args: any[]) => void; refresh: (changes: any) => void } | undefined;
  let styleWidget: typeof widget;
  let onChange: ((changes: Record<string, TW5ChangeRecord>) => void) | undefined;
  let uninstallRoot: (() => void) | undefined;
  let keys: { manager: Record<string, any>; stock: unknown } | undefined;
  let mounted = false;
  const release = (): void => {
    if (onChange) tw.wiki.removeEventListener("change", onChange);
    uninstallRoot?.();
    if (keys) keys.manager["handleKeydownEvent"] = keys.stock;
    widget?.removeChildDomNodes?.();
    styleWidget?.removeChildDomNodes?.();
    container.remove();
    style.remove();
    for (const [name, prior] of lent.reverse()) { if (prior === undefined) delete twAny[name]; else twAny[name] = prior; }
    if (tw.rootWidget !== priorRoot) tw.rootWidget = priorRoot as never;
  };
  try {
  // A browser-mode boot built `$tw.rootWidget` over the page's document, and the house's own startup modules already bound their
  // root listeners on it (`lar-story`): the camera renders beneath that root. An engine with no root gets one minted.
  root = (tw.rootWidget as typeof root | undefined) ?? tw.wiki.makeWidget(tw.wiki.parseText("text/vnd.tiddlywiki", ""), { document: doc as never });
  if (tw.rootWidget !== root) tw.rootWidget = root as never;
  // Widgets read `$tw.browser` for their real-DOM branches (scrolling, framed editing, popups) long after startup has finished;
  // an engine that booted without it gets it for the camera's life.
  if (!twAny.browser) {
    const agent = doc.defaultView?.navigator?.userAgent ?? "";
    lend("browser", { isFirefox: /Firefox/.test(agent), isSafari: /Safari/.test(agent) && !/Chrome/.test(agent), isIE: false,
      isMobile: /Mobile|Android/.test(agent), hasTouch: "ontouchstart" in (doc.defaultView ?? {}) });
  }
  // The scroller, the popup layer, the modal, the notifier and the root `tm-*` listeners stock builds in its browser startup
  // (kept out of the mirror's boot), each over the pane.
  const scroller = makePaneScroller(tw, container, shadowRoot);
  lend("pageScroller", scroller);
  if (twAny.utils?.Popup) lend("popup", new twAny.utils.Popup({ rootElement: container }));
  lend("pageContainer", page);
  uninstallRoot = installGlassRoot({ tw, root: root as never, shadowRoot, body: container, scroller, ...(door ? { door } : {}) });
  // Stock listens for shortcuts on the whole document. The mirror owns its pane alone: a key reaches the wiki's shortcuts only
  // while it travels through the pane, and never after the camera leaves.
  const manager = twAny.keyboardManager as Record<string, any> | undefined;
  if (manager && typeof manager["handleKeydownEvent"] === "function") {
    const stock = manager["handleKeydownEvent"] as (event: KeyboardEvent, options?: unknown) => unknown;
    keys = { manager, stock };
    manager["handleKeydownEvent"] = function (this: unknown, event: KeyboardEvent, options?: unknown): unknown {
      if (!mounted || !(event.composedPath?.() ?? []).includes(shadowRoot.host)) return false;
      return stock.call(this, event, options);
    };
  }
  widget = tw.wiki.makeTranscludeWidget(template, { document: doc, parentWidget: root });
  styleWidget = tw.wiki.makeTranscludeWidget(stylesheet, { document: doc, parentWidget: root });
  // The sheet renders into a detached holder; its text lands in the shadow root's one <style>, as core's own page render does,
  // read against the host as the engine's viewport (`shadowSheet`).
  const sheet = doc.createElement("div");
  styleWidget.render(sheet as unknown as TW5FakeElement, null);
  let rendered = sheet.textContent ?? "";
  style.textContent = shadowSheet(rendered);
  widget.render(page as unknown as TW5FakeElement, null);
  lend("pageWidgetNode", widget);
  twAny.hooks?.invokeHook?.("th-page-refreshed");
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
    twAny.hooks?.invokeHook?.("th-page-refreshing");
    widget!.refresh(changes);
    twAny.hooks?.invokeHook?.("th-page-refreshed");
    if (held) giveBack(held);
    styleWidget!.refresh(changes);
    if (rendered !== (sheet.textContent ?? "")) { rendered = sheet.textContent ?? ""; style.textContent = shadowSheet(rendered); }
  };
  tw.wiki.addEventListener("change", onChange);
  } catch (error) { release(); throw error; }
  mounted = true;
  return { unmount() {
    if (!mounted) return;
    mounted = false;
    release();
  } };
}
