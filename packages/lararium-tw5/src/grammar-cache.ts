/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/grammar-cache
type: application/javascript
module-type: startup
\*/
/**
 * grammar-cache — TW5 startup module: grammar loader + wiki-change invalidation.
 *
 * Runs at TW5 boot (module-type: startup, after: ["startup"]).
 * Registers a wiki "change" listener that invalidates the grammar cache whenever
 * any tiddler tagged `$:/tags/LarariumGrammar` changes — covering both the base
 * grammar kernel (GRAMMAR_MEME_URI) and any operator extension tiddlers.
 *
 * `getGrammar()` remains callable by any TW5 module (wikirules, deserializer,
 * widgets). The cache populates lazily on first call and stays warm until a
 * grammar-tagged tiddler changes.
 *
 * Operator extension flow:
 *   1. Promote a tiddler tagged `$:/tags/LarariumGrammar` into a higher-priority bag.
 *   2. TW5 fires the "change" event → this listener clears the cache automatically.
 *   3. Next parse (deserialize or render) calls getGrammar() → re-reads live tiddler.
 *
 * Exported:
 *   name, platforms, after, startup  — TW5 startup lifecycle
 *   GRAMMAR_TAG                       — tag that marks grammar tiddlers
 *   getGrammar()                      — lazy GrammarRules loader
 *   resetGrammar()                    — explicit cache invalidation (tests / emergency)
 */

import { grammarRulesFromText, GRAMMAR_MEME_URI } from "@lararium/core";
import type { GrammarRules } from "@lararium/core";

export const GRAMMAR_TAG = "$:/tags/LarariumGrammar";

// ---------------------------------------------------------------------------
// TW5 startup lifecycle
// ---------------------------------------------------------------------------

export const name      = "lararium-grammar-cache";
export const platforms = ["browser"];
export const after     = ["startup"];

export function startup(): void {
  const wiki = (globalThis as { $tw?: { wiki?: TwWiki } }).$tw?.wiki;
  if (!wiki) return;
  wiki.addEventListener("change", (changes) => {
    for (const title of Object.keys(changes)) {
      if (title === GRAMMAR_MEME_URI) { _cache = undefined; return; }
      const tags = wiki.getTiddler(title)?.fields?.tags;
      if (Array.isArray(tags) ? tags.includes(GRAMMAR_TAG) : typeof tags === "string" && tags.split(" ").includes(GRAMMAR_TAG)) {
        _cache = undefined; return;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Grammar cache — readable by any module via require()
// ---------------------------------------------------------------------------

type TwWiki = {
  getTiddler(t: string): { fields: { tags?: string | string[] } } | undefined;
  getTiddlerText(t: string): string | undefined;
  addEventListener(ev: "change", fn: (changes: Record<string, unknown>) => void): void;
};

let _cache: { loaded: true; rules: GrammarRules | null } | undefined = undefined;

export function getGrammar(): GrammarRules | null {
  if (_cache) return _cache.rules;
  let rules: GrammarRules | null = null;
  try {
    const wiki = (globalThis as { $tw?: { wiki?: TwWiki } }).$tw?.wiki;
    if (wiki) {
      const text = wiki.getTiddlerText(GRAMMAR_MEME_URI) ?? "";
      rules = text ? grammarRulesFromText(GRAMMAR_MEME_URI, text) : null;
    }
  } catch { /* grammar unavailable — BOOTSTRAP_SCANS remain active */ }
  _cache = { loaded: true, rules };
  return rules;
}

/** Explicit cache invalidation — for test isolation and emergency use. */
export function resetGrammar(): void {
  _cache = undefined;
}
