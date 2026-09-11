/**
 * outbound-bridge — the wire from a live `$tw.wiki` change to `IslandAdaptor.saveTiddler` / `deleteTiddler`.
 *
 * ── THE SEAM THIS HOLDS ─────────────────────────────────────────────────────────────────────────
 * The adaptor's outbound half stands complete: `saveTiddler` walks the cascade, debounces, strips the
 * host's `$origin-bag` stamp and puts into the slot the cascade named; `deleteTiddler` reads the
 * last-known-slot map and tombstones there. What the island never wired is the SUBSCRIPTION — nothing
 * carries a `wiki.addEventListener("change")` into those two methods. `sovereign-kernel.ts` drops the
 * adaptor `buildIslandRecipe` returns; `tw5-vm.ts` subscribes `tm-verse-event` alone; TW5's own
 * `$tw.syncer` never stands because no `module-type: syncadaptor` registers. So a hand edit, and the
 * anchor `meme put`, land in `$tw.wiki` and go no further.
 *
 * Every vector below drives the REAL wiki and a recording store with NO wire of its own — each reads
 * red for exactly the seam it names, and flips loud the day the bridge lands (`test.fails`). The
 * CONTROLS stand green today and MUST stay green under the bridge.
 *
 * ── THE ECHO TRAP THE CONTROLS MEASURE ──────────────────────────────────────────────────────────
 * TiddlyWiki dispatches `change` on `$tw.utils.nextTick` (`core/modules/wiki.js` `enqueueTiddlerEvent`),
 * AFTER the nalu drain's `finally` lowered `_applying`. A bridge riding `change` therefore sees
 * `isApplyingNalu()` already false for every inbound apply — the guard gates a SYNCHRONOUS caller
 * only. TW5's syncer carries its own echo law for the same reason: `tiddlerInfo[title].changeCount`,
 * stamped at `storeTiddler` and compared at `chooseNextTask`. The bridge owes one of those.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/outbound-bridge
 */

import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
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

/** Past the adaptor's capture debounce and the wiki's nextTick dispatch. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, IslandAdaptor.DEBOUNCE_MS + 100));

const URI  = "lar:///t/bridge/anchor";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/bridge/anchor"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe.skipIf(wikiSkip)(`outbound bridge — a live wiki change reaches the adaptor${skipNote}`, () => {
  let engine: TW5Engine;
  let store: RecordingStore;
  let adaptor: IslandAdaptor;
  let wiki: { addTiddler(t: unknown): void; deleteTiddler(t: string): void; getTiddler(t: string): unknown; addEventListener(type: string, fn: (c: unknown) => void): void; removeEventListener(type: string, fn: (c: unknown) => void): void };
  let Tiddler: new (f: Record<string, unknown>) => unknown;
  let lares: { enqueueNalu(c: unknown): void; flushNalu(): void; isApplyingNalu(): boolean; meme: LaresMemeFace };

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
    adaptor = new IslandAdaptor(engine, store, "outbound-bridge");
    // The projection registers — the INBOUND half. No outbound subscription exists to register: that is the seam.
    adaptor.start();
  }, 120_000);

  afterEach(() => { store.puts.length = 0; store.tombstones.length = 0; });

  test.fails("(1) SEAM `change`→saveTiddler: `$tw.wiki.addTiddler` of a plain title → `store.put` in working, `$origin-bag` stripped", async () => {
    wiki.addTiddler(new Tiddler({ title: "Shopping List", text: "kalo, poi", "$origin-bag": SLOTS.working }));
    await settle();
    const put = store.puts.find((p) => p.title === "Shopping List");
    expect(put, "no put reached the store — nothing carries the wiki's change event to saveTiddler").toBeDefined();
    expect(put!.bag).toBe(SLOTS.working);
    expect(put!.fields["$origin-bag"], "the host's provenance stamp persisted as a field").toBeUndefined();
  });

  test.fails("(2) SEAM `change`→saveTiddler: a tiddler whose `draft.of` stands → `store.put` in the draft slot", async () => {
    wiki.addTiddler(new Tiddler({ title: "Draft of 'Shopping List'", "draft.of": "Shopping List", "draft.title": "Shopping List", text: "" }));
    await settle();
    const put = store.puts.find((p) => p.title === "Draft of 'Shopping List'");
    expect(put, "the draft never reached the store").toBeDefined();
    expect(put!.bag).toBe(SLOTS.draft);
  });

  test.fails("(3) SEAM `change`(deleted)→deleteTiddler: `$tw.wiki.deleteTiddler` → `tombstoneInBag` in the slot the map recorded", async () => {
    wiki.addTiddler(new Tiddler({ title: "Draft of 'Gone'", "draft.of": "Gone", "draft.title": "Gone", text: "" }));
    await settle();
    wiki.deleteTiddler("Draft of 'Gone'");
    await settle();
    const gone = store.tombstones.find((t) => t.title === "Draft of 'Gone'");
    expect(gone, "the delete never reached the store — the record resurrects on the next boot").toBeDefined();
    // The tiddler is gone when the delete runs; only the map knows it was a draft.
    expect(gone!.bag).toBe(SLOTS.draft);
  });

  test.fails("(4) SEAM `change`→saveTiddler: `$:/temp/*` → the temp store, never a CRDT put", async () => {
    wiki.addTiddler(new Tiddler({ title: "$:/temp/scratch", text: "volatile" }));
    await settle();
    const put = store.puts.find((p) => p.title === "$:/temp/scratch");
    expect(put, "the volatile write never reached the composite").toBeDefined();
    expect(put!.bag).toBe(SLOTS.temp);
  });

  test("CONTROL (5): a nalu-applied inbound change fires NO outbound put", async () => {
    lares.enqueueNalu({
      title: "lar:///t/bridge/inbound", bag: SLOTS.working,
      record: { tiddler: { title: "lar:///t/bridge/inbound", text: "from the fleet" } },
      origin: { kind: "crdt-remote", edgeIsland: "peer" },
    });
    lares.flushNalu();
    expect(wiki.getTiddler("lar:///t/bridge/inbound"), "the inbound apply never reached the wiki").toBeTruthy();
    await settle();
    expect(store.puts.filter((p) => p.title === "lar:///t/bridge/inbound"), "an inbound apply echoed back out as a put").toEqual([]);
  });

  test("CONTROL (5b) MEASURED: `change` dispatches after the drain lowered `isApplyingNalu` — a `change`-riding bridge cannot lean on the guard", async () => {
    const seen: boolean[] = [];
    const onChange = (): void => { seen.push(lares.isApplyingNalu()); };
    wiki.addEventListener("change", onChange);
    try {
      lares.enqueueNalu({
        title: "lar:///t/bridge/inbound-2", bag: SLOTS.working,
        record: { tiddler: { title: "lar:///t/bridge/inbound-2", text: "from the fleet" } },
        origin: { kind: "crdt-remote", edgeIsland: "peer" },
      });
      lares.flushNalu();
      expect(lares.isApplyingNalu(), "the guard stays raised past the drain").toBe(false);
      await settle();
    } finally {
      wiki.removeEventListener("change", onChange);
    }
    expect(seen.length, "no change event fired for the applied tiddler").toBeGreaterThan(0);
    expect(seen.every((v) => v === false), "the guard read raised inside `change` — the trap closed; retire this measurement").toBe(true);
  });

  test.fails("(6) SEAM anchor→store: `$tw.lares.meme.place` (the anchor `meme put`, no target) → its records reach the working store, not `$tw.wiki` alone", async () => {
    const receipt = await lares.meme.place(URI, meme(["/a", "/b"]));
    expect(receipt.decision).toBe("ingest");
    expect(wiki.getTiddler(`${URI}#/a`), "the placement never reached the wiki").toBeTruthy();
    await settle();
    const titles = store.puts.filter((p) => p.bag === SLOTS.working).map((p) => p.title);
    expect(titles, "the anchor placement stands in $tw.wiki alone — no record reached the working store").toContain(URI);
    expect(titles).toContain(`${URI}#/a`);
  });
});
