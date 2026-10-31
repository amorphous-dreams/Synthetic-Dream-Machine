/**
 * mount-timeout-cleans-its-delegation — a mount the gate gave up on leaves nothing in the daemon island's pending book.
 *
 * `mountAimedWiki` asks main to `wiki-switch` through `routeFn`, and the daemon island holds a resolver per ask in its
 * delegation book until main answers. A mount that timed out refuses by name, and the entry for its ask stood forever
 * (main may never answer). The dispatcher hands `routeFn` an AbortSignal that aborts when it gives up, and the book drops
 * the entry on that abort. CONTROL: an answered ask leaves the book empty by its own settle, and an ask still awaiting
 * its answer holds one entry.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, type CapabilityVerifier } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { makeDelegationBook } from "../src/delegation-book.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { Verb } from "@lararium/mesh";

afterEach(() => vi.useRealTimers());

/** The least wiki a dispatcher starts over: tiddlers by title, change listeners. */
class FakeWiki {
  private readonly records = new Map<string, Record<string, unknown>>();
  private listeners: Array<(c: Record<string, { deleted?: boolean }>) => void> = [];
  readonly wiki = {
    addTiddler: (t: { fields?: Record<string, unknown> } | Record<string, unknown>): void => {
      const f = (t && "fields" in t && t.fields ? t.fields : t) as Record<string, unknown>;
      const title = String(f["title"]);
      this.records.set(title, { ...f });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string) => { const f = this.records.get(title); return f ? { fields: { ...f } } : undefined; },
    deleteTiddler: (title: string): void => { if (this.records.delete(title)) for (const l of this.listeners) l({ [title]: { deleted: true } }); },
    addEventListener: (type: string, fn: never): void => { if (type === "change") this.listeners.push(fn); },
    removeEventListener: (type: string, fn: unknown): void => { if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn); },
  };
  readonly $tw = { Tiddler: class { fields: Record<string, unknown>; constructor(f: Record<string, unknown>) { this.fields = f; } }, wiki: this.wiki };
}

const verb = (requestId: string): Verb => ({ requestId, action: "wiki-switch", args: {}, requestedBy: "did:key:x", targets: [] } as unknown as Verb);

describe("the delegation book", () => {
  test("RED: an aborted ask leaves no entry and rejects by name", async () => {
    const book = makeDelegationBook(() => {});
    const gone = new AbortController();
    const asked = book.route(verb("a1"), gone.signal);
    expect(book.size()).toBe(1);   // CONTROL: an ask awaiting its answer holds one entry
    gone.abort();
    await expect(asked).rejects.toThrow(/abandoned/);
    expect(book.size()).toBe(0);
  });

  test("RED (Copilot's read): a post that throws leaves no entry", async () => {
    const book = makeDelegationBook(() => { throw new Error("port closed"); });
    await expect(book.route(verb("a3"), new AbortController().signal)).rejects.toThrow(/port closed/);
    expect(book.size()).toBe(0);
  });

  test("CONTROL: an answered ask settles and leaves the book empty", async () => {
    const book = makeDelegationBook(() => {});
    const asked = book.route(verb("a2"), new AbortController().signal);
    expect(book.answer("a2", { result: { ok: true } })).toBe(true);
    await expect(asked).resolves.toEqual({ ok: true });
    expect(book.size()).toBe(0);
  });
});

describe("a mount that times out", () => {
  test("RED: the gate aborts the ask it gave up on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const WORKING = "lar:///ha.ka.ba/wikis/orchard/working";
    const daemon = new CompositeStore();
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
    const verifier: CapabilityVerifier = { verify: async ({ bagUrl }) => bagUrl === WORKING ? { ok: false, kind: "bag-not-registered", bagUrl, reason: `bag not registered: ${bagUrl}` } : { ok: true } };
    const signals: Array<AbortSignal | undefined> = [];
    const dispatcher = new VerbDispatcher({
      daemonVm: new FakeWiki() as unknown as TW5Engine, daemon, registry: new VerbTable(), verifier, localOf: () => true,
      routeFn: (_inv, signal) => { signals.push(signal); return new Promise(() => {}); },   // main never answers
    });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "wiki-act", args: { verb: "LOAD", args: { "to-bag": WORKING, "source-uri": "/x" } }, requestedBy: "did:key:m", requestId: "t1" });
    for (let i = 0; i < 20 && signals.length === 0; i++) await vi.advanceTimersByTimeAsync(0);   // the ask reaches the router
    expect(signals.length).toBe(1);
    expect(signals[0]?.aborted).toBe(false);   // CONTROL: while the gate waits, the ask stands
    await vi.advanceTimersByTimeAsync(31_000);
    expect(signals.length).toBe(1);
    expect(signals[0]?.aborted).toBe(true);
    dispatcher.stop();
  });
});
