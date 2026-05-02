/**
 * toCanonicalWikitext — pre-processes lararium sugar syntax into canonical TW5 filter operators.
 */
export function toCanonicalWikitext(expr: string): string {
  return expr
    .replace(/\ball\[memes\]/g, "all[tiddlers]")
    .replace(/\btoml:([\w-]+)\[/g, "field:$1[")
    .replace(/\bimplements\[([\w:/.-]+)\]/g, "field:implements[$1]")
    .replace(/\bedge:([\w-]+)\[([\w-]+)\]/g, "has[edge-out-$1-$2]")
    .replace(/\bedge:([\w-]+)\[\]/g, "has[edge-out-$1]");
}
