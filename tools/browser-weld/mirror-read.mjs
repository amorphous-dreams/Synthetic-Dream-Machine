/**
 * mirror-read — what the browser weld reads off the person's own surface, the glass mirror (`#mirror`), as pure functions.
 *
 * ── WHY THE WELD READS THE MIRROR ───────────────────────────────────────────────────────────────
 * Once the mirror stands (`data-lar-shown="mirror"`), the page's CSS hides the worker-rendered floor (`#projection`). W2-W4
 * drive that floor and prove the none-width return leg; they never read what a person sees. These readings do: the
 * mirror's settle, its styling, the story it opened, and the name the pane gives it. Each verdict names its seam.
 *
 * ── A GAP STANDS ONLY WHERE THE TREE DECLARES IT ────────────────────────────────────────────────
 * The stock theme, the palette pointer and the house landing reach a browser vessel through genesis (the boot-set blobs) and
 * its floor release. Where `genesis/unbaked.json` declares the source that carries a reading, a red reading names that row
 * as a gap; once the bake folds the row away, the same reading fails. A reading with no declared source behind it fails.
 *
 * Every function here runs in node, and `settleOf` also runs in the page (the weld hands its source to the page's wait), so
 * one implementation decides the settle on both sides.
 */

/**
 * The mirror's settle, from the host's three words. `full` settles; `skinny` settles only with a named reason
 * (`data-lar-mirror-why`); a `none:<why>` floor settles as a floor (the vessel naming no inputs yet keeps waiting).
 * Pure and self-contained: the page evaluates its source.
 */
export function settleOf(words) {
  const mirror = words && words.mirror;
  if (mirror === "full") return { settled: "full" };
  if (mirror === "skinny" && words.why) return { settled: "skinny", why: words.why };
  if (typeof mirror === "string" && mirror.startsWith("none:") && mirror !== "none:mirror-inputs-absent") return { settled: "floor", why: mirror.slice(5) };
  return null;
}

/** The sources `genesis/unbaked.json` declares, or none where the file stands absent (a fresh bake deleted it). */
export function unbakedSources(text) {
  if (text === null || text === undefined) return [];
  const marker = JSON.parse(text);
  return Array.isArray(marker.unbaked) ? marker.unbaked.map((row) => String(row.source)) : [];
}

const STOCK_THEME = /^packages\/lararium-tw5\/plugins\/tiddlywiki-[^/]+\.json$/;
const BOOT_SHADOWS = "packages/lararium-tw5/plugins/lararium-boot-shadows.json";
const GRAMMAR = "packages/lararium-tw5/plugins/lares-memetic-wikitext.json";

/** A red reading: a gap naming the declared row where the tree declares the source behind it, else a failure. */
function red(name, message, declared, row) {
  return declared ? { name, status: "gap", message: `${message} — declared unbaked (${row}); the controller's bake carries it` }
    : { name, status: "bad", message };
}

/**
 * THE STYLED READINGS. `probe` comes off the mirror's shadow root: `sheetHasSidebarRule` (the `<style>` text carries a
 * `.tc-sidebar-scrollable` rule), `sidebarPosition` (its computed position), `svgWidth` (a toolbar icon's rendered width, px),
 * `frameBackground` (a tiddler frame's computed background colour, rgb) and `paletteBackground` (the palette's own
 * `tiddler-background`, as the engine reads it). `svgBound` caps the icon width.
 */
export function styledReadings(probe, unbaked, { svgBound = 48 } = {}) {
  const theme = unbaked.find((s) => STOCK_THEME.test(s));
  const shadows = unbaked.includes(BOOT_SHADOWS) ? BOOT_SHADOWS : undefined;
  const out = [];
  out.push(probe.sheetHasSidebarRule
    ? { name: "M2 styled-sheet", status: "ok", message: "the mirror's sheet carries a .tc-sidebar-scrollable rule (the stock vanilla theme stands)" }
    : red("M2 styled-sheet", "the mirror's sheet carries no .tc-sidebar-scrollable rule: no stock theme reached the mirror's engine", theme, theme));
  out.push(probe.sidebarPosition === "fixed"
    ? { name: "M2 styled-sidebar", status: "ok", message: "the sidebar's computed position reads fixed" }
    : red("M2 styled-sidebar", `the sidebar's computed position reads ${probe.sidebarPosition ?? "(no sidebar)"}, not fixed`, theme, theme));
  out.push(typeof probe.svgWidth === "number" && probe.svgWidth > 0 && probe.svgWidth <= svgBound
    ? { name: "M2 styled-icons", status: "ok", message: `a toolbar icon renders ${probe.svgWidth}px wide (bound ${svgBound}px)` }
    : red("M2 styled-icons", `a toolbar icon renders ${probe.svgWidth ?? "(none)"}px wide, past the ${svgBound}px bound`, theme, theme));
  const want = rgbOf(probe.paletteBackground);
  out.push(want !== null && probe.frameBackground === want
    ? { name: "M2 styled-palette", status: "ok", message: `the tiddler frame's background reads the palette's tiddler-background ${probe.paletteBackground}` }
    : red("M2 styled-palette", `the tiddler frame's background reads ${probe.frameBackground ?? "(no frame)"}; the palette's tiddler-background reads ${probe.paletteBackground ?? "(no palette colour)"}`,
      theme ?? shadows, theme ?? shadows));
  return out;
}

/** `#rrggbb` → `rgb(r, g, b)`, the computed-style spelling; anything else reads null. */
export function rgbOf(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex ?? "").trim());
  return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : null;
}

/**
 * THE CONTENT READING. `firstTitle` reads off the mirror's story river; `reading.defaults` names the wiki's own default story
 * as the mirror's engine filters `$:/DefaultTiddlers`. The first story title equals the first default; GettingStarted reads
 * only as the stock fallback, never as the wiki's own landing.
 */
export function contentReading(firstTitle, reading, unbaked) {
  const name = "M3 content-story";
  const first = reading?.defaults?.[0];
  if (firstTitle && first && firstTitle === first && firstTitle !== "GettingStarted") {
    return { name, status: "ok", message: `the first story title "${firstTitle}" equals the wiki's own $:/DefaultTiddlers` };
  }
  if (firstTitle !== first) {
    return { name, status: "bad", message: `the first story title "${firstTitle ?? "(empty story)"}" differs from the wiki's $:/DefaultTiddlers "${first ?? "(empty)"}": the story opened before the wiki landed` };
  }
  const grammar = unbaked.includes(GRAMMAR) ? GRAMMAR : undefined;
  return red(name, `the story opens on "${firstTitle ?? "(empty story)"}": the shown wiki names no landing of its own`, grammar, `${grammar}; its landing record rides the next floor cut`);
}

/** THE LABEL READING: the pane's heading names the shown wiki in the vessel card's own word. */
export function labelReading(paneWiki, cardWiki) {
  const name = "M4 pane-label";
  if (paneWiki && cardWiki && paneWiki === cardWiki) return { name, status: "ok", message: `the pane names "${paneWiki}", the vessel card's wiki` };
  return { name, status: "bad", message: `the pane names "${paneWiki ?? "(nothing)"}"; the vessel card names "${cardWiki ?? "(nothing)"}"` };
}
