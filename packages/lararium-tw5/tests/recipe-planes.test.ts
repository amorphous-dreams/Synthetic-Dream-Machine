import { describe, test, expect } from "vitest";
import { recipeUri, type LarTiddlerRecord } from "@lararium/mesh";
import { RECIPE_PLANES, effectiveRecipe, effectiveRecipeOf } from "../src/recipe-planes.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";

const rec = (title: string, stack: string, meta?: LarTiddlerRecord["meta"]): LarTiddlerRecord =>
  ({ tiddler: { title, "bag-stack": stack }, ...(meta ? { meta } : {}) });

const planes = (tiddlers: { catalog?: Record<string, LarTiddlerRecord>; oracle?: Record<string, LarTiddlerRecord> }) =>
  (plane: "catalog" | "oracle", title: string) => tiddlers[plane]?.[title];

const accessor = (tiddlers: Record<string, LarTiddlerRecord>): CatalogAccessor =>
  ({ recordOf: async (t: string) => tiddlers[t] ?? null }) as unknown as CatalogAccessor;

const OWN = recipeUri("catalog", "lares");
const DEFAULT = recipeUri("oracle", "lares");

describe("the one recipe reader", () => {
  test("the plane order spells the vessel's own composition first", () => {
    expect([...RECIPE_PLANES]).toEqual(["catalog", "oracle"]);
  });

  test("both planes carry a record: the catalog's wins", () => {
    const got = effectiveRecipe("lares", planes({ catalog: { [OWN]: rec(OWN, "own") }, oracle: { [DEFAULT]: rec(DEFAULT, "default") } }));
    expect(got?.plane).toBe("catalog");
    expect(got?.title).toBe(OWN);
    expect(got?.record.tiddler["bag-stack"]).toBe("own");
  });

  test("only the oracle carries one: the oracle's, named as such", () => {
    const got = effectiveRecipe("lares", planes({ oracle: { [DEFAULT]: rec(DEFAULT, "default") } }));
    expect(got?.plane).toBe("oracle");
    expect(got?.title).toBe(DEFAULT);
  });

  test("neither carries one: nothing", () => {
    expect(effectiveRecipe("lares", planes({}))).toBeNull();
  });

  test("a tombstoned catalog record counts as nothing: the oracle's stands", () => {
    const got = effectiveRecipe("lares", planes({
      catalog: { [OWN]: rec(OWN, "own", { deleted: true }) },
      oracle:  { [DEFAULT]: rec(DEFAULT, "default") },
    }));
    expect(got?.plane).toBe("oracle");
  });

  test("the accessor walk reads the same order, and skips an absent plane", async () => {
    const both = await effectiveRecipeOf("lares", { catalog: accessor({ [OWN]: rec(OWN, "own") }), oracle: accessor({ [DEFAULT]: rec(DEFAULT, "default") }) });
    expect(both?.plane).toBe("catalog");
    const onlyOracle = await effectiveRecipeOf("lares", { catalog: null, oracle: accessor({ [DEFAULT]: rec(DEFAULT, "default") }) });
    expect(onlyOracle?.plane).toBe("oracle");
    expect(await effectiveRecipeOf("lares", {})).toBeNull();
  });
});
