/**
 * recipe-planes — the ONE reader of a wiki's recipe record.
 *
 * Two registry planes can carry a recipe for a slug. The oracle plane holds a system wiki's DEFAULT
 * recipe (written at genesis, shared by every vessel); the catalog holds the vessel's OWN composition
 * of any wiki, system or user. Own shadows default, exactly as a working layer shadows canon. Every
 * reader walks the planes in the order this module spells, so no site carries an order of its own: the
 * surface mount's resolver (`surface-recipe`), the boot mount, the live watch, `meme get --recipe` and
 * the compose verbs.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/recipe-planes
 */
import type { StoredLarRecord } from "./stored-value.js";
import { recipeUri } from "./lar-uris.js";
import { plainRecordOrNull } from "./stored-value.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** The planes a wiki's recipe record may stand in, the vessel's own composition first. */
export const RECIPE_PLANES = ["catalog", "oracle"] as const;
export type RecipePlane = typeof RECIPE_PLANES[number];

export interface EffectiveRecipe {
  readonly record: LarTiddlerRecord;
  readonly plane:  RecipePlane;
  readonly title:  string;
}

/** A record that stands: present, and carrying no tombstone. */
export const recipeRecordStands = (rec: LarTiddlerRecord | null | undefined): rec is LarTiddlerRecord =>
  !!rec && rec.meta?.deleted !== true;

/** The recipe a wiki stands on. `read` answers one plane's record or nothing, straight off the plane's
 *  document or already unwrapped; this reader unwraps it. A tombstoned record (`meta.deleted`) counts as
 *  nothing. Synchronous, so the surface mount, the boot mount and the live watch share it. */
export function effectiveRecipe(
  slug: string,
  read: (plane: RecipePlane, title: string) => StoredLarRecord | null | undefined,
): EffectiveRecipe | null {
  for (const plane of RECIPE_PLANES) {
    const title = recipeUri(plane, slug);
    const record = plainRecordOrNull(read(plane, title));
    if (recipeRecordStands(record)) return { record, plane, title };
  }
  return null;
}
