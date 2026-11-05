/**
 * verb-dispatcher-hand-only — the verbs only a hand's page gesture may summon (promote and kapae commits): the island's dispatcher
 * answers them ONLY for an ask that arrived on the surface's own control-event path.
 *
 * A seat's session call (origin channel), a `meme put` of a verb tiddler (content) and a synced verb tiddler (content) all refuse
 * by the verb's own code and dispatch nothing; a verb outside the set routes for any origin (the control). The local ask book
 * binds the surface mark to the exact act, so a reused id lends nothing. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */

import { describe, test, expect } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { makeLocalAskBook } from "../src/daemon-behavior.js";
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

/** Flush N real macrotask turns — the dispatcher's getLive→dedup→writeOutcome chain crosses a
 *  genuine async boundary (verbInputDigest rides Web Crypto's subtle.digest, which resolves on
 *  the platform's own task queue, not a bare microtask), so a `Promise.resolve()` spin isn't
 *  enough; `setTimeout(0)` is. */
async function settle(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

async function outcomeOf(daemon: CompositeStore, requestId: string) {
  const rec = await daemon.getLive(OUTCOME_URI_PREFIX + requestId);
  if (!rec) return null;
  const results = JSON.parse(String(rec.tiddler["results"] ?? "{}")) as Record<string, { ok: boolean; output?: unknown }>;
  return { fields: rec.tiddler, results };
}


const HAND_ONLY = { "promote-commit": "promote-needs-hand", "kapae-raise": "kapae-needs-hand" } as const;

describe("the local ask book marks the surface", () => {
  test("RED: an ask placed on the surface reads surface; a channel ask reads local but not surface; the same id with other args reads neither; CONTROL: a retired id lends nothing", () => {
    const book = makeLocalAskBook();
    const ask = { requestId: "r1", action: "promote-commit", args: { digest: "d" }, requestedBy: "me" };
    book.add({ ...ask, origin: "surface" });
    expect(book.has(ask)).toBe(true);
    expect(book.isSurface(ask)).toBe(true);
    book.add({ ...ask, requestId: "r2", origin: "channel" });
    expect(book.has({ ...ask, requestId: "r2" })).toBe(true);
    expect(book.isSurface({ ...ask, requestId: "r2" })).toBe(false);
    expect(book.has({ ...ask, args: { digest: "other" } })).toBe(false);
    expect(book.isSurface({ ...ask, args: { digest: "other" } })).toBe(false);
    book.onWikiChange({ "lar:///lararium.local.vm/verbs/r1": { deleted: true } });
    expect(book.isSurface(ask)).toBe(false);
  });
});

describe("hand-only verbs", () => {
  async function stand() {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const daemon = makeDaemon();
    const book = makeLocalAskBook();
    const routed: string[] = [];
    const registry = new VerbTable();
    registry.handOnly(HAND_ONLY);
    const dispatcher = new VerbDispatcher({
      daemonVm: tw5, daemon, registry,
      routeFn: async (inv) => { routed.push(inv.action); return { routed: true }; },
      localOf: (inv) => book.has(inv), surfaceOf: (inv) => book.isSurface(inv),
    });
    dispatcher.start();
    const place = async (requestId: string, verb: string, origin: "surface" | "channel" | "content", args: Record<string, unknown> = { digest: "d" }) => {
      const inv = { requestId, action: verb, args, requestedBy: "me" };
      if (origin !== "content") book.add({ ...inv, origin });
      dispatcher.placeVerb({ verb, args, requestedBy: "me", requestId });
      await settle();
      return outcomeOf(daemon, requestId);
    };
    return { place, routed, stop: () => dispatcher.stop() };
  }

  test("RED: a surface summon of promote-commit and kapae-raise routes to main; CONTROL: nothing else changes for them", async () => {
    const s = await stand();
    expect((await s.place("a1", "promote-commit", "surface"))?.fields.status).toBe("done");
    expect((await s.place("a2", "kapae-raise", "surface"))?.fields.status).toBe("done");
    expect(s.routed).toEqual(["promote-commit", "kapae-raise"]);
    s.stop();
  });

  test("RED: a seat's session call (channel) and a meme put or synced verb tiddler (content) refuse by the verb's own code and dispatch nothing; CONTROL: the same refusal for each hand-only verb", async () => {
    const s = await stand();
    for (const [id, verb, origin, code] of [
      ["b1", "promote-commit", "channel", "promote-needs-hand"], ["b2", "promote-commit", "content", "promote-needs-hand"],
      ["b3", "kapae-raise", "channel", "kapae-needs-hand"], ["b4", "kapae-raise", "content", "kapae-needs-hand"],
    ] as const) {
      const out = await s.place(id, verb, origin);
      expect(out?.fields.status, id).toBe("error");
      expect(JSON.stringify(out?.results ?? {}), id).toContain(code);
    }
    expect(s.routed).toEqual([]);
    s.stop();
  });

  test("RED: a surface mark does not carry to a reused id with other args; CONTROL: a verb outside the set routes for a channel ask and for content", async () => {
    const s = await stand();
    const out = await s.place("c1", "promote-commit", "surface", { digest: "d" });
    expect(out?.fields.status).toBe("done");
    const reused = await s.place("c1", "promote-commit", "content", { digest: "other" });
    expect(reused?.fields.status).toBe("done");   // the landed outcome stands for the id; nothing re-ran
    expect(s.routed).toEqual(["promote-commit"]);
    expect((await s.place("c2", "promote-snapshot", "channel"))?.fields.status).toBe("done");
    expect((await s.place("c3", "promote-snapshot", "content"))?.fields.status).toBe("done");
    expect(s.routed).toEqual(["promote-commit", "promote-snapshot", "promote-snapshot"]);
    s.stop();
  });

  test("RED (live e2e): a face row cleared by the session door (given) passes the hand-only gate, since the socket already refused a seat; CONTROL: the same verb PLACED from a channel ask refuses", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const registry = new VerbTable();
    registry.handOnly(HAND_ONLY);
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: makeDaemon(), registry, routeFn: async () => ({}), localOf: () => true, surfaceOf: () => false });
    const inv = { requestId: "s1", action: "promote-commit", args: { digest: "d" }, requestedBy: "me" } as never;
    await expect(dispatcher.clearRouted(inv, { local: true, presenter: "me" })).resolves.toBeUndefined();
    await expect(dispatcher.clearRouted(inv)).rejects.toMatchObject({ reason: "promote-needs-hand" });
  });
});
