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
    role:         entry.role ?? "",
    exists:       String(entry.exists),
    laresRelPath: entry.laresRelPath ?? "",
    contentHash:  entry.contentHash,
  };
}

// ---------------------------------------------------------------------------
// Expression pre-processing: Lararium dialect → TW5 canonical
// ---------------------------------------------------------------------------

function toCanonicalTW(expr: string): string {
  return expr.replace(/\ball\[memes\]/g, "all[tiddlers]");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter ClosureEntry objects using TW5's filter engine.
 *
 * Async because TW boots on first call (singleton, ~10ms; subsequent calls instant).
 *
 * @param allEntries  Full closure to filter from
 * @param expr        TW5 filter expression — use [all[memes]] as the entry-point source
 *
 * @example
 *   // All invariant memes
 *   await filterMemesTW(closure, "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]");
 *
 *   // First 5 memes by depth (numeric sort)
 *   await filterMemesTW(closure, "[all[memes]nsort[depth]limit[5]]");
 *
 *   // Memes at depth 0 (the boot entry)
 *   await filterMemesTW(closure, "[all[memes]field:depth[0]]");
 *
 *   // Memes with data rating, sorted by URI
 *   await filterMemesTW(closure, "[all[memes]field:rating[data]sort[title]]");
 */
export async function filterMemesTW(
  allEntries: readonly ClosureEntry[],
  expr: string,
): Promise<ClosureEntry[]> {
  const $tw = await getTw();

  for (const entry of allEntries) {
    $tw.wiki.addTiddler(new $tw.Tiddler(entryToFields(entry)));
  }

  const titles: string[] = $tw.wiki.filterTiddlers(toCanonicalTW(expr));

  // Return only entries that match (exclude TW system tiddlers like $:/boot/*)
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  return titles.map((t) => byUri.get(t)).filter((e): e is ClosureEntry => e !== undefined);
}

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
    const titles: string[] = $tw.wiki.filterTiddlers(toCanonicalTW(expr));
    result[roomId] = titles.filter((t) => byUri.has(t));
  }

  return result;
}
