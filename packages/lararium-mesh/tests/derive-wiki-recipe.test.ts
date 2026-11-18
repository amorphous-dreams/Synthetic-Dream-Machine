import { describe, expect, test } from "vitest";
import { deriveWikiRecipe, wikiSlugOfBag } from "../src/surface-recipe.js";
import { expandRecipe, recipeUri, wikiBagUri, wikiSlotUri, type LarTiddlerRecord } from "../src/index.js";

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
