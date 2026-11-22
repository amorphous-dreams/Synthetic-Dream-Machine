/**
 * house-filters — the house's named filters (`[lares.law[]]`, `[lares.law.pins[]]`, `[lares.road[open]]`, `[lares.stage[state]]`)
 * stand as `\function` definitions in ONE canon carrier, and a filter reaches them from canon alone.
 *
 * TiddlyWiki resolves a user function as a filter operator only where the name holds a period (`filters/unknown.js`), so
 * the house names carry the `lares.` stem. A function reaches a filter through a widget whose variables hold it; the
 * stock route (`\import` over the `$:/tags/Global` tag) reads the wiki, where a face's working-layer record shadows a
 * canon record of the same title and any tiddler may carry the tag. This module builds the widget from the canon
 * layers' own text instead: the carrier read from a canon bag (the oracle floor, the system canon bags), the
 * `\function` blocks lifted out of it, parsed once per reader's view. A working-layer tiddler that redefines a house
 * function (at the carrier's title, or any other titled `$:/tags/Global`) never reaches that widget, so it changes no answer.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers
 */

import type { CompositeStore } from "@lararium/mesh";
import { LAW_CANON_BAG_PATTERN } from "./daemon-law-tiddlers.js";

/** The one canon carrier that defines the house's functions. */
export const HOUSE_FILTERS_TITLE = "lar:///ha.ka.ba/lares/api/filters";

/** The stem every house function name opens with; a filter naming none of them needs no widget. */
export const HOUSE_FUNCTION_STEM = "lares.";

/**
 * THE FLOOR: the carrier's `\function` blocks as the source carries them, read only where no canon layer holds the carrier
 * (a vessel founded on a floor snapshot cut before the carrier landed; the release cut carries canon forward and the floor then
 * stands unread). It lives in code, never in a wiki layer, so no working-layer record shadows it; a test welds it to the canon
 * carrier byte for byte.
 */
export const HOUSE_FILTERS_FLOOR = String.raw`\function lares.law.pins()
[subfilter{$:/config/lares/law/pins}] :intersection[lares.law[]]
\end

\function lares.law()
[subfilter{$:/config/lares/law/pins}] =[prefix[lar:///ha.ka.ba/]regexp[^lar:///ha\.ka\.ba/(\w|-)+/api/]!regexp[#]sort[title]] +[unique[]] :filter[regexp[^lar:///ha\.ka\.ba/(\w|-)+/api/]!regexp[#]] :filter[get[$origin-bag]regexp[^lar:///ha\.ka\.ba/bags/(oracle|lares|lararium)$]] :filter[regexp[^lar:///\S+$]]
\end

\function lares.road(state)
[tag[stage/road]] :filter[tags[]removeprefix[road/state/]match<state>]
\end

\function lares.stage(name)
[prefix[lar:///ha.ka.ba/kahua/memory/]] :filter[<currentTiddler>removeprefix[lar:///ha.ka.ba/kahua/memory/]removeprefix<name>removeprefix[/]]
\end`;

const FUNCTION_BLOCK = /^\\function [^\n]*\n(?:(?!\\end\n?$)[^\n]*\n)*?\\end[ \t]*$/gm;
const CANON_BAG = new RegExp(LAW_CANON_BAG_PATTERN);

/** The `\function … \end` blocks of a carrier's text, joined as one pragma run; empty where none stands. */
export function functionPragmasOf(text: string): string {
  return (text.match(FUNCTION_BLOCK) ?? []).join("\n\n");
}

interface WikiLike { getTiddler(title: string): { fields: Record<string, unknown> } | undefined }

/**
 * The carrier's text as a canon layer answers it, topmost layer first; the wiki's own record serves only where that record
 * itself carries a canon stamp (a rig that rides canon as wiki records). The floor where no canon layer holds it.
 */
export async function canonFiltersText(composite: CompositeStore, wiki: WikiLike, mayRead: (bag: string | null) => Promise<boolean>): Promise<string> {
  for (const bag of [...composite.layerIds].reverse()) {
    if (!CANON_BAG.test(bag) || !(await mayRead(bag))) continue;
    const record = await composite.storeForBag(bag)?.get(HOUSE_FILTERS_TITLE);
    const text = record?.tiddler["text"];
    if (typeof text === "string" && text !== "" && !record?.meta?.deleted) return text;
  }
  const held = wiki.getTiddler(HOUSE_FILTERS_TITLE);
  const stamp = held?.fields["$origin-bag"];
  const text = held?.fields["text"];
  return typeof stamp === "string" && CANON_BAG.test(stamp) && typeof text === "string" && text !== "" ? text : HOUSE_FILTERS_FLOOR;
}

interface WidgetLike { children?: WidgetLike[]; render(parent: unknown, next: null): void; makeFakeWidgetWithVariables(vars: Record<string, unknown>): unknown }
interface HouseWiki {
  parseText(type: string, text: string): unknown;
  makeWidget(parser: unknown, options: Record<string, unknown>): WidgetLike;
}

/**
 * The widget a house filter runs under: the canon pragmas rendered once over one text leaf (TiddlyWiki reads a function off
 * the widget's PARENT chain, so the deepest widget stands below every definition). Null where the carrier holds no function.
 */
export function houseWidgetOf(wiki: HouseWiki, document: { createElement(tag: string): unknown }, carrierText: string): unknown | null {
  const pragmas = functionPragmasOf(carrierText);
  if (pragmas === "") return null;
  const root = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", `${pragmas}\n\n.`), {});
  root.render(document.createElement("div"), null);
  let deepest = root;
  while (deepest.children && deepest.children.length > 0) deepest = deepest.children[0]!;
  return deepest.makeFakeWidgetWithVariables({});
}
