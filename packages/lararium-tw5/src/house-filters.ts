/**
 * house-filters — the house's named filters (`[lares.law[]]`, `[lares.law.pins[]]`, `[lares.course[open]]`, `[lares.stage[state]]`)
 * stand as `\function` definitions in ONE carrier, and a filter reaches them through the whole bag stack.
 *
 * TiddlyWiki resolves a user function as a filter operator only where the name holds a period (`filters/unknown.js`), so
 * the house names carry the `lares.` stem. A function reaches a filter through a widget whose variables hold it. This module
 * builds that widget from the carrier's text as the reader's stack seats it: the topmost layer the reader may read that holds
 * the carrier's title answers (TiddlyWiki's own cascade), a working layer's above canon's, the `\function` blocks lifted out of
 * it and parsed once per reader's view. MUTABILITY AT THE ROOT (comms-ux-enacts fork 16): a spirit or an operator re-seats a
 * house function by seating the carrier above, as it re-seats any carrier; no fence keeps the seam to canon. The widget reads
 * the carrier's title alone, never the wiki's `$:/tags/Global` imports, so a function defined at any other title reaches the
 * house's filters only where the carrier names it. Each house name reads from the carrier where it parses (the `\function`
 * form, one-line or multi-line, or the `function` sigil) and from the floor where it does not, name by name; a `lares.`
 * function the carrier adds beyond the house set rides beside them. A filter that names a `lares.` operator nothing resolves
 * (no house function, no function the carrier adds, no filter operator module such as `lares.heads` and `lares.inbox`)
 * refuses by name, never falling through to TiddlyWiki's field operator.
 *
 * Meme: lar:///ha.ka.ba/lares/api/filters
 */

import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { type CompositeStore } from "@lararium/mesh/composite-store";

/** The one canon carrier that defines the house's functions. */
export const HOUSE_FILTERS_TITLE = "lar:///ha.ka.ba/lares/api/filters";

/** The stem every house function name opens with. */
export const HOUSE_FUNCTION_STEM = "lares.";
/**
 * The house's filter operator MODULES (`filters/stream`): operators in their own right, which TiddlyWiki reads before any
 * function of the same name. A layer re-seats one by seating a module tiddler at its title.
 */
export const HOUSE_OPERATOR_NAMES: readonly string[] = ["lares.heads", "lares.inbox"];

/** The house's function names, in the carrier's order. */
export const HOUSE_FUNCTION_NAMES: readonly string[] = ["lares.law.pins", "lares.law", "lares.road", "lares.course.citers", "lares.course.text-uncited", "lares.course.uncited", "lares.course.standing", "lares.course", "lares.waves", "lares.attractors", "lares.stage", "lares.broken", "lares.unreached"];

/**
 * THE FLOOR: the carrier's `\function` blocks as the source carries them, read only where no layer the reader reads holds the
 * carrier (a vessel founded on a floor snapshot cut before the carrier landed), and name by name where the seated carrier drops
 * a house name. A test welds it to the canon carrier byte for byte.
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

\function lares.attractors()
[[discordian-catmas]] [[pattern-integrities]] [[practices]]
+[addprefix[lar:///ha.ka.ba/kahua/memory/reference/]]
:filter[is[tiddler]]
\end

\function lares.stage(name)
[prefix[lar:///ha.ka.ba/kahua/memory/]] :filter[<currentTiddler>removeprefix[lar:///ha.ka.ba/kahua/memory/]removeprefix<name>removeprefix[/]]
\end

\function lares.broken()
[prefix[lar:///ha.ka.ba/kahua/memory/]lar-refs:out[]prefix[lar:///ha.ka.ba/kahua/memory/]] :filter[is[missing]]
\end

\function lares.unreached()
[prefix[lar:///ha.ka.ba/kahua/memory/]!regexp[#]lar-refs:unreached[]]
\end`;

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

/** The `lares.` functions a carrier adds beyond the house set, in the carrier's order. */
function addedNamesOf(held: ReadonlyMap<string, string>): string[] {
  return [...held.keys()].filter((name) => name.startsWith(HOUSE_FUNCTION_STEM) && !HOUSE_FUNCTION_NAMES.includes(name));
}

/**
 * The pragma run a carrier's text yields: every house name, from the carrier where it parses and from the floor where it
 * does not, name by name; then each `lares.` function the carrier adds beyond the house set.
 */
export function functionPragmasOf(text: string): string {
  const held = houseBlocksOf(text);
  const floor = houseBlocksOf(HOUSE_FILTERS_FLOOR);
  return [...HOUSE_FUNCTION_NAMES.map((name) => held.get(name) ?? floor.get(name)!), ...addedNamesOf(held).map((name) => held.get(name)!)].join("\n\n");
}

/** Every `lares.` operator a filter may name over a carrier's text: the house functions, the carrier's added ones, the operator modules. */
export function houseNamesOf(text: string): string[] {
  return [...HOUSE_FUNCTION_NAMES, ...addedNamesOf(houseBlocksOf(text)), ...HOUSE_OPERATOR_NAMES];
}

/** The house operators a filter names: each `lares.<name>[` operator, as written. */
const HOUSE_OPERATOR = /(?<![\w.\/:#-])(lares\.[\w.-]+)(?=\[)/g;

/**
 * A filter naming a `lares.` operator nothing resolves refuses by name: TiddlyWiki would read it as a field name and answer the
 * whole store. `known` names what resolves (`houseNamesOf` the seated carrier); absent, the house set and the operator modules.
 */
export function refuseUnknownHouseOperators(filter: string, known: readonly string[] = [...HOUSE_FUNCTION_NAMES, ...HOUSE_OPERATOR_NAMES]): void {
  if (!filter.includes(HOUSE_FUNCTION_STEM)) return;
  for (const match of filter.matchAll(HOUSE_OPERATOR)) {
    if (!known.includes(match[1]!)) {
      throw new VerbRefusal("house-filter-unknown", `house-filter-unknown: "${match[1]}" names no house function or operator (${known.join(", ")}); the filter refuses before it can read as a field name`);
    }
  }
}

interface WikiLike { getTiddler(title: string): { fields: Record<string, unknown> } | undefined }

/** The bag a wiki record names (`$origin-bag`), or null for a record the engine itself holds (a shadow, a boot tiddler). */
const stampOf = (fields: Record<string, unknown> | undefined): string | null => {
  const stamp = fields?.["$origin-bag"];
  return typeof stamp === "string" && stamp !== "" ? stamp : null;
};

/** The carrier's text as the wiki's cascade answers it, whatever layer stamps it; the floor where the wiki holds none. */
export function filtersTextOfWiki(wiki: WikiLike): string {
  const text = wiki.getTiddler(HOUSE_FILTERS_TITLE)?.fields["text"];
  return typeof text === "string" && text !== "" ? text : HOUSE_FILTERS_FLOOR;
}

/**
 * The carrier's text as the reader's stack seats it: the wiki's own record (TiddlyWiki's cascade, its topmost layer) where the
 * reader reads the layer that stamps it; else the topmost store layer the reader reads that holds it, any layer; then the floor.
 */
export async function filtersText(composite: CompositeStore, wiki: WikiLike, mayRead: (bag: string | null) => Promise<boolean>): Promise<string> {
  const held = wiki.getTiddler(HOUSE_FILTERS_TITLE)?.fields;
  const live = held?.["text"];
  if (typeof live === "string" && live !== "" && (await mayRead(stampOf(held)))) return live;
  for (const bag of [...composite.layerIds].reverse()) {
    if (!(await mayRead(bag))) continue;
    const record = await composite.storeForBag(bag)?.get(HOUSE_FILTERS_TITLE);
    const text = record?.tiddler["text"];
    if (typeof text === "string" && text !== "" && !record?.meta?.deleted) return text;
  }
  return HOUSE_FILTERS_FLOOR;
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
  const known = houseNamesOf(carrierText);
  slots["filterTiddlers"] = (filter: string, given?: unknown, source?: unknown): string[] => {
    refuseUnknownHouseOperators(filter, known);
    if (given === undefined) { widget ??= houseWidgetOf(view, document, carrierText); given = widget; }
    return run.call(view, filter, given, source);
  };
  return view;
}
