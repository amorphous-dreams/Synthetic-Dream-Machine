/**
 * bag — TW5 filter operators for lar: bag-scoped tiddler views.
 *
 * Wiki-first: recipe evaluation logic lives here, not in TS peer factories.
 * Vite compiles this module into the TW5 plugin bundle so the wiki can
 * evaluate recipes and bag membership without any TS runtime context.
 *
 * Operators:
 *
 *   [bag[lar:URI]]         — collection source: all tiddlers where bag == uri
 *
 *   [recipe[recipeUri]]    — collection source: all tiddlers visible through
 *                            the recipe's bag stack (deduped by title; higher-
 *                            priority bag wins if same title appears in multiple bags)
 *
 * Both operators ignore the input `source` and build their own set from the
 * in-memory wiki.  They act as collection sources, usable like `[memes[]]`:
 *
 *   [bag[lar:///ha.ka.ba/@lararium]]tag[system]
 *   [recipe[lar:///ha.ka.ba/@lararium/recipes/default]]search[query]
 *
 * Recipe tiddlers arrive via MemeSyncAdaptor from the ha island before any UI
 * evaluation, so [recipe[uri]] resolves correctly at wiki load time.
 *
 * bagStack field format: space-separated lar: URIs (TW5 list format).
 * TW5's Tiddler.getFieldList("bagStack") parses this natively.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/filter-operators/bag
 */

import type { TW5Instance, TW5FilterSource, TW5FilterOperator, TW5Wiki } from "../types/tiddlywiki.js";

// ---------------------------------------------------------------------------
// [bag[bagId]] — bag-scoped collection source
// ---------------------------------------------------------------------------

/**
 * Register `[bag[bagId]]` as a filterOperator.
 *
 * Returns titles of all tiddlers whose `bag` field equals the operand.
 * Ignores the input source — behaves as a collection source, not a pipeline filter.
 *
 * Usage:
 *   [bag[lar:///ha.ka.ba/@lararium]]          — all ha tiddlers
 *   [bag[lar:///ha.ka.ba/@catalog]]           — all ka tiddlers
 *   [bag[lar:///ha.ka.ba/@catalog/@elyncia]]  — corpus child-doc tiddlers
 */
export function registerBag(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;
  tw.filterOperators["bag"] = function (
    _source:  TW5FilterSource,
    operator: TW5FilterOperator,
    options:  { wiki: TW5Wiki },
  ): string[] {
    const targetBag = operator.operand;
    const results: string[] = [];
    options.wiki.each(function (tiddler, title) {
      const bag = tiddler.fields["bag"] as string | undefined;
      if (bag === targetBag) results.push(title);
    });
    return results;
  };
}

// ---------------------------------------------------------------------------
// [recipe[recipeUri]] — recipe-derived collection source
// ---------------------------------------------------------------------------

/**
 * Register `[recipe[recipeUri]]` as a filterOperator.
 *
 * Reads the recipe tiddler at recipeUri, walks its bagStack (lowest → highest
 * priority), and returns the visible set of titles.  Same title in a higher-
 * priority bag shadows the same title in a lower-priority bag.
 *
 * Returns [] if the recipe tiddler does not exist or bagStack parses empty.
 *
 * bagStack field: space-separated lar: URIs — read via tiddler.getFieldList().
 *
 * Usage:
 *   [recipe[lar:///ha.ka.ba/@lararium/recipes/default]]
 *   [recipe[lar:///ha.ka.ba/@lararium/recipes/full]]tag[system]
 */
export function registerRecipe(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;
  tw.filterOperators["recipe"] = function (
    _source:  TW5FilterSource,
    operator: TW5FilterOperator,
    options:  { wiki: TW5Wiki },
  ): string[] {
    const recipeUri = operator.operand;
    const recipeTiddler = options.wiki.getTiddler(recipeUri);
    if (!recipeTiddler) return [];

    // getFieldList handles TW5 space-separated string and JS arrays natively.
    const bagStack: string[] = recipeTiddler.getFieldList("bagStack");
    if (bagStack.length === 0) return [];

    // Walk lowest → highest priority.  Build title → bagIndex map;
    // higher index wins for same-title collisions.  Then return all titles
    // that survived to the highest-priority bag that claimed them.
    // Since each title appears at most once per bag, a Set suffices —
    // we accumulate all titles and the last bag's setTiddler() call
    // (via MemeSyncAdaptor) already left the highest-priority version in the wiki.
    // The recipe filter therefore returns the union of titles across all bags
    // in the stack (same deduplication semantics as CompositeStore.listVisible).
    const seen = new Set<string>();
    for (const bagId of bagStack) {
      options.wiki.each(function (tiddler, title) {
        const bag = tiddler.fields["bag"] as string | undefined;
        if (bag === bagId) seen.add(title);
      });
    }
    return Array.from(seen);
  };
}
