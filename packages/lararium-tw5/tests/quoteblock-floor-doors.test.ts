/**
 * THE QUOTEBLOCK FLOOR SITS IN THE DESERIALIZER, SO EVERY DOOR FENCES BY CONSTRUCTION
 * (`ahu.mem#/quoteblock-floor`). The floor is a pure, idempotent text transform inside
 * `memeticWikitextDeserializer`, right behind the frame verdict: TW5's own doors (import, drop, paste,
 * boot-folder load) read through the registered deserializer, and the bag doors (LOAD, the syncer
 * INGEST, native INGEST, a pack member) read through it or through the gate that calls it.
 *
 * Each door SURFACES the fence where it can: a wiki's alert rail, a bag door's receipt warnings, and
 * `$:/Import`'s listing message for the TW5 import doors. A torn frame holds verbatim as ONE flagged
 * record through TW5's own doors (their contract has no refuse channel). Every bag door has one and
 * REFUSES the tear before it writes: LOAD and a native INGEST leave a family standing under the carrier's
 * title byte-identical, and the Confluence gate refuses on the frame's own grade.
 *
 * CONTROLS: a clean carrier decomposes, carries no flag, and its receipts carry no `warnings` key.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { CompositeStore, carrierHash } from "@lararium/mesh";
import type { CapabilityAccess, CapabilityVerifyResult, Verb, VerbContext } from "@lararium/mesh";
import {
  memeticWikitextDeserializer, quoteblockFence, QUOTEBLOCKED_FIELD, TORN_FIELD, BARE_DATA_TYPE,
} from "../src/deserializer.js";
import { registerActionReactors, type Tw5Deserializer } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import { upgrade } from "../src/modules/import-floor-upgrader.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const URI = "lar:///t/floor-doors";
const BAG = "lar:///ha.ka.ba/bags/floor-doors";
const CARRIER = "text/memetic-wikitext+tiddlywiki";

/** A framed carrier over an authored body, root meta opening the body. */
const carrier = (body: string, uri = URI): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n\`\`\`\n\n` +
  `${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const SOUND = "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>";
const ORPHAN = "<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nstray prose\n\n<<~/ahu>>";
/** A meta fence above STX: the frame verdict's tear. */
const TORN = `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/floor-doors"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n${SOUND}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const sha = (s: string) => `sha256:${createHash("sha256").update(s, "utf8").digest("hex")}`;

// ---------------------------------------------------------------------------
// The TW5 contract — `(text, fields) → fields[]`, no refuse channel
// ---------------------------------------------------------------------------

describe("★ the deserializer lays the floor — the TW5 contract fences by construction ★", () => {
  test("an un-decomposable carrier deserializes to ONE fenced root carrying the floor's account", () => {
    const records = memeticWikitextDeserializer(carrier(ORPHAN), { title: URI });
    expect(records.map((r) => r.title)).toEqual([URI]);
    expect(records[0]!.text).toBe(quoteblockFence(ORPHAN));
    expect(String(records[0]![QUOTEBLOCKED_FIELD])).toContain("ahu-orphan-close");
  });

  test("the transform is idempotent: the fenced text reads the same records again, with nothing left to fence", () => {
    const fenced = memeticWikitextDeserializer(carrier(ORPHAN), { title: URI })[0]!;
    const again = memeticWikitextDeserializer(carrier(String(fenced.text)), { title: URI });
    expect(again.map((r) => r.title)).toEqual([URI]);
    expect(again[0]!.text).toBe(fenced.text);
    expect(again[0]![QUOTEBLOCKED_FIELD]).toBeUndefined();
  });

  test("a torn frame holds verbatim as ONE flagged record — never split, never fenced", () => {
    const held = memeticWikitextDeserializer(TORN, { title: URI });
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ title: URI, type: BARE_DATA_TYPE, text: TORN });
    expect(String(held[0]![TORN_FIELD])).toContain("before STX");
    expect(held[0]![QUOTEBLOCKED_FIELD]).toBeUndefined();
  });

  test("CONTROL: a clean carrier decomposes and carries no flag", () => {
    const records = memeticWikitextDeserializer(carrier(SOUND), { title: URI });
    expect(records.map((r) => r.title)).toEqual([URI, `${URI}#/a`]);
    for (const r of records) {
      expect(r[QUOTEBLOCKED_FIELD]).toBeUndefined();
      expect(r[TORN_FIELD]).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// The bag doors — a bag holds no alert rail, so the receipt carries the fence
// ---------------------------------------------------------------------------

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

function ctx(composite: CompositeStore, action: string, args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-floor", title: "lar:///lararium.local.vm/verbs/req-floor",
    action, args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-06T00:00:00Z",
  } as Verb;
  return { daemon: composite, invocation, cap: allowCap };
}

function makeComposite(): CompositeStore {
  const c = new CompositeStore();
  c.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(), writable: true });
  return c;
}

/** A registry stand-in that routes every extension to the memetic deserializer — the type a `.mem`
 *  extension resolves to — so a native door reads a carrier through the same reader TW5 would. */
function memeticRegistry(): Tw5Deserializer {
  return {
    deserialize: (_ext, text, fields) => memeticWikitextDeserializer(text, fields) as Array<Record<string, unknown>>,
    parseFields: () => ({}),
    renderCarrier: (_uri, fields) => ({ body: String(fields["text"] ?? "") }),
    serializeBundle: () => { throw new Error("unused"); },
    contentTypeFromExt: () => CARRIER,
  };
}

async function run(composite: CompositeStore, action: "LOAD" | "INGEST", args: Record<string, unknown>, tw5?: Tw5Deserializer) {
  const table = new VerbTable();
  registerActionReactors(table, { composite, ...(tw5 ? { tw5 } : {}) });
  return await table.get(action)!(args, ctx(composite, action, args)) as Record<string, unknown>;
}

describe("★ every bag door fences, and its receipt names the fence ★", () => {
  test("LOAD lands the fenced root and its receipt carries the floor's warning", async () => {
    const composite = makeComposite();
    const result = await run(composite, "LOAD", {
      "source-uri": "file:///staged/floor.mem", "to-bag": BAG, "change-id": "c-load",
      carriers: [{ title: URI, text: carrier(ORPHAN) }],
    });
    expect(result["titles"]).toEqual([URI]);
    expect((await composite.get(URI))!.tiddler.text).toBe(quoteblockFence(ORPHAN));
    expect((result["warnings"] as string[]).join(" ")).toContain("ahu-orphan-close");
  });

  /** Every record the bag holds under the carrier's family, serialized — the byte-identity witness. */
  async function familyBytes(composite: CompositeStore): Promise<string> {
    const titles = (await composite.listVisible()).filter((t) => t === URI || t.startsWith(`${URI}#`) || t.startsWith(`${URI}/`)).sort();
    const records = await Promise.all(titles.map(async (t) => [t, await composite.get(t)] as const));
    return JSON.stringify(records);
  }

  /** A bag with a sound family standing under the carrier's title, landed by a sound LOAD. */
  async function standingFamily(): Promise<CompositeStore> {
    const composite = makeComposite();
    await run(composite, "LOAD", {
      "source-uri": "file:///staged/sound.mem", "to-bag": BAG, "change-id": "c-stand",
      carriers: [{ title: URI, text: carrier(SOUND) }],
    });
    return composite;
  }

  test("★ a torn LOAD over a standing family REFUSES, and the family stands byte-identical ★", async () => {
    const composite = await standingFamily();
    const before = await familyBytes(composite);
    expect(before).toContain(`${URI}#/a`);                       // the family stands: root and child
    await expect(run(composite, "LOAD", {
      "source-uri": "file:///staged/torn.mem", "to-bag": BAG, "change-id": "c-torn",
      carriers: [{ title: `${URI}-sibling`, text: carrier(SOUND, `${URI}-sibling`) }, { title: URI, text: TORN }],
    })).rejects.toThrow(/torn/);
    expect(await familyBytes(composite)).toBe(before);
    // Refused BEFORE any write: the sound sibling in the same LOAD never landed either.
    expect(await composite.get(`${URI}-sibling`)).toBeFalsy();
  });

  test("★ a torn native INGEST over a standing family REFUSES on its receipt, and the family stands byte-identical ★", async () => {
    const composite = await standingFamily();
    const before = await familyBytes(composite);
    // No speaking head: the content route is native, and the registry hands the bytes to the memetic reader,
    // which holds the tear verbatim at the carrier's root.
    const text = TORN.replace(/^<<\^ code="&#x0001;"[^\n]*\n/, "");
    expect(memeticWikitextDeserializer(text, { title: URI })[0]![TORN_FIELD]).toBeTruthy();
    const result = await run(composite, "INGEST", {
      "source-uri": "file:///staged/torn.mem", "to-bag": BAG, "change-id": "c-torn",
      carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".mem" }],
    }, memeticRegistry());
    const receipt = (result["carriers"] as Array<Record<string, unknown>>)[0]!;
    expect(receipt).toMatchObject({ uri: URI, decision: "refuse", grade: "error" });
    expect((receipt["warnings"] as string[]).join(" ")).toContain("torn frame refused");
    expect(await familyBytes(composite)).toBe(before);
  });

  test("CONTROL: a sound carrier LOADs over the same family", async () => {
    const composite = await standingFamily();
    const result = await run(composite, "LOAD", {
      "source-uri": "file:///staged/sound.mem", "to-bag": BAG, "change-id": "c-again",
      carriers: [{ title: URI, text: carrier(SOUND) }],
    });
    expect(result["titles"]).toContain(URI);
    expect(result).not.toHaveProperty("warnings");
  });

  test("the syncer INGEST receipt CARRIES the placement's warnings — `quoteblocked` is never dropped", async () => {
    const composite = makeComposite();
    const text = carrier(ORPHAN);
    const result = await run(composite, "INGEST", {
      "source-uri": "file:///staged/floor.mem", "to-bag": BAG, "change-id": "c-ingest",
      carriers: [{ uri: URI, text, diskHash: sha(text), syncedHash: null }],
    });
    const receipt = (result["carriers"] as Array<Record<string, unknown>>)[0]!;
    expect(receipt["decision"]).toBe("ingest");
    expect((receipt["warnings"] as string[]).join(" ")).toContain("ahu-orphan-close");
  });

  test("a native single-carrier INGEST read through the registry fences, and its receipt says so", async () => {
    const composite = makeComposite();
    // No head: the content route is native, and the registry hands the bytes to the memetic reader.
    const text = `<<^ code="&#x0002;">>\n\n${ORPHAN}\n\n<<^ code="&#x0003;">>\n`;
    const result = await run(composite, "INGEST", {
      "source-uri": "file:///staged/floor.mem", "to-bag": BAG, "change-id": "c-native",
      carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".mem" }],
    }, memeticRegistry());
    const receipt = (result["carriers"] as Array<Record<string, unknown>>)[0]!;
    expect(receipt["decision"]).toBe("ingest");
    expect(String((await composite.get(URI))!.tiddler.text)).toContain(quoteblockFence(ORPHAN));
    expect((receipt["warnings"] as string[]).join(" ")).toContain("ahu-orphan-close");
  });

  test("a pack member the registry fenced names the fence on its own member receipt", async () => {
    const composite = makeComposite();
    const fencedMember = memeticWikitextDeserializer(carrier(ORPHAN, `${URI}-a`), { title: `${URI}-a` })[0]!;
    const plainMember = { title: `${URI}-b`, type: "text/plain", text: "b" };
    const registry: Tw5Deserializer = { ...memeticRegistry(), deserialize: () => [fencedMember, plainMember] };
    const text = "pack bytes";
    const result = await run(composite, "INGEST", {
      "source-uri": "file:///staged/pack.json", "to-bag": BAG, "change-id": "c-pack",
      carriers: [{ uri: URI, text, diskHash: carrierHash(text), syncedHash: null, ext: ".json" }],
    }, registry);
    const members = (result["carriers"] as Array<Record<string, unknown>>)[0]!["members"] as Array<Record<string, unknown>>;
    const a = members.find((m) => m["title"] === `${URI}-a`)!;
    const b = members.find((m) => m["title"] === `${URI}-b`)!;
    expect((a["warnings"] as string[]).join(" ")).toContain("ahu-orphan-close");
    expect(b).toEqual({ title: `${URI}-b`, decision: "ingest" });
  });

  test("CONTROL: a clean carrier's LOAD and INGEST receipts carry no `warnings` key", async () => {
    const composite = makeComposite();
    const text = carrier(SOUND);
    const load = await run(composite, "LOAD", {
      "source-uri": "file:///staged/clean.mem", "to-bag": BAG, "change-id": "c-load",
      carriers: [{ title: URI, text }],
    });
    expect(load).not.toHaveProperty("warnings");
    const ingest = await run(makeComposite(), "INGEST", {
      "source-uri": "file:///staged/clean.mem", "to-bag": BAG, "change-id": "c-ingest",
      carriers: [{ uri: URI, text, diskHash: sha(text), syncedHash: null }],
    });
    expect((ingest["carriers"] as Array<Record<string, unknown>>)[0]).not.toHaveProperty("warnings");
  });
});

// ---------------------------------------------------------------------------
// TW5's own import doors — the fence shows in `$:/Import` before anything lands
// ---------------------------------------------------------------------------

describe("★ the import listing names the fence — TW5's upgrader rail ★", () => {
  test("a fenced record and a torn hold each get a listing message; a clean record gets none", () => {
    const fenced = memeticWikitextDeserializer(carrier(ORPHAN), { title: URI })[0]!;
    const torn = memeticWikitextDeserializer(TORN, { title: `${URI}-torn` })[0]!;
    const clean = memeticWikitextDeserializer(carrier(SOUND, `${URI}-clean`), { title: `${URI}-clean` })[0]!;
    const tiddlers = { [URI]: fenced, [`${URI}-torn`]: torn, [`${URI}-clean`]: clean } as Record<string, Record<string, unknown>>;
    const messages = upgrade(null, Object.keys(tiddlers), tiddlers);
    expect(messages[URI]).toMatch(/^Quoteblocked — .*ahu-orphan-close/);
    expect(messages[`${URI}-torn`]).toMatch(/^Torn frame — held verbatim/);
    expect(messages).not.toHaveProperty(`${URI}-clean`);
  });
});

describe.skipIf(wikiSkip)(`★ a booted wiki: the registered deserializer fences and the import upgraders speak ★${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  test("`wiki.deserializeTiddlers` (import · drop · paste · boot load) answers the fenced root, and `invokeUpgraders` names it", () => {
    const wiki = engine.$tw.wiki as unknown as {
      deserializeTiddlers(type: string, text: string, fields: Record<string, unknown>): Array<Record<string, unknown>>;
      invokeUpgraders(titles: string[], tiddlers: Record<string, Record<string, unknown>>): Record<string, string>;
    };
    const records = wiki.deserializeTiddlers(CARRIER, carrier(ORPHAN), { title: URI });
    expect(records.map((r) => r["title"])).toEqual([URI]);
    expect(records[0]!["text"]).toBe(quoteblockFence(ORPHAN));
    const messages = wiki.invokeUpgraders([URI], { [URI]: records[0]! });
    expect(messages[URI]).toMatch(/^Quoteblocked — .*ahu-orphan-close/);
  });
});
