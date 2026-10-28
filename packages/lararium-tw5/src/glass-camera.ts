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
    container.remove();
    style.remove();
    if (tw.rootWidget === root) tw.rootWidget = undefined as never;
  } };
}
