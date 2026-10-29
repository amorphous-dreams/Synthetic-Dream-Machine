/**
 * The shore's bookkeeping at its edges: a refused act stays owed until a later try lands it, a noop write
 * marks nothing ahead of the ledger, one dispatch writes a target once, a stopped shore holds no account of
 * the wiki and lands nothing, and a hand's next write builds on its own last write.
 */
import { describe, expect, test, vi } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import {
  afterDispatch, arrived, draftBag, ManualBoundary, openDraft, peerWrite, remote, saveSequence, shoreRig, storeDeleted,
  storeText, turns, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const seed = async (r: Rig, records: ReadonlyArray<Record<string, unknown>>): Promise<void> => {
  const before = r.arrivals.length;
  for (const tiddler of records) await r.working.put({ tiddler: tiddler as never }, remote);
  await arrived(r, before, records.map((tiddler) => String(tiddler["title"])));
  await r.adaptor.armSeedCheckpoint();
  await r.adaptor.landingIdle();
};
/** The boundary leaves the hands; `echoes` names the titles the store takes as a change, and the store's own event for each ends the wait. */
const landDraft = async (r: Rig, boundary: ManualBoundary, echoes: readonly string[] = []): Promise<void> => {
  const before = r.arrivals.length;
  await afterDispatch();
  boundary.fire();
  await arrived(r, before, echoes);
  await r.adaptor.landingIdle();
};

describe.skipIf(wikiSkip)(`wiki shore residue${skipNote}`, () => {
  test("a save act the store refused stays owed, draft tombstone included, and the teardown lands all of it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/residue/refused-act";
    await seed(r, [{ title: x, text: "landed" }]);
    const d = openDraft(r, x, "hand value");
    await landDraft(r, boundary, [d]);
    expect(storeText(r, draftBag, d), "the draft reached the store").toBe("hand value");
    r.failures.family = new Error("refused");
    saveSequence(r, d);
    await afterDispatch();
    await turns(24);
    expect(storeText(r, workingBag, x), "the refused save wrote nothing").toBe("landed");
    expect(storeDeleted(r, draftBag, d), "the refused tombstone wrote nothing").toBe(false);
    expect(r.adaptor.holdsHand(x)).toBe(true);
    expect(r.adaptor.holdsHand(d), "the draft's tombstone stays owed").toBe(true);
    r.failures.family = null;
    await r.stop();
    expect(storeText(r, workingBag, x), "the teardown lands the owed save").toBe("hand value");
    expect(storeDeleted(r, draftBag, d), "and the owed draft tombstone").toBe(true);
  }, 120_000);

  test("a write the store takes as a noop marks nothing ahead of the ledger", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/residue/noop";
    const control = "lar:///t/residue/noop-control";
    await seed(r, [{ title: x, text: "landed" }, { title: control, text: "landed" }]);
    const unlanded = (r.adaptor as unknown as { unlanded: Set<string> }).unlanded;
    const changes = r.changes(workingBag);
    // A field the shore never persists on a non-draft: the wiki differs from the landed value, the store record does not.
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { "lar-draft-base-bag": "never persisted" }));
    await landDraft(r, boundary);
    expect(r.changes(workingBag), "the store took the write as a noop").toBe(changes);
    expect(unlanded.has(x), "no wave will come to clear a mark, so none stands").toBe(false);
    // CONTROL: an acknowledged write stands ahead of the ledger until its wave lands, and the wave clears it.
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(control)!.fields, { text: "changed" }));
    await landDraft(r, boundary, [control]);
    expect(r.changes(workingBag)).toBe(changes + 1);
    expect(unlanded.has(control)).toBe(false);
    expect(r.adaptor.ledger.landedOf(control)!.tiddler).toBe(r.wiki.getTiddler(control));
    await r.stop();
  }, 120_000);

  test("two drafts of one target leaving in one dispatch write the target once", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/residue/two-drafts";
    await seed(r, [{ title: x, text: "landed" }]);
    const d1 = openDraft(r, x, "first draft");
    const d2 = "Draft 2 of 'two-drafts'";
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { title: d2, "draft.of": x, "draft.title": x, text: "second draft" }));
    await landDraft(r, boundary, [d1, d2]);
    const mark = r.calls.length;
    // One dispatch: the target written from the second draft, both drafts gone.
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(d2)!.fields, { title: x, "draft.of": undefined, "draft.title": undefined }));
    r.wiki.deleteTiddler(d1);
    r.wiki.deleteTiddler(d2);
    await afterDispatch();
    await turns(24);
    await r.adaptor.landingIdle();
    const issued = r.calls.slice(mark);
    expect(issued.filter((c) => c.puts.includes(x)), "one write of the target").toHaveLength(1);
    expect(storeText(r, workingBag, x)).toBe("second draft");
    expect(storeDeleted(r, draftBag, d1)).toBe(true);
    expect(storeDeleted(r, draftBag, d2)).toBe(true);
    await r.stop();
  }, 120_000);

  test("a stopped shore holds no account of the wiki and turns resident again at its own seed checkpoint", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/residue/restart";
    await seed(r, [{ title: x, text: "landed" }]);
    expect(r.adaptor.isResident()).toBe(true);
    expect(r.adaptor.ledger.landedOf(x)).toBeDefined();
    r.unbridge();
    await r.adaptor.stop();
    expect(r.adaptor.isResident(), "a stopped shore stands non-resident").toBe(false);
    expect(r.adaptor.ledger.landedOf(x), "and keeps no landed value").toBeUndefined();
    // The restart seeds afresh: the ledger fills from the replay and the shore turns resident at its checkpoint.
    r.adaptor.installLandingQueue();
    r.adaptor.start();
    r.working.emitInitialReplay();
    await r.adaptor.armSeedCheckpoint();
    expect(r.adaptor.isResident()).toBe(true);
    expect(r.adaptor.ledger.landedOf(x)!.tiddler).toBe(r.wiki.getTiddler(x));
    await r.adaptor.stop();
    await r.repo.shutdown();
  }, 120_000);

  test("a wave whose composition read answers after the shore stopped lands nothing", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/residue/stopped-landing";
    const control = "lar:///t/residue/stopped-landing-control";
    await seed(r, [{ title: control, text: "landed while standing" }]);
    expect(r.wiki.getTiddler(control), "CONTROL: a standing shore lands the wave").toBeDefined();
    const resolve = r.composite.resolveLayered.bind(r.composite);
    let release!: () => void;
    const held = new Promise<void>((done) => { release = done; });
    let asked!: () => void;
    const reading = new Promise<void>((done) => { asked = done; });
    vi.spyOn(r.composite, "resolveLayered").mockImplementation(async (title) => {
      if (title === x) { asked(); await held; }
      return resolve(title);
    });
    await r.working.put({ tiddler: { title: x, text: "arrives during the stop" } }, remote);
    await reading;
    r.unbridge();
    const stopping = r.adaptor.stop();
    release();
    await stopping;
    expect(r.wiki.getTiddler(x), "the stopped shore applies nothing").toBeUndefined();
    await r.repo.shutdown();
  }, 120_000);

  test("a hand's next write builds on its own last write, never on the merged heads", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    let release!: () => void;
    const held = new Promise<void>((done) => { release = done; });
    const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/residue/own-base";
    await seed(r, [{ title: x, text: "landed", note: "n0" }]);
    const landedHeads = r.adaptor.ledger.landedOf(x)!.heads!;
    // A peer's change of another field stands in the store while its wave waits in the queue.
    hold = true;
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "landed", note: "peer" } }]);
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "hand one" }));
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const merged = [...(r.working.headsNow() ?? [])].sort();
    expect(merged, "the hand's change stands concurrent with the peer's").toHaveLength(2);
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "hand two" }));
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const writes = r.calls.slice(mark).filter((c) => c.puts.includes(x));
    expect(writes).toHaveLength(2);
    expect(writes[0]!.base, "the first write builds on the landed heads").toEqual(landedHeads);
    expect(writes[1]!.base, "the second builds on the first write alone").toHaveLength(1);
    expect(merged).toContain(writes[1]!.base![0]);
    expect([...writes[1]!.base!].sort(), "never on the merged heads").not.toEqual(merged);
    hold = false;
    release();
    await turns(24);
    await r.adaptor.landingIdle();
    const stored = r.doc(workingBag).tiddlers[x]!.tiddler;
    expect({ text: stored.text, note: stored.note }, "both actors' fields stand").toEqual({ text: "hand two", note: "peer" });
    await r.stop();
  }, 120_000);
});
