/**
 * A WIKI'S HAND MEETS A RETIRED BAG.
 *
 * DROP retires a bag by its marker (`<bag>/ledger/residency/retired`), and a retired bag takes no landing
 * (action-handler#/retired). A wiki island's save and its delete (the delete `lares shore remove` makes)
 * reach the bag through the composite's write door, never the residency verbs' gate. Against a working
 * layer DROP retired, the save and the delete each refuse by name (`bag-retired`): nothing lands, the
 * refusal stands on the alert rail, the page keeps the person's words and the hand stays owed.
 *
 * Control: the same save into a working layer no DROP retired lands.
 */
import { describe, expect, test } from "vitest";
import { buildEffectRecordTiddler, RETIRED_EVENT_ID, type ChangeOrigin } from "@lararium/mesh";
import { unsavedHandAlertTitle } from "../src/island-adaptor.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualTimers, shoreRig, storeDeleted, storeText, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

const SAVED = "lar:///t/retired/saved";
const KEPT = "lar:///t/retired/kept";
const hand = async (r: Rig, timers: ManualTimers): Promise<void> => {
  await afterDispatch();
  timers.fireAll(400);
  await turns(48);
  await r.adaptor.landingIdle();
};
const end = async (r: Rig): Promise<void> => { r.unbridge(); await r.adaptor.stop().catch(() => undefined); await r.repo.shutdown(); };
const retire = async (r: Rig): Promise<void> => {
  await r.working.put(buildEffectRecordTiddler({
    eventId: RETIRED_EVENT_ID, archivalVerb: "disposition", actionVerb: "DROP", requestId: "req-drop",
    bag: workingBag, actor: "did:test", timestamp: "0", disposition: "bag-retired",
  }), { kind: "lares-verb", requestId: "req-drop" } as ChangeOrigin);
};

describe.skipIf(wikiSkip)(`a wiki's hand meets a retired bag${skipNote}`, () => {
  test("RED: a save and a delete into a retired working layer refuse by name, land nothing and stay owed", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    r.wiki.addTiddler(new r.Tiddler({ title: KEPT, text: "kept" }));
    await hand(r, timers);
    expect(storeText(r, workingBag, KEPT), "setup: the title landed before DROP").toBe("kept");

    await retire(r);
    r.wiki.addTiddler(new r.Tiddler({ title: SAVED, text: "a save after DROP" }));
    r.wiki.deleteTiddler(KEPT);
    await hand(r, timers);

    expect(storeText(r, workingBag, SAVED), "nothing lands in the retired bag").toBeUndefined();
    expect(storeDeleted(r, workingBag, KEPT), "no tombstone lands in the retired bag").toBe(false);
    for (const title of [SAVED, KEPT]) {
      const alert = r.wiki.getTiddler(unsavedHandAlertTitle(title));
      expect(alert, `the refusal of ${title} stands on the alert rail`).toBeDefined();
      expect(String(alert!.fields.error)).toContain("stands retired");
      expect(r.adaptor.holdsHand(title), `${title} stays owed`).toBe(true);
    }
    expect(r.wiki.getTiddler(SAVED)!.fields.text, "the page keeps what the person wrote").toBe("a save after DROP");
    await end(r);
  }, 120_000);

  test("CONTROL: the same save into a working layer no DROP retired lands", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    r.wiki.addTiddler(new r.Tiddler({ title: SAVED, text: "a save" }));
    await hand(r, timers);
    expect(storeText(r, workingBag, SAVED)).toBe("a save");
    expect(r.wiki.getTiddler(unsavedHandAlertTitle(SAVED))).toBeUndefined();
    await end(r);
  }, 120_000);
});
