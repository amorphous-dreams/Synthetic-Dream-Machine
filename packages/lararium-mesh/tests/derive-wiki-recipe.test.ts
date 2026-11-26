import { describe, expect, test } from "vitest";
import { deriveWikiRecipe, wikiSlugOfBag } from "../src/surface-recipe.js";
import {
  CROSSROADS_BAG, KAHUA_BAG, LARARIUM_BAG, LARES_BAG, ORACLE_BAG, clearRecipeOf, daemonFaceCanonBag, expandRecipe, houseCanonBags, kahuaRecipe, recipeFromRecord,
  recipeUri, wikiBagUri, wikiSlotUri, type CapTier, type LarTiddlerRecord, type WikiRecipe,
} from "../src/index.js";

const record = (slug: string, fields: Record<string, unknown> = {}): LarTiddlerRecord => ({ tiddler: { title: recipeUri("catalog", slug), ...fields } } as LarTiddlerRecord);

describe("wiki recipe derivation", () => {
  test("absence and tombstones read the floor; a standing record reads its stack", () => {
    expect(deriveWikiRecipe({ slug: "x", record: null, canonUrl: "automerge:canon" })).toEqual({ ok: true, recipe: { wikiSlug: "x" }, source: "floor" });
    expect(deriveWikiRecipe({ slug: "x", record: record("x", { "bag-stack": `${wikiBagUri("x")} lar:///ha.ka.ba/bags/extra` }), canonUrl: "automerge:canon" })).toMatchObject({ ok: true, source: "record", recipe: { wikiSlug: "x", libraryBags: ["lar:///ha.ka.ba/bags/extra"] } });
    expect(deriveWikiRecipe({ slug: "x", record: { ...record("x", { "bag-stack": "torn" }), meta: { deleted: true } }, canonUrl: "automerge:canon" })).toEqual({ ok: true, recipe: { wikiSlug: "x" }, source: "floor" });
  });

  test("a torn stack and absent canon refuse by cause", () => {
    expect(deriveWikiRecipe({ slug: "x", record: record("x", { "bag-stack": 42 }), canonUrl: "automerge:canon" })).toMatchObject({ ok: false, cause: "record-unparsable" });
    expect(deriveWikiRecipe({ slug: "x", record: record("x", { "bag-stack": "anything" }), canonUrl: null })).toMatchObject({ ok: false, cause: "no-such-bag" });
    expect(deriveWikiRecipe({ slug: "x", record: null, canonUrl: null })).toMatchObject({ ok: false, cause: "no-such-bag" });
  });

  test("a torn plugin field carries its fault through derivation", () => {
    expect(deriveWikiRecipe({
      slug: "x",
      record: record("x", { "bag-stack": `${wikiBagUri("x")} lar:///ha.ka.ba/bags/extra`, "plugin-offerings": 42 }),
      canonUrl: "automerge:canon",
    })).toMatchObject({
      ok: true,
      source: "record",
      recipe: {
        wikiSlug: "x",
        libraryBags: ["lar:///ha.ka.ba/bags/extra"],
        pluginOfferingsFault: expect.stringContaining("plugin-offerings field"),
      },
    });
  });

  test("bag addresses resolve only their owning wiki", () => {
    expect(wikiSlugOfBag(wikiSlotUri("x", "working"))).toBe("x");
    expect(wikiSlugOfBag(wikiBagUri("x"))).toBe("x");
    for (const uri of ["lar:///ha.ka.ba/@oracle", "lar:///ha.ka.ba/catalog", "lar:///ha.ka.ba/crossroads"]) expect(wikiSlugOfBag(uri)).toBeNull();
  });

  test("CONTROL: the floor lays the six standing slots", () => {
    expect(expandRecipe({ wikiSlug: "x" })).toEqual([wikiSlotUri("x", "temp"), wikiSlotUri("x", "draft"), wikiSlotUri("x", "personal"), wikiSlotUri("x", "working"), wikiBagUri("x"), "lar:///ha.ka.ba/bags/oracle"]);
  });
});

describe("the clear recipe ~ the floor-class view of any recipe", () => {
  const PUBLIC_LIB = "lar:///ha.ka.ba/bags/sdm";
  const CONTRACT_LIB = "lar:///ha.ka.ba/bags/cabal-notes";
  const tiers: Record<string, CapTier> = { [PUBLIC_LIB]: "public", [CONTRACT_LIB]: "contract", [CROSSROADS_BAG]: "public", [KAHUA_BAG]: "personagroup", [wikiBagUri("open")]: "public", [wikiBagUri("x")]: "veil" };
  const tierOf = (bag: string): CapTier | null => tiers[bag] ?? null;
  const recipes: readonly WikiRecipe[] = [
    { wikiSlug: "x" },
    { wikiSlug: "open", libraryBags: [PUBLIC_LIB, CONTRACT_LIB] },
    { wikiSlug: "lares", libraryBags: [LARARIUM_BAG] },
    kahuaRecipe({ wikiSlug: "daemon", canonBag: daemonFaceCanonBag("11111111-2222-4333-8444-555555555555"), libraryBags: [CROSSROADS_BAG] }),
    { wikiSlug: "x", libraryBags: [PUBLIC_LIB], mirrorBags: [PUBLIC_LIB], pluginOfferings: ["sha256:aa"] },
    recipeFromRecord(record("x", { "bag-stack": `${ORACLE_BAG} ${CONTRACT_LIB} ${PUBLIC_LIB} ${wikiBagUri("x")}` }), "x"),
  ];

  test("no clear recipe lays a draft, personal or working slot; each tops on its memory temp and still ends on the oracle bag", () => {
    for (const r of recipes) {
      for (const source of [tierOf, undefined]) {
        const slots = expandRecipe(clearRecipeOf(r, source));
        for (const kind of ["draft", "personal", "working"] as const) expect(slots).not.toContain(wikiSlotUri(r.wikiSlug, kind));
        expect(slots[0]).toBe(wikiSlotUri(r.wikiSlug, "temp"));
        expect(slots.at(-1)).toBe(ORACLE_BAG);
        expect(new Set(slots).size).toBe(slots.length);
      }
    }
  });

  test("a recipe naming a CONTRACT library loses it; its PUBLIC library and its public canon stay, in the recipe's order", () => {
    expect(expandRecipe(clearRecipeOf({ wikiSlug: "open", libraryBags: [PUBLIC_LIB, CONTRACT_LIB] }, tierOf)))
      .toEqual([wikiSlotUri("open", "temp"), wikiBagUri("open"), PUBLIC_LIB, ORACLE_BAG]);
    expect(expandRecipe(clearRecipeOf({ wikiSlug: "x", libraryBags: [CONTRACT_LIB, PUBLIC_LIB] }, tierOf)))
      .toEqual([wikiSlotUri("x", "temp"), PUBLIC_LIB, ORACLE_BAG]);
  });

  test("a bag whose tier nobody answers drops; the system canon stands on every floor whatever the source says", () => {
    expect(expandRecipe(clearRecipeOf({ wikiSlug: "open", libraryBags: [PUBLIC_LIB] }))).toEqual([wikiSlotUri("open", "temp"), ORACLE_BAG]);
    for (const source of [undefined, () => "veil" as const, () => null]) {
      expect(expandRecipe(clearRecipeOf({ wikiSlug: "lares", libraryBags: [LARARIUM_BAG] }, source)))
        .toEqual([wikiSlotUri("lares", "temp"), LARES_BAG, LARARIUM_BAG, ORACLE_BAG]);
      for (const bag of houseCanonBags()) expect(expandRecipe(clearRecipeOf({ wikiSlug: "x", libraryBags: [bag] }, source))).toContain(bag);
    }
  });

  test("the daemon wiki seen clear keeps neither its face canon, its own bag nor the kahua stage; the public board stays", () => {
    const daemon = recipes[3]!;
    expect(expandRecipe(clearRecipeOf(daemon, tierOf))).toEqual([wikiSlotUri("daemon", "temp"), CROSSROADS_BAG, ORACLE_BAG]);
  });

  test("every mirror, pin and optional offering drops, and a clear recipe re-read stays under the same law", () => {
    const clear = clearRecipeOf(recipes[4]!, tierOf);
    expect(clear).toEqual({ wikiSlug: "x", clear: true, libraryBags: [PUBLIC_LIB] });
    expect(clearRecipeOf(clear, tierOf)).toEqual(clear);
    // A hand-built clear recipe naming a contract bag gains nothing by its mark.
    expect(clearRecipeOf({ wikiSlug: "x", clear: true, libraryBags: [CONTRACT_LIB, PUBLIC_LIB] }, tierOf)).toEqual(clear);
    expect(clearRecipeOf(clear)).toEqual({ wikiSlug: "x", clear: true });
  });
});
