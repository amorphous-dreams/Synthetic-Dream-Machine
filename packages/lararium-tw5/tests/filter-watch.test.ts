/**
 * FILTER WATCH — `filter-watch` (lar:///engine.filter.watches, comms-ux-enacts landing 16): a filter subscription that stands as
 * a tiddler (`$:/state/lares/watch/<id>`) the wiki's own `change` event moves, and one held call that answers when it moves.
 *
 * A real engine boots here (`bootTestWiki`), so the change event batches and fires as TiddlyWiki fires it. Each red names what the
 * watch must do; the counted cost reads the book's own run count (`WatchBook.runs`).
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeFilterWatchReactor, makeTiddlerPutReactor, makeWikiFilterReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
import { TIDDLER_CALL_SEATS } from "../src/tiddler-verbs.js";
import { watchBookOf, WATCH_BOOK_MAX, WATCH_PREFIX, type WatchSpec, type WatchWiki } from "../src/modules/watch.js";
import { makeTiddlerGetReactor } from "../src/tiddler-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const CANON = bagUri("lares");
const SECRET = bagUri("secret");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

type Cap = VerbContext["cap"];
/** Reads every bag. */
const reader: Cap = async (access) => (access === "read" ? { ok: true } : { ok: false, reason: "read-only-seat" });
/** Reads every bag but the secret one. */
const outsider: Cap = async (access, bag) => (access === "read" && bag !== SECRET ? { ok: true } : { ok: false, reason: "no-grant" });
const ctxOf = (cap: Cap = reader, signal?: AbortSignal): VerbContext => ({
  daemon: {} as CompositeStore, invocation: { requestId: "w1" } as VerbContext["invocation"], cap,
  worn: { ordinal: 0, presenter: "did:witness" }, ...(signal ? { signal } : {}),
});
const A = { recipe: "default" } as const;
/** Real macrotask turns: TiddlyWiki batches change events onto its own next tick. */
const settle = async (turns = 6): Promise<void> => { for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0)); };

async function rig() {
  const engine = await bootTestWiki({ tiddlers: [
    { title: WORKING_POINTER, text: DAEMON },
    ...Array.from({ length: 6 }, (_, i) => ({ title: `Note ${String(i + 1).padStart(2, "0")}`, tags: "memory", text: `note ${i + 1}` })),
    { title: "Other", text: "untagged" },
    { title: "Secret 1", tags: "memory", text: "behind the fence", "$origin-bag": SECRET },
  ] });
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: new MemoryTiddlerStore(CANON), writable: false });
  composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
  const opts: TiddlerVerbOptions = { composite, tw5: engine };
  const book = watchBookOf(engine.wiki as unknown as WatchWiki);
  const watch = makeFilterWatchReactor(opts);
  const wiki = engine.wiki as unknown as { addTiddler(f: Record<string, unknown>): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined; deleteTiddler(t: string): void };
  return { engine, opts, book, watch, wiki };
}

describe.skipIf(wikiSkip)(`a watch stands as a tiddler the wiki's change event moves${skipNote}`, () => {
  test("RED: a write the filter answers wakes the held call once, and the watch's record names its filter, face and digest", async () => {
    const r = await rig();
    const held = r.watch({ ...A, filter: "[tag[memory]]", hold: 5_000 }, ctxOf());
    await settle();
    r.wiki.addTiddler({ title: "Note 07", tags: "memory", text: "a new note" });
    const out = await held;
    expect(out).toMatchObject({ band: "changed", recipe: "default", filter: "[tag[memory]]" });
    const id = String(out["id"]);
    const record = r.wiki.getTiddler(`${WATCH_PREFIX}${id}`);
    expect(record?.fields).toMatchObject({ filter: "[tag[memory]]", recipe: "default", face: "did:witness", digest: out["asOf"], count: "8" });
    expect(out["titles"]).toContain("Note 07");
    expect(String(out["has"])).toContain("band/changed");
  });

  test("RED: an edit to an answering record moves the digest; CONTROL: a write the filter never answers leaves it, and the hold answers unchanged", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    expect(first["band"]).toBe("unchanged");
    const id = String(first["id"]);
    const quiet = r.watch({ ...A, filter: "[tag[memory]]", id, asOf: first["asOf"], hold: 1_000 }, ctxOf());
    await settle();
    r.wiki.addTiddler({ title: "Elsewhere", text: "no tag" });
    expect(await quiet).toMatchObject({ band: "unchanged", asOf: first["asOf"] });
    const moved = r.watch({ ...A, filter: "[tag[memory]]", id, asOf: first["asOf"], hold: 5_000 }, ctxOf());
    await settle();
    r.wiki.addTiddler({ title: "Note 03", tags: "memory", text: "note 3, edited" });
    const out = await moved;
    expect(out["band"]).toBe("changed");
    expect(out["asOf"]).not.toBe(first["asOf"]);
  });

  test("RED: a stale cursor answers at once; the watch tiddler kept moving while no call held it", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    r.wiki.addTiddler({ title: "Note 08", tags: "memory", text: "landed between calls" });
    await settle();
    const id = String(first["id"]);
    expect(r.wiki.getTiddler(`${WATCH_PREFIX}${id}`)?.fields["digest"]).not.toBe(first["asOf"]);
    const out = await r.watch({ ...A, filter: "[tag[memory]]", id, asOf: first["asOf"], hold: 110_000 }, ctxOf());
    expect(out).toMatchObject({ band: "changed", id });
    expect(out["titles"]).toContain("Note 08");
  });

  test("RED: until ends the watch and drops its record", async () => {
    const r = await rig();
    const held = r.watch({ ...A, filter: "[tag[memory]]", until: "[[Done]is[tiddler]]", hold: 5_000 }, ctxOf());
    await settle();
    r.wiki.addTiddler({ title: "Done", tags: "memory", text: "the end" });
    const out = await held;
    expect(out["band"]).toBe("ended");
    expect(r.wiki.getTiddler(`${WATCH_PREFIX}${String(out["id"])}`)).toBeUndefined();
    expect(r.book.entry(String(out["id"]))).toBeUndefined();
  });

  test("RED: a watch lists through the filter door like any record, and unask drops it; CONTROL: the put door takes no write to it", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    const id = String(first["id"]);
    const title = `${WATCH_PREFIX}${id}`;
    const listed = await makeWikiFilterReactor(r.opts)({ ...A, filter: `[prefix[${WATCH_PREFIX}]]` }, ctxOf());
    expect(listed["titles"]).toEqual([title]);
    await expect(makeTiddlerPutReactor(r.opts)({ ...A, title, text: "x" }, ctxOf(async () => ({ ok: true })))).rejects.toThrow(/tiddler-withheld/);
    expect(await r.watch({ ...A, id, unask: true }, ctxOf())).toMatchObject({ band: "removed", id });
    expect(r.wiki.getTiddler(title)).toBeUndefined();
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: `[prefix[${WATCH_PREFIX}]]` }, ctxOf()))["titles"]).toEqual([]);
  });

  test("RED: the unask carry folds into the watch's reactor args", () => {
    const seat = TIDDLER_CALL_SEATS["lar:///engine.filter.watches"]!;
    expect(seat.verb).toBe("filter-watch");
    expect(seat.fold!({ id: "abc", mu: "0" })).toEqual({ id: "abc", unask: true });
    expect(seat.fold!({ filter: "[tag[x]]", asOf: "d" })).toEqual({ filter: "[tag[x]]", asOf: "d" });
  });

  test("RED: a dropped line stops the held call, drops the watch and its record, and refuses watch-withdrawn", async () => {
    const r = await rig();
    const line = new AbortController();
    const held = r.watch({ ...A, filter: "[tag[memory]]", hold: 110_000 }, ctxOf(reader, line.signal));
    await settle();
    const live = r.book.ids();
    expect(live).toHaveLength(1);
    line.abort();
    await expect(held).rejects.toThrow(/watch-withdrawn/);
    expect(r.book.ids()).toEqual([]);
    expect(r.wiki.getTiddler(`${WATCH_PREFIX}${live[0]}`)).toBeUndefined();
  });

  test("RED: another face of the house continues a watch by its id, and the record names the face that bound it last", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    const second: VerbContext = { ...ctxOf(), worn: { ordinal: 1, presenter: "did:second" } };
    expect(await r.watch({ ...A, filter: "[tag[memory]]", id: first["id"], hold: 1_000 }, second)).toMatchObject({ band: "unchanged", id: first["id"] });
    expect(r.wiki.getTiddler(`${WATCH_PREFIX}${String(first["id"])}`)?.fields["face"]).toBe("did:second");
  });

  test("RED: N watchers re-run only on changes they could see, counted; the shore's echo re-runs none", async () => {
    const r = await rig();
    // Three watchers over one filter: two read the secret bag, one does not.
    await Promise.all([
      r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf(reader)),
      r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf(outsider)),
      r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf(reader)),
    ]);
    await settle();
    const runs = (): number => r.book.runs;
    const base = runs();
    // A title that stays home (a temp title) re-runs no watch.
    r.wiki.addTiddler({ title: "$:/temp/lares/scratch", text: "volatile" });
    await settle();
    expect(runs() - base).toBe(0);
    // An edit every watcher can read re-runs each watcher once.
    r.wiki.addTiddler({ title: "Note 05", tags: "memory", text: "note 5, edited" });
    await settle();
    expect(runs() - base).toBe(3);
    // A record in the secret bag re-runs only the two watchers whose view reads it.
    r.wiki.addTiddler({ title: "Secret 2", tags: "memory", text: "also fenced", "$origin-bag": SECRET });
    await settle();
    expect(runs() - base).toBe(5);
    // THE SHORE'S ECHO: the same record again, its residency stamp alone moved, re-runs nothing and moves no digest.
    const digests = r.book.ids().map((id) => r.wiki.getTiddler(`${WATCH_PREFIX}${id}`)?.fields["digest"]);
    r.wiki.addTiddler({ title: "Note 05", tags: "memory", text: "note 5, edited", "$origin-bag": DAEMON });
    await settle();
    expect(runs() - base).toBe(5);
    expect(r.book.ids().map((id) => r.wiki.getTiddler(`${WATCH_PREFIX}${id}`)?.fields["digest"])).toEqual(digests);
  }, 15_000);
});

/** A spec over a stub view, for the book's own housekeeping: no engine run reads it. */
const stub = (id: string, face: string): WatchSpec => ({
  id, face, filter: "[tag[memory]]", recipe: "default",
  view: { filterTiddlers: () => [], getTiddler: () => undefined }, visible: () => true,
});
const other = (presenter: string, ordinal = 1): VerbContext => ({ ...ctxOf(), worn: { ordinal, presenter } });

describe.skipIf(wikiSkip)(`the house's faces share one book${skipNote}`, () => {
  test("RED: a watch record reads to every face of the house, its face field naming who bound it", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    const title = `${WATCH_PREFIX}${String(first["id"])}`;
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: `[prefix[${WATCH_PREFIX}]]` }, ctxOf()))["titles"]).toEqual([title]);
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: `[prefix[${WATCH_PREFIX}]]` }, other("did:second")))["titles"]).toEqual([title]);
    const got = await makeTiddlerGetReactor(r.opts)({ ...A, title }, other("did:second"));
    expect((got["tiddler"] as { fields: Record<string, string> }).fields).toMatchObject({ face: "did:witness", filter: "[tag[memory]]" });
  });

  test("RED: a call that rode no session refuses watch-faceless; a free-text presenter names no face", async () => {
    const r = await rig();
    const faceless: VerbContext = { daemon: {} as CompositeStore, invocation: { requestId: "w9" } as VerbContext["invocation"], cap: reader, presenter: "h0" };
    await expect(r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, faceless)).rejects.toThrow(/watch-faceless/);
    expect(r.book.ids()).toEqual([]);
  });

  test("RED: any face of the house unasks any watch", async () => {
    const r = await rig();
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf());
    expect(await r.watch({ ...A, id: first["id"], unask: true }, other("did:second"))).toMatchObject({ band: "removed" });
    expect(r.book.ids()).toEqual([]);
  });

  test("RED: the bound counts per binding face, letting go that face's own longest-bound idle watch first", async () => {
    const r = await rig();
    for (let i = 0; i < WATCH_BOOK_MAX; i++) r.book.bind(stub(`a-${i}`, "did:a"));
    for (let i = 0; i < WATCH_BOOK_MAX; i++) r.book.bind(stub(`b-${i}`, "did:b"));
    r.book.bind(stub("b-past", "did:b"));
    expect(r.book.ids().filter((id) => id.startsWith("a-"))).toHaveLength(WATCH_BOOK_MAX);
    expect(r.book.entry("b-0"), "the binding face's own longest-bound idle watch left").toBeUndefined();
    expect(r.book.entry("b-past")).toBeDefined();
  });

  test("RED: an id the bound let go frees at once, for any face of the house", async () => {
    const r = await rig();
    for (let i = 0; i <= WATCH_BOOK_MAX; i++) r.book.bind(stub(`a-${i}`, "did:a"));
    expect(r.book.entry("a-0")).toBeUndefined();
    expect(r.book.bind(stub("a-0", "did:b")).face).toBe("did:b");
  });

  test("RED: the weigh queue folds: one weigh runs and one waits per watch, however many changes land meanwhile", async () => {
    const r = await rig();
    let weighs = 0;
    let release: (() => void) | undefined;
    const slow = (): Promise<void> => { weighs++; return new Promise((resolve) => { release = resolve; }); };
    r.book.bind({ ...stub("fold", "did:f"), reweigh: slow });
    await settle();
    weighs = 0;
    for (let i = 0; i < 5; i++) { r.wiki.addTiddler({ title: `Burst ${i}`, text: String(i) }); await settle(2); }
    expect(weighs).toBe(1);
    release!();
    await settle();
    expect(weighs).toBe(2);
    release!();
    await settle();
    expect(weighs).toBe(2);
  });

  test("RED: the bound holds while every watch is held: a face past it refuses watch-bound by name", async () => {
    const r = await rig();
    for (let i = 0; i < WATCH_BOOK_MAX; i++) { r.book.bind(stub(`c-${i}`, "did:c")); r.book.hold(`c-${i}`, 1); }
    expect(() => r.book.bind(stub("c-past", "did:c"))).toThrow(/watch-bound/);
    expect(r.book.ids().filter((id) => id.startsWith("c-"))).toHaveLength(WATCH_BOOK_MAX);
    // CONTROL: a re-bind of a watch the face holds already lands.
    expect(r.book.bind(stub("c-0", "did:c")).id).toBe("c-0");
  });

  test("RED: the view weighs the caller's reach again before each re-run: a bag it lost leaves the answer, and a lost wiki read drops the watch", async () => {
    const r = await rig();
    let grant: "all" | "no-secret" | "none" = "all";
    const moving: Cap = async (access, bag) => {
      if (access !== "read" || grant === "none") return { ok: false, reason: "revoked" };
      return grant === "no-secret" && bag === SECRET ? { ok: false, reason: "revoked" } : { ok: true };
    };
    const first = await r.watch({ ...A, filter: "[tag[memory]]", hold: 1_000 }, ctxOf(moving));
    const id = String(first["id"]);
    expect(r.book.entry(id)!.titles).toContain("Secret 1");
    grant = "no-secret";
    r.wiki.addTiddler({ title: "Note 02", tags: "memory", text: "note 2, edited" });
    await settle();
    expect(r.book.entry(id)!.titles).not.toContain("Secret 1");
    grant = "none";
    r.wiki.addTiddler({ title: "Note 04", tags: "memory", text: "note 4, edited" });
    await settle();
    expect(r.book.entry(id)).toBeUndefined();
    expect(r.wiki.getTiddler(`${WATCH_PREFIX}${id}`)).toBeUndefined();
  });
});
