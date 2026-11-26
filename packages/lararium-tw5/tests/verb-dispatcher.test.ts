/**
 * verb-dispatcher — effect dedup (D1, P2.5 iter 4, H1R+H4+M1+M3" lane, commit 2/4).
 *
 * LIVE proofs over a real CompositeStore + MemoryTiddlerStore (the daemon bag's genuine read/write
 * path — getLive/put, the same calls uds-channel.ts and daemon-vm-core.ts make in production) and a
 * fake TW5 wiki whose addTiddler/deleteTiddler fire synchronous "change" events, exactly like the
 * real `$tw.wiki` the dispatcher subscribes to. No regex, no shim over the dedup logic itself.
 *
 * `requestId` names an ATTEMPT (fresh per retry); `effectKey` names the EFFECT an attempt would
 * produce. The dispatcher reads `<control home>/effects/<effectKey>` before running a handler: a
 * prior `done` attempt with a MATCHING input digest answers the new attempt with a copy of that
 * result (`effect-of: <prior requestId>`) and never re-runs the handler. A changed-digest reuse of
 * the same effectKey string skips the shortcut and runs fresh — the key names an effect, not a
 * string. Concurrent same-effectKey attempts serialize through `inFlightEffect`.
 */

import { describe, test, expect, vi } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { OUTCOME_URI_PREFIX, VERB_RESULT_KEY, VERB_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { answerRingOf } from "@lararium/mesh/control-home";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { EFFECT_URI_PREFIX } from "../src/verb-vm.js";
import { memoryControlStore } from "./control-store-fixture.js";
import type { TW5Engine } from "../src/tw5-vm.js";

type TiddlerFields = Record<string, unknown>;
type ChangeListener = (changed: Record<string, { deleted?: boolean }>) => void;

/** A fake TW5 wiki whose addTiddler/deleteTiddler fire REAL synchronous "change" events — the one
 *  thing the dispatcher's LOCAL path depends on, and the one thing a plain field-bag fake (as
 *  verb-vm.test.ts's FakeTW5Engine) doesn't need to provide. */
class FakeTW5Engine {
  private readonly records = new Map<string, TiddlerFields>();
  private listeners: ChangeListener[] = [];

  readonly wiki = {
    addTiddler: (tiddler: { fields?: TiddlerFields } | TiddlerFields): void => {
      const fields = (tiddler && typeof tiddler === "object" && "fields" in tiddler && tiddler.fields)
        ? tiddler.fields
        : (tiddler as TiddlerFields);
      const title = typeof fields.title === "string" ? fields.title : null;
      if (!title) throw new Error("title required");
      this.records.set(title, { ...fields });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string): { fields: TiddlerFields } | undefined => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string): void => {
      const existed = this.records.delete(title);
      if (existed) for (const l of this.listeners) l({ [title]: { deleted: true } });
    },
    addEventListener: (type: string, fn: ChangeListener): void => {
      if (type === "change") this.listeners.push(fn);
    },
    removeEventListener: (type: string, fn: ChangeListener): void => {
      if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn);
    },
  };

  readonly $tw = {
    Tiddler: class {
      fields: TiddlerFields;
      constructor(fields: TiddlerFields) { this.fields = fields; }
    },
    wiki: this.wiki,
  };
}

function makeDaemon(): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return composite;
}

/** The daemon composite (holding no ledger) beside the control store the ledger rests in. */
function makeStores(): { daemon: CompositeStore; control: CompositeStore } {
  return { daemon: makeDaemon(), control: memoryControlStore() };
}

/** Flush N real macrotask turns — the dispatcher's getLive→dedup→writeOutcome chain crosses a
 *  genuine async boundary (verbInputDigest rides Web Crypto's subtle.digest, which resolves on
 *  the platform's own task queue, not a bare microtask), so a `Promise.resolve()` spin isn't
 *  enough; `setTimeout(0)` is. */
async function settle(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

/** One outcome as the island left it: the verdict row's fields, and the results the whole answer carries in the ring
 *  (`{}` once the body left, or for a row that rests no body). */
async function outcomeOf(control: CompositeStore, requestId: string) {
  const rec = await control.getLive(OUTCOME_URI_PREFIX + requestId);
  if (!rec) return null;
  const body = answerRingOf(control).get(requestId)?.tiddler["results"] ?? rec.tiddler["results"];
  const results = JSON.parse(String(body ?? "{}")) as Record<string, { ok: boolean; output?: unknown }>;
  return { fields: rec.tiddler, results };
}

describe("VerbDispatcher — redelivered requestId vs. the already-landed outcome's stamped digest", () => {
  test("a redelivered requestId carrying a CHANGED digest against its landed outcome is skipped and logged by name; a matching redelivery is skipped silently (control)", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-redeliver", async (args) => {
      runCount++;
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-redeliver", args: { x: 1 }, requestedBy: "did:key:test", requestId: "req-redeliver",
    });
    await settle();
    expect(runCount).toBe(1);
    const landed = await outcomeOf(control, "req-redeliver");
    expect(landed?.fields.status).toBe("done");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // CONTROL — an exact redelivery (same requestId, same args) is the ordinary idempotent
    // case: skipped, no handler run, nothing worth naming since content matches.
    dispatcher.placeVerb({
      verb: "do-redeliver", args: { x: 1 }, requestedBy: "did:key:test", requestId: "req-redeliver",
    });
    await settle();
    expect(runCount).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();

    // A redelivery under the SAME requestId but DIFFERENT content — a changed digest against
    // the already-landed outcome's stamped one. It must still be SKIPPED (the landed outcome
    // is never re-derived), but logged by name so the mismatch doesn't vanish silently.
    dispatcher.placeVerb({
      verb: "do-redeliver", args: { x: 999 }, requestedBy: "did:key:test", requestId: "req-redeliver",
    });
    await settle();

    expect(runCount).toBe(1); // still skipped — never re-runs the handler
    const stillLanded = await outcomeOf(control, "req-redeliver");
    expect(stillLanded?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 1, echo: 1 }); // unchanged
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("req-redeliver");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("do-redeliver");

    warnSpy.mockRestore();
    dispatcher.stop();
  });
});

describe("VerbDispatcher — a redelivered invocation leaves the VM (Sol's delta read)", () => {
  test("RED: a redelivery against a landed outcome is removed from the VM, so no stamp rides a standing invocation; CONTROL: the outcome stands unchanged", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    const registry = new VerbTable();
    registry.register("do-once", async () => ({ ran: true }));
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "do-once", args: {}, requestedBy: "did:key:test", requestId: "req-once" });
    await settle();
    expect((await outcomeOf(control, "req-once"))?.fields.status).toBe("done");
    dispatcher.placeVerb({ verb: "do-once", args: { again: true }, requestedBy: "did:key:test", requestId: "req-once" });
    const wiki = (tw5 as unknown as { $tw: { wiki: { getTiddler(t: string): unknown } } }).$tw.wiki;
    expect(wiki.getTiddler(`${VERB_URI_PREFIX}req-once`), "the redelivery stands placed").toBeDefined();
    await settle();
    expect(wiki.getTiddler(`${VERB_URI_PREFIX}req-once`)).toBeUndefined();
    expect((await outcomeOf(control, "req-once"))?.fields.status).toBe("done");
    dispatcher.stop();
  });
});

describe("VerbDispatcher — effect dedup (D1)", () => {
  test("RED (Sol's read, slice 4): a ROUTED verb's replay asks the routed admission too; a refused presenter never reads the prior result", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let routed = 0;
    const registry = new VerbTable();
    registry.fence({ open: {}, check: (verb, context) => {
      if (context.presenter !== "did:key:mounted") throw Object.assign(new Error(`${verb}: fenced`), { reason: "content-mounted-only" });
    } });
    // Both attempts arrive over the vessel's own channel and address a wiki, so the fence reads their presenters.
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry, localOf: () => true, routeFn: async () => ({ routed: ++routed, secret: "mounted-only" }) });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "wiki-act", args: { wiki: "home" }, requestedBy: "did:key:mounted", requestId: "route-1", effectKey: "eff-route" });
    await settle();
    expect((await outcomeOf(control, "route-1"))?.fields.status).toBe("done");
    dispatcher.placeVerb({ verb: "wiki-act", args: { wiki: "home" }, requestedBy: "did:key:sibling", requestId: "route-2", effectKey: "eff-route" });
    await settle();
    const refused = await outcomeOf(control, "route-2");
    expect(refused?.fields["effect-of"]).toBeUndefined();
    expect(refused?.fields.status).toBe("error");
    expect(JSON.stringify(refused?.results ?? {})).not.toContain("mounted-only");
    expect(routed).toBe(1);
    dispatcher.stop();
  });

  test("a presenter the table's fence refuses never reads a prior attempt's result through the effect replay; it concludes refused by the fence's name (the mounted control replays)", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-effect", async () => ({ ran: ++runCount, secret: "mounted-only" }));
    registry.fence({ open: {}, check: (verb, context) => {
      if (context.presenter !== "did:key:mounted") throw Object.assign(new Error(`${verb}: fenced`), { reason: "content-mounted-only" });
    } });
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:mounted", requestId: "fence-1", effectKey: "eff-fence" });
    await settle();
    expect((await outcomeOf(control, "fence-1"))?.fields.status).toBe("done");
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:sibling", requestId: "fence-2", effectKey: "eff-fence" });
    await settle();
    const refused = await outcomeOf(control, "fence-2");
    expect(refused?.fields["effect-of"]).toBeUndefined();
    expect(refused?.fields.status).toBe("error");
    expect(JSON.stringify(refused?.results ?? {})).not.toContain("mounted-only");
    // CONTROL: the mounted presenter under a new attempt replays the effect.
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:mounted", requestId: "fence-3", effectKey: "eff-fence" });
    await settle();
    expect((await outcomeOf(control, "fence-3"))?.fields["effect-of"]).toBe("fence-1");
    expect(runCount).toBe(1);
    dispatcher.stop();
  });

  test("A VISIT NEVER REPLAYS (Sol 407c H2): a visit's outcome indexes no effect, and a fresh requestId under the same effectKey runs the reactor again, never copying the stored body", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    // A visit's reactor: its answer carries `visit: true` (`crossFaceReactor`), and each run reads the target afresh.
    registry.register("tiddler-get", async () => { runCount++; return { face: 1, worn: 0, visit: true, tiddler: { text: `read ${runCount}` } }; });
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "tiddler-get", args: { recipe: "default", title: "T", target: 1 }, requestedBy: "did:key:test", requestId: "visit-1", effectKey: "eff-visit" });
    await settle();
    expect(runCount).toBe(1);
    expect(await control.getLive(EFFECT_URI_PREFIX + "eff-visit"), "a visit indexes no effect").toBeNull();
    dispatcher.placeVerb({ verb: "tiddler-get", args: { recipe: "default", title: "T", target: 1 }, requestedBy: "did:key:test", requestId: "visit-2", effectKey: "eff-visit" });
    await settle();
    expect(runCount, "the second visit ran its reactor (and its opening check) afresh").toBe(2);
    const second = await outcomeOf(control, "visit-2");
    expect(second?.fields["effect-of"]).toBeUndefined();
    expect(JSON.stringify(second?.results)).toContain("read 2");
    dispatcher.stop?.();
  });

  test("a reused effectKey with CHANGED inputs runs fresh even where the stored results will not parse; matching inputs over unparseable results run fresh too (Sol 407d M4)", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-effect", async (args) => { runCount++; return { ran: runCount, echo: args["x"] }; });
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:test", requestId: "torn-1", effectKey: "eff-torn" });
    await settle();
    expect(runCount).toBe(1);
    // The stored outcome's results tear (a hand, a bad write): the index still names it.
    const stored = await control.getLive(OUTCOME_URI_PREFIX + "torn-1");
    await control.put({ ...stored!, tiddler: { ...stored!.tiddler, results: "{torn" } } as never, { kind: "lares-verb", requestId: "tear" } as never);
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 2 }, requestedBy: "did:key:test", requestId: "torn-2", effectKey: "eff-torn" });
    await settle();
    expect(runCount, "changed inputs run fresh").toBe(2);
    expect((await outcomeOf(control, "torn-2"))?.fields.status).toBe("done");
    dispatcher.placeVerb({ verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:test", requestId: "torn-3", effectKey: "eff-torn" });
    await settle();
    expect((await outcomeOf(control, "torn-3"))?.fields.status, "a matching digest over torn results concludes, never strands").toBe("done");
    dispatcher.stop?.();
  });

  test("A VISIT NEVER REPLAYS: an effect index that names a visit's outcome (written by any hand) copies nothing; the reactor runs", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("tiddler-get", async () => { runCount++; return { face: 1, worn: 0, visit: true, tiddler: { text: `read ${runCount}` } }; });
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();
    dispatcher.placeVerb({ verb: "tiddler-get", args: { recipe: "default", title: "T", target: 1 }, requestedBy: "did:key:test", requestId: "planted-1", effectKey: "eff-planted" });
    await settle();
    // A planted index pointing the effect at that visit's outcome.
    await control.put({ tiddler: { title: `${EFFECT_URI_PREFIX}eff-planted`, "effect-key": "eff-planted", "request-id": "planted-1" }, meta: { authority: "lares-dispatcher" } } as never, { kind: "lares-verb", requestId: "plant" } as never);
    dispatcher.placeVerb({ verb: "tiddler-get", args: { recipe: "default", title: "T", target: 1 }, requestedBy: "did:key:test", requestId: "planted-2", effectKey: "eff-planted" });
    await settle();
    expect(runCount).toBe(2);
    expect((await outcomeOf(control, "planted-2"))?.fields["effect-of"]).toBeUndefined();
    dispatcher.stop?.();
  });

  test("a second attempt under a NEW requestId with the SAME effectKey answers with effect-of and the handler runs ONCE; a changed digest skips the shortcut and runs fresh", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-effect", async (args) => {
      runCount++;
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-1", effectKey: "eff-1",
    });
    await settle();

    expect(runCount).toBe(1);
    const first = await outcomeOf(control, "req-1");
    expect(first?.fields.status).toBe("done");
    expect(first?.fields["effect-key"]).toBe("eff-1");
    expect(first?.fields["effect-of"]).toBeUndefined();
    expect(first?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 1, echo: 1 });
    const fact = await control.getLive(EFFECT_URI_PREFIX + "eff-1");
    expect(fact?.tiddler["request-id"]).toBe("req-1");

    // SAME effectKey, SAME args, a NEW requestId — the handler must not run again.
    dispatcher.placeVerb({
      verb: "do-effect", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-2", effectKey: "eff-1",
    });
    await settle();

    expect(runCount).toBe(1); // still once — the second attempt borrowed the first's effect.
    const second = await outcomeOf(control, "req-2");
    expect(second?.fields.status).toBe("done");
    expect(second?.fields["effect-of"]).toBe("req-1");
    expect(second?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 1, echo: 1 }); // copied, not re-derived

    // Mutation — the SAME effectKey string, but CHANGED args (a different digest): the dedup
    // shortcut must skip, and the handler runs fresh (named "eff-1" keys an EFFECT, not a string).
    dispatcher.placeVerb({
      verb: "do-effect", args: { x: 999 }, requestedBy: "did:key:test",
      requestId: "req-3", effectKey: "eff-1",
    });
    await settle();

    expect(runCount).toBe(2); // ran again — digest mismatch, not a reuse
    const third = await outcomeOf(control, "req-3");
    expect(third?.fields.status).toBe("done");
    expect(third?.fields["effect-of"]).toBeUndefined();
    expect(third?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 2, echo: 999 });

    dispatcher.stop();
  });

  test("CONTROL/mutation — stripping effectKey disables dedup entirely: two attempts, same args, no effectKey, the handler runs TWICE", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-plain", async () => {
      runCount++;
      return { ran: runCount };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({ verb: "do-plain", args: { x: 1 }, requestedBy: "did:key:test", requestId: "req-a" });
    await settle();
    dispatcher.placeVerb({ verb: "do-plain", args: { x: 1 }, requestedBy: "did:key:test", requestId: "req-b" });
    await settle();

    expect(runCount).toBe(2); // no effectKey on either attempt → no dedup path at all

    const a = await outcomeOf(control, "req-a");
    const b = await outcomeOf(control, "req-b");
    expect(a?.fields["effect-key"]).toBeUndefined();
    expect(b?.fields["effect-key"]).toBeUndefined();
    expect(b?.fields["effect-of"]).toBeUndefined();

    dispatcher.stop();
  });

  test("a same-effect attempt already IN FLIGHT awaits the first, then re-reads — the handler still runs exactly ONCE", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    let releaseFirstRun: (() => void) | null = null;
    const registry = new VerbTable();
    registry.register("do-slow-effect", async (args) => {
      runCount++;
      await new Promise<void>((resolve) => { releaseFirstRun = resolve; });
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-slow-effect", args: { x: 7 }, requestedBy: "did:key:test",
      requestId: "req-slow-1", effectKey: "eff-slow",
    });
    // Enough turns for the first attempt to reach (and block inside) the handler, but the handler
    // itself never resolves until releaseFirstRun() fires — so this is a genuine in-flight window.
    await settle();
    expect(runCount).toBe(1);
    expect(releaseFirstRun).not.toBeNull();
    expect(await outcomeOf(control, "req-slow-1")).toBeNull(); // not yet written — still running

    // A second attempt under a NEW requestId, same effectKey, arrives WHILE the first is in flight.
    dispatcher.placeVerb({
      verb: "do-slow-effect", args: { x: 7 }, requestedBy: "did:key:test",
      requestId: "req-slow-2", effectKey: "eff-slow",
    });
    await settle();

    // The second attempt must not have started a second handler call — it chained onto the first.
    expect(runCount).toBe(1);
    expect(await outcomeOf(control, "req-slow-2")).toBeNull(); // still waiting on the first

    // Release the first attempt's handler; it completes, writes its outcome + the effect index.
    (releaseFirstRun as (() => void) | null)?.();
    await settle();

    expect(runCount).toBe(1); // the second attempt re-read and copied — it never called the handler
    const first = await outcomeOf(control, "req-slow-1");
    expect(first?.fields.status).toBe("done");
    expect(first?.fields["effect-of"]).toBeUndefined();

    const second = await outcomeOf(control, "req-slow-2");
    expect(second?.fields.status).toBe("done");
    expect(second?.fields["effect-of"]).toBe("req-slow-1");
    expect(second?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 1, echo: 7 });

    dispatcher.stop();
  });

  test("RED (ledger diet, step 2) — a dedup hit decides against the effect row alone: with the prior outcome row evicted and the body gone from the ring, it answers effect-of + the body's hash, handler not run", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-evictable", async (args) => {
      runCount++;
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-evictable", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-evict-1", effectKey: "eff-evict",
    });
    await settle();
    expect(runCount).toBe(1);
    const first = await outcomeOf(control, "req-evict-1");
    expect(first?.fields.status).toBe("done");
    expect(first?.fields["results"], "the durable row rests no body").toBeUndefined();
    const effectRow = await control.getLive(EFFECT_URI_PREFIX + "eff-evict");
    expect(effectRow?.tiddler["request-id"]).toBe("req-evict-1");
    expect(effectRow?.tiddler["input-digest"]).toBe(first?.fields["input-digest"]);
    expect(effectRow?.tiddler["result-sha256"]).toBe(first?.fields["result-sha256"]);

    // The ring evicts the prior outcome row, and a restart empties the answer ring: the effect row stands alone.
    await control.tombstone(OUTCOME_URI_PREFIX + "req-evict-1", { kind: "lares-verb", requestId: "req-evict-1" });
    answerRingOf(control).clear();

    dispatcher.placeVerb({
      verb: "do-evictable", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-evict-2", effectKey: "eff-evict",
    });
    await settle();

    expect(runCount, "the handler did not run for the dedup hit").toBe(1);
    const second = await control.getLive(OUTCOME_URI_PREFIX + "req-evict-2");
    expect(second?.tiddler.status).toBe("done");
    expect(second?.tiddler["effect-of"]).toBe("req-evict-1");
    expect(second?.tiddler["result-sha256"]).toBe(effectRow?.tiddler["result-sha256"]);
    expect(second?.tiddler["results"]).toBeUndefined();
    const answer = answerRingOf(control).get("req-evict-2")?.tiddler as Record<string, unknown>;
    expect(answer["effect-of"]).toBe("req-evict-1");
    expect(answer["results"], "no body rides a copy whose prior body left").toBeUndefined();

    // CONTROL: while the island's ring still holds the prior body, the copy carries it whole.
    dispatcher.placeVerb({ verb: "do-evictable", args: { x: 2 }, requestedBy: "did:key:test", requestId: "req-evict-3", effectKey: "eff-held" });
    await settle();
    dispatcher.placeVerb({ verb: "do-evictable", args: { x: 2 }, requestedBy: "did:key:test", requestId: "req-evict-4", effectKey: "eff-held" });
    await settle();
    expect(runCount).toBe(2);
    const copied = await outcomeOf(control, "req-evict-4");
    expect(copied?.fields["effect-of"]).toBe("req-evict-3");
    expect(copied?.results[VERB_RESULT_KEY]?.output).toEqual({ ran: 2, echo: 2 });

    dispatcher.stop();
  });

  test("E1 — an effect row that names no digest of its own (written before rows carried one) whose prior outcome is EVICTED refuses (retention-gap), names its cure, and never runs the handler", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-evictable", async (args) => {
      runCount++;
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    // An effect row in the older shape: the key and the prior request id, no digest, and no outcome row behind it.
    await control.put({ tiddler: { title: `${EFFECT_URI_PREFIX}eff-old`, "effect-key": "eff-old", "request-id": "req-old-1" }, meta: { authority: "lares-dispatcher" } } as never, { kind: "lares-verb", requestId: "plant" } as never);

    dispatcher.placeVerb({
      verb: "do-evictable", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-old-2", effectKey: "eff-old",
    });
    await settle();

    expect(runCount).toBe(0); // handler did NOT run for the evicted-effect attempt
    const second = await control.getLive(OUTCOME_URI_PREFIX + "req-old-2");
    expect(second?.tiddler.status).toBe("error");
    expect(second?.tiddler.refusal).toBe("retention-gap");
    expect(String(second?.tiddler["error-message"])).toContain("mint a fresh effect key");
    // The refused attempt is itself an "error" outcome, which writeOutcome's own law never
    // indexes — so it did NOT clobber the effect-index row; the index still names the original.
    const factAfterRefusal = await control.getLive(EFFECT_URI_PREFIX + "eff-old");
    expect(factAfterRefusal?.tiddler["request-id"]).toBe("req-old-1");

    dispatcher.stop();
  });

  test("CONTROL (eviction-guard specificity) — an effect-index hit whose prior outcome is STILL LIVE dedups normally, same effectKey shape as the eviction test above", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-evictable-live", async (args) => {
      runCount++;
      return { ran: runCount, echo: args["x"] };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-evictable-live", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-live-1", effectKey: "eff-live",
    });
    await settle();
    expect(runCount).toBe(1);

    // No eviction this time — the prior outcome is untouched. A same-args retry must still
    // take the ordinary effect-of dedup path, NOT the retention-gap refusal — proving the
    // new guard fires only when the prior outcome is actually gone.
    dispatcher.placeVerb({
      verb: "do-evictable-live", args: { x: 1 }, requestedBy: "did:key:test",
      requestId: "req-live-2", effectKey: "eff-live",
    });
    await settle();

    expect(runCount).toBe(1); // dedup shortcut, not a refusal and not a fresh run
    const second = await outcomeOf(control, "req-live-2");
    expect(second?.fields.status).toBe("done");
    expect(second?.fields["effect-of"]).toBe("req-live-1");
    expect(second?.fields.refusal).toBeUndefined();

    dispatcher.stop();
  });

  test("CONTROL — a fresh requestId with a fresh effectKey runs normally (no prior effect to find)", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const { daemon: daemonComposite, control } = makeStores();
    let runCount = 0;
    const registry = new VerbTable();
    registry.register("do-fresh", async () => {
      runCount++;
      return { ran: runCount };
    });

    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: daemonComposite, control, registry });
    dispatcher.start();

    dispatcher.placeVerb({
      verb: "do-fresh", args: {}, requestedBy: "did:key:test",
      requestId: "req-fresh-1", effectKey: "eff-fresh",
    });
    await settle();

    expect(runCount).toBe(1);
    const outcome = await outcomeOf(control, "req-fresh-1");
    expect(outcome?.fields.status).toBe("done");
    expect(outcome?.fields["effect-of"]).toBeUndefined();
    const fact = await control.getLive(EFFECT_URI_PREFIX + "eff-fresh");
    expect(fact?.tiddler["request-id"]).toBe("req-fresh-1");

    dispatcher.stop();
  });
});
