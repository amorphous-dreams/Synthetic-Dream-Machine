import type { TW5Instance, TW5FilterSource } from "../types/tiddlywiki.js";

/** memes — filter source: all tiddlers with lar: URI titles.
 *  Matches both hostless (lar:///path) and hostful (lar://host/path) URIs.
 *  [all[memes]] → every lar: meme in the wiki (excludes $:/ system tiddlers). */
export function registerMemes(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;
  tw.filterOperators["memes"] = function (source: TW5FilterSource) {
    const results: string[] = [];
    source(function (_tiddler, title: string) {
      if (title.startsWith("lar:")) results.push(title);
    });
    return results;
  };
}
