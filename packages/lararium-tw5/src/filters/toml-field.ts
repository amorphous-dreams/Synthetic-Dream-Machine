/*\
title: lar:///ha.ka.ba/@lararium/tw5/filters/toml-field
type: application/javascript
module-type: library
\*/
import type { TW5Instance, TW5FilterSource, TW5FilterOperator } from "../types/tiddlywiki.js";

/** toml:key[val] — field filter using TOML field names directly.
 *  toml:register[CS] → tiddlers where the "register" field equals "CS" */
export function registerTomlField(tw: TW5Instance): void {
  tw.filterOperators["toml"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const fieldName = operator.suffix ?? "";
    const value     = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      const fv: string = String(tiddler.fields?.[fieldName] ?? "");
      if (fv === value) results.push(title);
    });
    return results;
  };
}
