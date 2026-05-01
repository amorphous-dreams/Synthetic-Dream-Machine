import type { TW5Instance, TW5FilterSource, TW5FilterOperator } from "../types/tiddlywiki.js";

/** edge:family[role] — filter tiddlers that have an edge-out field for family+role.
 *  edge:control[owns] → has field edge-out-control-owns
 *  edge:control[]     → has any edge-out-control-* field */
export function registerEdge(tw: TW5Instance): void {
  tw.filterOperators["edge"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const family  = operator.suffix ?? "";
    const role    = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      if (role) {
        const v = tiddler.fields?.[`edge-out-${family}-${role}`];
        if (v !== undefined && v !== "") results.push(title);
      } else {
        const prefix = `edge-out-${family}-`;
        if (Object.keys(tiddler.fields ?? {}).some((k) => k.startsWith(prefix))) results.push(title);
      }
    });
    return results;
  };
}
