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
 * `tiddler-background`, as the engine reads it), `sidebarBox`/`hostBox`/`breakpoint` (`sidebarInPane`), and `groundBackground`
 * (the mirror container's computed background) beside `pageBackground` (the palette's `page-background`). `svgBound` caps the icon width.
 */
export function styledReadings(probe, unbaked, { svgBound = 48 } = {}) {
  const theme = unbaked.find((s) => STOCK_THEME.test(s));
  const shadows = unbaked.includes(BOOT_SHADOWS) ? BOOT_SHADOWS : undefined;
  const out = [];
  out.push(probe.sheetHasSidebarRule
    ? { name: "M2 styled-sheet", status: "ok", message: "the mirror's sheet carries a .tc-sidebar-scrollable rule (the stock vanilla theme stands)" }
    : red("M2 styled-sheet", "the mirror's sheet carries no .tc-sidebar-scrollable rule: no stock theme reached the mirror's engine", theme, theme));
  const pane = sidebarInPane(probe);
  out.push(pane.ok
    ? { name: "M2 styled-sidebar", status: "ok", message: pane.message }
    : red("M2 styled-sidebar", pane.message, theme, theme));
  out.push(typeof probe.svgWidth === "number" && probe.svgWidth > 0 && probe.svgWidth <= svgBound
    ? { name: "M2 styled-icons", status: "ok", message: `a toolbar icon renders ${probe.svgWidth}px wide (bound ${svgBound}px)` }
    : red("M2 styled-icons", `a toolbar icon renders ${probe.svgWidth ?? "(none)"}px wide, past the ${svgBound}px bound`, theme, theme));
  const want = rgbOf(probe.paletteBackground);
  out.push(want !== null && probe.frameBackground === want
    ? { name: "M2 styled-palette", status: "ok", message: `the tiddler frame's background reads the palette's tiddler-background ${probe.paletteBackground}` }
    : red("M2 styled-palette", `the tiddler frame's background reads ${probe.frameBackground ?? "(no frame)"}; the palette's tiddler-background reads ${probe.paletteBackground ?? "(no palette colour)"}`,
      theme ?? shadows, theme ?? shadows));
  const ground = rgbOf(probe.pageBackground);
  out.push(ground !== null && probe.groundBackground === ground
    ? { name: "M2 styled-ground", status: "ok", message: `the mirror's ground reads the palette's page-background ${probe.pageBackground}` }
    : red("M2 styled-ground", `the mirror's ground reads ${probe.groundBackground ?? "(no ground)"}; the palette's page-background reads ${probe.pageBackground ?? "(no palette colour)"}`,
      theme ?? shadows, theme ?? shadows));
  return out;
}

/**
 * THE SIDEBAR LAYS OUT IN THE PANE. The mirror's host stands as the engine's viewport: TW5's breakpoint reads the pane's width,
 * so the sidebar reads `fixed` beside the story where the pane stands at least the breakpoint wide and flows beneath it where
 * narrower, and either way its box starts inside the host's box (never at the window's corner). Boxes are `{ x, y, w, h }`, px.
 */
export function sidebarInPane({ sidebarPosition, sidebarBox, hostBox, breakpoint }) {
  if (!sidebarPosition || !sidebarBox || !hostBox) return { ok: false, message: `no sidebar box beside a host box (sidebar ${sidebarPosition ?? "absent"})` };
  const px = Number.parseFloat(String(breakpoint ?? ""));
  if (!Number.isFinite(px)) return { ok: false, message: `the engine names no sidebar breakpoint (${breakpoint ?? "absent"})` };
  const inside = sidebarBox.x >= hostBox.x - 1 && sidebarBox.x + sidebarBox.w <= hostBox.x + hostBox.w + 1 && sidebarBox.y >= hostBox.y - 1;
  if (!inside) return { ok: false, message: `the sidebar paints at (${sidebarBox.x}, ${sidebarBox.y}) ${sidebarBox.w}px wide, outside the pane at (${hostBox.x}, ${hostBox.y}) ${hostBox.w}px wide` };
  const wide = hostBox.w >= px;
  if (wide !== (sidebarPosition === "fixed")) return { ok: false, message: `the pane stands ${hostBox.w}px against the ${px}px breakpoint, yet the sidebar reads ${sidebarPosition}: the breakpoint read another width` };
  return { ok: true, message: `the sidebar lays out inside the pane (${sidebarPosition}; the pane stands ${hostBox.w}px against the ${px}px breakpoint)` };
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

/**
 * THE HANDOFF READING: the mirror's engine booted from what the vessel's island handed it over the port (the engine blob, each
 * plugin blob, and the wiki's records in the store before the engine stood), never from a store the page read itself. `handed`
 * comes off the mirror's own read-only reading: the members the port carried and verified, and the records the engine booted with.
 */
export function handoffReading(handed) {
  const name = "M6 mirror-boots-handed";
  if (!handed) return { name, status: "bad", message: "the mirror names no handoff: its engine booted from something the port never carried" };
  if (!(handed.members >= 2)) return { name, status: "bad", message: `the port handed ${handed.members ?? 0} boot member(s): an engine and at least one plugin blob make a boot set` };
  if (!(handed.records >= 1)) return { name, status: "bad", message: "the engine booted with none of the wiki's records: the snapshot landed after boot, so TW5 unpacked no record at boot" };
  return { name, status: "ok", message: `the island handed ${handed.members} boot members and ${handed.records} records over the port before the engine stood` };
}
