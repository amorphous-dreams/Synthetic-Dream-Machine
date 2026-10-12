import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor } from "../src/meme-verbs.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";

class Wiki {
  private readonly records = new Map<string, Record<string, unknown>>();
  private readonly listeners = new Set<(changed: Record<string, { deleted?: boolean }>) => void>();
  readonly wiki = {
    getTiddlerText: (_title: string, fallback = "") => fallback,
    addTiddler: (input: { fields?: Record<string, unknown> } | Record<string, unknown>) => {
      const fields = "fields" in input && input.fields ? input.fields : input as Record<string, unknown>;
      const title = String(fields.title);
      this.records.set(title, { ...fields });
      for (const listener of this.listeners) listener({ [title]: {} });
    },
    getTiddler: (title: string) => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string) => { this.records.delete(title); },
    addEventListener: (_type: string, listener: (changed: Record<string, { deleted?: boolean }>) => void) => this.listeners.add(listener),
    removeEventListener: (_type: string, listener: (changed: Record<string, { deleted?: boolean }>) => void) => this.listeners.delete(listener),
  };
  readonly $tw = { Tiddler: class { fields: Record<string, unknown>; constructor(fields: Record<string, unknown>) { this.fields = fields; } }, wiki: this.wiki };
}

describe("a meme write into the daemon's own wiki without a working layer", () => {
  test("the dispatcher reports the named refusal and writes no content", async () => {
    const daemon = new CompositeStore();
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
    const tw5 = new Wiki();
    const options = { composite: daemon, tw5: tw5 as unknown as Pick<TW5Engine, "$tw"> };
    const registry = new VerbTable();
    registry.register("meme-put", makeMemePutReactor(options));
    const dispatcher = new VerbDispatcher({ daemonVm: tw5 as unknown as TW5Engine, daemon, registry });
    dispatcher.start();
    const outcomeTitle = `${OUTCOME_URI_PREFIX}meme-no-working`;
    const outcomeLanded = new Promise<void>((resolve) => {
      const stop = daemon.subscribe((change) => { if (change.title === outcomeTitle && change.record) { stop(); resolve(); } });
    });
    dispatcher.placeVerb({ verb: "meme-put", args: { recipe: "default", uri: "lar:///t/no-working", text: "content" }, requestedBy: "did:key:test", requestId: "meme-no-working" });
    await outcomeLanded;

    const outcome = await daemonBag.get(`${OUTCOME_URI_PREFIX}meme-no-working`);
    expect(outcome?.tiddler.status).toBe("error");
    expect(String(outcome?.tiddler["error-message"])).toContain("no default writable layer");
    expect(await daemonBag.get("lar:///t/no-working")).toBeNull();
    expect(await daemon.defaultWritableBagId()).toBeNull();
    expect(String(outcome?.tiddler["error-message"]), "the refusal named no remedy").toContain("--recipe");
    dispatcher.stop();
  });
});
