/**
 * THE SAVE PROBE (`IslandAdaptor.saveBagOf`): where a hand's save of a title would land, asked without raising anything.
 * A writer that lands words on a person's behalf (the stand-off keeper) asks it first and writes only where the save lands
 * in the bag it means.
 *
 *   - A title living in the floor's canon layer saves into the working layer above it, never into canon: a landing meant
 *     for canon would land elsewhere, and the probe says so.
 *   - A title the cascade routes to no layer answers null, and the probe raises no alert on the rail.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { canonBag, peerWrite, shoreRig, turns, workingBag } from "./wiki-shore-rig.js";

describe.skipIf(wikiSkip)(`the wiki shore's save probe${skipNote}`, () => {
  test("a title living in canon saves into the working layer; the probe names that layer, never canon", async () => {
    const r = await shoreRig();
    const x = "lar:///t/probe/lives-in-canon";
    await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon words" } }]);
    await turns(16);
    expect(r.adaptor.saveBagOf(x)).toBe(workingBag);
    expect(r.adaptor.saveBagOf(x)).not.toBe(canonBag);
    await r.stop();
  }, 120_000);

  test("a title no layer takes answers null, and the probe stands no alert", async () => {
    const r = await shoreRig();
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: "" }));
    await turns(16);
    // The pointer's own write rides the bridge as a hand (TW5 saves a write made after its syncer stands), and with the pointer empty
    // that save raises the unrouted alert itself. Clear it, then probe synchronously: the probe alone raises nothing.
    const alert = unroutedSaveAlertTitle("lar:///ha.ka.ba/lararium/config/current-wiki-bag");
    if (r.wiki.getTiddler(alert)) r.wiki.deleteTiddler(alert);
    expect(r.adaptor.saveBagOf("lar:///t/probe/unroutable")).toBeNull();
    expect(r.wiki.getTiddler(alert)).toBeUndefined();
    await r.stop();
  }, 120_000);
});
