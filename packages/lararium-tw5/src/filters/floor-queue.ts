/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/floor-queue
type: application/javascript
module-type: filteroperator
\*/
/**
 * floor-queue — THE TEST FLOOR'S QUEUE, read inside the wiki that holds it (mandate/floor-gate-1).
 *
 *   [[lar:///ha.ka.ba/kahua/memory/state/test-floor]floor-queue[<view>],[<arg>]]
 *
 * The input titles name ledger records; their texts join in input order and fold through `floor-ledger` (the grammar, the
 * arrival order, the dedupe by sha). Views: `waiting` (the default) · `next` · `skip` (waiting, but a green verdict already
 * covers the sha) · `taken` · `green` · `red` · `stopped` · `dropped` · `budget` (one byte row per verdict) · `ticket` /
 * `runs` / `sha` (the second operand names the ticket) · `green-sha` (the second operand names a sha; answers `yes` or
 * nothing). A view the grammar does not name THROWS: an empty answer for a typo would read as an empty floor.
 *
 * The host reads the floor through the render door (`tools/floor-ledger.mjs`), so the queue's law runs here alone; the host
 * appends lines and asks, and holds no second fold.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { floorView, foldLedger } from "../floor-ledger.js";

export function floorQueue(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const texts: string[] = [];
  source((_tiddler, title: string) => {
    const fields = (options.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (fields !== undefined) texts.push(String(fields["text"] ?? ""));
  });
  const arg = (((operator.operands[1] as unknown as { text?: string } | string | undefined) ?? "") as string | { text?: string });
  const second = typeof arg === "string" ? arg : (arg.text ?? "");
  return floorView(foldLedger(texts.join("\n")), (operator.operand || "").trim(), second.trim());
}

export { floorQueue as "floor-queue" };
