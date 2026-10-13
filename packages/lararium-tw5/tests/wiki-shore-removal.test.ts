/**
 * A HAND'S REMOVAL THAT MEETS A PEER'S EDIT SURFACES AT THE WIKI.
 *
 * A hand removes a field of X while a peer's edit of that same field lands. The store keeps the peer's
 * value live and raises the hand's record, without the field, as a parallel draft (`removal-surfaces` in
 * mesh pins the store). The wiki shore keeps that draft in the draft layer, where it stands beside the
 * live record until a person settles it; no edit vanishes.
 *
 * Control: the same removal with no peer edit of that field lands clean and keeps no draft.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { ManualTimers, afterDispatch, draftBag, peerWrite, shoreRig, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

const remote = { kind: "crdt-remote", edgeIsland: "seed" } as const;
const kept = (r: Rig, target: string): Array<Record<string, unknown>> =>
  Object.values(r.doc(draftBag).tiddlers).filter((rec) => !rec.meta?.deleted && rec.tiddler["draft.of"] === target).map((rec) => rec.tiddler as Record<string, unknown>);

async function stage(title: string): Promise<{ r: Rig; timers: ManualTimers }> {
  const timers = new ManualTimers();
  const r = await shoreRig({ timers });
  await r.working.put({ tiddler: { title, text: "body", caption: "base caption" } }, remote);
  await turns(16);
  await r.adaptor.armSeedCheckpoint();
  await r.adaptor.landingIdle();
  return { r, timers };
}

/** The hand rewrites X without its caption: one `addTiddler` of the standing fields less that field. */
function removeCaption(r: Rig, title: string): void {
  const { caption: _gone, ...rest } = r.wiki.getTiddler(title)!.fields;
  r.wiki.addTiddler(new r.Tiddler(rest));
}

describe.skipIf(wikiSkip)(`a hand's removal meets a peer's edit${skipNote}`, () => {
  test("the peer's value stays live, and the hand's record without the field stands as a kept draft", async () => {
    const x = "lar:///t/removal/meets-edit";
    const { r, timers } = await stage(x);
    removeCaption(r, x);
    await afterDispatch();
    // The peer's edit of the same field lands while the hand still waits in its window.
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "body", caption: "peer caption" } }]);
    timers.fireAll(400);
    await turns(32);
    await r.adaptor.landingIdle();
    await turns(16);

    expect(r.doc(workingBag).tiddlers[x]!.tiddler["caption"], "the store keeps the peer's value").toBe("peer caption");
    expect(r.wiki.getTiddler(x)!.fields["caption"], "the wiki shows the merged record").toBe("peer caption");
    const drafts = kept(r, x);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!["lar-conflict-removed"]).toBe("caption");
    expect("caption" in drafts[0]!).toBe(false);
    expect(drafts[0]!["text"]).toBe("body");
    await r.stop();
  }, 120_000);

  test("CONTROL: the same removal beside a peer's edit of another field lands clean", async () => {
    const x = "lar:///t/removal/clean";
    const { r, timers } = await stage(x);
    removeCaption(r, x);
    await afterDispatch();
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "peer body", caption: "base caption" } }]);
    timers.fireAll(400);
    await turns(32);
    await r.adaptor.landingIdle();
    await turns(16);

    const stored = r.doc(workingBag).tiddlers[x]!.tiddler;
    expect("caption" in stored, "the removal landed").toBe(false);
    expect(stored["text"]).toBe("peer body");
    expect(kept(r, x)).toEqual([]);
    await r.stop();
  }, 120_000);
});
