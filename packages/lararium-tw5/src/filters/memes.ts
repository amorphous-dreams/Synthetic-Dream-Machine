import type { TW5Instance, TW5FilterSource, TW5FilterOperator, TW5Wiki } from "../types/tiddlywiki.js";

/**
 * memes — TW5 filter operator: all tiddlers with lar: URI titles.
 *
 * Follows the TW5 filteroperator convention:
 *   (source, operator, options) → string[]
 *
 * Acts as a collection source — ignores the input `source` pipeline and
 * builds its own set from options.wiki.each(), matching both hostless
 * (lar:///path) and hostful (lar://node/path) lar: URIs.
 *
 * Usage:
 *   [memes[]]                  — all lar: memes (filterOperator path)
 *   [all[memes]]               — all lar: memes (allfilteroperator path)
 *   [all[memes]tag[important]] — lar: memes with a tag
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/filter-operators/memes
 */

function collectMemes(wiki: TW5Wiki): string[] {
  const results: string[] = [];
  wiki.each(function (_tiddler, title: string) {
    if (title.startsWith("lar:")) results.push(title);
  });
  return results;
}

/** Register `[memes[]]` as a named filterOperator. */
export function registerMemes(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;
  tw.filterOperators["memes"] = function (
    _source:   TW5FilterSource,
    _operator: TW5FilterOperator,
    options:   { wiki: TW5Wiki },
  ): string[] {
    return collectMemes(options.wiki);
  };
}

/**
 * Register `all[memes]` as a named allfilteroperator source.
 * TW5's `all[]` dispatches via modules.types["allfilteroperator"], not filterOperators.
 */
export function registerMemesSource(tw: TW5Instance): void {
  if (!tw?.modules?.types) return;
  tw.modules.types["allfilteroperator"] = tw.modules.types["allfilteroperator"] ?? {};
  if (tw.modules.types["allfilteroperator"]["memes"]) return;
  tw.modules.types["allfilteroperator"]["memes"] = {
    moduleType: "allfilteroperator",
    definition: null,
    exports: {
      memes: function (
        _source:  TW5FilterSource,
        _prefix:  string,
        options:  { wiki: TW5Wiki },
      ): string[] {
        return collectMemes(options.wiki);
      },
    },
  };
}
