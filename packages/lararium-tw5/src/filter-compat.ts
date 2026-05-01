/**
 * filter-compat — filterMemesWikitext utility for tests and CLI tools.
 *
 * Takes ClosureEntry[] and returns matching entries — the legacy API used by
 * lararium-core tests and the MCP sketch. Production code should boot a recipe
 * VM via bootRecipeVm() and call filterRecipe() against loaded wiki state.
 *
 * Browser-safe: no fs/path imports.
 */

import type { ClosureEntry, EdgeRecord } from "@lararium/core";
import { LarariumTW5 } from "./lararium-tw5.js";

// One reusable VM per process — avoids re-booting on every call.
// Intentionally not part of the recipe VM registry: no store, no subscription.
let _compat: LarariumTW5 | null = null;

async function compatVm(): Promise<LarariumTW5> {
  if (_compat) return _compat;
  const vm = new LarariumTW5();
  await vm.boot();
  _compat = vm;
  return vm;
}

/**
 * Filter ClosureEntry objects using a TW5 wikitext filter expression.
 *
 * Convenience wrapper for tests and CLI tools. Uses loadClosure() internally,
 * which rewrites all wiki tiddlers on every call — not suitable for concurrent
 * server use. For production: use bootRecipeVm() + filterRecipe().
 */
export async function filterMemesWikitext(
  entries:  readonly ClosureEntry[],
  expr:     string,
  edges?:   readonly EdgeRecord[],
): Promise<ClosureEntry[]> {
  const vm = await compatVm();
  vm.loadClosure(entries, edges);
  return vm.filterClosure(expr, entries);
}
