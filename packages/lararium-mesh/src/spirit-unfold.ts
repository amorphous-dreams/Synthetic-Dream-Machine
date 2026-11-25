/**
 * spirit-unfold — the pure core of a tasked spirit's progressive unfold: an aperture names a rank, a rank names the slots that
 * read unfolded, and every folded slot names the one command that unfolds it.
 *
 * A spirit reads AS A FOLDED CARRIER: its shrine (`familiar/<pet>` or `spirit/<pet>`) in the carrier's own grammar, as the file
 * rests on disk (the declaration, the head, the meta, each slot's `ahu` pair), with a folded slot's body standing as its `has`
 * line and the command that fetches it. The grain widens with the aperture scale:
 *
 *   pulse    the envelope, the meta and every slot folded
 *   beat     the entry slot unfolded
 *   measure  the entry, attention and open slots unfolded
 *   arc      measure plus #/bodies, the path across turns: a reader sees the spirit's lineage (ruling 2026-11-25-the-open-items-decided)
 *   theme    the whole carrier
 *
 * A spirit holding a card alone (`spirit-card/<pet>`: fields, and a text that transcludes the card template) folds the same way:
 * its fields ride the meta, and its body holds the transclusion and the command that renders it.
 *
 * ONE MODULE, TWO CONTEXTS. The lares-lararium skin bundles this core into its fold filter and its `<<spirit-unfold>>` macro, so
 * the wiki VM folds its own records from its loaded plugin; the host door reads the same core for the aperture it names and the
 * one macro call it sends. The core reads no wiki, no clock and no env, and it writes no carrier: the fold itself runs through
 * the house's own recompose and frame writer, in the engine that holds the records.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/reference/tasked-spirit
 */

/** Where a spirit's card stands on the memory stage. */
export const SPIRIT_CARD_PREFIX = "lar:///ha.ka.ba/kahua/memory/spirit-card/";
/** Where a shrine stands, in the order the spirit door resolves the kinds. */
export const SPIRIT_SHRINE_PREFIXES = ["lar:///ha.ka.ba/kahua/memory/familiar/", "lar:///ha.ka.ba/kahua/memory/spirit/"] as const;
/** A pet name: lower-case letters, digits and hyphens (the spirit door's own shape). */
const PET = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A face a command names: `0`, `1`, … or a face handle (`h1`). */
const FACE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** The macro and the spirit's filter operator the lares-lararium skin registers (the general `meme-fold` operator rides the same module). */
export const UNFOLD_MACRO = "spirit-unfold";
export const FOLD_OPERATOR = "spirit-fold";

/** The aperture ranks, narrowest first. */
export const UNFOLD_RANKS = ["pulse", "beat", "measure", "arc", "theme"] as const;
export type UnfoldRank = (typeof UNFOLD_RANKS)[number];

/** The slots each rank reads unfolded; `null` unfolds every slot. Arc reads measure plus #/bodies, the spirit's lineage across turns. */
export const UNFOLD_OPEN: Readonly<Record<UnfoldRank, readonly string[] | null>> = Object.freeze({
  pulse: [], beat: ["#/entry"], measure: ["#/entry", "#/attention", "#/open"], arc: ["#/entry", "#/attention", "#/open", "#/bodies"], theme: null,
});
/** Does a rank read this slot unfolded? */
export const unfoldsSlot = (rank: UnfoldRank, slot: string): boolean => UNFOLD_OPEN[rank]?.includes(slot) ?? true;
/** The rank one grain narrower, or null beneath pulse. */
export function narrowerRank(rank: UnfoldRank): UnfoldRank | null {
  return rank === "theme" ? "arc" : rank === "arc" ? "measure" : rank === "measure" ? "beat" : rank === "beat" ? "pulse" : null;
}

/** The card a pet name's fields rest on. */
export const spiritCardOf = (pet: string): string => `${SPIRIT_CARD_PREFIX}${pet}`;
/** The shrines a pet name may stand under. */
export const spiritShrinesOf = (pet: string): string[] => SPIRIT_SHRINE_PREFIXES.map((prefix) => `${prefix}${pet}`);
export const isPetName = (pet: string): boolean => PET.test(pet);
export const isFaceWord = (face: string): boolean => FACE.test(face);

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

// ── THE BUTTONS: the one command each fold names ───────────────────────────────────────────────────────────────────

/**
 * One word of a printed command, safe to paste into a shell: bare where every character reads plain, else single-quoted (a quote
 * inside closes, escapes and reopens). A title holding a space, a `#`, a `$` or any other metacharacter never splits or expands.
 */
export const shellWord = (word: string): string => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`);

const faceFlag = (face: string | null | undefined): string => (face && FACE.test(face) ? ` --face ${face}` : "");
/** The command that reads one slot of a carrier whole. */
export const slotCommand = (uri: string, slot: string, face?: string | null): string => `lares tiddler get ${shellWord(uri)} --recipe default${faceFlag(face)} --meme --slot ${shellWord(slot)}`;
/** The command that reads a whole carrier. */
export const wholeCommand = (uri: string, face?: string | null): string => `lares tiddler get ${shellWord(uri)} --recipe default${faceFlag(face)} --meme --all`;
/** The command that reads one plain record. */
export const recordCommand = (uri: string, face?: string | null): string => `lares tiddler get ${shellWord(uri)} --recipe default${faceFlag(face)}`;
/** The command that renders a card through the template its text transcludes. */
export const cardRenderCommand = (card: string, face?: string | null): string => `lares wiki render ${shellWord(card)} --recipe default${faceFlag(face)} --form text`;

// ── THE CALL ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The one macro call a door sends the wiki's render verb. Null where the pet name, the aperture or the face reads malformed. */
export function unfoldCall(pet: string, aperture: string, face?: string | null): string | null {
  const rank = unfoldRank(aperture);
  if (rank === null || !PET.test(pet) || (face != null && face !== "" && !FACE.test(face))) return null;
  return `<<${UNFOLD_MACRO} pet:"${pet}" aperture:"${rank}"${face ? ` face:"${face}"` : ""}>>`;
}

const refusal = (line: string): string => `<$text text="""${line}"""/>`;

/**
 * The wikitext the macro hands the engine: one text node whose value the skin's fold filter answers, so the carrier rides out
 * byte for byte and never wikifies. A malformed pet name, aperture or face renders one line naming the shape it reads; with no
 * aperture the macro reads measure, the grain a wake reads.
 */
export function unfoldWikitext(pet: string, aperture: string | null | undefined, face?: string | null): string {
  if (!PET.test(pet)) return refusal(`${UNFOLD_MACRO}: the pet name reads malformed (lower-case letters, digits and hyphens)`);
  const rank = unfoldRank(aperture === undefined || aperture === null || aperture.trim() === "" ? "measure" : aperture);
  if (rank === null) return refusal(`${UNFOLD_MACRO}: the aperture names one of ${UNFOLD_RANKS.join(" · ")}, a level 0..20, or the pair (10/measure)`);
  const named = face === undefined || face === null ? "" : face.trim();
  if (named !== "" && !FACE.test(named)) return refusal(`${UNFOLD_MACRO}: the face reads malformed (a face number or handle)`);
  return `<$text text={{{ [[${pet}]${FOLD_OPERATOR}[${rank}],[${named}]] }}}/>`;
}
