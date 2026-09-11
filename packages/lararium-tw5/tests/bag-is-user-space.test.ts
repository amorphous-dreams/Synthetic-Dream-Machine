/**
 * `bag` IS USER SPACE. `$origin-bag` IS THE HOST'S PROVENANCE. RESIDENCY RIDES THE ENVELOPE.
 *
 * TiddlyWeb stamps `bag` on a tiddler as server-side provenance and ignores it for routing. An author
 * here may hold a `bag` field of their own — an NPC's inventory — and it must pass every hand the
 * house lays on a record without being read, rewritten or stripped: the inbound nalu, the outbound
 * adaptor, the placement sinks. The host's own "which bag did this come from" wears `$origin-bag`,
 * a name no author collides with, present on the wiki tiddler and absent from every render and
 * every persisted record.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { toWikiFields } from "../src/modules/nalu-engine.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { storeMemeSink } from "../src/meme-sinks.js";
import { placeMeme } from "../src/place-meme.js";
import type { LarTiddlerChange, ChangeOrigin } from "@lararium/mesh";

const INVENTORY = "backpack: rope, lantern, 3 torches";
const URI = "lar:///t/npc";
const ORIGIN_BAG = "lar:///ha.ka.ba/bags/sdm";
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const BAG_PATHS_CONFIG = "lar:///ha.ka.ba/lararium/config/bag-paths";

describe("★ the inbound nalu ★", () => {
  test("a record's own `bag` survives; the envelope's bag lands as `$origin-bag` only", () => {
    const change: LarTiddlerChange = {
      title: URI,
      record: { tiddler: { title: URI, text: "an NPC", bag: INVENTORY } },
      origin: { kind: "crdt-remote", edgeIsland: "automerge" },
      bag: ORIGIN_BAG,
    };
    const fields = toWikiFields(change) as Record<string, unknown>;
    expect(fields["bag"]).toBe(INVENTORY);
    expect(fields["$origin-bag"]).toBe(ORIGIN_BAG);
  });

  test("CONTROL: no envelope bag → no `$origin-bag`, and the author's field still stands", () => {
    const change: LarTiddlerChange = {
      title: URI,
      record: { tiddler: { title: URI, bag: INVENTORY } },
      origin: { kind: "crdt-remote", edgeIsland: "automerge" },
    };
    const fields = toWikiFields(change) as Record<string, unknown>;
    expect(fields["bag"]).toBe(INVENTORY);
    expect(fields["$origin-bag"]).toBeUndefined();
  });
});

/** The smallest engine the adaptor's outbound path needs: a cascade routing every `lar:` title to one bag. */
class FakeEngine {
  readonly texts = new Map<string, string>([
    [BAG_PATHS_CONFIG, `[prefix[lar:]then{${CURRENT_WIKI_BAG}}]`],
    [CURRENT_WIKI_BAG, ORIGIN_BAG],
  ]);
  readonly wiki = {
    getTiddlerText: (t: string, d = ""): string => this.texts.get(t) ?? d,
    // The cascade's one rule, read against the title the source yields.
    filterTiddlers: (filter: string, _w: unknown, source: unknown): string[] => {
      let title = "";
      (source as (fn: (t: unknown, ti: string) => void) => void)((_t, ti) => { title = ti; });
      return /^\[prefix\[lar:\]/.test(filter) && title.startsWith("lar:") ? [ORIGIN_BAG] : [];
    },
    getTiddler: (): undefined => undefined,
    deleteTiddler: (): void => {},
    addTiddler: (): void => {},
    transact: (fn: () => void): void => fn(),
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
  };
  readonly $tw = {
    Tiddler: class {
      fields: Record<string, unknown>;
      constructor(fields: Record<string, unknown>) { this.fields = fields; }
      getFieldStrings(): Record<string, string> {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(this.fields)) if (v !== undefined) out[k] = String(v);
        return out;
      }
    },
    wiki: this.wiki,
    lares: { isApplyingNalu: () => false, enqueueNalu: () => {}, flushNalu: () => {}, naluPending: () => 0 },
  };
}

describe("★ the outbound adaptor ★", () => {
  let store: MemoryTiddlerStore;
  let adaptor: IslandAdaptor;
  const puts: Array<{ fields: Record<string, unknown>; bag: string | undefined }> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    puts.length = 0;
    store = new MemoryTiddlerStore();
    const orig = store.put.bind(store);
    store.put = async (rec, origin: ChangeOrigin, options?: { bag?: string }) => {
      puts.push({ fields: rec.tiddler as Record<string, unknown>, bag: options?.bag });
      return orig(rec, origin);
    };
    adaptor = new IslandAdaptor(new FakeEngine() as never, store, "witness", ORIGIN_BAG);
    adaptor.start();
  });
  afterEach(() => { adaptor.stop(); vi.useRealTimers(); });

  test("★ an author's `bag` never routes the save and rides into the record whole ★", async () => {
    const done = adaptor.saveTiddler({ fields: { title: URI, text: "an NPC", bag: INVENTORY, "$origin-bag": ORIGIN_BAG } });
    await vi.advanceTimersByTimeAsync(IslandAdaptor.DEBOUNCE_MS + 1);
    await done;
    expect(puts).toHaveLength(1);
    // Residency rides the envelope: the cascade's bag, never the field's value.
    expect(puts[0]!.bag).toBe(ORIGIN_BAG);
    // The author's field persists; the host's provenance does not.
    expect(puts[0]!.fields["bag"]).toBe(INVENTORY);
    expect(puts[0]!.fields["$origin-bag"]).toBeUndefined();
  });
});

describe("★ the placement sinks ★", () => {
  test("a store sink hands an author's `bag` back untouched and stamps nothing into the record", async () => {
    const store = new MemoryTiddlerStore(ORIGIN_BAG);
    const sink = storeMemeSink(store, ORIGIN_BAG, { kind: "lares-verb", requestId: "w" });
    await sink.land({ title: URI, text: "an NPC", bag: INVENTORY });
    const persisted = (await store.get(URI))!.tiddler as Record<string, unknown>;
    expect(persisted["bag"]).toBe(INVENTORY);
    expect((await sink.read(URI))?.bag).toBe(INVENTORY);
  });

  test("★ round trip: a meme whose meta carries `bag = …` lands, reads back, and re-places as a noop ★", async () => {
    const meme =
      `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/npc"\nbag = "${INVENTORY}"\n\`\`\`\n\n` +
      `<<^ code="&#x0002;">>\n\nan NPC\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;
    const store = new MemoryTiddlerStore(ORIGIN_BAG);
    const sink = storeMemeSink(store, ORIGIN_BAG, { kind: "lares-verb", requestId: "w" });
    const first = await placeMeme({ uri: URI, text: meme }, sink);
    expect(first.decision).toBe("ingest");
    expect((await store.get(URI))!.tiddler["bag"]).toBe(INVENTORY);
    const again = await placeMeme({ uri: URI, text: meme, baseHash: first.canonicalHash }, sink);
    expect(again.decision).toBe("noop");
  });
});
