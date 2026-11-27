/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/afford
type: application/javascript
module-type: filteroperator
\*/
/**
 * afford — an affordance carrier's slots, read for one skin inside the wiki that holds the carrier.
 *
 *   [[lar:///oracle.library.consults]afford:cli[rows],[#/takes]]     one JSON row per `has` line, with what the cli spells
 *   [[lar:///oracle.library.consults]afford:mcp[usage]]              the usage spine on the mcp surface
 *   [[lar:///oracle.library.consults]afford:tw5[spells]]           the skin's spelling (absent where the carrier skins none)
 *   [[lar:///oracle.library.consults]afford[prose],[#/head]]         the slot's prose, one paragraph per title
 *   [[lar:///oracle.library.consults]afford[digest],[#/takes]]       the slot's digest line
 *   [[lar:///oracle.library.consults]afford:cli[read],[#/refuses]]   the read that opens the next depth
 *   [[lar:///oracle.library.consults]afford[surfaces]]               the surfaces the carrier skins
 *   [all[shadows+tiddlers]tag[…/affordance]afford[match],[oracle.*]]   the carriers a t2/t3 wildcard names
 *
 * The suffix names the surface (cli by default), or a third operand does where a template binds it to a variable
 * (`afford[rows],[#/takes],<surface>`); an unknown surface or view THROWS by name. The skin templates
 * (`afford/skin/<surface>`) compose their lines from these views, so the words stay in the carrier and the reading in one
 * module (`affordance-read`).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { affordView, surfaceOf } from "../affordance-read.js";

const operandText = (o: unknown): string =>
  typeof o === "string" ? o : String((o as { value?: string; text?: string } | undefined)?.value ?? (o as { text?: string } | undefined)?.text ?? "");

export function afford(source: TW5FilterSource, operator: TW5FilterOperator, options: { wiki: TW5Wiki }): string[] {
  const textOf = (title: string): string | undefined => {
    const fields = (options.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
    return fields === undefined ? undefined : String(fields["text"] ?? "");
  };
  const surface = surfaceOf(operator.suffix || operandText(operator.operands[2]));
  const view = (operator.operand || "").trim();
  const arg = operandText(operator.operands[1]).trim();
  const out: string[] = [];
  source((_tiddler, title: string) => { out.push(...affordView(textOf, title, view, surface, arg)); });
  return out;
}
