/*\
title: lar:///ha.ka.ba/@lararium/tw5/filters/all-memes
type: application/javascript
module-type: allfilteroperator
\*/
import type { TW5Wiki } from "../types/tiddlywiki.js";

/**
 * [all[memes]] — all tiddlers whose title carries a lar: URI.
 *
 * A meme means any tiddler or tiddler-group with a lar: URI title,
 * including slot-children (whose titles share the parent's lar: prefix).
 *
 * Mirrors the shape of TW5's built-in tiddlers.js allfilteroperator:
 * returns a string[] so LinkedList.pushTop() can compose it with other
 * all[] suboperators (e.g. [all[memes+shadows]]).
 */
export function memes(
  _source:  unknown,
  _prefix:  string,
  options:  { wiki: TW5Wiki },
): string[] {
  const results: string[] = [];
  options.wiki.each(function (_tiddler, title: string) {
    if (title.startsWith("lar:")) results.push(title);
  });
  return results;
}
