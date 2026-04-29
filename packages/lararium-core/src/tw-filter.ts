/**
 * TiddlyWiki Filter Language — canonical filter engine for Lararium.
 *
 * TW5 is the single authority on filter syntax and operator semantics.
 * No hand-rolled evaluator: all filtering goes through $tw.wiki.filterTiddlers().
 *
 * Deterministic upstream sync process:
 *   1. `tiddlywiki` is pinned in devDependencies (lararium-core/package.json)
 *   2. To pick up upstream TW5 changes: `pnpm update tiddlywiki` → re-run tests
 *   3. New operators are immediately available — no code changes needed here
 *   4. Operator behaviour changes surface as test failures → explicit ack required
 *
 * Node-only runtime (browser uses pre-computed room data from snapshot):
 *   - Uses `createRequire` + `tiddlywiki` CJS package
 *   - Do NOT import this module in browser bundles (Vite will warn; keep it server-only)
 *   - Browser-dynamic filtering (future): add TW browser shim as needed
 *
 * ClosureEntry → tiddler field mapping:
 *   title        = entry.uri          (TW primary key; what filter results return)
 *   tags         = entry.implements   (TW [tag[X]] → implements membership)
 *   depth        = String(depth)      (string field; use [nsort[depth]] not [sort[depth]])
 *   rating       = entry.kind         ([field:rating[meme]] etc.)
 *   role         = entry.role
 *   exists       = String(exists)
 *   laresRelPath = entry.laresRelPath
 *   contentHash  = entry.contentHash
 *
 * Lararium dialect aliases (pre-processed before TW sees the expression):
 *   [all[memes]] → [all[tiddlers]]    ("memes" = Lararium domain word for tiddlers)
 *
 * Full TW5 filter reference: https://tiddlywiki.com/static/Filters.html
 */

import { createRequire } from "module";
import type { ClosureEntry } from "./compiler.js";

const _require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// TW5 instance — lazy singleton, booted once per Node process (~10ms)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwInstance = any;

let _tw: TwInstance | null = null;
let _bootPromise: Promise<TwInstance> | null = null;

function getTw(): Promise<TwInstance> {
  if (_tw) return Promise.resolve(_tw);
  if (_bootPromise) return _bootPromise;

  _bootPromise = new Promise((resolve) => {
    const tw = _require("tiddlywiki");
    const instance = tw.TiddlyWiki();
    instance.boot.argv = [];
    // TW5 prints its help banner to stdout when argv is empty; suppress it.
    const origWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = () => true;
    instance.boot.boot(() => {
      (process.stdout as any).write = origWrite;
      _tw = instance;
      resolve(instance);
    });
  });

  return _bootPromise;
}

// ---------------------------------------------------------------------------
// ClosureEntry → tiddler field mapping
// ---------------------------------------------------------------------------

function entryToFields(entry: ClosureEntry): Record<string, string | string[]> {
  return {
    title:        entry.uri,
    tags:         entry.implements,
    depth:        String(entry.depth),
    rating:       entry.kind,
    confidence:   String(entry.confidence),
    register:     entry.register,
    manaoio:      String(entry.manaoio),
    mana:         String(entry.mana),
    manao:        String(entry.manao),
    role:         entry.role ?? "",
    exists:       String(entry.exists),
    laresRelPath: entry.laresRelPath ?? "",
    contentHash:  entry.contentHash,
  };
}

// ---------------------------------------------------------------------------
// Expression pre-processing: wikitext-filter dialect → TW5 canonical
//
// wikitext-filter is a superset of x-tiddlywiki-filter (lar:///grammars/wikitext-filter).
// Key translations applied before the TW5 engine sees the expression:
//
//   all[memes]       → all[tiddlers]       (noun alias)
//   toml:key[value]  → field:key[value]    (#iam TOML keys ARE tiddler fields in the engine)
//
// Operators handled in a future pass (require graph data injected as tiddler fields):
//   edge:family[X]role[Y]   pranala edge query — planned; see entryToFields for edge prep
//   self[]                  current-meme URI context — planned
//   ahu:id[X]               ahu block presence query — planned
//
// Deprecated TW5 forms (!!field, ##index, currentTiddler) are passed through as-is;
// they may work via the underlying TW engine but emit no special handling here.
// ---------------------------------------------------------------------------

function toCanonicalWikitext(expr: string): string {
  return expr
    // Noun alias: memes = tiddlers in TW5 engine
    .replace(/\ball\[memes\]/g, "all[tiddlers]")
    // toml:key[value] → field:key[value]
    // #iam TOML keys (rating, register, confidence, manaoio, role, depth, …) are
    // stored as tiddler fields in entryToFields(), so field: queries work directly.
    .replace(/\btoml:([\w-]+)\[/g, "field:$1[");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter ClosureEntry objects using the wikitext-filter dialect.
 *
 * Dialect: lar:///grammars/wikitext-filter — superset of x-tiddlywiki-filter.
 * Engine: TW5 wiki.filterTiddlers() with wikitext-filter pre-processing.
 * Async: TW boots on first call (~10ms singleton); subsequent calls instant.
 *
 * @param allEntries  Full closure to filter from
 * @param expr        wikitext-filter expression
 *
 * @example
 *   // Invariant memes
 *   await filterMemesWikitext(closure, "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]");
 *
 *   // CS-register memes (toml: operator)
 *   await filterMemesWikitext(closure, "[all[memes]toml:register[CS]]");
 *
 *   // Memes by confidence register + rating
 *   await filterMemesWikitext(closure, "[all[memes]toml:register[SC]field:rating[meme]]");
 *
 *   // First 5 by depth
 *   await filterMemesWikitext(closure, "[all[memes]nsort[depth]limit[5]]");
 *
 *   // URI prefix
 *   await filterMemesWikitext(closure, "[prefix[lar:///ha.ka.ba/api/v0.1]]");
 */
export async function filterMemesWikitext(
  allEntries: readonly ClosureEntry[],
  expr: string,
): Promise<ClosureEntry[]> {
  const $tw = await getTw();

  for (const entry of allEntries) {
    $tw.wiki.addTiddler(new $tw.Tiddler(entryToFields(entry)));
  }

  const titles: string[] = $tw.wiki.filterTiddlers(toCanonicalWikitext(expr));

  // Return only entries that match (exclude TW system tiddlers like $:/boot/*)
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  return titles.map((t) => byUri.get(t)).filter((e): e is ClosureEntry => e !== undefined);
}

/** Backward-compat alias — prefer filterMemesWikitext for new code. */
export const filterMemesTW = filterMemesWikitext;

/**
 * Pre-compute multiple named filter results in a single TW boot cycle.
 * Used by the snapshot builder to embed room data for browser consumption.
 *
 * @param allEntries  Full closure
 * @param rooms       Map of roomId → TW filter expression
 * @returns           Map of roomId → matching URIs (order preserved)
 */
export async function precomputeRooms(
  allEntries: readonly ClosureEntry[],
  rooms: Record<string, string>,
): Promise<Record<string, string[]>> {
  const $tw = await getTw();

  for (const entry of allEntries) {
    $tw.wiki.addTiddler(new $tw.Tiddler(entryToFields(entry)));
  }

  const result: Record<string, string[]> = {};
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));

  for (const [roomId, expr] of Object.entries(rooms)) {
    const titles: string[] = $tw.wiki.filterTiddlers(toCanonicalWikitext(expr));
    result[roomId] = titles.filter((t) => byUri.has(t));
  }

  return result;
}
