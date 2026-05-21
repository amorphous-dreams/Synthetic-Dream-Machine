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
export interface BagTiddler {
    /** Stable lar: URI of the bag this tiddler describes (= the bag's Automerge doc). */
    readonly title: string;
    /** Human-readable label for UI display. */
    readonly label: string;
    /** Read-access policy expression. Default: "public". */
    readonly readPolicy: string;
    /** Write-access policy expression. Default: "private" for root docs; "public" for wiki draft bags. */
    readonly writePolicy: string;
    /** ISO 8601 creation / last-update timestamp. */
    readonly updatedAt: string;
    /** Authority that created this descriptor. */
    readonly authority: string;
    /** Owning bag (ha island for root-doc descriptors). */
    readonly bag: string;
}
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
export declare function bagDescriptorUri(bagId: string): string;
export interface RecipeTiddler {
    /** Stable lar: URI of this recipe tiddler (its own address). */
    readonly title: string;
    /** Human-readable name shown in recipe picker UI. */
    readonly label: string;
    /** Ordered bag IDs: lowest priority → highest priority (TW5 convention). */
    readonly bagStack: readonly string[];
    /**
     * Optional: the single writable bag ID for writes routed through this recipe.
     * When absent, writes fall through to the CompositeStore's default writable layer.
     * Set to the highest-priority bag in the stack for typical recipe use.
     */
    readonly writableBag?: string;
    /**
     * Optional: vendored TW5 community plugin blob IDs to preload for this Recipe's vm.
     * Each entry is the blob's id (e.g. "$:/plugins/sq/streams").
     * When absent or empty, no vendored plugins are preloaded (minimal vm).
     * Opt-in per Recipe — plugins are never forced into all vms.
     */
    readonly plugins?: readonly string[];
    /** ISO 8601 creation / last-update timestamp. */
    readonly updatedAt: string;
    /** Authority that wrote this recipe tiddler. */
    readonly authority: string;
    /** Owning bag (root doc URI where this tiddler lives). */
    readonly bag: string;
}
/**
 * Stable lar: URI for a named recipe tiddler.
 *
 * @param root  - The @-prefixed root doc slot, e.g. "@lararium" or "@catalog".
 * @param name  - Short recipe name, e.g. "default", "wiki", "elyncia".
 *
 * e.g. recipeUri("@lararium", "default") → "lar:///ha.ka.ba/@lararium/recipes/default"
 */
export declare function recipeUri(root: string, name: string): string;
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
export declare function parsePlugins(raw: unknown): string[];
export declare function parseBagStack(raw: unknown): string[];
//# sourceMappingURL=recipe.d.ts.map