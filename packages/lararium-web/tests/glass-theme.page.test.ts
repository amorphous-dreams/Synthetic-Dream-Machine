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

/** A pane of `width` px: the host the mirror stands in, sized the way a page lays it. */
async function standIn(width: number) {
  const r = await rig({ preloads: preloads(true), records: [paletteRecord(), welcomeRecord] });
  r.host.style.width = `${width}px`;
  const result = await standMirror(r.options, r.seams) as Awaited<ReturnType<typeof standMirror>> & { settled: Promise<unknown>; unmount(): void };
  await result.settled;
  const root = r.host.shadowRoot!;
  const sidebar = root.querySelector<HTMLElement>(".tc-sidebar-scrollable")!;
  return { r, result, root, sidebar, side: sidebar.getBoundingClientRect(), pane: r.host.getBoundingClientRect() };
}

test("the sidebar lays out inside the pane: fixed beside the story in a pane past the breakpoint, in flow beneath it in a narrower one; CONTROL: never at the window's corner", async () => {
  const wide = await standIn(1200);
  try {
    expect(getComputedStyle(wide.sidebar).position).toBe("fixed");
    expect(wide.side.left).toBeGreaterThanOrEqual(wide.pane.left - 1);
    expect(wide.side.right).toBeLessThanOrEqual(wide.pane.right + 1);
    expect(wide.side.top).toBeGreaterThanOrEqual(wide.pane.top - 1);
    expect(wide.side.bottom).toBeLessThanOrEqual(wide.pane.bottom + 1);
    // The story river scrolls inside the pane; the fixed sidebar stands where it stood.
    const scroller = wide.root.querySelector<HTMLElement>(".lar-mirror")!;
    scroller.scrollTop = 200;
    expect(wide.sidebar.getBoundingClientRect().top).toBeCloseTo(wide.side.top, 0);
  } finally { wide.result.unmount(); wide.r.host.remove(); }
  forgetEvidence();
  const narrow = await standIn(600);
  try {
    // The breakpoint reads the pane's 600px, not the window: the sidebar flows beneath the story.
    expect(getComputedStyle(narrow.sidebar).position).not.toBe("fixed");
    expect(narrow.side.left).toBeGreaterThanOrEqual(narrow.pane.left - 1);
    expect(narrow.side.right).toBeLessThanOrEqual(narrow.pane.right + 1);
    expect(narrow.side.top).toBeGreaterThanOrEqual(narrow.pane.top - 1);
  } finally { narrow.result.unmount(); narrow.r.host.remove(); }
});

test("the mirror's ground wears the palette's page-background, where a page's body.tc-body would; CONTROL: the house sheet's own body rule reaches no element outside the shadow root", async () => {
  const stood = await standIn(800);
  try {
    expect(getComputedStyle(stood.root.querySelector(".lar-mirror")!).backgroundColor).toBe("rgb(29, 32, 33)");
    expect(getComputedStyle(document.body).backgroundColor).not.toBe("rgb(29, 32, 33)");
  } finally { stood.result.unmount(); stood.r.host.remove(); }
});
