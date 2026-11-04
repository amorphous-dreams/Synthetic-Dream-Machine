/** The writable marker in TW5's own scheduler: the thunk stands the shore, then a module ordered after `lararium-writable` writes into a live backing. */

import { describe, test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { TW5Engine } from "../src/tw5-vm.js";
import { CORE_PATH } from "./test-wiki.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN } from "../src/plugin-tiddler.generated.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { asIslandStore } from "./island-store-double.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
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

const MODULE_TEXT = (extra: string): string => `exports.name="probe-after-writable";exports.after=["lararium-writable"];exports.synchronous=true;exports.startup=function(){${extra}};`;
const moduleTiddler = (title: string, text: string): Record<string, unknown> => ({ title, type: "application/javascript", "module-type": "startup", text });

async function bootWith(opts: { stand?: (engine: TW5Engine) => Promise<void>; module: string; before?: boolean }) {
  const engine = new TW5Engine();
  const seen: Record<string, unknown> = {};
  await engine.boot(new Uint8Array(readFileSync(CORE_PATH)), [
    LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>,
    moduleTiddler("$:/test/probe-after-writable", MODULE_TEXT(opts.module)),
  ], undefined, {
    onInstance(instance) {
      const tw = instance as unknown as { larariumWritableStand?: () => Promise<unknown>; __seen?: Record<string, unknown> };
      tw.__seen = seen;
      if (!opts.stand) return;
      Object.defineProperty(instance, "larariumWritableStand", { configurable: true, enumerable: false, value: async () => { await opts.stand!(engine); return { state: "standing" }; } });
    },
  });
  return { engine, seen };
}

const stoodShore = (store: RecordingStore, adaptor: { value?: IslandAdaptor }) => async (engine: TW5Engine): Promise<void> => {
  const wiki = engine.$tw.wiki as unknown as { addTiddler(t: unknown): void };
  const Tiddler = (engine.$tw as never as { Tiddler: new (f: Record<string, unknown>) => unknown }).Tiddler;
  for (const [title, text] of [
    ["lar:///ha.ka.ba/lararium/config/current-wiki-bag", SLOTS.working],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-temp", SLOTS.temp],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-draft", SLOTS.draft],
    ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
  ] as const) wiki.addTiddler(new Tiddler({ title, text }));
  adaptor.value = new IslandAdaptor(engine, asIslandStore(store), "writable-marker");
  adaptor.value.start();
  bridgeWikiToAdaptor(engine, adaptor.value);
  await adaptor.value.armSeedCheckpoint();
};

describe.skipIf(wikiSkip)(`writable marker — the scheduler holds a dependent until the backing stands${skipNote}`, () => {
  test("T1/T2: a module ordered after the marker starts with the shore resident and its write reaches the store; no pre-resident warning", async () => {
    const warns: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warns.push(a.join(" ")); });
    const store = new RecordingStore();
    const adaptor: { value?: IslandAdaptor } = {};
    const resident: boolean[] = [];
    const { engine } = await bootWith({
      stand: stoodShore(store, adaptor),
      module: `$tw.__seen.resident=true;$tw.wiki.addTiddler({title:"probe/after-writable",text:"ran"});`,
    });
    // the module's own view of the shore: read after boot, the shore was resident when it ran
    resident.push(adaptor.value!.isResident());
    await adaptor.value!.handsRested();
    await new Promise((r) => setTimeout(r, 30));
    spy.mockRestore();
    expect(resident).toEqual([true]);
    expect(store.puts.some((p) => p.title === "probe/after-writable" && p.bag === SLOTS.working), "the dependent's write reached the working bag").toBe(true);
    expect(warns.filter((w) => w.includes("before the shore stood resident") && w.includes("probe/after-writable")), "the dependent was named as lost").toEqual([]);
    expect(engine.wiki.getTiddler("$:/temp/lares/writable")).toBeDefined();
  }, 120_000);

  test("CONTROL: a module with no `after` still meets the refuse-by-name floor", async () => {
    const warns: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warns.push(a.join(" ")); });
    const store = new RecordingStore();
    const adaptor: { value?: IslandAdaptor } = {};
    const engine = new TW5Engine();
    await engine.boot(new Uint8Array(readFileSync(CORE_PATH)), [
      LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>,
      moduleTiddler("$:/test/probe-early", `exports.name="probe-early";exports.before=["lararium-writable"];exports.after=["startup"];exports.synchronous=true;exports.startup=function(){$tw.wiki.addTiddler({title:"probe/early",text:"ran"});};`),
    ], undefined, { onInstance(instance) { Object.defineProperty(instance, "larariumWritableStand", { configurable: true, enumerable: false, value: async () => { await stoodShore(store, adaptor)(engine); return { state: "standing" }; } }); } });
    await adaptor.value!.handsRested();
    await new Promise((r) => setTimeout(r, 30));
    spy.mockRestore();
    expect(store.puts.some((p) => p.title === "probe/early")).toBe(false);
    expect(warns.some((w) => w.includes("before the shore stood resident") && w.includes("probe/early"))).toBe(true);
  }, 120_000);

  test("T6: a module that calls the stand itself changes nothing (the door is gone once the marker takes it)", async () => {
    const store = new RecordingStore();
    const adaptor: { value?: IslandAdaptor } = {};
    let calls = 0;
    const { engine } = await bootWith({
      stand: async (e) => { calls++; await stoodShore(store, adaptor)(e); },
      module: `if(typeof $tw.larariumWritableStand==="function"){$tw.larariumWritableStand();}$tw.wiki.addTiddler({title:"probe/t6",text:"x"});`,
    });
    expect(calls).toBe(1);
    expect(Object.keys(engine.$tw as object)).not.toContain("larariumWritableStand");
  }, 120_000);
});
