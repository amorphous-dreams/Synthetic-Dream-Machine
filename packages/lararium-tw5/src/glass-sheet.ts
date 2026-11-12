/**
 * glass-sheet — the page sheet a TW5 theme writes for a whole document, carried into the mirror's shadow root.
 *
 * A stock theme addresses the document: `html` and `body.tc-body` carry the page ground and the fonts, and the sidebar
 * breakpoint asks the WINDOW (`@media (min-width: …)`). Inside a shadow root no `html` or `body` stands, and the window
 * names nothing about the pane the engine paints. So the mirror's host stands as the engine's viewport, and the sheet reads
 * against it:
 *
 * - `html` reads as the host (`:host`), `body` as the mirror's container (`.lar-mirror`, which also wears `tc-body`);
 * - a width-only `@media` query reads as an `@container` query on the host, so the breakpoint reads the pane's width;
 * - the host contains layout, so TW5's `position: fixed` (the sidebar, a modal) lays out inside the pane, never on the window,
 *   and holds a definite height for `bottom: 0` to land on. The container scrolls; a fixed sidebar stays put beside it.
 *
 * Pure text in, text out: the camera runs it over every sheet render.
 */

/** The frame the host and its container hold whatever theme paints: appended after the theme, so it holds the last word. */
export const GLASS_FRAME_SHEET = `
:host { display: block; position: relative; container-type: inline-size; contain: layout paint; height: 80vh; min-height: 24rem; overflow: hidden; }
.lar-mirror { position: relative; box-sizing: border-box; height: 100%; overflow: auto; }
`;

const WIDTH_FEATURE = /^\(\s*(?:min|max)-width\s*:[^()]*\)$/;

/** True for a media condition made of width features alone (`(min-width: 960px)`, `(max-width: 55em) and (min-width: 30em)`). */
function widthOnly(condition: string): boolean {
  const parts = condition.trim().split(/\s+and\s+/i).map(part => part.trim());
  return parts.length > 0 && parts.every(part => WIDTH_FEATURE.test(part));
}

/** One selector's head: `html…` reads as the host (`html body…` as the container beneath it), `body…` as the container. */
function selector(raw: string): string {
  const lead = raw.match(/^\s*/)![0];
  let rest = raw.slice(lead.length);
  let host = "";
  const html = rest.match(/^html(?![\w-])((?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*)/);
  if (html) {
    host = html[1] ? `:host(${html[1]})` : ":host";
    rest = rest.slice(html[0].length);
    // The document element only scopes the body: `html body.tc-body x` names the container, under a qualified host alone.
    const body = rest.match(/^\s+body(?![\w-])/);
    if (!body) return `${lead}${host}${rest}`;
    rest = rest.slice(body[0].length);
    return `${lead}${html[1] ? `${host} ` : ""}.lar-mirror${rest}`;
  }
  const body = rest.match(/^body(?![\w-])/);
  if (body) return `${lead}.lar-mirror${rest.slice(body[0].length)}`;
  return raw;
}

/** Rewrite one rule prelude: an at-rule keeps its own text unless its media condition reads widths alone. */
function prelude(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("@")) {
    const media = trimmed.match(/^@media\s+(.+)$/is);
    if (media && widthOnly(media[1]!)) return text.replace(/@media\s+/i, "@container ");
    return text;
  }
  return text.split(",").map(selector).join(",");
}

/** The theme's page sheet as the mirror's shadow root reads it, the frame appended. */
export function shadowSheet(css: string): string {
  // Each prelude runs from the last brace (or the start) to the next `{`; a declaration block holds no `{`, so it never reads as one.
  const rewritten = css.replace(/(^|[{}])([^{}]+)(?=\{)/g, (_all, brace: string, head: string) => {
    const comment = head.lastIndexOf("*/");
    if (comment < 0) return brace + prelude(head);
    return brace + head.slice(0, comment + 2) + prelude(head.slice(comment + 2));
  });
  return `${rewritten}\n${GLASS_FRAME_SHEET}`;
}
