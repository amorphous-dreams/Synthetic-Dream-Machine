/**
 * glass-theme — the mirror wears the stock theme under the house palette and opens the wiki's own default story, read off the
 * boot set the next bake carries (the tree's packed plugin files, as the vessel names them by CID) and the canon records a wiki
 * lands. The node island reads the same blobs (`lararium-tw5/tests/tree-boot-set.test.ts`).
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import housePlugin from "../../lararium-tw5/plugins/lares-memetic-wikitext.json";
import bootShadows from "../../lararium-tw5/plugins/lararium-boot-shadows.json";
import vanilla from "../../lararium-tw5/plugins/tiddlywiki-vanilla.json";
import snowwhite from "../../lararium-tw5/plugins/tiddlywiki-snowwhite.json";
import paletteCarrier from "../../../bags/lararium/ha.ka.ba/lararium/tw5/palette/gruvbox-dark.mem?raw";

beforeEach(forgetEvidence); afterEach(forgetEvidence);

const PALETTE = "lar:///ha.ka.ba/lararium/tw5/palette/gruvbox-dark#/palette";
const WELCOME = "lar:///ha.ka.ba/lares/docs/welcome";
/** The palette slot as the lararium bag lands it: the carrier's own dictionary rows, typed and tagged. */
const paletteRecord = () => {
  const rows = paletteCarrier.slice(paletteCarrier.indexOf("background: #282828"), paletteCarrier.lastIndexOf("<<~/ahu>>")).trim();
  return { title: PALETTE, fields: { type: "application/x-tiddler-dictionary", tags: ["$:/tags/Palette"], text: rows } };
};
const welcomeRecord = { title: WELCOME, fields: { type: "text/vnd.tiddlywiki", tags: ["$:/tags/lares/Landing"], text: "Welcome." } };
const preloads = (stock: boolean) => [housePlugin, ...(bootShadows as Record<string, unknown>[]), ...(stock ? [vanilla, snowwhite] : [])] as Record<string, unknown>[];

async function stand(stock: boolean, records: Array<{ title: string; fields: Record<string, unknown> }>) {
  const r = await rig({ preloads: preloads(stock), records });
  const result = await standMirror(r.options, r.seams) as Awaited<ReturnType<typeof standMirror>> & { settled: Promise<unknown>; unmount(): void };
  await result.settled;
  const root = r.host.shadowRoot!;
  const sheet = [...root.querySelectorAll("style")].map(style => style.textContent ?? "").join("\n");
  const frame = root.querySelector<HTMLElement>(".tc-story-river .tc-tiddler-frame");
  return { r, result, sheet, frame, first: frame?.getAttribute("data-tiddler-title") ?? null };
}

test("the mirror's sheet carries the stock vanilla rules and the palette reaches the tiddler frame; CONTROL: with no stock theme, no sidebar rule", async () => {
  const styled = await stand(true, [paletteRecord(), welcomeRecord]);
  try {
    expect(styled.sheet).toMatch(/\.tc-sidebar-scrollable\s*\{/);
    expect(styled.sheet).toContain("#282828");
    expect(getComputedStyle(styled.frame!).backgroundColor).toBe("rgb(40, 40, 40)");
  } finally { styled.result.unmount(); styled.r.host.remove(); }
  forgetEvidence();
  const bare = await stand(false, [paletteRecord(), welcomeRecord]);
  try {
    expect(bare.sheet).not.toMatch(/\.tc-sidebar-scrollable\s*\{/);
    expect(getComputedStyle(bare.frame!).backgroundColor).not.toBe("rgb(40, 40, 40)");
  } finally { bare.result.unmount(); bare.r.host.remove(); }
});

test("the mirror opens its story after the port's first snapshot, on the wiki's own landing; CONTROL: a wiki with no landing opens the stock fallback", async () => {
  const landed = await stand(true, [paletteRecord(), welcomeRecord]);
  try { expect(landed.first).toBe(WELCOME); }
  finally { landed.result.unmount(); landed.r.host.remove(); }
  forgetEvidence();
  const bare = await stand(true, [paletteRecord()]);
  try { expect(bare.first).toBe("GettingStarted"); }
  finally { bare.result.unmount(); bare.r.host.remove(); }
});
