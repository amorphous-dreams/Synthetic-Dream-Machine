/**
 * recipe-planes — the ONE reader of a wiki's recipe record.
 *
 * Two registry planes can carry a recipe for a slug. The oracle plane holds a system wiki's DEFAULT
 * recipe (written at genesis, shared by every vessel); the catalog holds the vessel's OWN composition
 * of any wiki, system or user. Own shadows default, exactly as a working layer shadows canon. Every
 * reader — the boot mount, the live watch, `meme get --recipe`, the compose verbs — walks the planes
 * in the order this module spells, so no site carries an order of its own.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/recipe-planes
 */

import { RECIPE_PLANES, effectiveRecipe, recipeRecordStands as standing, recipeUri, type EffectiveRecipe, type RecipePlane } from "@lararium/mesh";
import type { CatalogAccessor } from "./catalog-accessor.js";

// The reader itself stands in mesh, where the surface mount's resolver reads it too; this module keeps the
// one name every tw5 site already imports.
export { RECIPE_PLANES, effectiveRecipe };
export type { EffectiveRecipe, RecipePlane };

/** The same walk over accessors (`recordOf`), for verb handlers. */
export async function effectiveRecipeOf(
  slug: string,
  planes: { readonly catalog?: CatalogAccessor | null | undefined; readonly oracle?: CatalogAccessor | null | undefined },
): Promise<EffectiveRecipe | null> {
  for (const plane of RECIPE_PLANES) {
    const accessor = planes[plane];
    if (!accessor) continue;
    const title = recipeUri(plane, slug);
    const record = await accessor.recordOf(title).catch(() => null);
    if (standing(record)) return { record, plane, title };
  }
  return null;
}
