/**
 * house-filters — the house's named filters (`[lares.law[]]`, `[lares.law.pins[]]`, `[lares.course[open]]`, `[lares.stage[state]]`)
 * stand as `\function` definitions in ONE canon carrier, and a filter reaches them from canon alone.
 *
 * TiddlyWiki resolves a user function as a filter operator only where the name holds a period (`filters/unknown.js`), so
 * the house names carry the `lares.` stem. A function reaches a filter through a widget whose variables hold it; the
 * stock route (`\import` over the `$:/tags/Global` tag) reads the wiki, where a face's working-layer record shadows a
 * canon record of the same title and any tiddler may carry the tag. This module builds the widget from the canon
 * layers' own text instead: the carrier read from a canon bag (the oracle floor, the system canon bags), the
 * `\function` blocks lifted out of it, parsed once per reader's view. A working-layer tiddler that redefines a house
 * function (at the carrier's title, or any other titled `$:/tags/Global`) never reaches that widget, so it changes no answer.
 * The carrier itself carries no `$:/tags/Global`, so no stock `\import` reads a shadowable copy of it. Each house name reads
 * from the carrier where it parses (the `\function` form, one-line or multi-line, or the `function` sigil) and from the floor
 * where it does not, name by name; a filter that names a `lares.` operator outside the house set refuses by name, never
 * falling through to TiddlyWiki's field operator.
 *
 * Meme: lar:///ha.ka.ba/lares/api/filters
 */

import { VerbRefusal, type CompositeStore } from "@lararium/mesh";
import { LAW_CANON_BAG_PATTERN } from "./daemon-law-tiddlers.js";

/** The one canon carrier that defines the house's functions. */
export const HOUSE_FILTERS_TITLE = "lar:///ha.ka.ba/lares/api/filters";

/** The stem every house function name opens with. */
export const HOUSE_FUNCTION_STEM = "lares.";
/** The house's function names, in the carrier's order. */
export const HOUSE_FUNCTION_NAMES: readonly string[] = ["lares.law.pins", "lares.law", "lares.road", "lares.course.citers", "lares.course.text-uncited", "lares.course.uncited", "lares.course.standing", "lares.course", "lares.waves", "lares.stage", "lares.broken", "lares.unreached"];

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

\function lares.course.citers(pattern,t)
[all[tiddlers]prefix[lar:///ha.ka.ba/kahua/memory/]!match<t>search:text:literal,casesensitive<t>regexp:text<pattern>] :filter[<currentTiddler>removeprefix<t>prefix[#/]then[no]else[yes]match[yes]]
\end

\function lares.course.text-uncited(t)
[<t>escaperegexp[]addsuffix[(?:\.(?!\w|-)|#/|(?!(?:-|\.|/|#))\W|$)]] :map[lares.course.citers<currentTiddler>,<t>count[]] +[match[0]]
\end

\function lares.course.uncited(t)
[<t>backlinks[]prefix[lar:///ha.ka.ba/kahua/memory/]!match<t>] :filter[<currentTiddler>removeprefix<t>prefix[#/]then[no]else[yes]match[yes]] +[count[]match[0]] :filter[lares.course.text-uncited<t>]
\end

\function lares.course.standing(t)
[<t>!has[proof]then[open]] :else[<t>get[proof]trim[]is[blank]then[open]] :else[lares.course.uncited<t>then[closed ash-ready]else[closed]enlist-input[]]
\end

\function lares.course(standing)
[tag[stage/course]!regexp[#]] :filter[lares.course.standing<currentTiddler>match<standing>]
\end

\function lares.waves()
[tag[stage/wave]]
\end

\function lares.stage(name)
[prefix[lar:///ha.ka.ba/kahua/memory/]] :filter[<currentTiddler>removeprefix[lar:///ha.ka.ba/kahua/memory/]removeprefix<name>removeprefix[/]]
\end

\function lares.broken()
[prefix[lar:///ha.ka.ba/kahua/memory/]lar-refs:out[]] :filter[is[missing]]
\end

\function lares.unreached()
[prefix[lar:///ha.ka.ba/kahua/memory/]!regexp[#]] :filter[<currentTiddler>lar-refs:in[]!match<currentTiddler>count[]match[0]] :filter[<currentTiddler>lar-refs:tagged[]!match<currentTiddler>count[]match[0]]
\end`;

const CANON_BAG = new RegExp(LAW_CANON_BAG_PATTERN);

/**
 * The function blocks a carrier's text defines, by name, each as one canonical multi-line `\function` block. Three spellings
 * parse: `\function name(params)` … `\end`, the one-line `\function name(params) body`, and the sigil
 * ``<<~ function name=`name(params)`>>body<<~/function>>`` (api/pono/function#/syntax). CRLF reads as LF.
 */
export function houseBlocksOf(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const put = (name: string, params: string | undefined, body: string): void => {
    const trimmed = body.trim();
    if (trimmed !== "") out.set(name, `\\function ${name}${params ?? "()"}\n${trimmed}\n\\end`);
  };
  const source = text.replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const head = /^\\function[ \t]+([\w.-]+)[ \t]*(\([^)]*\))?[ \t]*(.*)$/.exec(lines[i]!);
    if (!head) continue;
    if (head[3] !== "") { put(head[1]!, head[2], head[3]!); continue; }
    const body: string[] = [];
    while (++i < lines.length && lines[i]!.trim() !== "\\end") body.push(lines[i]!);
    put(head[1]!, head[2], body.join("\n"));
  }
  for (const sigil of source.matchAll(/<<~[ \t]*function[ \t]+name=`([\w.-]+)(\([^)]*\))?`[^>]*>>([\s\S]*?)<<~\/function>>/g)) put(sigil[1]!, sigil[2], sigil[3]!);
  return out;
}

/**
 * The pragma run a carrier's text yields: every house name, from the carrier where it parses and from the floor where it
 * does not, name by name. The names beyond the house set a carrier may hold never ride.
 */
export function functionPragmasOf(text: string): string {
  const held = houseBlocksOf(text);
  const floor = houseBlocksOf(HOUSE_FILTERS_FLOOR);
  return HOUSE_FUNCTION_NAMES.map((name) => held.get(name) ?? floor.get(name)!).join("\n\n");
}

/** The house operators a filter names: each `lares.<name>[` operator, as written. */
const HOUSE_OPERATOR = /(?<![\w.\/:#-])(lares\.[\w.-]+)(?=\[)/g;

/** A filter naming a `lares.` operator outside the house set refuses by name: TiddlyWiki would read it as a field name and answer the whole store. */
export function refuseUnknownHouseOperators(filter: string): void {
  if (!filter.includes(HOUSE_FUNCTION_STEM)) return;
  for (const match of filter.matchAll(HOUSE_OPERATOR)) {
    if (!HOUSE_FUNCTION_NAMES.includes(match[1]!)) {
      throw new VerbRefusal("house-filter-unknown", `house-filter-unknown: "${match[1]}" names no house function (${HOUSE_FUNCTION_NAMES.join(", ")}); the filter refuses before it can read as a field name`);
    }
  }
}

interface WikiLike { getTiddler(title: string): { fields: Record<string, unknown> } | undefined }

/**
 * THE WIKI-STAMP SEAM. A wiki record serves as the carrier only where it itself carries a canon `$origin-bag` stamp (the
 * island lands canon records stamped; a face's working-layer write lands stamped with its own layer, never a canon one). Else the floor.
 */
export function canonFiltersTextOfWiki(wiki: WikiLike): string {
  const held = wiki.getTiddler(HOUSE_FILTERS_TITLE);
  const stamp = held?.fields["$origin-bag"];
  const text = held?.fields["text"];
  return typeof stamp === "string" && CANON_BAG.test(stamp) && typeof text === "string" && text !== "" ? text : HOUSE_FILTERS_FLOOR;
}

/**
 * The carrier's text as a canon layer answers it, topmost layer first; then the wiki-stamp seam; then the floor where no
 * canon layer holds it.
 */
export async function canonFiltersText(composite: CompositeStore, wiki: WikiLike, mayRead: (bag: string | null) => Promise<boolean>): Promise<string> {
  for (const bag of [...composite.layerIds].reverse()) {
    if (!CANON_BAG.test(bag) || !(await mayRead(bag))) continue;
    const record = await composite.storeForBag(bag)?.get(HOUSE_FILTERS_TITLE);
    const text = record?.tiddler["text"];
    if (typeof text === "string" && text !== "" && !record?.meta?.deleted) return text;
  }
  return canonFiltersTextOfWiki(wiki);
}

interface WidgetLike { children?: WidgetLike[]; parentWidget?: { variables?: Record<string, { isFunctionDefinition?: boolean } | undefined> }; render(parent: unknown, next: null): void; makeFakeWidgetWithVariables(vars: Record<string, unknown>): unknown }
interface HouseWiki {
  parseText(type: string, text: string): unknown;
  makeWidget(parser: unknown, options: Record<string, unknown>): WidgetLike;
}

/**
 * The widget a house filter runs under: the pragmas rendered once over one text leaf (TiddlyWiki reads a function off the
 * widget's PARENT chain, so the deepest widget stands below every definition). Every house name must resolve as a function,
 * or the build refuses by name.
 */
export function houseWidgetOf(wiki: HouseWiki, document: { createElement(tag: string): unknown }, carrierText: string): unknown {
  const root = wiki.makeWidget(wiki.parseText("text/vnd.tiddlywiki", `${functionPragmasOf(carrierText)}\n\n.`), {});
  root.render(document.createElement("div"), null);
  let deepest = root;
  while (deepest.children && deepest.children.length > 0) deepest = deepest.children[0]!;
  for (const name of HOUSE_FUNCTION_NAMES) {
    if (!deepest.parentWidget?.variables?.[name]?.isFunctionDefinition) throw new VerbRefusal("house-filters-unresolved", `house-filters-unresolved: the house function "${name}" did not resolve; no filter runs without it`);
  }
  return deepest.makeFakeWidgetWithVariables({});
}

interface FilterWiki extends HouseWiki { filterTiddlers(filter: string, widget?: unknown, source?: unknown): string[] }

/**
 * A wiki whose every filter runs under the house widget, nested and indirect filters (`[subfilter{$:/y}]`) included, and refuses
 * an unknown `lares.` operator wherever it stands. It inherits the wiki, with filter caches of its own, so it never changes the wiki's.
 */
export function houseFilterWikiOf<W extends FilterWiki>(wiki: W, document: { createElement(tag: string): unknown }, carrierText: string): W {
  const view = Object.create(wiki) as W;
  const slots = view as unknown as Record<string, unknown>;
  slots["filterCache"] = Object.create(null);
  slots["filterCacheCount"] = 0;
  slots["caches"] = Object.create(null);
  slots["globalCache"] = Object.create(null);
  let widget: unknown;
  const run = wiki.filterTiddlers as (this: unknown, filter: string, widget?: unknown, source?: unknown) => string[];
  slots["filterTiddlers"] = (filter: string, given?: unknown, source?: unknown): string[] => {
    refuseUnknownHouseOperators(filter);
    if (given === undefined) { widget ??= houseWidgetOf(view, document, carrierText); given = widget; }
    return run.call(view, filter, given, source);
  };
  return view;
}
