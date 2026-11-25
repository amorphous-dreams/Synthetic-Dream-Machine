/**
 * spirit-unfold — the pure core of a tasked spirit's progressive unfold: an aperture names a rank, a rank names a layer, and a
 * layer names the wikitext a wiki's own engine renders.
 *
 * A spirit's metadata rests as FIELDS on its card (`spirit-card/<pet>`), whose text transcludes the card template; its slots
 * rest on its shrine (`spirit/<pet>` or `familiar/<pet>`). The unfold widens with the aperture scale:
 *
 *   pulse    the card's fields, one per line
 *   beat     the card rendered through its template
 *   measure  the rendered card, then each shrine slot by name, size and heading (arc reads this layer too)
 *   theme    the rendered card, then the whole shrine carrier
 *
 * ONE MODULE, TWO CONTEXTS. The lares-lararium skin bundles this core into the `<<spirit-unfold>>` macro, so the wiki VM builds
 * and renders the wikitext from its own loaded plugin; the host door reads the same core for the aperture it names and the one
 * macro call it sends. The core reads no wiki, no clock and no env, and it never renders: every filter and transclusion in the
 * wikitext runs in the engine that holds the records.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/reference/tasked-spirit
 */

/** Where a spirit's card stands on the memory stage. */
export const SPIRIT_CARD_PREFIX = "lar:///ha.ka.ba/kahua/memory/spirit-card/";
/** The record kinds a shrine stands under, in the order the spirit door resolves them. */
const SHRINE_PREFIXES = ["lar:///ha.ka.ba/kahua/memory/familiar/", "lar:///ha.ka.ba/kahua/memory/spirit/"] as const;
/** A pet name: lower-case letters, digits and hyphens (the spirit door's own shape). */
const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The macro the lares-lararium skin registers. */
export const UNFOLD_MACRO = "spirit-unfold";

/** The aperture ranks, narrowest first. */
export const UNFOLD_RANKS = ["pulse", "beat", "measure", "arc", "theme"] as const;
export type UnfoldRank = (typeof UNFOLD_RANKS)[number];
export type UnfoldLayer = "fields" | "card" | "slots" | "whole";

/** The layer each rank unfolds. Arc reads the slots layer: no wider layer stands between the slots and the whole carrier. */
export const UNFOLD_LAYER: Readonly<Record<UnfoldRank, UnfoldLayer>> = Object.freeze({
  pulse: "fields", beat: "card", measure: "slots", arc: "slots", theme: "whole",
});

/** The card a pet name's fields rest on. */
export const spiritCardOf = (pet: string): string => `${SPIRIT_CARD_PREFIX}${pet}`;

/** The rank a level on the 0..20 aperture scale falls in. */
const rankOfLevel = (n: number): UnfoldRank => (n <= 4 ? "pulse" : n <= 8 ? "beat" : n <= 12 ? "measure" : n <= 16 ? "arc" : "theme");

/**
 * The rank an aperture word names: a rank (`beat`), a level (`10`), or the gauge's own pair (`10/measure`), whose two halves must
 * agree. Null where the word names no rank.
 */
export function unfoldRank(aperture: string | null | undefined): UnfoldRank | null {
  const word = (aperture ?? "").trim().toLowerCase();
  const m = /^(?:([0-9]{1,2})\/)?([a-z]+)$|^([0-9]{1,2})$/.exec(word);
  if (!m) return null;
  const level = m[1] ?? m[3];
  const named = m[2];
  if (level !== undefined && Number(level) > 20) return null;
  if (named !== undefined && !(UNFOLD_RANKS as readonly string[]).includes(named)) return null;
  if (level === undefined) return named as UnfoldRank;
  const banded = rankOfLevel(Number(level));
  return named === undefined || named === banded ? banded : null;
}

/** The one macro call a door sends the wiki's render verb. Null where the pet name or the aperture reads malformed. */
export function unfoldCall(pet: string, aperture: string): string | null {
  const rank = unfoldRank(aperture);
  return rank === null || !PET.test(pet) ? null : `<<${UNFOLD_MACRO} pet:"${pet}" aperture:"${rank}">>`;
}

const NL = `<$text text="""\n"""/>`;
const BOOKKEEPING = ["title", "text", "tags", "type", "bag", "revision", "created", "modified", "creator", "modifier"];

/** The card's fields, one `name: value` line each; the values ride as text, never wikified. */
const fieldsLayer = (): string =>
  `<$list filter="[<card>fields[]] ${BOOKKEEPING.map((f) => `-[[${f}]]`).join(" ")}" variable="field"><$text text=<<field>>/>: <$text text={{{ [<card>get<field>] }}}/>${NL}</$list>`;

/** The card through its own text, the template it transcludes: the render a wiki gives the title. */
const cardLayer = (): string => `<$tiddler tiddler=<<card>>><$transclude $tiddler=<<card>> $mode="block"/></$tiddler>${NL}`;

/** Each shrine that stands for the pet, or the one line naming that none does. */
const shrines = (pet: string, body: string): string =>
  `<$list filter="${SHRINE_PREFIXES.map((p) => `[[${p}${pet}]is[tiddler]]`).join(" ")}" variable="shrine" emptyMessage="""no slot shrine stands at ${SHRINE_PREFIXES[1]}${pet}""">${body}</$list>`;

/**
 * The shrine's slots, each by name, size and heading: the slots the root calls, in carrier order, after any slot it never calls
 * (a filter's later run moves a title it repeats to the end, so the carrier-order run rides last).
 */
const slotsLayer = (pet: string): string => shrines(pet,
  "<$let slot-call=\"^.*slot=`(#/[^`]+)`.*$\" heading-mark=\"^!+\\s*\">" +
  `<$text text=<<shrine>>/>${NL}` +
  "<$list filter=\"[all[tiddlers]field:$fragment-parent<shrine>get[$slot]] [<shrine>get[text]splitregexp[\\n]regexp<slot-call>search-replace::regexp<slot-call>,[$1]]\" variable=\"slot\">" +
  "<$let slot-title={{{ [<shrine>addsuffix<slot>] }}}>" +
  "<$text text=<<slot>>/> · <$text text={{{ [<slot-title>get[text]length[]] }}}/> chars · " +
  "<$text text={{{ [<slot-title>get[text]splitregexp[\\n]!is[blank]first[]search-replace::regexp<heading-mark>,[]] }}}/>" +
  `${NL}</$let></$list></$let>`);

/** The whole shrine carrier, recomposed by the grammar's own projection: the bytes a body reads and trues. */
const wholeLayer = (pet: string): string => shrines(pet, `<$text text={{{ [<shrine>meme-project[mem]] }}}/>${NL}`);

const refusal = (line: string): string => `<$text text="""${line}"""/>`;

/**
 * The wikitext one unfold renders, for the engine that holds the records. Where no card stands for the pet the wikitext renders
 * nothing; a malformed pet name or aperture renders one line naming the shape it reads.
 */
export function unfoldWikitext(pet: string, aperture: string | null | undefined): string {
  if (!PET.test(pet)) return refusal(`${UNFOLD_MACRO}: the pet name reads malformed (lower-case letters, digits and hyphens)`);
  const rank = unfoldRank(aperture === undefined || aperture === null || aperture.trim() === "" ? "beat" : aperture);
  if (rank === null) return refusal(`${UNFOLD_MACRO}: the aperture names one of ${UNFOLD_RANKS.join(" · ")}, a level 0..20, or the pair (10/measure)`);
  const layer = UNFOLD_LAYER[rank];
  const head = `<$text text="""${pet} ~ ${layer} at ${rank} · ${spiritCardOf(pet)}"""/>${NL}`;
  const body = layer === "fields" ? fieldsLayer()
    : layer === "card" ? cardLayer()
    : layer === "slots" ? `${cardLayer()}${slotsLayer(pet)}`
    : `${cardLayer()}${wholeLayer(pet)}`;
  return `<$let card="${spiritCardOf(pet)}"><$list filter="[<card>is[tiddler]]" variable="standing">${head}${body}</$list></$let>`;
}
