/**
 * server-api — Node.js server singleton and functional filter API.
 *
 * NEVER import from browser code. Each room owns its own LarariumTW5 instance.
 * The singleton exists so Node CLI tools (MCP, serve.ts) avoid re-booting TW5
 * on every invocation.
 *
 * Milestone D note (research-packet §9): once the recipe/bag live surface lands,
 * filterMemesWikitext and precomputeRooms will drive corpus bag composition
 * rather than a flat closure load. getServerSingleton becomes per-corpus-island.
 */

import type { ClosureEntry, EdgeRecord } from "@lararium/core";
import { LarariumTW5 } from "./lararium-tw5.js";

let _serverSingleton: LarariumTW5 | null = null;
let _serverSingletonReady: Promise<LarariumTW5> | null = null;

export async function getServerSingleton(): Promise<LarariumTW5> {
  if (typeof window !== "undefined") {
    throw new Error(
      "LarariumTW5 getServerSingleton() called in browser context. " +
      "Use new LarariumTW5() scoped to the room instead.",
    );
  }
  if (_serverSingleton?.ready) return _serverSingleton;
  if (_serverSingletonReady) return _serverSingletonReady;
  _serverSingletonReady = (async () => {
    _serverSingleton = new LarariumTW5();
    await _serverSingleton.boot();
    return _serverSingleton;
  })();
  return _serverSingletonReady;
}

/**
 * Filter ClosureEntry objects using the wikitext-filter dialect.
 * Boots TW5 on first call (~10ms), then instant on subsequent calls.
 */
export async function filterMemesWikitext(
  allEntries: readonly ClosureEntry[],
  expr: string,
  edges?: readonly EdgeRecord[],
): Promise<ClosureEntry[]> {
  const inst = await getServerSingleton();
  inst.loadClosure(allEntries, edges);
  return inst.filterClosure(expr, allEntries);
}

/**
 * Pre-compute multiple named filter results in a single boot cycle.
 * Used by the snapshot builder.
 */
export async function precomputeRooms(
  allEntries: readonly ClosureEntry[],
  rooms: Record<string, string>,
  edges?: readonly EdgeRecord[],
): Promise<Record<string, string[]>> {
  const inst = await getServerSingleton();
  inst.loadClosure(allEntries, edges);
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  const result: Record<string, string[]> = {};
  for (const [roomId, expr] of Object.entries(rooms)) {
    const titles = inst.filterTiddlers(expr);
    result[roomId] = titles.filter((title: string) => byUri.has(title));
  }
  return result;
}
