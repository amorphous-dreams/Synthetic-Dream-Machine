/** Wiki changes equal to landed state are foam; each other resident title is a hand for its per-title gate. */

import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { HandGate } from "../src/hand-gate.js";
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

/** Past the per-title trailing window and the wiki's nextTick dispatch. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, HandGate.TRAILING_MS + 100));

const URI  = "lar:///t/bridge/anchor";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/bridge/anchor"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe.skipIf(wikiSkip)(`outbound bridge — a live wiki change reaches the adaptor${skipNote}`, () => {
  let engine: TW5Engine;
  let store: RecordingStore;
  let adaptor: IslandAdaptor;
  let wiki: { addTiddler(t: unknown): void; deleteTiddler(t: string): void; getTiddler(t: string): unknown; addEventListener(type: string, fn: (c: unknown) => void): void; removeEventListener(type: string, fn: (c: unknown) => void): void };
  let Tiddler: new (f: Record<string, unknown>) => unknown;
  let lares: { enqueueNalu?: (c: unknown) => void; isApplyingNalu(): boolean; meme: LaresMemeFace };

  beforeAll(async () => {
    engine  = await bootTestWiki();
    wiki    = engine.$tw.wiki as never;
    Tiddler = (engine.$tw as never as { Tiddler: typeof Tiddler }).Tiddler;
    lares   = (engine.$tw as never as { lares: typeof lares }).lares;
    // The slot pointers `island-recipe` seeds at boot; the packed cascade dereferences them.
    for (const [title, text] of [
      ["lar:///ha.ka.ba/lararium/config/current-wiki-bag",      SLOTS.working],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-temp",     SLOTS.temp],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-draft",    SLOTS.draft],
      ["lar:///ha.ka.ba/lararium/config/current-wiki-personal", SLOTS.personal],
    ] as const) wiki.addTiddler(new Tiddler({ title, text }));
    store   = new RecordingStore();
    adaptor = new IslandAdaptor(engine, asIslandStore(store), "outbound-bridge");
    // The projection registers — the INBOUND half — and the OUTBOUND BRIDGE (Road B) stands over it, the SAME
    // call the kernel makes after `buildIslandRecipe`: one `change` listener, the echo law read off the
    // adaptor's landed ledger.
    adaptor.start();
    bridgeWikiToAdaptor(engine, adaptor);
    await adaptor.armSeedCheckpoint();
  }, 120_000);

  afterEach(() => { store.puts.length = 0; store.tombstones.length = 0; });

  test("(1) SEAM `change`→saveTiddler: `$tw.wiki.addTiddler` of a plain title → `store.put` in working, `$origin-bag` stripped", async () => {
    wiki.addTiddler(new Tiddler({ title: "Shopping List", text: "kalo, poi", "$origin-bag": SLOTS.working }));
    await settle();
    const put = store.puts.find((p) => p.title === "Shopping List");
    expect(put, "no put reached the store — nothing carries the wiki's change event to saveTiddler").toBeDefined();
    expect(put!.bag).toBe(SLOTS.working);
    expect(put!.fields["$origin-bag"], "the host's provenance stamp persisted as a field").toBeUndefined();
  });

  test("(2) SEAM `change`→saveTiddler: a tiddler whose `draft.of` stands → `store.put` in the draft slot", async () => {
    wiki.addTiddler(new Tiddler({ title: "Draft of 'Shopping List'", "draft.of": "Shopping List", "draft.title": "Shopping List", text: "" }));
    await settle();
    const put = store.puts.find((p) => p.title === "Draft of 'Shopping List'");
    expect(put, "the draft never reached the store").toBeDefined();
    expect(put!.bag).toBe(SLOTS.draft);
  });

  test("(3) a saved draft deletion uses the draft bag after the wiki title is gone", async () => {
    wiki.addTiddler(new Tiddler({ title: "Draft of 'Gone'", "draft.of": "Gone", "draft.title": "Gone", text: "" }));
    await settle();
    wiki.deleteTiddler("Draft of 'Gone'");
    await settle();
    const gone = store.tombstones.find((t) => t.title === "Draft of 'Gone'");
    expect(gone, "the delete never reached the store — the record resurrects on the next boot").toBeDefined();
    // The acknowledged draft save owns its delete bag until a wave lands over the title.
    expect(gone!.bag).toBe(SLOTS.draft);
  });

  test("(4) SEAM `change`→saveTiddler: `$:/temp/*` → the temp store, never a CRDT put", async () => {
    wiki.addTiddler(new Tiddler({ title: "$:/temp/scratch", text: "volatile" }));
    await settle();
    const put = store.puts.find((p) => p.title === "$:/temp/scratch");
    expect(put, "the volatile write never reached the composite").toBeDefined();
    expect(put!.bag).toBe(SLOTS.temp);
  });

  test("CONTROL (5): a nalu-applied inbound change fires NO outbound put", async () => {
    // The fleet's record stands in the store before its wave arrives: a bagged wave lands what the
    // composition resolves. The base put leaves `store.puts` to the shore's own writes.
    await MemoryTiddlerStore.prototype.put.call(store, { tiddler: { title: "lar:///t/bridge/inbound", text: "from the fleet" } }, { kind: "crdt-remote", edgeIsland: "peer" });
    lares.enqueueNalu!({
      title: "lar:///t/bridge/inbound", bag: SLOTS.working,
      record: { tiddler: { title: "lar:///t/bridge/inbound", text: "from the fleet" } },
      origin: { kind: "crdt-remote", edgeIsland: "peer" },
    });
    await adaptor.landingIdle();
    expect(wiki.getTiddler("lar:///t/bridge/inbound"), "the inbound apply never reached the wiki").toBeTruthy();
    await settle();
    expect(store.puts.filter((p) => p.title === "lar:///t/bridge/inbound"), "an inbound apply echoed back out as a put").toEqual([]);
  });

  test("CONTROL (5b) MEASURED: `change` dispatches after the drain lowered `isApplyingNalu` — a `change`-riding bridge cannot lean on the guard", async () => {
    const seen: boolean[] = [];
    const onChange = (): void => { seen.push(lares.isApplyingNalu()); };
    wiki.addEventListener("change", onChange);
    try {
      await MemoryTiddlerStore.prototype.put.call(store, { tiddler: { title: "lar:///t/bridge/inbound-2", text: "from the fleet" } }, { kind: "crdt-remote", edgeIsland: "peer" });
      lares.enqueueNalu!({
        title: "lar:///t/bridge/inbound-2", bag: SLOTS.working,
        record: { tiddler: { title: "lar:///t/bridge/inbound-2", text: "from the fleet" } },
        origin: { kind: "crdt-remote", edgeIsland: "peer" },
      });
      await adaptor.landingIdle();
      expect(lares.isApplyingNalu(), "the guard stays raised past the landing").toBe(false);
      await settle();
    } finally {
      wiki.removeEventListener("change", onChange);
    }
    expect(seen.length, "no change event fired for the applied tiddler").toBeGreaterThan(0);
    expect(seen.every((v) => v === false), "the guard read raised inside `change` — the trap closed; retire this measurement").toBe(true);
  });

  test("(6) SEAM anchor→store: `$tw.lares.meme.place` (the anchor `meme put`, no target) → its records reach the working store, not `$tw.wiki` alone", async () => {
    const receipt = await lares.meme.place(URI, meme(["/a", "/b"]));
    expect(receipt.decision).toBe("ingest");
    expect(wiki.getTiddler(`${URI}#/a`), "the placement never reached the wiki").toBeTruthy();
    await settle();
    const titles = store.puts.filter((p) => p.bag === SLOTS.working).map((p) => p.title);
    expect(titles, "the anchor placement stands in $tw.wiki alone — no record reached the working store").toContain(URI);
    expect(titles).toContain(`${URI}#/a`);
  });
});
