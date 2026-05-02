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
 * toCanonicalWikitext — compat shim for callers that pre-date native operator registration.
 *
 * With registerLarariumFilters() called at boot, all sugar operators resolve
 * natively inside TW5. This shim rewrites `all[memes]` to `all[tiddlers]`
 * only as a fallback for contexts where the VM has not been booted yet.
 *
 * @deprecated Call registerLarariumFilters(tw) at boot instead of pre-processing expressions.
 */
export function toCanonicalWikitext(expr: string): string {
  return expr.replace(/\ball\[memes\]/g, "all[tiddlers]");
}
