/**
 * THE ONE-TOP WIKI'S SAVE. The daemon wiki mounts one writable top (`wikis/daemon/working`, `attachDaemonWorking`) and no
 * draft slot, while the shipped cascade still routes a `draft.of` tiddler through `current-wiki-draft`. TiddlyWiki's
 * new-tiddler cycle writes the draft first (its save refuses `unrouted-save: a bag this wiki does not mount`), then saves:
 * one dispatch deleting the draft and adding the target. The target's own route names the working layer, so it MUST
 * land there: a hand's words never vanish for want of a draft slot. The stage walk (lararium-web e2e/stage-walk, S3-S4)
 * authors into the daemon surface and proposes the draft it saved; `kahua-proposal-no-draft` named this hole.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { afterDispatch, draftBag, ManualBoundary, openDraft, saveSequence, shoreRig, storeText, turns, typeInto, workingBag } from "./wiki-shore-rig.js";

const POINTER_DRAFT = "lar:///ha.ka.ba/lararium/config/current-wiki-draft";

/** TiddlyWiki's new-tiddler cycle: a draft of `New Tiddler`, retitled while open, then saved under the new title. */
async function newTiddlerCycle(r: Awaited<ReturnType<typeof shoreRig>>, boundary: ManualBoundary, title: string, text: string): Promise<void> {
  const d = openDraft(r, "New Tiddler", "");
  await afterDispatch();
  typeInto(r, d, text, { "draft.title": title });
  await afterDispatch();
  boundary.fire();
  await turns(16);
  saveSequence(r, d);
  await afterDispatch();
  boundary.fire();
  await turns(24);
}

describe.skipIf(wikiSkip)(`a wiki with one writable top saves a new tiddler${skipNote}`, () => {
  test("RED: with no draft slot mounted, the draft refuses by name and the saved target still lands in working", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, noDraft: true });
    await r.adaptor.armSeedCheckpoint();
    await newTiddlerCycle(r, boundary, "L4/page-new", "NEW FROM THE PAGE");
    expect(r.wiki.getTiddler(unroutedSaveAlertTitle(POINTER_DRAFT)), "the draft's refusal names the draft pointer on the alert rail").toBeDefined();
    expect(r.wiki.getTiddler("L4/page-new")?.fields["text"]).toBe("NEW FROM THE PAGE");
    expect(storeText(r, workingBag, "L4/page-new"), "the saved target never reached the working layer").toBe("NEW FROM THE PAGE");
    expect((await r.composite.resolveLayered("L4/page-new"))?.bagId).toBe(workingBag);
  });

  test("CONTROL: with the draft slot mounted the save act lands the target in working and tombstones the draft", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    await r.adaptor.armSeedCheckpoint();
    await newTiddlerCycle(r, boundary, "L4/page-new", "NEW FROM THE PAGE");
    expect(storeText(r, workingBag, "L4/page-new")).toBe("NEW FROM THE PAGE");
    expect(r.doc(draftBag).tiddlers["Draft of 'New Tiddler'"]?.meta?.deleted).toBe(true);
    expect(r.wiki.getTiddler(unroutedSaveAlertTitle(POINTER_DRAFT))).toBeUndefined();
  });
});
