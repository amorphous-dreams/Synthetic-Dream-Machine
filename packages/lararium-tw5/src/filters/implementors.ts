import type { TW5Instance, TW5FilterSource, TW5FilterOperator } from "../types/tiddlywiki.js";

/** Exact-token match on space-separated `implements` field.
 *  TW5's built-in field: operator does substring matching, which breaks when one
 *  URI is a prefix of another. This uses parseStringArray for exact token matching. */
export function registerImplementors(tw: TW5Instance): void {
  tw.filterOperators["implementors"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const target  = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      const raw: string    = String(tiddler.fields?.["implements"] ?? "");
      const tokens: string[] = tw.utils.parseStringArray(raw) ?? [];
      if (tokens.includes(target)) results.push(title);
    });
    return results;
  };
}
