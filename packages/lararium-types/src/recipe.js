/**
 * recipe — RecipeTiddler schema + URI helpers for Lares recipe tiddlers.
 *
 * Canonical home: @lararium/types (no external deps; shared by mesh and tw5).
 * Public face: @lararium/tw5 re-exports this module as the operator-facing surface.
 *
 * A recipe tiddler functions as a first-class tiddler stored inside a root doc (typically
 * LarariumDoc or CatalogDoc) that describes an ordered bag stack for a TW5 VM.
 * Recipes bridge the static Automerge doc topology and the dynamic
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
 *   lararium/recipes/wiki    — full stack + specific wiki draft bag (writable)
 *   catalog/recipes/default  — catalog + lares + corpus leaves only (no social plane)
 *
 * Meme: lar:///ha.ka.ba/@lararium/mesh/v0.1/recipe
 */
/**
 * Stable lar: URI for a bag descriptor tiddler.
 *
 * The descriptor tiddler title = `{bagId}/descriptor`.
 * This satisfies the URI grammar: no `@` at pos-3+, clean leaf path under the root doc.
 *
 * Examples:
 *   bagDescriptorUri("lar:///ha.ka.ba/@lararium")  → "lar:///ha.ka.ba/@lararium/descriptor"
 *   bagDescriptorUri("lar:///ha.ka.ba/@catalog")   → "lar:///ha.ka.ba/@catalog/descriptor"
 *
 * @param bagId  - The bag's lar: URI (= Automerge doc address).
 */
export function bagDescriptorUri(bagId) {
    return `${bagId}/descriptor`;
}
// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------
/**
 * Stable lar: URI for a named recipe tiddler.
 *
 * @param root  - The @-prefixed root doc slot, e.g. "@lararium" or "@catalog".
 * @param name  - Short recipe name, e.g. "default", "wiki", "elyncia".
 *
 * e.g. recipeUri("@lararium", "default") → "lar:///ha.ka.ba/@lararium/recipes/default"
 */
export function recipeUri(root, name) {
    // root is e.g. "@lararium" — strip leading @ for cosmetics if needed, but keep as-is for URI.
    const rootSlug = root.startsWith("@") ? root : `@${root}`;
    return `lar:///ha.ka.ba/${rootSlug}/recipes/${name}`;
}
// ---------------------------------------------------------------------------
// parseBagStack — isomorphic helper
// ---------------------------------------------------------------------------
/**
 * Parse a bagStack value from a tiddler field into a string array.
 *
 * Handles two storage formats:
 *   - TW5 list string: `"lar:///a lar:///b lar:///c"` (space-separated; no spaces
 *     appear in lar: URIs so no [[...]] quoting required).
 *   - JS/JSON array: `["lar:///a", "lar:///b"]` (Automerge-stored or deserialized).
 *
 * Returns [] for null / undefined / unrecognised types.
 *
 * Meme: lar:///ha.ka.ba/@lararium/mesh/v0.1/recipe
 */
/**
 * Parse a plugins value from a recipe tiddler field into a string array.
 * Same format as bagStack: space-separated blob IDs or JS array.
 * Returns [] when absent — callers treat empty list as "no vendored plugins".
 */
export function parsePlugins(raw) {
    return parseBagStack(raw);
}
export function parseBagStack(raw) {
    if (Array.isArray(raw)) {
        return raw.filter((x) => typeof x === "string");
    }
    if (typeof raw === "string") {
        return raw.trim().split(/\s+/).filter(Boolean);
    }
    return [];
}
//# sourceMappingURL=recipe.js.map