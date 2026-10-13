/**
 * A VANISHED FILE STANDS AS A PENDING REMOVAL.
 *
 * A person deletes a carrier's file by hand. The bytes cannot say whether that names a delete, a branch
 * switch, a checkout or a slip, so the vessel decides nothing: the projector writes no file back, nothing
 * tombstones the records, and one alert per bag names how many carriers stand pending. The person
 * answers: `remove` deletes the carrier in the wiki, `restore` writes the file back and pins the base.
 *
 * A mass vanish reads as ONE alert naming the count, pinned by the reconcile queue's own idle handshake:
 * no clock paces it. An answer over more than one carrier names the count its giver read.
 *
 * Controls: a path that never held a base takes its first projection; a file that returns by a hand clears
 * its pending removal with no answer; an answer whose count moved refuses and changes nothing.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { syncedTreeKey } from "../src/synced-tree.js";

describe.skipIf(coreBlobSkip)("a vanished file stands as a pending removal", () => {
  let rig: ShoreRig;
  let rendered: Map<string, string>;
  beforeAll(async () => {
    rig = await ShoreRig.stand(8);
    await rig.ingest();
    await rig.boot();
    await rig.rest();
    rendered = new Map(rig.uris.map((uri) => [uri, rig.read(uri)]));
  }, 300_000);
  afterAll(async () => { await rig?.close(); });

  const pendingNow = (): Array<{ bagId: string; uri: string }> => rig.projector.pendingRemovals().map(({ bagId, uri }) => ({ bagId, uri }));

  test("a file a hand deleted while the vessel rested stays gone at the next boot, the records stay, and one alert names it", async () => {
    const uri = rig.uris[0]!;
    rig.remove(uri);
    await rig.boot();

    expect(rig.stands(uri)).toBe(false);
    expect(rig.titlesOf(uri).length).toBeGreaterThan(0);
    expect(await rig.store.get(uri)).not.toBeNull();
    expect(pendingNow()).toEqual([{ bagId: RIG_BAG, uri }]);
    expect(rig.pendings).toHaveLength(1);
    expect(rig.pendings[0]).toMatchObject({ bagId: RIG_BAG, count: 1, uris: [uri] });
    expect(rig.conflicts).toEqual([]);
    // The base stays: the agreement the file left still names what it held.
    expect(rig.tree.base(syncedTreeKey(RIG_BAG, uri))).not.toBeNull();
  });

  test("a later record change leaves the vanished file pending: a new render gives no leave to write it back", async () => {
    const uri = rig.uris[0]!;
    const wiki = (rig.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } } }).wiki;
    const slot = rig.titlesOf(uri).find((t) => t !== uri && typeof wiki.getTiddler(t).fields["text"] === "string")!;
    await rig.save(slot, `${String(wiki.getTiddler(slot).fields["text"])}\nA LATER SAVE IN THE WIKI.\n`);
    expect(rig.stands(uri)).toBe(false);
    expect(pendingNow()).toEqual([{ bagId: RIG_BAG, uri }]);
    expect(rig.pendings).toHaveLength(1);
  });

  test("answer RESTORE: the projector writes the records' render back, pins the base, and the alert clears", async () => {
    const uri = rig.uris[0]!;
    const key = rig.pendings[0]!["key"];
    const answer = await rig.projector.answerRemovals("restore", RIG_BAG, { uris: [uri] });
    expect(answer).toMatchObject({ ok: true, done: [uri] });
    expect(rig.stands(uri)).toBe(true);
    expect(rig.read(uri)).toContain("A LATER SAVE IN THE WIKI.");
    expect(pendingNow()).toEqual([]);
    expect(rig.pendingsResolved).toEqual([{ bagId: RIG_BAG, key }]);
    const base = rig.tree.base(syncedTreeKey(RIG_BAG, uri))!;
    expect(base.disk).toBe(base.records);
    await rig.rest();
  });

  test("answer REMOVE: the carrier leaves the wiki by a hand's delete, the file stays gone, and the alert clears", async () => {
    const uri = rig.uris[1]!;
    rig.remove(uri);
    await rig.boot();
    expect(pendingNow()).toEqual([{ bagId: RIG_BAG, uri }]);
    const raised = rig.pendings.at(-1)!;

    const answer = await rig.projector.answerRemovals("remove", RIG_BAG, { uris: [uri] });
    expect(answer).toMatchObject({ ok: true, done: [uri] });
    expect(rig.removed).toEqual([uri]);
    expect(rig.titlesOf(uri)).toEqual([]);
    expect(rig.stands(uri)).toBe(false);
    expect(pendingNow()).toEqual([]);
    expect(rig.pendingsResolved.at(-1)).toEqual({ bagId: RIG_BAG, key: raised["key"] });
    // A boot after the removal landed finds nothing to write and nothing pending.
    await rig.rest();
    await rig.boot();
    expect(rig.stands(uri)).toBe(false);
    expect(pendingNow()).toEqual([]);
    await rig.rest();
  });

  test("a mass vanish reads as ONE alert naming the count; nothing writes back and nothing tombstones", async () => {
    const gone = rig.uris.slice(2, 7);
    for (const uri of gone) rig.remove(uri);
    const raisedBefore = rig.pendings.length;
    const live = (await rig.store.listVisible()).length;

    await rig.boot();

    expect(rig.pendings.length).toBe(raisedBefore + 1);
    expect(rig.pendings.at(-1)).toMatchObject({ bagId: RIG_BAG, count: 5 });
    for (const uri of gone) expect(rig.stands(uri)).toBe(false);
    expect((await rig.store.listVisible()).length).toBe(live);
    expect(new Set(pendingNow().map((p) => p.uri))).toEqual(new Set(gone));
  });

  test("an answer over many names the count its giver read: a count that moved refuses and changes nothing", async () => {
    const gone = rig.uris.slice(2, 7);
    for (const wrong of [undefined, 4, 6]) {
      const refused = await rig.projector.answerRemovals("restore", RIG_BAG, { all: true, ...(wrong !== undefined ? { count: wrong } : {}) });
      expect(refused).toMatchObject({ ok: false, refusal: "pending-count-moved", count: 5 });
    }
    expect(await rig.projector.answerRemovals("remove", RIG_BAG, { uris: gone.slice(0, 2), count: 2 })).toMatchObject({ ok: false, refusal: "pending-count-moved", count: 5 });
    expect(await rig.projector.answerRemovals("restore", RIG_BAG, { uris: [rig.uris[7]!] })).toMatchObject({ ok: false, refusal: "not-pending" });
    for (const uri of gone) expect(rig.stands(uri)).toBe(false);
    expect(rig.removed).toEqual([rig.uris[1]]);
  });

  test("a file that returns by a hand clears its pending removal with no answer", async () => {
    const back = rig.uris[2]!;
    rig.write(back, rendered.get(back)!);
    await rig.projector.sense([back]);
    expect(pendingNow().map((p) => p.uri)).not.toContain(back);
    expect(rig.pendings.at(-1)).toMatchObject({ bagId: RIG_BAG, count: 4 });
    expect(rig.read(back)).toBe(rendered.get(back));
  });

  test("answer RESTORE over all, under the count that stands: every file returns and the alert clears", async () => {
    const answer = await rig.projector.answerRemovals("restore", RIG_BAG, { all: true, count: 4 });
    expect(answer).toMatchObject({ ok: true });
    for (const uri of rig.uris.slice(3, 7)) expect(rig.read(uri)).toBe(rendered.get(uri));
    expect(pendingNow()).toEqual([]);
    expect(rig.pendingsResolved.at(-1)).toEqual({ bagId: RIG_BAG, key: rig.pendings.at(-1)!["key"] });
    await rig.rest();
  });

  test("CONTROL: a path that never held a base takes its first projection", async () => {
    const uri = rig.uris[7]!;
    rig.remove(uri);
    const raised = rig.pendings.length;
    await rig.boot({ freshTree: true });
    expect(rig.read(uri)).toBe(rendered.get(uri));
    expect(rig.pendings.length).toBe(raised);
    expect(pendingNow()).toEqual([]);
    await rig.rest();
  });
});
