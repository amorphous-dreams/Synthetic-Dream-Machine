/**
 * TiddlyWiki Filter Language adapter for Lararium meme queries.
 *
 * Uses TW5's actual filter engine (tiddlywiki npm package) so Lararium stays
 * in sync with upstream TW5 operator development. When TW5 ships new filter
 * operators or fixes bugs, bump the tiddlywiki devDependency and re-run tests.
 *
 * Deterministic process:
 *   1. tiddlywiki pinned in devDependencies of lararium-core
 *   2. This file is the only adapter — TW code is NOT vendored or modified
 *   3. ClosureEntry ↔ tiddler field mapping is the only Lararium-specific code
 *   4. To consume upstream changes: `pnpm update tiddlywiki`, re-run tests
 *
 * Field mapping (ClosureEntry → TW tiddler fields):
 *   title   = entry.uri          (TW title = primary key)
 *   tags    = entry.implements   (TW tags = set membership; maps to implements)
 *   depth   = String(depth)      (TW fields are strings; use nsort[depth])
 *   rating  = entry.kind         (field:rating[meme] etc.)
 *   role    = entry.role
 *   exists  = String(exists)
 *
 * TW syntax remapping:
 *   [all[memes]]     → [all[tiddlers]]   (alias: "memes" = our domain word)
 *   [nsort[depth]]   → numeric sort (use instead of [sort[depth]])
 *
 * Full TW5 filter reference: https://tiddlywiki.com/static/Filters.html
 * All 80+ operators work as-is once memes are loaded as tiddlers.
 *
 * Node-only: this module uses `require('tiddlywiki')` — do NOT import in
 * browser bundles. Use `filter.ts` (hand-rolled) for browser/isomorphic code.
 */

import { createRequire } from "module";
import type { ClosureEntry } from "./compiler.js";

const _require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// TW instance — lazy singleton, booted once per process
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwInstance = any;

let _tw: TwInstance | null = null;
let _booted = false;

function getTw(): Promise<TwInstance> {
  if (_tw && _booted) return Promise.resolve(_tw);
  return new Promise((resolve, reject) => {
    // CJS require via createRequire — keeps tiddlywiki out of browser bundle
    const tw = _require("tiddlywiki");
    _tw = tw.TiddlyWiki();
    _tw.boot.argv = [];
    _tw.boot.boot(() => {
      _booted = true;
      resolve(_tw);
    });
    // TW doesn't expose a boot error callback; catch synchronous throws
  });
}

// ---------------------------------------------------------------------------
// ClosureEntry → tiddler field mapping
// ---------------------------------------------------------------------------

function entryToFields(entry: ClosureEntry): Record<string, string | string[]> {
  return {
    title: entry.uri,
    tags: entry.implements,          // TW [tag[X]] tests set membership → implements
    depth: String(entry.depth),
    rating: entry.kind,
    role: entry.role ?? "",
    exists: String(entry.exists),
    laresRelPath: entry.laresRelPath ?? "",
    contentHash: entry.contentHash,
  };
}

// ---------------------------------------------------------------------------
// Expression pre-processing: Lararium dialect → TW5 canonical
// ---------------------------------------------------------------------------

/**
 * Translate Lararium-flavoured filter expressions to TW5 canonical form.
 * Keeps our domain language ("memes") while delegating to TW's engine.
 */
function normaliseTwExpr(expr: string): string {
  // [all[memes]] → [all[tiddlers]]
  return expr.replace(/\ball\[memes\]/g, "all[tiddlers]");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter ClosureEntry objects using TW5's native filter engine.
 *
 * Async because TW boots asynchronously on first call (~10ms, then cached).
 *
 * @param allEntries - The full closure to filter from
 * @param expr       - A TW5 filter expression (use [all[memes]] as the source)
 *
 * @example
 *   const results = await filterMemesTW(closure, "[all[memes]tag[lar:///pono/invariant]]");
 *   const top5   = await filterMemesTW(closure, "[all[memes]nsort[depth]limit[5]]");
 */
export async function filterMemesTW(
  allEntries: readonly ClosureEntry[],
  expr: string,
): Promise<ClosureEntry[]> {
  const $tw = await getTw();

  // Sync entries into TW wiki (addTiddler is idempotent for same title)
  for (const entry of allEntries) {
    $tw.wiki.addTiddler(new $tw.Tiddler(entryToFields(entry)));
  }

  const canonical = normaliseTwExpr(expr);
  const titles: string[] = $tw.wiki.filterTiddlers(canonical);

  // Map titles back to ClosureEntry (skip any TW system tiddlers like $:/boot/*)
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  return titles.map((t) => byUri.get(t)).filter((e): e is ClosureEntry => e !== undefined);
}

/**
 * Synchronous variant using the lightweight hand-rolled evaluator.
 * For browser and hot-path use. TW5 syntax subset only (see filter.ts).
 */
export { filterEntries as filterMemes } from "./filter.js";
