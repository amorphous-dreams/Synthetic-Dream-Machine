/**
 * server-api — Node.js per-recipe TW5 VM registry and functional filter API.
 *
 * Fontany-Fuller-Zelenka local-first law:
 *   Each recipe (ordered bag stack) gets its own LarariumTW5 VM.
 *   A recipe = a CompositeStore layer order. Different rooms or corpus views
 *   can compose different subsets of bags — each needs its own isolated VM.
 *   No shared global state. No seed-and-hydrate over HTTP.
 *
 * NEVER import from browser code. Browser rooms own their VMs via
 * useLarariumHostOpen → LarariumTW5 scoped to the room.
 *
 * recipeId convention: sorted bag slugs joined by "+" e.g. "lares+ftls+room"
 * Use makeRecipeId(bagIds) to produce a canonical key.
 */

import type { ClosureEntry, EdgeRecord } from "@lararium/core";
import { LarariumTW5 } from "./lararium-tw5.js";

if (typeof window !== "undefined") {
  throw new Error("server-api must not be imported in browser bundles.");
}

// ---------------------------------------------------------------------------
// Per-recipe VM registry
// ---------------------------------------------------------------------------

const _vms = new Map<string, Promise<LarariumTW5>>();

/** Canonical recipe key from an ordered list of bag slugs. */
export function makeRecipeId(bagIds: readonly string[]): string {
  return [...bagIds].sort().join("+");
}

/**
 * Get or boot a TW5 VM for the given recipe.
 *
 * First call for a recipeId boots a fresh VM (~10ms). Subsequent calls return
 * the same instance. Call releaseRecipeVm() to tear down when a room closes.
 */
export async function getRecipeVm(recipeId: string): Promise<LarariumTW5> {
  const existing = _vms.get(recipeId);
  if (existing) return existing;
  const boot = (async () => {
    const vm = new LarariumTW5();
    await vm.boot();
    return vm;
  })();
  _vms.set(recipeId, boot);
  return boot;
}

/**
 * Release a VM when its recipe/room is torn down.
 * Safe to call with an unknown recipeId (no-op).
 */
export function releaseRecipeVm(recipeId: string): void {
  _vms.delete(recipeId);
}

/** Number of live VM instances — useful for diagnostics. */
export function liveVmCount(): number { return _vms.size; }

// ---------------------------------------------------------------------------
// Functional filter API — used by @lararium/node + MCP server
//
// Callers must supply an explicit recipeId. No implicit global VM.
// ---------------------------------------------------------------------------

/**
 * Filter ClosureEntry objects using the wikitext-filter dialect.
 *
 * recipeId must be produced by makeRecipeId(bagIds) — the ordered bag stack
 * that defines this VM's corpus view. Different recipes run in separate VMs.
 */
export async function filterMemesWikitext(
  allEntries: readonly ClosureEntry[],
  expr: string,
  edges?: readonly EdgeRecord[],
  recipeId = makeRecipeId(["lares"]),
): Promise<ClosureEntry[]> {
  const inst = await getRecipeVm(recipeId);
  inst.loadClosure(allEntries, edges);
  return inst.filterClosure(expr, allEntries);
}

/**
 * Pre-compute multiple named filter results in a single boot cycle.
 * Used by the snapshot builder and corpus projection tools.
 */
export async function precomputeRooms(
  allEntries: readonly ClosureEntry[],
  rooms: Record<string, string>,
  edges?: readonly EdgeRecord[],
  recipeId = makeRecipeId(["lares"]),
): Promise<Record<string, string[]>> {
  const inst = await getRecipeVm(recipeId);
  inst.loadClosure(allEntries, edges);
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  const result: Record<string, string[]> = {};
  for (const [roomId, expr] of Object.entries(rooms)) {
    const titles = inst.filterTiddlers(expr);
    result[roomId] = titles.filter((title: string) => byUri.has(title));
  }
  return result;
}
