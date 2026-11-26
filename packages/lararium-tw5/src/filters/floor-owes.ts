/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/floor-owes
type: application/javascript
module-type: filteroperator
\*/
/**
 * floor-owes — THE FLOOR'S TICKET RULE, read inside the wiki that holds the seam table (research/corpus-seams).
 *
 *   [[lar:///ha.ka.ba/lararium/tw5/floor/seams]floor-owes[<view>],[<encodeURIComponent of the facts>]]
 *
 * The input titles name records in the fold's line grammars (the seam table, and a facts record where one stands in the
 * wiki); the second operand carries one more record, percent-encoded so its brackets never close the operand. Their texts
 * join in input order and fold through `floor-owes` (seams, guards, trunk and hub escalations, the refusal of a path in no
 * seam). Views: `runs` (the default) · `refuse` · `files` · `sets` · `seams` · `census`. A view the grammar does not name
 * THROWS, and so does a title naming no record: an empty answer would read as nothing owed.
 *
 * The host gathers a checkout's facts and asks through the filter door (`tools/floor-owes.mjs`), so the rule runs here
 * alone; the bench gate plans its steps from the answer and holds no second fold.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { FLOOR_SEAMS, floorOwesRows } from "../floor-owes.js";

export function floorOwes(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const texts: string[] = [];
  source((_tiddler, title: string) => {
    const fields = (options.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (fields === undefined) throw new Error(`floor-owes: ${title} names no record this wiki holds; the seam table ships as ${FLOOR_SEAMS}`);
    texts.push(String(fields["text"] ?? ""));
  });
  const arg = (((operator.operands[1] as unknown as { text?: string } | string | undefined) ?? "") as string | { text?: string });
  const second = typeof arg === "string" ? arg : (arg.text ?? "");
  if (second.trim() !== "") {
    try { texts.push(decodeURIComponent(second.trim())); }
    catch { throw new Error("floor-owes: the second operand carries the percent-encoded facts, and this one would not decode"); }
  }
  return floorOwesRows(texts.join("\n"), operator.operand || "");
}

export { floorOwes as "floor-owes" };
