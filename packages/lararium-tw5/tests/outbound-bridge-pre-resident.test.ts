/** A write the wiki makes BEFORE the shore stands resident (a startup module) is NAMED in the log when the shore stands; a landed seed title is not. */

import { describe, test, expect, vi } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { asIslandStore } from "./island-store-double.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";
import type { ChangeOrigin, LarTiddlerRecord, LarWriteOptions } from "@lararium/mesh";

const SLOTS = {
  working:  "lar:///ha.ka.ba/wikis/test/working",
  draft:    "lar:///ha.ka.ba/wikis/test/draft",
  personal: "lar:///ha.ka.ba/wikis/test/personal",
  temp:     "lar:///ha.ka.ba/wikis/test/temp",
} as const;

/** A store that remembers every put and every bagged tombstone the adaptor lands. */
class RecordingStore extends MemoryTiddlerStore {
  readonly puts: Array<{ title: string; bag: string | undefined; fields: Record<string, unknown> }> = [];
  readonly tombstones: Array<{ title: string; bag: string | undefined }> = [];
  override async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: LarWriteOptions): Promise<void> {
    this.puts.push({ title: record.tiddler.title, bag: options?.bag, fields: record.tiddler as Record<string, unknown> });
    return super.put(record, origin, options);
  }
  async tombstoneInBag(bag: string, title: string, origin: ChangeOrigin): Promise<void> {
    this.tombstones.push({ title, bag });
    return super.tombstone(title, origin);
  }
}


const URI  = "lar:///t/bridge/anchor";
const meme = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/bridge/anchor"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe.skipIf(wikiSkip)(`outbound bridge — a write before the shore stands resident${skipNote}`, () => {
  test("RED: a startup module's write before the seed checkpoint is named, never silent; CONTROL: a seed-landed title is not named and echoes nothing", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void };
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    const lares = (engine.$tw as never as { lares: { enqueueNalu?: (c: unknown) => void } }).lares;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", SLOTS.working],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp", SLOTS.temp],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", SLOTS.draft],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const warns: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warns.push(a.join(" ")); });
    const store = new RecordingStore();
    const adaptor = new IslandAdaptor(engine, asIslandStore(store), "pre-resident");
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    // The seed wave is queued; the shore is not resident yet.
    await MemoryTiddlerStore.prototype.put.call(store, { tiddler: { title: "lar:///t/pre/seeded", text: "from the fleet" } }, { kind: "crdt-remote", edgeIsland: "peer" });
    lares.enqueueNalu!({ title: "lar:///t/pre/seeded", bag: SLOTS.working, record: { tiddler: { title: "lar:///t/pre/seeded", text: "from the fleet" } }, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
    const checkpoint = adaptor.armSeedCheckpoint();
    expect(adaptor.isResident()).toBe(false);
    wiki.addTiddler(new Tiddler({ title: "probe/ran/1", text: "ran" }));
    await checkpoint;
    await adaptor.handsRested();
    await new Promise((r) => setTimeout(r, 50));
    await adaptor.handsRested();
    spy.mockRestore();
    const named = warns.find((w) => w.includes("before the shore stood resident"));
    expect(named, "a write made before the shore stood resident vanished without a trace").toBeDefined();
    expect(named).toContain("probe/ran/1");
    expect(named, "a seed-landed title was named as lost").not.toContain("lar:///t/pre/seeded");
    expect(store.puts.filter((p) => p.title === "lar:///t/pre/seeded"), "a seed-landed title echoed back out").toEqual([]);
  }, 120_000);
});

describe.skipIf(wikiSkip)(`outbound bridge — a lone async write on a resident island${skipNote}`, () => {
  test("RED (measured, no cure yet): one fresh tiddler, the change delivered and scheduled work drained, with no handsRested, teardown, inbound wave or signal, reaches the store", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void };
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", SLOTS.working],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp", SLOTS.temp],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", SLOTS.draft],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const store = new RecordingStore();
    const adaptor = new IslandAdaptor(engine, asIslandStore(store), "lone-async");
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    await adaptor.armSeedCheckpoint();
    store.puts.length = 0;
    // The module's write arrives as a timer would deliver it: alone, async, with nothing else touching the island.
    await new Promise<void>((resolve) => setTimeout(() => { wiki.addTiddler(new Tiddler({ title: "probe/lone", text: "ran" })); resolve(); }, 10));
    for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 25));
    expect(adaptor.holdsHand("probe/lone"), "the lone write still sits as a gate mark (no timer flushes it)").toBe(false);
    expect(store.puts.filter((p) => p.title === "probe/lone"), "one write reaches the store").toHaveLength(1);
  }, 120_000);

  test("eight writes to one title in one change batch coalesce into one store write", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as {
      addTiddler(t: unknown): void;
      addEventListener(type: string, fn: (changes: Record<string, unknown>) => void): void;
      removeEventListener(type: string, fn: (changes: Record<string, unknown>) => void): void;
    };
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", SLOTS.working],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp", SLOTS.temp],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", SLOTS.draft],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const store = new RecordingStore();
    const adaptor = new IslandAdaptor(engine, asIslandStore(store), "batch-coalesce");
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    await adaptor.armSeedCheckpoint();
    let dispatches = 0;
    const count = (changes: Record<string, unknown>): void => { if ("probe/batch" in changes) dispatches++; };
    wiki.addEventListener("change", count);
    try {
      for (let i = 0; i < 8; i++) wiki.addTiddler(new Tiddler({ title: "probe/batch", text: String(i) }));
      await adaptor.handsRested();
      const puts = store.puts.filter((p) => p.title === "probe/batch");
      expect(dispatches).toBe(1);
      expect(puts).toHaveLength(1);
      expect(puts[0].fields.text).toBe("7");
    } finally {
      wiki.removeEventListener("change", count);
    }
  }, 120_000);
});

describe.skipIf(wikiSkip)(`outbound bridge — draft recovery follows the idle drain${skipNote}`, () => {
  async function residentWith(label: string, store = new RecordingStore()) {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void };
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", SLOTS.working],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp", SLOTS.temp],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", SLOTS.draft],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    const adaptor = new IslandAdaptor(engine, asIslandStore(store), label);
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    await adaptor.armSeedCheckpoint();
    store.puts.length = 0;
    const type = async (n: number): Promise<void> => {
      wiki.addTiddler(new Tiddler({ title: "Draft of 'Note'", "draft.of": "Note", "draft.title": "Note", text: `keystroke ${n}` }));
      await new Promise((r) => setTimeout(r, 15));
    };
    const land = async (): Promise<void> => {
      const title = "lar:///t/bridge/inbound";
      const record = { tiddler: { title, text: "remote" } };
      await MemoryTiddlerStore.prototype.put.call(store, record, { kind: "crdt-remote", edgeIsland: "peer" });
      (engine.$tw as never as { lares: { enqueueNalu(c: unknown): void } }).lares.enqueueNalu({ title, bag: SLOTS.working, record, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
      await adaptor.landingIdle();
      await new Promise((r) => setTimeout(r, 30));
    };
    return { adaptor, store, type, land, wiki, Tiddler };
  }
  const draftPuts = (store: RecordingStore): number => store.puts.filter((p) => p.title === "Draft of 'Note'").length;

  test("an attached recovery trigger alone decides when ordinary hands fire", async () => {
    const { adaptor, store, wiki, Tiddler } = await residentWith("trigger-seam");
    let fire!: (titles?: readonly string[]) => Promise<void>;
    adaptor.setRecoveryTrigger({ attach(fn) { fire = fn; return () => {}; } });
    wiki.addTiddler(new Tiddler({ title: "probe/trigger", text: "latest" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(store.puts.filter((p) => p.title === "probe/trigger")).toHaveLength(0);
    await fire();
    expect(store.puts.filter((p) => p.title === "probe/trigger")).toHaveLength(1);
    await adaptor.stop();
  }, 120_000);

  test("twelve draft dispatches reach the store at idle", async () => {
    const { adaptor, store, type } = await residentWith("draft-twelve");
    for (let n = 0; n < 12; n++) await type(n);
    expect(draftPuts(store)).toBeLessThanOrEqual(12);
    expect(store.puts.filter((p) => p.title === "Draft of 'Note'").at(-1)?.fields.text).toBe("keystroke 11");
    expect(store.puts.filter((p) => p.title === "Note")).toHaveLength(0);
    await adaptor.stop();
  }, 120_000);

  test("draft marks during a write coalesce to the latest recovery copy", async () => {
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const writing = new Promise<void>((resolve) => { started = resolve; });
    class HeldStore extends RecordingStore {
      override async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: LarWriteOptions): Promise<void> {
        if (record.tiddler.title === "Draft of 'Note'" && this.puts.every((p) => p.title !== record.tiddler.title)) {
          started();
          await held;
        }
        await super.put(record, origin, options);
      }
    }
    const { adaptor, store, type } = await residentWith("draft-flight", new HeldStore());
    await type(0);
    await writing;
    await type(1);
    await type(2);
    release();
    await new Promise((r) => setTimeout(r, 30));
    const writes = store.puts.filter((p) => p.title === "Draft of 'Note'");
    expect(writes.map((p) => p.fields.text)).toEqual(["keystroke 0", "keystroke 2"]);
    expect(store.puts.filter((p) => p.title === "Note")).toHaveLength(0);
    await adaptor.stop();
  }, 120_000);

  test("an inbound landing neither flushes nor loses an unrelated draft", async () => {
    const { adaptor, store, type, land } = await residentWith("draft-inbound");
    await type(1);
    expect(draftPuts(store)).toBe(1);
    await land();
    expect(draftPuts(store)).toBe(1);
    expect(store.puts.filter((p) => p.title === "Draft of 'Note'").at(-1)?.fields.text).toBe("keystroke 1");
    await adaptor.stop();
  }, 120_000);

  test("a synchronous burst of draft dispatches produces one latest recovery copy", async () => {
    const { adaptor, store, wiki, Tiddler } = await residentWith("draft-burst");
    for (let n = 0; n < 12; n++) {
      wiki.addTiddler(new Tiddler({ title: "Draft of 'Note'", "draft.of": "Note", "draft.title": "Note", text: `keystroke ${n}` }));
    }
    await new Promise((r) => setTimeout(r, 30));
    expect(draftPuts(store)).toBe(1);
    expect(store.puts.filter((p) => p.title === "Draft of 'Note'")[0]?.fields.text).toBe("keystroke 11");
    expect(store.puts.filter((p) => p.title === "Note")).toHaveLength(0);
    await adaptor.stop();
  }, 120_000);
});
