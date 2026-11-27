/**
 * THE CANON FLOOR BY PLACE, BROWSER SIDE — one vector, two hosts. The mesh suite runs `CANON_FLOOR_VECTOR` in Node
 * (`packages/lararium-mesh/tests/derive-wiki-recipe.test.ts`); this file runs the same rows through the browser package's own
 * import of the mesh, the derivation the browser vessel's daemon island and wiki islands read. A fork reads red on one side.
 */
import { describe, expect, test } from "vitest";
import { HEARTH_WIKI_SLUG, canonFloorOf, recipeFloorStack } from "@lararium/mesh/wiki-recipe";
import { CANON_FLOOR_VECTOR, LARARIUM, LARES, TW5_DEV, TW5_DOCS } from "../../lararium-mesh/tests/canon-floor-vector.js";

describe("the browser derives the canon floor the node derives", () => {
  test("every row of the one vector", () => {
    for (const row of CANON_FLOOR_VECTOR) {
      const stack = recipeFloorStack(row.recipe);
      expect(stack.slice(-row.floorTail.length), row.name).toEqual(row.floorTail);
      for (const bag of row.never) expect(stack, `${row.name} never stacks ${bag}`).not.toContain(bag);
    }
  });

  test("the browser vessel's daemon recipe stands the herm/hearth wiki: lares, lararium, then TiddlyWiki5's docs beneath", () => {
    expect(canonFloorOf(HEARTH_WIKI_SLUG)).toEqual([LARES, LARARIUM]);
    const stack = recipeFloorStack({ wikiSlug: "daemon" });
    expect(stack.indexOf(TW5_DOCS)).toBeGreaterThan(stack.indexOf(LARARIUM));
    expect(stack.indexOf(TW5_DEV)).toBeGreaterThan(stack.indexOf(LARARIUM));
    expect(recipeFloorStack({ wikiSlug: "plain" })).not.toContain(LARARIUM);
  });
});
