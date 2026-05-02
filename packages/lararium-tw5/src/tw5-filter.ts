/**
 * tw5-filter — registration entry point for Lararium TW5 filter operators.
 *
 * Each operator lives in its own composable file (filters/*.ts) so it can
 * become an independent self-describing meme in the wiki.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/tw5-filter
 */

import type { TW5Instance } from "./types/tiddlywiki.js";
import { registerMemes, registerMemesSource } from "./filters/memes.js";
import { registerEdge }                       from "./filters/edge.js";
import { registerTomlField }                  from "./filters/toml-field.js";
import { registerImplementors }               from "./filters/implementors.js";

export { registerMemes, registerMemesSource, registerEdge, registerTomlField, registerImplementors };

/** Register all Lararium filter operators on a TW5 instance. */
export function registerLarariumFilters(tw: TW5Instance): void {
  registerMemes(tw);
  registerMemesSource(tw);
  registerEdge(tw);
  registerTomlField(tw);
  registerImplementors(tw);
}

/**
 * toCanonicalWikitext — identity passthrough.
 *
 * With registerLarariumFilters() called at boot, all filter sugar resolves
 * natively inside TW5:
 *   [all[memes]]   → allfilteroperator "memes" source (registerMemesSource)
 *   [memes[]]      → filterOperator "memes" (registerMemes)
 *   edge:fam[role] → filterOperator "edge" (registerEdge)
 *   toml:key[val]  → filterOperator "toml" (registerTomlField)
 *   implementors[] → filterOperator "implementors" (registerImplementors)
 *
 * @deprecated This function now does nothing. Call registerLarariumFilters(tw)
 * at boot and pass filter expressions to wiki.filterTiddlers() directly.
 * Kept for call-site compatibility; remove callers, then remove this export.
 */
export function toCanonicalWikitext(expr: string): string {
  return expr;
}
