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

import { recipeUri, type LarTiddlerRecord } from "@lararium/mesh";
import type { CatalogAccessor } from "./catalog-accessor.js";

/** The planes a wiki's recipe record may stand in, the vessel's own composition first. */
export const RECIPE_PLANES = ["catalog", "oracle"] as const;
export type RecipePlane = typeof RECIPE_PLANES[number];

export interface EffectiveRecipe {
  readonly record: LarTiddlerRecord;
  readonly plane:  RecipePlane;
  readonly title:  string;
}

const standing = (rec: LarTiddlerRecord | null | undefined): rec is LarTiddlerRecord =>
  !!rec && rec.meta?.deleted !== true;

/** The recipe a wiki stands on. `read` answers one plane's record or nothing; a tombstoned record
 *  (`meta.deleted`) counts as nothing. Synchronous, so the boot mount and the live watch share it. */
export function effectiveRecipe(
  slug: string,
  read: (plane: RecipePlane, title: string) => LarTiddlerRecord | null | undefined,
): EffectiveRecipe | null {
  for (const plane of RECIPE_PLANES) {
    const title = recipeUri(plane, slug);
    const record = read(plane, title);
    if (standing(record)) return { record, plane, title };
  }
  return null;
}

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
