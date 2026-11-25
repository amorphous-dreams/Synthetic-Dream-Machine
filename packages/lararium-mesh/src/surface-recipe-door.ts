/**
 * surface-recipe-door: the names the package barrel exports from `surface-recipe.ts`, on a subpath of their own.
 *
 * `surface-recipe.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { resolveRecipePluginCids, deriveWikiRecipe, wikiSlugOfBag } from "./surface-recipe.js";
export type { WikiRecipeDerivation } from "./surface-recipe.js";
