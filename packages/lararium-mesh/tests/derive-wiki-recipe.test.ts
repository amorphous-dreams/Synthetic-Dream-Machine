import { describe, expect, test } from "vitest";
import { deriveWikiRecipe, wikiSlugOfBag } from "../src/surface-recipe.js";
import { bagUri, expandRecipe, recipeUri, wikiBagUri, wikiSlotUri, type LarTiddlerRecord } from "../src/index.js";
import {
  HEARTH_WIKI_SLUG, canonFloorOf, floorUntrueLibraries, foreignDocsOf, isHearthWiki, recipeFloorStack, recipeFromRecord, recipeRecordFields,
} from "../src/wiki-recipe.js";
import { floorRecordsFor, type ResolvedFloor } from "../src/floor-manifest.js";
import { CANON_FLOOR_VECTOR, LARARIUM, LARES, ORACLE, TW5_DEV, TW5_DOCS } from "./canon-floor-vector.js";

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

describe("THE CANON FLOOR BY PLACE (ruling 2026-11-26-canon-floor-by-place)", () => {
  test("every row of the one vector: the floor a recipe stacks, and what it never stacks", () => {
    for (const row of CANON_FLOOR_VECTOR) {
      const stack = recipeFloorStack(row.recipe);
      expect(stack.slice(-row.floorTail.length), row.name).toEqual(row.floorTail);
      for (const bag of row.never) expect(stack, `${row.name} never stacks ${bag}`).not.toContain(bag);
    }
  });

  test("a plain wiki's derived recipe holds lares and not lararium; the hearth wiki's holds both", () => {
    expect(canonFloorOf("plain")).toEqual([LARES]);
    expect(recipeFloorStack({ wikiSlug: "plain" })).toContain(LARES);
    expect(recipeFloorStack({ wikiSlug: "plain" })).not.toContain(LARARIUM);
    expect(isHearthWiki(HEARTH_WIKI_SLUG)).toBe(true);
    expect(canonFloorOf(HEARTH_WIKI_SLUG)).toEqual([LARES, LARARIUM]);
    const hearth = recipeFloorStack({ wikiSlug: HEARTH_WIKI_SLUG });
    expect(hearth).toEqual(expect.arrayContaining([LARES, LARARIUM]));
  });

  test("the hearth recipe holds TiddlyWiki5's two docs bags beneath lararium and lares; a plain wiki holds neither", () => {
    const hearth = recipeFloorStack({ wikiSlug: HEARTH_WIKI_SLUG });
    for (const docs of [TW5_DOCS, TW5_DEV]) {
      expect(hearth.indexOf(docs), docs).toBeGreaterThan(hearth.indexOf(LARES));
      expect(hearth.indexOf(docs), docs).toBeGreaterThan(hearth.indexOf(LARARIUM));
      expect(expandRecipe({ wikiSlug: "plain" })).not.toContain(docs);
    }
    expect(foreignDocsOf(HEARTH_WIKI_SLUG)).toEqual([TW5_DOCS, TW5_DEV]);
    // A record never names the docs: the table derives them on every read.
    expect(recipeRecordFields({ wikiSlug: HEARTH_WIKI_SLUG })["bag-stack"]).not.toContain(TW5_DOCS);
    expect(recipeFromRecord({ tiddler: { title: recipeUri("catalog", HEARTH_WIKI_SLUG), "bag-stack": `${ORACLE} ${TW5_DOCS}` } } as LarTiddlerRecord, HEARTH_WIKI_SLUG).libraryBags).toBeUndefined();
  });

  test("the oracle read-face lays the snapshots the place admits: lararium under the hearth and its own quine wiki alone", () => {
    const snap = (title: string) => ({ [title]: { tiddler: { title } } });
    const floor = {
      manifest: { format: "lararium-floor", engine: "e", plugins: "p", snapshots: { lararium: "a".repeat(64), lares: "b".repeat(64), sdm: "c".repeat(64) } },
      snapshots: { lararium: snap("ll"), lares: snap("ls"), sdm: snap("sd") },
    } as unknown as ResolvedFloor;
    const titles = (slug: string) => floorRecordsFor(floor, slug).flatMap((rows) => Object.keys(rows)).sort();
    expect(titles("plain")).toEqual(["ls", "sd"]);
    expect(titles(HEARTH_WIKI_SLUG)).toEqual(["ll", "ls", "sd"]);
    expect(titles("lararium")).toEqual(["ll", "ls", "sd"]);
    expect(titles("lares")).toEqual(["ls", "sd"]);
  });

  test("a record that stacks lararium outside the hearth reads untrue; lares and the hearth's own stack read true", () => {
    expect(floorUntrueLibraries("lares", [LARARIUM])).toEqual([LARARIUM]);
    expect(floorUntrueLibraries("plain", [LARES, LARARIUM, bagUri("elyncia")])).toEqual([LARARIUM]);
    expect(floorUntrueLibraries(HEARTH_WIKI_SLUG, [LARES, LARARIUM])).toEqual([]);
    expect(floorUntrueLibraries("lararium", [LARES])).toEqual([]);
  });
});
