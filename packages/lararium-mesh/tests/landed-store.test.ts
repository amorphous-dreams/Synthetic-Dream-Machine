import { afterEach, describe, expect, test, vi } from "vitest";
import { encodeHeads, Repo } from "@automerge/automerge-repo";
import { getAllChanges, getConflicts, save } from "@automerge/automerge";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { draftsOffLive } from "../src/parallel-drafts.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

const origin: ChangeOrigin = { kind: "tw-local", instanceId: "landed" };
const TITLE = "lar:///landed/X";
const record = (tiddler: LarTiddlerRecord["tiddler"], meta?: LarTiddlerRecord["meta"]): LarTiddlerRecord => ({ tiddler, ...(meta ? { meta } : {}) });

function newStore(bag = "bag-landed") {
  const repo = new Repo({ network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  return { handle, store: new AutomergeDocStore(handle, bag) };
}

afterEach(() => vi.useRealTimers());

describe("landed store laws", () => {
  test("B-store: content equality ignores metadata; metadata omission preserves it; moved content writes once", async () => {
    const { handle, store } = newStore();
    await store.put(record({ title: TITLE, text: "same", "$origin-bag": "origin-stamp" }, { changeId: "first" }), origin);
    const before = getAllChanges(handle.doc()!).length;
    const heads = await store.getHeads();
    let fanout = 0;
    store.subscribe(() => fanout++);

    await store.put(record({ title: TITLE, text: "same" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(0);
    expect(await store.getHeads()).toEqual(heads);
    expect((await store.get(TITLE))?.meta?.changeId).toBe("first");
    expect((await store.get(TITLE))?.tiddler["$origin-bag"]).toBe("origin-stamp");
    expect(fanout).toBe(0);

    await store.put(record({ title: TITLE, text: "same" }, { changeId: "second" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(0);
    expect((await store.get(TITLE))?.meta?.changeId).toBe("first");
    expect((await store.get(TITLE))?.tiddler["$origin-bag"]).toBe("origin-stamp");

    await store.put(record({ title: TITLE, text: "moved" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(1);
    expect((await store.get(TITLE))?.meta?.changeId).toBe("first");
    expect(fanout).toBe(1);

    await store.put(record({ title: TITLE, text: "moved-with-meta" }, { changeId: "replacement" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(2);
    expect((await store.get(TITLE))?.meta?.changeId).toBe("replacement");
    expect(fanout).toBe(2);
  });

  test("direct, replay, tombstone, and remove envelopes carry the matching bag heads and record", async () => {
    const { store } = newStore("bag-envelopes");
    const seen: any[] = [];
    store.subscribe((change) => seen.push(change));
    await store.put(record({ title: TITLE, text: "one" }), origin);
    await store.tombstone(TITLE, origin);
    await store.remove(TITLE, origin);
    expect(seen).toHaveLength(3);
    expect(seen[0].record.tiddler.text).toBe("one");
    expect(seen[1].record.meta.deleted).toBe(true);
    expect(seen[2].record).toBeNull();
    expect(seen.every((change) => change.bag === "bag-envelopes" && change.heads?.length)).toBe(true);
    seen.length = 0;
    await store.put(record({ title: `${TITLE}/replay`, text: "replay" }), origin);
    seen.length = 0;
    store.emitInitialReplay();
    expect(seen).toHaveLength(1);
    expect(seen[0].record.tiddler.text).toBe("replay");
    expect(seen[0].bag).toBe("bag-envelopes");
    expect(seen[0].heads).toEqual(store.headsNow());
  });

  test("N-store: TW5 field strings with long dates and spaced list values round-trip byte exact and noop", async () => {
    const { handle, store } = newStore();
    const fields = {
      title: TITLE,
      created: "20261012010203004",
      modified: "20261012010203004",
      tags: "[[two words]] single",
      list: "[[two words]] single",
      text: "body",
    };
    await store.put(record(fields), origin);
    const first = await store.get(TITLE);
    const before = getAllChanges(handle.doc()!).length;
    await store.put(record(first!.tiddler), origin);
    expect((await store.get(TITLE))?.tiddler).toEqual(fields);
    expect(getAllChanges(handle.doc()!).length - before).toBe(0);

    await store.put(record({ ...fields, modified: "20261012010203005" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(1);
  });

  test("A2-store: a bulk changeset carries twelve complete bag and heads envelopes", async () => {
    vi.useFakeTimers();
    const { handle, store } = newStore("bag-a2");
    const calls: Array<readonly any[]> = [];
    const singles: any[] = [];
    store.addProjection({ onUriChanged(change) { singles.push(change); }, onChangeset(changes) { calls.push(changes); } });
    handle.change((doc) => {
      for (let i = 0; i < 12; i++) doc.tiddlers[`lar:///landed/${i}`] = { tiddler: { title: `lar:///landed/${i}`, text: `v${i}` } };
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(12);
    expect(calls[0]!.every((change) => change.bag === "bag-a2" && change.heads?.length && change.record?.tiddler.text)).toBe(true);
    expect(calls[0]!.every((change) => change.origin.kind === "crdt-remote")).toBe(true);
    expect(calls[0]!.every((change) => JSON.stringify(change.record) === JSON.stringify(store.getAt(change.title, change.heads!)))).toBe(true);

    handle.change((doc) => {
      for (let i = 0; i < 9; i++) doc.tiddlers[`lar:///landed/small-${i}`] = { tiddler: { title: `lar:///landed/small-${i}`, text: `s${i}` } };
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(singles).toHaveLength(9);
    expect(singles.every((change) => change.bag === "bag-a2" && change.heads?.length && change.record)).toBe(true);
  });

  test("H-store: a based same-field write surfaces both values; a different-field write merges clean", async () => {
    const repo = new Repo({ network: [] });
    const ha = repo.create<LarDoc>(emptyLarDoc());
    const hb = repo.clone(ha);
    const a = new AutomergeDocStore(ha, "bag-h");
    const b = new AutomergeDocStore(hb, "bag-h");
    await a.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    hb.merge(ha);
    const base = await a.getHeads();

    await b.put(record({ title: TITLE, text: "remote", tags: "base" }), origin);
    ha.merge(hb);
    const remoteHeads = await a.getHeads();
    const seen: any[] = [];
    a.onParallelDrafts((change) => seen.push(...change.drafts));
    await a.put(record({ title: TITLE, text: "local", tags: "base" }), origin, { base } as any);
    expect(a.parallelDrafts(TITLE).map((draft) => draft.tiddler.text).sort()).toEqual(["local", "remote"]);
    expect(seen.map((draft) => draft.tiddler.text).sort()).toEqual(["local", "remote"]);

    const cleanRepo = new Repo({ network: [] });
    const cleanHa = cleanRepo.create<LarDoc>(emptyLarDoc());
    const cleanHb = cleanRepo.clone(cleanHa);
    const cleanA = new AutomergeDocStore(cleanHa, "bag-h-clean");
    const cleanB = new AutomergeDocStore(cleanHb, "bag-h-clean");
    await cleanA.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    cleanHb.merge(cleanHa);
    const cleanBaseHeads = (await cleanA.getHeads())!;
    const cleanSeen: any[] = [];
    cleanA.onParallelDrafts((change) => cleanSeen.push(...change.drafts));
    await cleanB.put(record({ title: TITLE, text: "remote", tags: "base" }), origin);
    cleanHa.merge(cleanHb);
    await cleanA.put(record({ title: TITLE, text: "base", tags: "local-tags" }), origin, { base: cleanBaseHeads } as any);
    expect((await cleanA.get(TITLE))?.tiddler.text).toBe("remote");
    expect((await cleanA.get(TITLE))?.tiddler.tags).toBe("local-tags");
    expect(cleanA.parallelDrafts(TITLE)).toEqual([]);
    expect(cleanSeen).toEqual([]);

    const equalHeads = await cleanA.getHeads();
    const beforeEqualHeadWrite = getAllChanges(cleanHa.doc()!).length;
    await cleanA.put(record({ title: TITLE, text: "remote", tags: "equal-head-write" }), origin, { base: equalHeads } as any);
    expect(getAllChanges(cleanHa.doc()!).length - beforeEqualHeadWrite).toBe(1);
    expect(cleanA.parallelDrafts(TITLE)).toEqual([]);

    expect(remoteHeads).not.toEqual(base);
  });

  test("writtenAt: a run of based writes from one hand never conflicts with itself, and an unseen remote edit stays concurrent with all of it", async () => {
    const repo = new Repo({ network: [] });
    const ha = repo.create<LarDoc>(emptyLarDoc());
    const hb = repo.clone(ha);
    const a = new AutomergeDocStore(ha, "bag-run");
    const b = new AutomergeDocStore(hb, "bag-run");
    await a.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    hb.merge(ha);
    const h0 = (await a.getHeads())!;

    // The remote edit lands in the doc; the hand has not seen it (its base stays h0).
    await b.put(record({ title: TITLE, text: "base", tags: "remote-tags" }), origin);
    ha.merge(hb);

    const own: Array<readonly string[] | undefined> = [];
    a.subscribe((change) => { if (change.origin === origin && change.title === TITLE) own.push(change.writtenAt); });

    await a.put(record({ title: TITLE, text: "h", tags: "base" }), origin, { base: h0 } as any);
    expect(own).toHaveLength(1);
    expect(own[0]).toBeDefined();
    expect(own[0]).not.toEqual(await a.getHeads());          // the based change alone, never the merged heads
    await a.put(record({ title: TITLE, text: "he", tags: "base" }), origin, { base: own[0]! } as any);
    await a.put(record({ title: TITLE, text: "hey", tags: "base" }), origin, { base: own[1]! } as any);

    expect(a.parallelDrafts(TITLE)).toEqual([]);              // the run supersedes itself: no self-conflict
    expect((await a.get(TITLE))?.tiddler.text).toBe("hey");
    expect((await a.get(TITLE))?.tiddler.tags).toBe("remote-tags");   // the other-field remote edit merged clean

    // CONTROL: the same run built on the MERGED heads would have seen the remote value as its base and
    // written `tags: "base"` back over it.
    const repo2 = new Repo({ network: [] });
    const ca = repo2.create<LarDoc>(emptyLarDoc());
    const cb = repo2.clone(ca);
    const c = new AutomergeDocStore(ca, "bag-run-control");
    const d = new AutomergeDocStore(cb, "bag-run-control");
    await c.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    cb.merge(ca);
    const c0 = (await c.getHeads())!;
    await d.put(record({ title: TITLE, text: "base", tags: "remote-tags" }), origin);
    ca.merge(cb);
    await c.put(record({ title: TITLE, text: "h", tags: "base" }), origin, { base: c0 } as any);
    await c.put(record({ title: TITLE, text: "he", tags: "base" }), origin, { base: (await c.getHeads())! } as any);
    expect((await c.get(TITLE))?.tiddler.tags).toBe("base");

    // A plain write names the doc's own heads.
    own.length = 0;
    await a.put(record({ title: TITLE, text: "plain", tags: "remote-tags" }), origin);
    expect(own[0]).toEqual(await a.getHeads());
  });

  test("F1: based live and gone states remain competing drafts in either arrival order", async () => {
    async function drive(tombstoneFirst: boolean, metadataAtBase: boolean) {
      const liveRepo = new Repo({ network: [] });
      const liveHandle = liveRepo.create<LarDoc>(emptyLarDoc());
      await new AutomergeDocStore(liveHandle, "bag-f1").put(record({ title: TITLE, text: "base" }, metadataAtBase ? { changeId: "base" } : undefined), origin);
      const goneRepo = new Repo({ network: [] });
      const goneHandle = goneRepo.import<LarDoc>(save(liveHandle.doc()!));
      const liveStore = new AutomergeDocStore(liveHandle, "bag-f1");
      const goneStore = new AutomergeDocStore(goneHandle, "bag-f1");
      const base = (await liveStore.getHeads())!;
      const surfaced: LarTiddlerRecord[] = [];
      liveStore.onParallelDrafts((change) => surfaced.push(...change.drafts));
      if (tombstoneFirst) {
        await goneStore.tombstone(TITLE, origin, { base });
        liveHandle.merge(goneHandle);
        await liveStore.put(record({ title: TITLE, text: "hand" }), origin, { base });
      } else {
        await liveStore.put(record({ title: TITLE, text: "hand" }), origin, { base });
        goneHandle.merge(liveHandle);
        await goneStore.tombstone(TITLE, origin, { base });
        liveHandle.merge(goneHandle);
      }
      const drafts = liveStore.parallelDrafts(TITLE);
      expect(drafts).toHaveLength(2);
      expect(drafts.some((draft) => draft.tiddler.text === "hand" && draft.tiddler["lar-conflict-fields"] === "meta.deleted")).toBe(true);
      expect(drafts.some((draft) => draft.tiddler["lar-conflict-deleted"] === "yes" && draft.tiddler["lar-conflict-fields"] === "meta.deleted")).toBe(true);
      expect(draftsOffLive(drafts)).toHaveLength(1);
      expect(surfaced.length).toBeGreaterThanOrEqual(2);
    }
    await drive(true, true);
    await drive(false, true);
    await drive(true, false);
    await drive(false, false);

    const { handle, store } = newStore("bag-f1-control");
    await store.put(record({ title: TITLE, text: "before" }), origin);
    await store.tombstone(TITLE, origin);
    const before = getAllChanges(handle.doc()!).length;
    await store.put(record({ title: TITLE, text: "revived" }), origin);
    expect(getAllChanges(handle.doc()!).length - before).toBe(1);
    expect((await store.get(TITLE))?.meta?.deleted).toBe(false);
    expect(store.parallelDrafts(TITLE)).toEqual([]);
  });

  test("F4: an unknown requested base rejects without changing heads", async () => {
    const { store } = newStore("bag-f4");
    await store.put(record({ title: TITLE, text: "standing" }), origin);
    const heads = await store.getHeads();
    await expect(store.put(record({ title: TITLE, text: "unbased fallback" }), origin, { base: ["00".repeat(32)] })).rejects.toThrow(/base/i);
    expect(await store.getHeads()).toEqual(heads);
    expect((await store.get(TITLE))?.tiddler.text).toBe("standing");
  });

  test("H2-store: one actor's two based values become two drafts, and changeAt is probed after later ops", async () => {
    const { handle, store } = newStore("bag-h2");
    await store.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    const h0 = (await store.getHeads())!;
    await store.put(record({ title: TITLE, text: "h1", tags: "base" }), origin);
    await store.put(record({ title: TITLE, text: "h2", tags: "base" }), origin);
    const beforeProbe = await store.getHeads();
    let probeError: unknown;
    try {
      handle.changeAt(encodeHeads(h0 as string[]), (doc) => { doc.tiddlers[TITLE]!.tiddler.text = "probe-at-h0"; });
    } catch (error) { probeError = error; }
    const afterProbe = await store.getHeads();
    const conflicts = getConflicts(handle.doc()!.tiddlers[TITLE]!.tiddler as never, "text" as never);
    const drafts = store.parallelDrafts(TITLE);
    expect(probeError).toBeUndefined();
    expect(afterProbe).not.toEqual(beforeProbe);
    expect(Object.keys(conflicts ?? {})).toHaveLength(2);
    expect(drafts.map((d) => d.tiddler.text).sort()).toEqual(["h2", "probe-at-h0"]);

    const second = newStore("bag-h2-same");
    await second.store.put(record({ title: TITLE, text: "base", tags: "base" }), origin);
    const sameBase = (await second.store.getHeads())!;
    await second.store.put(record({ title: TITLE, text: "one", tags: "base" }), origin, { base: sameBase } as any);
    await second.store.put(record({ title: TITLE, text: "two", tags: "base" }), origin, { base: sameBase } as any);
    const sameBaseDrafts = second.store.parallelDrafts(TITLE);
    expect(sameBaseDrafts).toHaveLength(2);
    expect(sameBaseDrafts.map((d) => d.tiddler.text).sort()).toEqual(["one", "two"]);
    expect(new Set(sameBaseDrafts.map((d) => d.tiddler.title)).size).toBe(2);
    expect(sameBaseDrafts.every((d) => String(d.tiddler["lar-conflict-ops"]).split(" ").length === 1)).toBe(true);
  });

  test("M2-store: getAt reads the record as it stood at old heads", async () => {
    const { store } = newStore();
    await store.put(record({ title: TITLE, text: "old" }), origin);
    const base = (await store.getHeads())!;
    await store.put(record({ title: TITLE, text: "new" }), origin);
    expect((store as any).getAt(TITLE, base)?.tiddler.text).toBe("old");
    expect((await store.get(TITLE))?.tiddler.text).toBe("new");
  });
});
