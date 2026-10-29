import type { TW5ChangeRecord, TW5FakeElement, TW5Instance } from "./types/tiddlywiki.js";
import { TW5_PAGE_STYLESHEET, TW5_ROOT_TEMPLATE } from "./tw5-camera.js";

/** Mount TW5's real widget tree inside a page-owned shadow root. */
export function mountGlassCamera({ tw, shadowRoot, template = TW5_ROOT_TEMPLATE,
  stylesheet = TW5_PAGE_STYLESHEET }: {
  tw: TW5Instance; shadowRoot: ShadowRoot; template?: string; stylesheet?: string;
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
  onChange = (changes: Record<string, TW5ChangeRecord>) => {
    widget!.refresh(changes);
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
