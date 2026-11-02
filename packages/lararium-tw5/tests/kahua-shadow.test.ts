/**
 * kahua-shadow — a title whose topmost live record sits in a device-local daemon layer while `bags/kahua`
 * also holds it renders a "local draft over shared" mark with a diff against the kahua record it covers.
 *
 * Driven over the real shore rig: a real wiki, the island adaptor landing from a real composite whose
 * floor layer answers to KAHUA_BAG and whose working layer stands above it. The mark derives from this
 * device's cascade alone: the stamp lives in the temp plane and never reaches a store.
 */
import { afterEach, describe, expect, test } from "vitest";
import { KAHUA_BAG } from "@lararium/mesh";
import { seedDaemonUiTiddlers } from "../src/daemon-ui-tiddlers.js";
import { GLOBAL_IMPORT, wikiSkip, skipNote } from "./test-wiki.js";
import { remote, shoreRig, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

const SHADOW_STAMP = (title: string): string => `$:/temp/lares/kahua-shadow/${title}`;

let rig: Rig | undefined;
afterEach(async () => { await rig?.stop(); rig = undefined; });

async function stand(): Promise<Rig> {
  rig = await shoreRig({ canonId: KAHUA_BAG });
  seedDaemonUiTiddlers(rig.engine);
  return rig;
}

async function settle(r: Rig): Promise<void> {
  await turns();
  await r.adaptor.landingIdle();
  await turns();
}

/** The view-template segment as the story river renders it for one title, whitespace folded. */
function renderSegment(r: Rig, title: string): string {
  r.engine.setTiddler({
    title: "$:/test/kahua-shadow/host",
    type: "text/vnd.tiddlywiki",
    text: `${GLOBAL_IMPORT}<$tiddler tiddler="${title}"><$transclude tiddler="$:/lares/ui/view/kahua-shadow" mode="block"/></$tiddler>`,
  });
  return r.engine.wiki.renderTiddler("text/html", "$:/test/kahua-shadow/host").replace(/\s+/g, " ").trim();
}

const shadowed = (r: Rig): string[] => r.wiki.filterTiddlers("[all[tiddlers]kahua-shadow[]]");

describe.skipIf(wikiSkip)(`the shadow shows its diff${skipNote}`, () => {
  test("RED 1: a daemon draft over a kahua item stamps the mark and its diff", async () => {
    const r = await stand();
    await r.canon.put({ tiddler: { title: "Item", text: "shared body" } }, remote);
    await settle(r);
    await r.working.put({ tiddler: { title: "Item", text: "my local body" } }, remote);
    await settle(r);
    expect(shadowed(r)).toContain("Item");
    expect(shadowed(r), "the operator lists shadowed titles, never every title").not.toContain("$:/boot/boot.js");
    expect(r.wiki.getTiddler(SHADOW_STAMP("Item"))?.fields.text).toBe("shared body");
    const html = renderSegment(r, "Item");
    expect(html).toContain("local draft over shared");
    expect(html).toContain("<ins");
    expect(html).toContain("<del");
  }, 120_000);

  test("CONTROL 2: a kahua item with no draft carries no mark", async () => {
    const r = await stand();
    await r.canon.put({ tiddler: { title: "Item", text: "shared body" } }, remote);
    await settle(r);
    expect(r.wiki.getTiddler(SHADOW_STAMP("Item"))).toBeUndefined();
    expect(renderSegment(r, "Item")).not.toContain("local draft over shared");
  }, 120_000);

  test("CONTROL 3: a daemon title with no kahua twin carries no mark", async () => {
    const r = await stand();
    await r.working.put({ tiddler: { title: "Solo", text: "only mine" } }, remote);
    await settle(r);
    expect(r.wiki.getTiddler(SHADOW_STAMP("Solo"))).toBeUndefined();
    expect(renderSegment(r, "Solo")).not.toContain("local draft over shared");
  }, 120_000);

  test("RED 4: equal bodies clear the mark, and a discarded draft clears it too", async () => {
    const r = await stand();
    await r.canon.put({ tiddler: { title: "Item", text: "shared body" } }, remote);
    await r.working.put({ tiddler: { title: "Item", text: "my local body" } }, remote);
    await settle(r);
    expect(shadowed(r)).toContain("Item");
    await r.canon.put({ tiddler: { title: "Item", text: "my local body" } }, remote);
    await settle(r);
    expect(shadowed(r), "a re-lift makes the bodies equal").not.toContain("Item");
    expect(renderSegment(r, "Item")).not.toContain("local draft over shared");

    await r.canon.put({ tiddler: { title: "Item", text: "shared again" } }, remote);
    await settle(r);
    expect(shadowed(r)).toContain("Item");
    await r.working.tombstone("Item", remote);
    await settle(r);
    expect(shadowed(r), "a discarded draft clears it").not.toContain("Item");
    expect(workingBag).toBeTruthy();
  }, 120_000);
});
