/**
 * tw5-filter — registration entry point for Lararium TW5 filter operators.
 *
 * Each operator lives in its own composable file (filters/*.ts) so it can
 * become an independent self-describing meme in the wiki.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/tw5-filter
 */

import type { TW5Instance } from "./types/tiddlywiki.js";
import { registerMemes }       from "./filters/memes.js";
import { registerEdge }        from "./filters/edge.js";
import { registerTomlField }   from "./filters/toml-field.js";
import { registerImplementors } from "./filters/implementors.js";

export { registerMemes, registerEdge, registerTomlField, registerImplementors };

/** Register all Lararium filter operators on a TW5 instance. */
export function registerLarariumFilters(tw: TW5Instance): void {
  registerMemes(tw);
  registerEdge(tw);
  registerTomlField(tw);
  registerImplementors(tw);
}

/**
 * toCanonicalWikitext — compat shim for `all[memes]` sugar until the memes
 * source operator propagates to all callers.
 *
 * With all operators registered, edge:/toml:/implementors[] resolve natively.
 * Only `all[memes]` → `all[tiddlers]` requires rewriting (TW5 source dispatch
 * does not call custom filterOperators for `all[]` — it calls getGlobalCache).
 *
 * @deprecated Remove when TW5 source registration lands for `memes`.
 */
export function toCanonicalWikitext(expr: string): string {
  return expr.replace(/\ball\[memes\]/g, "all[tiddlers]");
}
