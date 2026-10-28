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
  shadowRoot.append(style, container);
  // The third runtime has no browser startup root; create a real widget root deliberately.
  const root = tw.wiki.makeWidget(tw.wiki.parseText("text/vnd.tiddlywiki", ""), { document: doc as never });
  tw.rootWidget = root;
  // Core's browser startup builds the scroller, popup layer and focus handler the story views read; the third runtime
  // skips that startup, so the glass builds the same three over its own container.
  const twAny = tw as unknown as Record<string, any>;
  // Widgets read `$tw.browser` for their real-DOM branches (scrolling, framed editing, popups) long after startup
  // has finished, so the glass sets it once it mounts and gives it back at unmount.
  const priorBrowser = twAny.browser;
  const agent = doc.defaultView?.navigator?.userAgent ?? "";
  twAny.browser = { isFirefox: /Firefox/.test(agent), isSafari: /Safari/.test(agent) && !/Chrome/.test(agent), isIE: false,
    isMobile: /Mobile|Android/.test(agent), hasTouch: "ontouchstart" in (doc.defaultView ?? {}) };
  const lent: string[] = [];
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
  const widget = tw.wiki.makeTranscludeWidget(template, { document: doc, parentWidget: root });
  const styleWidget = tw.wiki.makeTranscludeWidget(stylesheet, { document: doc, parentWidget: root });
  // The sheet renders into a detached holder; its text lands in the shadow root's one <style>, as core's own page render does.
  const sheet = doc.createElement("div");
  styleWidget.render(sheet as unknown as TW5FakeElement, null);
  style.textContent = sheet.textContent;
  widget.render(container as unknown as TW5FakeElement, null);
  const onChange = (changes: Record<string, TW5ChangeRecord>) => {
    widget.refresh(changes);
    styleWidget.refresh(changes);
    if (style.textContent !== sheet.textContent) style.textContent = sheet.textContent;
  };
  tw.wiki.addEventListener("change", onChange);
  let mounted = true;
  return { unmount() {
    if (!mounted) return;
    mounted = false;
    tw.wiki.removeEventListener("change", onChange);
    widget.removeChildDomNodes?.();
    styleWidget.removeChildDomNodes?.();
    container.remove();
    style.remove();
    for (const name of lent) delete twAny[name];
    twAny.browser = priorBrowser;
    if (tw.rootWidget === root) tw.rootWidget = undefined as never;
  } };
}
