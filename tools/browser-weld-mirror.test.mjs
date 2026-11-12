/**
 * browser-weld mirror readings — the weld reads the person's own surface (`#mirror`), and each reading names its seam. Pure
 * functions over what the page reports: no browser, no web surface.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { contentReading, labelReading, rgbOf, settleOf, styledReadings, unbakedSources } from "./browser-weld/mirror-read.mjs";

const THEME = "packages/lararium-tw5/plugins/tiddlywiki-vanilla.json";
const SHADOWS = "packages/lararium-tw5/plugins/lararium-boot-shadows.json";
const GRAMMAR = "packages/lararium-tw5/plugins/lares-memetic-wikitext.json";
const styled = { sheetHasSidebarRule: true, sidebarPosition: "fixed", svgWidth: 18, frameBackground: "rgb(40, 40, 40)", paletteBackground: "#282828" };

test("RED: a skinny mirror with no named reason has not settled; CONTROL: full settles, and skinny settles once it names why", () => {
  assert.equal(settleOf({ mirror: "skinny", why: null }), null);
  assert.equal(settleOf({ mirror: null, why: null }), null);
  assert.equal(settleOf({ mirror: "none:mirror-inputs-absent", why: null }), null);
  assert.deepEqual(settleOf({ mirror: "full", why: null }), { settled: "full" });
  assert.deepEqual(settleOf({ mirror: "skinny", why: "full-promotion-unfinished" }), { settled: "skinny", why: "full-promotion-unfinished" });
  assert.deepEqual(settleOf({ mirror: "none:port-gone", why: null }), { settled: "floor", why: "port-gone" });
});

test("the page evaluates settleOf from its own source, so one implementation decides on both sides", () => {
  const inPage = new Function(`return (${settleOf.toString()})`)();
  assert.deepEqual(inPage({ mirror: "full" }), { settled: "full" });
  assert.equal(inPage({ mirror: "skinny" }), null);
});

test("RED: an unstyled mirror fails each styled reading by name where no source stands declared", () => {
  const out = styledReadings({ sheetHasSidebarRule: false, sidebarPosition: "static", svgWidth: 640, frameBackground: "rgba(0, 0, 0, 0)", paletteBackground: null }, []);
  assert.deepEqual(out.map((r) => [r.name, r.status]), [
    ["M2 styled-sheet", "bad"], ["M2 styled-sidebar", "bad"], ["M2 styled-icons", "bad"], ["M2 styled-palette", "bad"]]);
  assert.match(out[2].message, /640px wide, past the 48px bound/);
});

test("CONTROL: the same unstyled mirror reads as gaps naming the row where genesis/unbaked.json declares the stock theme", () => {
  const out = styledReadings({ sheetHasSidebarRule: false, sidebarPosition: "static", svgWidth: 640, frameBackground: null, paletteBackground: null }, [THEME]);
  assert.ok(out.every((r) => r.status === "gap"), JSON.stringify(out));
  assert.match(out[0].message, /tiddlywiki-vanilla\.json/);
  // A palette red with only the boot shadows declared names that row.
  const palette = styledReadings({ ...styled, frameBackground: "rgb(255, 255, 255)" }, [SHADOWS]);
  assert.equal(palette[3].status, "gap");
  assert.match(palette[3].message, /lararium-boot-shadows/);
});

test("CONTROL: a styled mirror passes every styled reading, the palette colour compared in the computed-style spelling", () => {
  assert.ok(styledReadings(styled, [THEME]).every((r) => r.status === "ok"));
  assert.equal(rgbOf("#282828"), "rgb(40, 40, 40)");
  assert.equal(rgbOf("transparent"), null);
  assert.equal(styledReadings({ ...styled, frameBackground: "rgb(41, 40, 40)" }, [])[3].status, "bad");
});

test("RED: a story opened before the wiki landed fails even where the landing stands declared unbaked", () => {
  const r = contentReading("GettingStarted", { defaults: ["lar:///ha.ka.ba/lares/docs/welcome"] }, [GRAMMAR]);
  assert.equal(r.status, "bad");
  assert.match(r.message, /before the wiki landed/);
});

test("the stock fallback reads as a gap only while the grammar bundle carrying the landing shadow stands declared unbaked", () => {
  assert.equal(contentReading("GettingStarted", { defaults: ["GettingStarted"] }, [GRAMMAR]).status, "gap");
  assert.equal(contentReading("GettingStarted", { defaults: ["GettingStarted"] }, []).status, "bad");
  // CONTROL: the wiki's own landing, opened first, passes.
  const welcome = "lar:///ha.ka.ba/lares/docs/welcome";
  assert.equal(contentReading(welcome, { defaults: [welcome] }, []).status, "ok");
});

test("RED: a pane that names the summon target or nothing fails the label; CONTROL: the vessel card's own word passes", () => {
  assert.equal(labelReading("daemon", "lares").status, "bad");
  assert.equal(labelReading(null, "lares").status, "bad");
  assert.equal(labelReading("lares", "lares").status, "ok");
});

test("unbakedSources reads the declaration's sources, and an absent file declares nothing", () => {
  assert.deepEqual(unbakedSources(null), []);
  assert.deepEqual(unbakedSources(JSON.stringify({ format: "lararium-genesis-unbaked", unbaked: [{ source: THEME, sha256: "a", why: "b" }] })), [THEME]);
});
