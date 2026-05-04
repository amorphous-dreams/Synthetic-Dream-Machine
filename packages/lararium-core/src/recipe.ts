/**
 * recipe — RecipeTiddler schema + URI helpers for Lares recipe tiddlers.
 *
 * A recipe tiddler is a first-class tiddler stored inside a root doc (typically
 * LarariumDoc or CatalogDoc) that describes an ordered bag stack for a TW5 VM.
 * Recipes are the bridge between the static Automerge doc topology and the dynamic
 * TW5 FilterRecipe evaluation surface.
 *
 * Recipe tiddler addressing:
 *   recipeUri("@lararium", "default")  → "lar:///ha.ka.ba/@lararium/recipes/default"
 *   recipeUri("@catalog",  "elyncia")  → "lar:///ha.ka.ba/@catalog/recipes/elyncia"
 *
 * Bag stack order: lowest-priority first → highest-priority last (TW5 convention).
 * Each entry in `bagStack` is a well-known lar: bag ID (a root doc URI or corpusLarUri).
 *
 * Seed recipes written at boot:
 *   lararium/recipes/default — full content + social plane, no writable leaves
 *   lararium/recipes/room    — full stack + specific room bag (writable)
 *   catalog/recipes/default  — catalog + lares + corpus leaves only (no social plane)
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/recipe
 */

// ---------------------------------------------------------------------------
// RecipeTiddler — stored shape
// ---------------------------------------------------------------------------

export interface RecipeTiddler {
  /** Stable lar: URI of this recipe tiddler (its own address). */
  readonly title:      string;
  /** Human-readable name shown in recipe picker UI. */
  readonly label:      string;
  /** Ordered bag IDs: lowest priority → highest priority. */
  readonly bagStack:   readonly string[];
  /** Optional: the single writable bag ID in this recipe (if any). */
  readonly writableBag?: string;
  /** ISO 8601 creation / last-update timestamp. */
  readonly updatedAt:  string;
  /** Authority that wrote this recipe tiddler. */
  readonly authority:  string;
  /** Owning bag (root doc URI where this tiddler lives). */
  readonly bag:        string;
}

// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------

/**
 * Stable lar: URI for a named recipe tiddler.
 *
 * @param root  - The @-prefixed root doc slot, e.g. "@lararium" or "@catalog".
 * @param name  - Short recipe name, e.g. "default", "room", "elyncia".
 *
 * e.g. recipeUri("@lararium", "default") → "lar:///ha.ka.ba/@lararium/recipes/default"
 */
export function recipeUri(root: string, name: string): string {
  // root is e.g. "@lararium" — strip leading @ for cosmetics if needed, but keep as-is for URI.
  const rootSlug = root.startsWith("@") ? root : `@${root}`;
  return `lar:///ha.ka.ba/${rootSlug}/recipes/${name}`;
}
