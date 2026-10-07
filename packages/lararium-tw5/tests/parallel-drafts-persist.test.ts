/**
 * Q4 (operator ruling) — A SURFACED PARALLEL DRAFT PERSISTS INTO THE READING WIKI'S DRAFT BAG.
 *
 * Two actors set one field of a shared record concurrently. The merge keeps one value live and the
 * other only as a conflict op, which Automerge drops from `getConflicts` on the NEXT write to that
 * property. The reading wiki's island adaptor hears the surfacing (it registers on every layer as a
 * `ParallelDraftsReader`) and persists the draft carrying the value that does not read live into the
 * bag the cascade routes a `draft.of` tiddler to — the wiki's own draft bag — so a third write cannot
 * erase it. The live value stays the merge's own; nothing picks a winner.
 *
 * CONTROLS: with no concurrent write nothing persists; the live value is the merge's own, and the
 * persistence writes nothing into the shared bag.
 */
import { describe, test, expect } from "vitest";
import { afterEach } from "vitest";
import {
  AutomergeDocStore, CompositeStore, emptyLarDoc, makeIslandRepo, wikiSlotUri,
  type ChangeOrigin, type DocHandle, type LarDoc, type LarTiddlerChange, type LarTiddlerRecord,
} from "@lararium/mesh";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const TITLE = "lar:///t/story";
const SHARED = "lar:///ha.ka.ba/bags/shared";
const DRAFT = wikiSlotUri("test-wiki", "draft");
const WORKING = wikiSlotUri("test-wiki", "working");
const peerOrigin: ChangeOrigin = { kind: "tw-local", instanceId: "a-peer-editor" };

const rec = (text: string, modifier: string, modified: string): LarTiddlerRecord =>
  ({ tiddler: { title: TITLE, text, modifier, modified } });

/** The smallest TW5 the adaptor reads: the shipped cascade's draft and catch-all rules, by source. */
function fakeTw5() {
  const texts = new Map<string, string>([
    ["lar:///ha.ka.ba/lararium/config/bag-paths", [
      "[is[draft]then{lar:///ha.ka.ba/lararium/config/current-wiki-draft}]",
      "[prefix[lar:]then{lar:///ha.ka.ba/lararium/config/current-wiki-bag}]",
      "[regexp[.]then{lar:///ha.ka.ba/lararium/config/current-wiki-bag}]",
    ].join("\n")],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", DRAFT],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", WORKING],
  ]);
  const enqueued: LarTiddlerChange[] = [];
  class Tiddler {
    fields: Record<string, unknown>;
    constructor(fields: Record<string, unknown>) { this.fields = fields; }
    getFieldStrings(): Record<string, string> {
      return Object.fromEntries(Object.entries(this.fields).map(([k, v]) => [k, String(v)]));
    }
  }
  const wiki = {
    getTiddler: (_t: string) => undefined,
    getTiddlerText: (t: string, fallback?: string) => texts.get(t) ?? fallback ?? "",
    filterTiddlers: (filter: string, _w: unknown, source: unknown): string[] => {
      const m = /^\[(is|prefix|regexp)\[([^\]]*)\]then\{([^}]+)\}\]$/.exec(filter);
      if (!m) return [];
      let tiddler: unknown;
      let title = "";
      (source as (fn: (t: unknown, ti: string) => void) => void)((t, ti) => { tiddler = t; title = ti; });
      const fields = (tiddler as { fields?: Record<string, unknown> } | undefined)?.fields;
      const hit = m[1] === "is" ? m[2] === "draft" && fields !== undefined && "draft.of" in fields
                : m[1] === "prefix" ? title.startsWith(m[2]!)
                : new RegExp(m[2]!).test(title);
      return hit ? [texts.get(m[3]!) ?? ""] : [];
    },
  };
  const engine = {
    $tw: {
      Tiddler,
      wiki,
      lares: { enqueueNalu: (c: LarTiddlerChange) => { enqueued.push(c); }, isApplyingNalu: () => false },
    },
  } as unknown as TW5Engine;
  return { engine, enqueued };
}

/** Peer A's shared bag (mounted by the reading wiki), peer B's clone, and the wiki's own draft bag. */
const channels: MessageChannel[] = [];
afterEach(() => { for (const c of channels.splice(0)) { c.port1.close(); c.port2.close(); } });

function stand() {
  const channel = new MessageChannel();
  channels.push(channel);
  const repo = makeIslandRepo({ syncPort: channel.port1 as never });
  const ha: DocHandle<LarDoc> = repo.create<LarDoc>(emptyLarDoc());
  const hb: DocHandle<LarDoc> = repo.clone(ha);
  const shared = new AutomergeDocStore(ha, SHARED);
  const peer = new AutomergeDocStore(hb, SHARED);
  const drafts = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), DRAFT);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: WORKING, store: new MemoryTiddlerStore(), writable: true });
  composite.addLayer({ bagId: SHARED, store: shared, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: DRAFT, store: drafts, writable: true, defaultWritable: false });
  const { engine, enqueued } = fakeTw5();
  const adaptor = new IslandAdaptor(engine, composite, "reading-wiki");
  adaptor.start();
  return { ha, hb, shared, peer, drafts, enqueued };
}

const settle = () => new Promise((res) => setTimeout(res, 10));

describe("★ Q4: a surfaced parallel draft persists into the reading wiki's draft bag ★", () => {
  test("two actors set one field concurrently, a third write lands, and the loser's draft persists in the draft bag", async () => {
    const { ha, hb, shared, peer, drafts, enqueued } = stand();
    await shared.put(rec("base", "Root", "20261005000000000"), peerOrigin);
    hb.merge(ha);

    await shared.put(rec("from Alice", "Alice", "20261005000000001"), peerOrigin);
    await peer.put(rec("from Bob", "Bob", "20261005000000002"), peerOrigin);
    ha.merge(hb);
    const liveRecord = (await shared.get(TITLE))!.tiddler;
    const live = String(liveRecord.text);
    const loser = live === "from Alice" ? "Bob" : "Alice";
    await settle();

    // A third write to the property drops the conflict from the CRDT…
    await shared.put(rec("a third word", "Carol", "20261005000000003"), peerOrigin);
    expect(shared.parallelDrafts(TITLE)).toEqual([]);
    await settle();

    // …and the loser's draft still stands, in the draft bag, in TW5's draft shape.
    const kept = await drafts.listVisible();
    const loserTitle = `Draft of '${TITLE}' by ${loser}`;
    expect(kept).toContain(loserTitle);
    const draft = (await drafts.get(loserTitle))!.tiddler;
    expect(draft["draft.of"]).toBe(TITLE);
    expect(draft["draft.title"]).toBe(TITLE);
    expect(draft.text).toBe(`from ${loser}`);
    expect(String(draft["lar-conflict-fields"]).split(" ")).toContain("text");
    expect(String(draft["lar-conflict-live"]).split(" ")).not.toContain("text");
    // Last-writer-wins resolves each key on its own, so the live record can be a mosaic; every kept
    // draft carries at least one value the merge did not keep live, and none IS the live record.
    for (const title of kept) {
      const d = (await drafts.get(title))!.tiddler;
      const offLive = String(d["lar-conflict-fields"]).split(" ").filter((f) => d[f] !== liveRecord[f]);
      expect(offLive.length, title).toBeGreaterThan(0);
    }
    // The wiki hears it as an inbound change from its draft bag (the quiet badge reads it there).
    expect(enqueued.some((c) => c.title === loserTitle && c.bag === DRAFT && c.record !== null)).toBe(true);
  });

  test("CONTROL: with no concurrent write, nothing persists", async () => {
    const { ha, hb, shared, peer, drafts } = stand();
    await shared.put(rec("base", "Root", "20261005000000000"), peerOrigin);
    hb.merge(ha);
    await shared.put(rec("from Alice", "Alice", "20261005000000001"), peerOrigin);
    hb.merge(ha);
    await peer.put(rec("from Bob", "Bob", "20261005000000002"), peerOrigin);
    ha.merge(hb);
    await settle();
    expect((await shared.get(TITLE))!.tiddler.text).toBe("from Bob");
    expect(await drafts.listVisible()).toEqual([]);
  });

  test("CONTROL: the live value is the merge's own, and keeping the draft writes nothing into the shared bag", async () => {
    const { ha, hb, shared, peer } = stand();
    await shared.put(rec("base", "Root", "20261005000000000"), peerOrigin);
    hb.merge(ha);
    await shared.put(rec("from Alice", "Alice", "20261005000000001"), peerOrigin);
    await peer.put(rec("from Bob", "Bob", "20261005000000002"), peerOrigin);
    ha.merge(hb);
    const headsAtMerge = await shared.getHeads();
    const liveAtMerge = (await shared.get(TITLE))!.tiddler.text;
    await settle();

    // Peer B reaches the same merge on its own; both read the one value Automerge chose.
    hb.merge(ha);
    expect((await peer.get(TITLE))!.tiddler.text).toBe(liveAtMerge);
    expect((await shared.get(TITLE))!.tiddler.text).toBe(liveAtMerge);
    expect(await shared.getHeads()).toEqual(headsAtMerge);
  });
});
