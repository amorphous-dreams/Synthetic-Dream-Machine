/**
 * asker-threads — the asker's hand rides a placed ask into the reactor's context (seat-canon-reach, T4-2). The vessel's door
 * names the hand (`seat`, `cli`, `tab`); the place-verb message carries it; the island's local ask book binds it to the exact
 * act, as it binds locality and the surface; the dispatcher hands it to the reactor as `ctx.asker`. A synced verb tiddler
 * (content) names no asker, and a reused id with other args lends none. Every red pairs with a CONTROL.
 */
import { memoryControlStore } from "./control-store-fixture.js";
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { mkDaemonPlaceVerb } from "@lararium/mesh/island-protocol";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { runLocalVerb } from "../src/verb-local-dispatch.js";
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
      const fields: TiddlerFields = (tiddler && typeof tiddler === "object" && "fields" in tiddler && tiddler.fields)
        ? tiddler.fields as TiddlerFields
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

describe("the asker rides the placed ask", () => {
  test("RED: the place-verb message carries the asker its sender names; CONTROL: one naming none carries none", () => {
    expect(mkDaemonPlaceVerb({ origin: "channel", verb: "meme-put", args: {}, requestedBy: "p", asker: "seat" } as never)).toMatchObject({ asker: "seat" });
    expect(mkDaemonPlaceVerb({ origin: "channel", verb: "meme-put", args: {}, requestedBy: "p" })).not.toHaveProperty("asker");
  });

  test("RED: the local ask book names the asker of the exact act; CONTROL: other args, an unbooked id and a retired id name none", () => {
    const book = makeLocalAskBook();
    const ask = { requestId: "r1", action: "meme-put", args: { bag: "lares" }, requestedBy: "me" };
    book.add({ ...ask, origin: "channel", asker: "seat" } as never);
    expect(book.askerOf(ask)).toBe("seat");
    expect(book.askerOf({ ...ask, args: { bag: "garden" } })).toBeUndefined();
    expect(book.askerOf({ ...ask, requestId: "r2" })).toBeUndefined();
    book.onWikiChange({ "lar:///lararium.local.vm/verbs/r1": { deleted: true } });
    expect(book.askerOf(ask)).toBeUndefined();
  });

  test("RED: runLocalVerb hands the asker to the reactor's context; CONTROL: no askerOf, no asker", async () => {
    const seen: unknown[] = [];
    const registry = new VerbTable();
    registry.register("probe", async (_args, ctx) => { seen.push((ctx as { asker?: unknown }).asker); return {}; });
    const inv = { requestId: "r", title: "t", action: "probe", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "me", requestedAt: "" } as unknown as Verb;
    await runLocalVerb(inv, { daemon: makeDaemon(), registry, askerOf: () => "seat" } as never);
    await runLocalVerb(inv, { daemon: makeDaemon(), registry });
    expect(seen).toEqual(["seat", undefined]);
  });

  test("RED: the dispatcher hands a booked channel ask's asker to the reactor; CONTROL: a synced verb tiddler (content) names none", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const book = makeLocalAskBook();
    const seen: Array<[string, unknown]> = [];
    const registry = new VerbTable();
    registry.register("probe", async (_args, ctx) => { seen.push([ctx.invocation.requestId, (ctx as { asker?: unknown }).asker]); return {}; });
    const dispatcher = new VerbDispatcher({
      daemonVm: tw5, daemon: makeDaemon(), control: memoryControlStore(), registry,
      localOf: (inv) => book.has(inv), surfaceOf: (inv) => book.isSurface(inv), askerOf: (inv) => book.askerOf(inv),
    });
    dispatcher.start();
    const place = async (requestId: string, asker?: string) => {
      const inv = { requestId, action: "probe", args: { x: 1 }, requestedBy: "me" };
      if (asker) book.add({ ...inv, origin: "channel", asker } as never);
      dispatcher.placeVerb({ verb: "probe", args: { x: 1 }, requestedBy: "me", requestId });
      await settle();
    };
    await place("a1", "seat");
    await place("a2", "cli");
    await place("a3");
    expect(seen).toEqual([["a1", "seat"], ["a2", "cli"], ["a3", undefined]]);
    dispatcher.stop();
  });
});
