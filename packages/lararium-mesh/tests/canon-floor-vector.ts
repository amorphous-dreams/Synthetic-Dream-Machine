/**
 * canon-floor-vector — ONE VECTOR, TWO HOSTS: the recipes both vessels compose and the canon floor each must stack under THE
 * CANON FLOOR BY PLACE (ruling 2026-11-26-canon-floor-by-place: "I want `lares` in all wikis, `lararium+lares` in the herm/hearth
 * wiki"). The mesh suite runs it in Node; the browser-node suite runs the same rows through the browser package's own import of
 * the mesh, so a fork between the two derivations reads red on one side.
 */
import { CROSSROADS_DOC_URI, KAHUA_DOC_URI, LARARIUM_DOC_URI, LARES_DOC_URI, bagUri } from "../src/lar-uris.js";
import type { WikiRecipe } from "../src/wiki-recipe.js";

export const LARES = LARES_DOC_URI;
export const LARARIUM = LARARIUM_DOC_URI;
export const TW5_DOCS = bagUri("tw5-docs");
export const TW5_DEV = bagUri("tw5-dev");
export const ORACLE = bagUri("oracle");

export interface CanonFloorRow {
  readonly name: string;
  readonly recipe: WikiRecipe;
  /** The canon the wiki's floor stacks, top first, in the order `recipeFloorStack` reads it (oracle and docs included). */
  readonly floorTail: readonly string[];
  /** Bags the derived stack must never hold. */
  readonly never: readonly string[];
}

export const CANON_FLOOR_VECTOR: readonly CanonFloorRow[] = [
  { name: "a plain wiki", recipe: { wikiSlug: "plain" }, floorTail: [LARES, ORACLE], never: [LARARIUM, TW5_DOCS, TW5_DEV] },
  { name: "a wiki with a library", recipe: { wikiSlug: "corpus", libraryBags: [bagUri("elyncia")] }, floorTail: [LARES, ORACLE], never: [LARARIUM, TW5_DOCS, TW5_DEV] },
  { name: "the lares quine wiki", recipe: { wikiSlug: "lares" }, floorTail: [ORACLE], never: [LARARIUM, TW5_DOCS, TW5_DEV] },
  { name: "the lararium quine wiki", recipe: { wikiSlug: "lararium" }, floorTail: [LARES, ORACLE], never: [TW5_DOCS, TW5_DEV] },
  { name: "the herm/hearth wiki, bare (the browser vessel's daemon recipe)", recipe: { wikiSlug: "daemon" }, floorTail: [LARES, LARARIUM, ORACLE, TW5_DOCS, TW5_DEV], never: [] },
  {
    name: "the herm/hearth wiki, composed (kahua stage and crossroads, as daemon-vm-core lays it on both vessels)",
    recipe: { wikiSlug: "daemon", libraryBags: [KAHUA_DOC_URI, CROSSROADS_DOC_URI] },
    floorTail: [LARES, LARARIUM, ORACLE, TW5_DOCS, TW5_DEV],
    never: [],
  },
];
