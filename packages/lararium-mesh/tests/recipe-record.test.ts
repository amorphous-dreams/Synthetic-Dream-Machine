/**
 * THE RECIPE RECORD AND THE MOUNT STRUCT CONVERGE. A recipe record (`bag-stack` + `writable-bag`)
 * drives `meme put --recipe`, recipe-watch's library membership and the residency pins; the
 * `WikiRecipe` struct drives the mount. One name, one shape: the record a minter writes and the
 * layers `expandRecipe` lays name the SAME bags in the SAME order, and `writable-bag` names the
 * working slot the mount makes the default writable.
 */
import { describe, test, expect } from "vitest";
import {
  expandRecipe, recipeFromRecord, recipeRecordFields, wikiBagUri, wikiSlotUri,
  ORACLE_BAG, LARARIUM_BAG, LARES_BAG, bagUri, designatedBagOf, bagStackFromRec,
  parsePluginOfferings,
} from "../src/index.js";
import { buildGenesisSeed } from "../src/genesis-doc.js";
import { recipeUri } from "../src/lar-uris.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const INSTANCE = (slug: string) => new Set(["temp", "draft", "personal", "working"].map((k) => wikiSlotUri(slug, k as never)));

/** The record a minter writes for `recipe`, as a LarTiddlerRecord. */
const minted = (slug: string, libraryBags: readonly string[]): LarTiddlerRecord => ({
  tiddler: { title: recipeUri("catalog", slug), ...recipeRecordFields({ wikiSlug: slug, libraryBags }) },
});

describe("★ the recipe record ↔ the mount struct ★", () => {
  test("the record's bag-stack IS the expanded cascade, bottom-up, minus the instance slots the grants mint", () => {
    for (const [slug, libs] of [["sdm", [LARES_BAG, LARARIUM_BAG, bagUri("ftls")]], ["lares", [LARARIUM_BAG]], ["solo", []]] as const) {
      const rec = minted(slug, libs);
      const laid = expandRecipe({ wikiSlug: slug, libraryBags: libs }).filter((s) => !INSTANCE(slug).has(s));
      expect([...bagStackFromRec(rec)].reverse(), `${slug}: the record and the mount disagree`).toEqual(laid);
    }
  });

  test("a record round-trips through recipeFromRecord: the same libraries in the same order", () => {
    const libs = [LARES_BAG, LARARIUM_BAG, bagUri("ftls")];
    const rec = minted("sdm", libs);
    expect(recipeFromRecord(rec, "sdm").libraryBags).toEqual(libs);
    expect(expandRecipe(recipeFromRecord(rec, "sdm"))).toEqual(expandRecipe({ wikiSlug: "sdm", libraryBags: libs }));
  });

  test("writable-bag names the working slot — the mount's default writable — and is the designated bag", () => {
    const rec = minted("sdm", [LARES_BAG]);
    expect(rec.tiddler["writable-bag"]).toBe(wikiSlotUri("sdm", "working"));
    expect(designatedBagOf(rec)).toBe(wikiSlotUri("sdm", "working"));
    expect(expandRecipe({ wikiSlug: "sdm" })).toContain(designatedBagOf(rec));
  });

  test("the catalog registry never rides a bag-stack (access ≠ load)", () => {
    expect(bagStackFromRec(minted("sdm", [LARES_BAG]))).not.toContain(bagUri("catalog"));
  });

  test("the genesis system recipes obey the same law", () => {
    const seed = buildGenesisSeed({
      actorSeed: "00".repeat(32), coreBlob: new Uint8Array([1, 2, 3]), coreVersion: "0.0.0-test",
      plugins: [],
    });
    for (const [slug, libs] of [["lares", [LARARIUM_BAG]], ["lararium", []]] as const) {
      const rec = seed.tiddlers[recipeUri("oracle", slug)] as LarTiddlerRecord | undefined;
      expect(rec, `genesis carries no recipe for ${slug}`).toBeDefined();
      const laid = expandRecipe({ wikiSlug: slug, libraryBags: libs }).filter((s) => !INSTANCE(slug).has(s));
      expect([...bagStackFromRec(rec!)].reverse()).toEqual(laid);
      expect(rec!.tiddler["writable-bag"]).toBe(wikiSlotUri(slug, "working"));
      expect(recipeFromRecord(rec!, slug).libraryBags ?? []).toEqual(libs);
    }
    expect(expandRecipe({ wikiSlug: "lares", libraryBags: [LARARIUM_BAG] })).toEqual(
      [wikiSlotUri("lares", "temp"), wikiSlotUri("lares", "draft"), wikiSlotUri("lares", "personal"), wikiSlotUri("lares", "working"), wikiBagUri("lares"), LARARIUM_BAG, ORACLE_BAG],
    );
  });
});

/**
 * ★ R1 — plugin-offerings round-trips through the record, in order, with no overloading of bag-stack. ★
 */
describe("★ the recipe's plugin-offerings list round-trips through the record ★", () => {
  const OFF_A = "sha256:" + "aa".repeat(32);
  const OFF_B = "sha256:" + "bb".repeat(32);

  test("CONTROL — a recipe naming no offerings writes no plugin-offerings field at all", () => {
    const fields = recipeRecordFields({ wikiSlug: "solo" });
    expect(fields).not.toHaveProperty("plugin-offerings");
    expect(recipeFromRecord({ tiddler: { title: recipeUri("catalog", "solo"), ...fields } }, "solo").pluginOfferings).toBeUndefined();
  });

  test("one offering round-trips to exactly itself", () => {
    const rec: LarTiddlerRecord = { tiddler: { title: recipeUri("catalog", "solo"), ...recipeRecordFields({ wikiSlug: "solo", pluginOfferings: [OFF_A] }) } };
    expect(rec.tiddler["plugin-offerings"]).toBe(OFF_A);
    expect(recipeFromRecord(rec, "solo").pluginOfferings).toEqual([OFF_A]);
  });

  test("ORDER HOLDS across a round-trip — the record never silently reorders the list", () => {
    for (const order of [[OFF_A, OFF_B], [OFF_B, OFF_A]]) {
      const rec: LarTiddlerRecord = { tiddler: { title: recipeUri("catalog", "solo"), ...recipeRecordFields({ wikiSlug: "solo", pluginOfferings: order }) } };
      expect(recipeFromRecord(rec, "solo").pluginOfferings).toEqual(order);
    }
  });

  test("plugin-offerings never rides bag-stack — a library bag and an offering CID never collide fields", () => {
    const rec: LarTiddlerRecord = {
      tiddler: {
        title: recipeUri("catalog", "sdm"),
        ...recipeRecordFields({ wikiSlug: "sdm", libraryBags: [LARES_BAG], pluginOfferings: [OFF_A] }),
      },
    };
    expect(bagStackFromRec(rec)).not.toContain(OFF_A);
    expect(recipeFromRecord(rec, "sdm").libraryBags).toEqual([LARES_BAG]);
    expect(recipeFromRecord(rec, "sdm").pluginOfferings).toEqual([OFF_A]);
  });

  test("★ MUTATION PROOF — a hand-tampered record that drops one offering CID loses exactly that CID on read-back ★", () => {
    const rec: LarTiddlerRecord = { tiddler: { title: recipeUri("catalog", "solo"), ...recipeRecordFields({ wikiSlug: "solo", pluginOfferings: [OFF_A, OFF_B] }) } };
    expect(recipeFromRecord(rec, "solo").pluginOfferings).toEqual([OFF_A, OFF_B]);
    const tampered = { ...rec, tiddler: { ...rec.tiddler, "plugin-offerings": OFF_A } };
    expect(recipeFromRecord(tampered, "solo").pluginOfferings).toEqual([OFF_A]);
  });
});

/**
 * ★ M4/M2 — a malformed `plugin-offerings` field never reads as an empty or successful recipe.
 * `parsePluginOfferings` still THROWS on its own contract (unit-tested directly below); M2 moves
 * the catch boundary to `recipeFromRecord` itself, which NEVER throws — a torn field names its
 * own `pluginOfferingsFault` instead, so the bag-stack walk on the SAME record stays unaffected
 * and a caller that never asked about plugins (the grain swap, `meme get`) never bricks over it.
 */
describe("★ a malformed plugin-offerings field names its own fault, never throws or reads empty ★", () => {
  const recordWith = (raw: unknown): LarTiddlerRecord => ({
    tiddler: { title: recipeUri("catalog", "solo"), label: "solo", "bag-stack": "", "writable-bag": wikiSlotUri("solo", "working"), "plugin-offerings": raw as never },
  });

  test("CONTROL — an absent field reads as no offerings, the lawful empty case, with no fault", () => {
    const rec = recipeFromRecord({ tiddler: { title: recipeUri("catalog", "solo"), label: "solo", "bag-stack": "", "writable-bag": wikiSlotUri("solo", "working") } }, "solo");
    expect(rec.pluginOfferings).toBeUndefined();
    expect(rec.pluginOfferingsFault).toBeUndefined();
  });

  test("a bare number names its fault, by the same message `parsePluginOfferings` throws — never a throw out of recipeFromRecord", () => {
    expect(() => recipeFromRecord(recordWith(42), "solo")).not.toThrow();
    const rec = recipeFromRecord(recordWith(42), "solo");
    expect(rec.pluginOfferingsFault).toMatch(/plugin-offerings field is a number/);
    expect(rec.pluginOfferings).toBeUndefined();
  });

  test("an array carrying a non-string entry names its fault — it must NOT silently drop the junk and keep the rest", () => {
    const rec = recipeFromRecord(recordWith(["sha256:" + "aa".repeat(32), 42, null]), "solo");
    expect(rec.pluginOfferingsFault).toMatch(/plugin-offerings\[1\] is a number/);
    expect(rec.pluginOfferings).toBeUndefined();
  });

  test("a plain object names its fault", () => {
    const rec = recipeFromRecord(recordWith({ not: "a list" }), "solo");
    expect(rec.pluginOfferingsFault).toMatch(/plugin-offerings field is a object/);
  });

  test("★ the fault NEVER bricks the rest of the record — library bags still read, on the SAME torn record ★", () => {
    const rec: LarTiddlerRecord = {
      tiddler: {
        title: recipeUri("catalog", "sdm"),
        ...recipeRecordFields({ wikiSlug: "sdm", libraryBags: [LARES_BAG] }),
        "plugin-offerings": 42 as never,
      },
    };
    const recipe = recipeFromRecord(rec, "sdm");
    expect(recipe.pluginOfferingsFault).toMatch(/plugin-offerings field is a number/);
    expect(recipe.libraryBags).toEqual([LARES_BAG]);
  });

  test("CONTROL — parsePluginOfferings itself still throws on the same malformed shapes (the contract recipeFromRecord catches)", () => {
    expect(() => parsePluginOfferings(42)).toThrow(/plugin-offerings field is a number/);
    expect(() => parsePluginOfferings(["sha256:" + "aa".repeat(32), 42, null])).toThrow(/plugin-offerings\[1\] is a number/);
  });
});
