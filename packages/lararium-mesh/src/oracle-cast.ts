/**
 * oracle-cast — the I Ching's three-coin cast, drawn through the house's entropy door.
 *
 * A line throws three coins, heads counting three and tails two, so each line sums to 6 (old yin, changing), 7 (young
 * yang), 8 (young yin) or 9 (old yang, changing). Six lines stack bottom line first into the PRIMARY hexagram; the
 * changing lines turned over make the RELATING hexagram, and a cast with no changing line names none. The figures
 * number in the King Wen order, 1 to 64, from the trigram below and the trigram above.
 *
 * ONE DOOR FOR CHANCE. A house cast draws every coin through the `EntropyDoor` the caller hands in
 * (`./entropy-door.js`), and the result names the door's source: `platform:crypto.getRandomValues` for a live cast, a
 * seeded door's own name in a test. An operator who threw real coins types the six values instead, and the result
 * names `operator:three-coins`: the strong cast, made by a hand.
 *
 * THE CLOCK SEAM. The core reads no clock: the caller names the time of the cast (`at`) and the caster. The same door
 * bytes and the same ask answer the same cast.
 *
 * A CAST STANDS AS AN ACT. `castFields` shapes the tiddler a cast writes, under the `casts/` prefix, naming the
 * readings the house imported (`oracles/doa`, `oracles/e-jing`); a surface writes it once, and re-rendering it never
 * casts again. The throw stands and the reading stays open.
 *
 * Platform-blind and pure.
 */

import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { entropyBelow, type EntropyDoor } from "./entropy-door.js";

/** One line's sum of three coins: 6 old yin · 7 young yang · 8 young yin · 9 old yang. */
export type LineValue = 6 | 7 | 8 | 9;

/** The method every cast here names. */
export const CAST_METHOD = "three-coins";

/** The source an operator's typed throw names: six lines thrown by a hand with real coins. */
export const OPERATOR_COINS = "operator:three-coins";

/** The oracle's pono place, said wherever it answers: a blind throw to collide uncertainty with. */
export const ORACLE_THROW_STANDS = "a blind throw to collide uncertainty with: the throw stands, the reading stays open";

/** The prefix every cast tiddler's title sits under. */
export const CAST_TITLE_PREFIX = "lar:///ha.ka.ba/lares/oracle/casts/";

/**
 * THE LIBRARY SHELVES (`library.oracle.speaks`): every oracle's corpus rests on a shelf `library/oracles/<kind>/`, and the
 * shelf's index record declares its own `method` (e-jing and doa: `three-coins`). The kind rides as data: a new oracle joins
 * as a shelf, never a new address or a new verb.
 */
export const ORACLE_SHELF_PREFIX = "lar:///ha.ka.ba/lares/library/oracles/";

/** The shelf a consult names none for. */
export const DEFAULT_ORACLE_KIND = "e-jing";

/** The methods the consult runs today; a shelf declaring another refuses by name until its method lands. */
export const RUN_METHODS: readonly string[] = [CAST_METHOD];

/** A kind spells one shelf: lower-case words joined by hyphens, never a path. */
export const KIND_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The index record of the shelf a kind names: `library/oracles/<kind>/index`. */
export function oracleShelfTitle(kind: string): string {
  return `${ORACLE_SHELF_PREFIX}${kind}/index`;
}

/** The house's imported readings: one tiddler per hexagram per source. */
export const READING_SOURCES = ["doa", "e-jing"] as const;
export type ReadingSource = typeof READING_SOURCES[number];

/** The eight trigrams by name, each a figure of three lines, bottom line first, 1 for yang. */
export const TRIGRAMS = {
  qian: "111", zhen: "100", kan: "010", gen: "001", kun: "000", xun: "011", li: "101", dui: "110",
} as const;
export type TrigramName = keyof typeof TRIGRAMS;

const TRIGRAM_ORDER: readonly TrigramName[] = ["qian", "zhen", "kan", "gen", "kun", "xun", "li", "dui"];

/** King Wen numbers: a row per trigram above, a column per trigram below, both in `TRIGRAM_ORDER`. */
const KING_WEN: readonly (readonly number[])[] = [
  [1, 25, 6, 33, 12, 44, 13, 10],
  [34, 51, 40, 62, 16, 32, 55, 54],
  [5, 3, 29, 39, 8, 48, 63, 60],
  [26, 27, 4, 52, 23, 18, 22, 41],
  [11, 24, 7, 15, 2, 46, 36, 19],
  [9, 42, 59, 53, 20, 57, 37, 61],
  [14, 21, 64, 56, 35, 50, 30, 38],
  [43, 17, 47, 31, 45, 28, 49, 58],
];

/** One hexagram: its King Wen number, its figure (bottom line first, 1 for yang), its trigrams and its glyph. */
export interface Hexagram {
  readonly number: number;
  readonly figure: string;
  readonly lower: TrigramName;
  readonly upper: TrigramName;
  readonly glyph: string;
}

/** Who cast, and when: both named by the caller. */
export interface CastAsk {
  readonly caster: string;
  readonly at: string;
}

/** A cast's whole result. */
export interface OracleCast {
  readonly method: typeof CAST_METHOD;
  /** The door the coins came through, or `operator:three-coins` for a typed throw. */
  readonly entropy: string;
  /** Six line values, bottom line first. */
  readonly lines: readonly LineValue[];
  /** The positions (1 at the bottom) of the changing lines, the 6s and the 9s. */
  readonly changing: readonly number[];
  readonly primary: Hexagram;
  /** The hexagram the changing lines turn into, or null where no line changes. */
  readonly relating: Hexagram | null;
  readonly caster: string;
  readonly at: string;
}

const FIGURE = /^[01]{6}$/;

/** The hexagram a six-line figure names (bottom line first, 1 for yang). */
export function hexagramOf(figure: string): Hexagram {
  if (!FIGURE.test(figure)) throw new RangeError(`hexagramOf: a figure reads six 0s and 1s, bottom line first; got "${figure}"`);
  const lower = TRIGRAM_ORDER.find((name) => TRIGRAMS[name] === figure.slice(0, 3))!;
  const upper = TRIGRAM_ORDER.find((name) => TRIGRAMS[name] === figure.slice(3))!;
  const number = KING_WEN[TRIGRAM_ORDER.indexOf(upper)]![TRIGRAM_ORDER.indexOf(lower)]!;
  return { number, figure, lower, upper, glyph: String.fromCodePoint(0x4dc0 + number - 1) };
}

/** The figure King Wen number `n` names. */
export function figureOf(n: number): string {
  for (let u = 0; u < 8; u += 1) {
    const col = KING_WEN[u]!.indexOf(n);
    if (col >= 0) return TRIGRAMS[TRIGRAM_ORDER[col]!] + TRIGRAMS[TRIGRAM_ORDER[u]!];
  }
  throw new RangeError(`figureOf: King Wen numbers run 1 to 64; got ${String(n)}`);
}

/** One coin through the door: heads three, tails two. */
function throwCoin(door: EntropyDoor): 2 | 3 {
  return entropyBelow(door, 2) === 1 ? 3 : 2;
}

/** One line: three coins summed. */
export function throwLine(door: EntropyDoor): LineValue {
  return (throwCoin(door) + throwCoin(door) + throwCoin(door)) as LineValue;
}

function requireAsk(ask: CastAsk): void {
  if (typeof ask.caster !== "string" || ask.caster.trim() === "") throw new RangeError("oracle cast: name the caster (who casts)");
  if (typeof ask.at !== "string" || ask.at.trim() === "") throw new RangeError("oracle cast: name the time of the cast (`at`); the core reads no clock");
}

function castOf(lines: readonly LineValue[], entropy: string, ask: CastAsk): OracleCast {
  const primary = lines.map((v) => (v === 7 || v === 9 ? "1" : "0")).join("");
  const relating = lines.map((v) => (v === 7 || v === 6 ? "1" : "0")).join("");
  const changing = lines.flatMap((v, i) => (v === 6 || v === 9 ? [i + 1] : []));
  return {
    method: CAST_METHOD, entropy, lines: [...lines], changing,
    primary: hexagramOf(primary),
    relating: changing.length > 0 ? hexagramOf(relating) : null,
    caster: ask.caster, at: ask.at,
  };
}

/** A house cast: eighteen coins through `door`, six lines bottom first. */
export function castThreeCoins(door: EntropyDoor, ask: CastAsk): OracleCast {
  requireAsk(ask);
  const lines: LineValue[] = [];
  for (let i = 0; i < 6; i += 1) lines.push(throwLine(door));
  return castOf(lines, door.source, ask);
}

/** A standing cast read back: its six lines and the door they came through, the same figure the throw named. */
export function castFromLines(lines: readonly LineValue[], entropy: string, ask: CastAsk): OracleCast {
  requireAsk(ask);
  return castOf(lines, entropy, ask);
}

/** The operator's own throw: six line values cast with real coins, bottom line first. */
export function castFromCoins(values: readonly unknown[], ask: CastAsk): OracleCast {
  requireAsk(ask);
  if (values.length !== 6) throw new RangeError(`oracle cast: an operator's throw names six lines, bottom first; got ${values.length}`);
  const lines = values.map((v) => {
    if (v !== 6 && v !== 7 && v !== 8 && v !== 9) throw new RangeError(`oracle cast: each line reads 6, 7, 8 or 9; got ${String(v)}`);
    return v as LineValue;
  });
  return castOf(lines, OPERATOR_COINS, ask);
}

/** Six line values from a line of text ("7,8,9,6,7,7", "7 8 9 6 7 7" or "789677"), or null where it reads otherwise. */
export function parseCoins(text: string): LineValue[] | null {
  const trimmed = text.trim();
  const parts = /^[6-9]{6}$/.test(trimmed) ? trimmed.split("") : trimmed.split(/[\s,]+/).filter((p) => p !== "");
  if (parts.length !== 6 || !parts.every((p) => /^[6-9]$/.test(p))) return null;
  return parts.map((p) => Number(p) as LineValue);
}

/** The title of a reading the house imported: `oracles/<source>/hexagram-NN`. */
export function readingTitle(source: ReadingSource, n: number): string {
  return `lar:///ha.ka.ba/lares/library/oracles/${source}/hexagram-${String(n).padStart(2, "0")}`;
}

/** The readings a cast names: each source for the primary, then each for the relating. */
export function castReadingTitles(cast: OracleCast): string[] {
  const numbers = cast.relating ? [cast.primary.number, cast.relating.number] : [cast.primary.number];
  return numbers.flatMap((n) => READING_SOURCES.map((source) => readingTitle(source, n)));
}

/**
 * ONE ASKING, ONE THROW. An asking names who asks (`asker`: the identity the vessel's door booked, never a name the
 * caller supplies), in what words (`asking`, empty where the asker named none), with the nonce the caller minted at the
 * word (a person's bare cast, or a person's fresh re-ask), the seed a person named, and the coins a person threw. The
 * time never enters: a clock annotates a cast and never names it.
 *
 * A LOW-ENTROPY SEED READS BACK. A cast names its seed by a 16-hex digest and its asking by a 16-hex id, so anyone who
 * reads the record can test a short or common seed (or asking) against them; a person choosing a seed chooses a strong one.
 */
export interface OracleAsking {
  readonly asker: string;
  readonly asking?: string;
  readonly nonce?: string;
  readonly seed?: string;
  readonly coins?: readonly LineValue[];
  /** The shelf consulted; the default shelf (`e-jing`) keys nothing, so every asking cast before the shelves keeps its id. */
  readonly by?: string;
}

/**
 * The asking's words as they key the throw: Unicode NFC, lower case, every run of whitespace one space, trimmed, and
 * trailing punctuation dropped, so a trivial edit (case, spacing, a final "?" or ".") replays the same throw.
 */
export function normalizeAsking(words: string): string {
  return words.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim().replace(/[\p{P}\s]+$/u, "");
}

/** The asking's id: sha256 over its canonical form, so the same asking lands on the same id in any seat. */
export function askingId(a: OracleAsking): string {
  return sha256HexBytesSync(canonicalJsonBytes({
    verb: "oracle-cast", asker: a.asker, asking: normalizeAsking(a.asking ?? ""), nonce: a.nonce ?? "", seed: a.seed ?? "",
    coins: a.coins ? [...a.coins] : [],
    ...(a.by !== undefined && a.by !== DEFAULT_ORACLE_KIND ? { by: a.by } : {}),
  }));
}

/** The title an asking's cast lands under: a second ask of the same asking finds the first throw standing there. */
export function askingCastTitle(id: string): string {
  return `${CAST_TITLE_PREFIX}asked-${id.slice(0, 16)}`;
}

/** The cast's tiddler title: the caller's time, then the primary and the relating number. */
export function castTitle(cast: OracleCast): string {
  const stamp = cast.at.trim().replace(/[^0-9A-Za-z]+/g, "-").replace(/^-+|-+$/g, "");
  return `${CAST_TITLE_PREFIX}${stamp}-${cast.primary.number}${cast.relating ? `-${cast.relating.number}` : ""}`;
}

const LINE_WORDS: Readonly<Record<LineValue, string>> = { 6: "old yin, changing", 7: "young yang", 8: "young yin", 9: "old yang, changing" };

function hexagramLine(h: Hexagram): string {
  return `Hexagram ${h.number} ${h.glyph} (${h.lower} below, ${h.upper} above)`;
}

/** The cast read plainly, a line per fact, the figure drawn top line first as the eye reads it. */
export function castText(cast: OracleCast): string {
  const out: string[] = [hexagramLine(cast.primary)];
  out.push(cast.relating ? `  changing to ${hexagramLine(cast.relating)}` : "  no line changes");
  out.push("");
  for (let i = 5; i >= 0; i -= 1) {
    const v = cast.lines[i]!;
    const yang = v === 7 || v === 9;
    out.push(`  ${i + 1}  ${yang ? "━━━━━━━" : "━━━ ━━━"}  ${v}  ${LINE_WORDS[v]}`);
  }
  out.push("");
  out.push(`method: ${cast.method} · entropy: ${cast.entropy}`);
  out.push(`caster: ${cast.caster} · at: ${cast.at}`);
  out.push("");
  out.push(`(${ORACLE_THROW_STANDS})`);
  return out.join("\n");
}

/** The tiddler a cast writes: its facts as flat fields, its body naming and transcluding the readings. */
export function castFields(cast: OracleCast, asked?: { readonly title: string; readonly intent: string; readonly asking?: string }): Record<string, string> {
  const readings = castReadingTitles(cast);
  const body: string[] = [
    `!! ${cast.primary.glyph} Hexagram ${cast.primary.number}${cast.relating ? ` changing to ${cast.relating.glyph} ${cast.relating.number}` : ""}`,
    "",
    `Lines, bottom first: ${cast.lines.join(" ")}${cast.changing.length > 0 ? ` · changing: ${cast.changing.join(", ")}` : " · no line changes"}`,
    "",
    `Cast by ${cast.caster} at ${cast.at}, ${cast.method}, entropy from \`${cast.entropy}\`.`,
  ];
  const sections: Array<[string, Hexagram]> = [["Primary", cast.primary]];
  if (cast.relating) sections.push(["Relating", cast.relating]);
  for (const [label, h] of sections) {
    body.push("", `!!! ${label}: ${h.glyph} ${h.number}`);
    for (const source of READING_SOURCES) body.push("", `{{${readingTitle(source, h.number)}#/reading}}`);
  }
  body.push("", `//(${ORACLE_THROW_STANDS})//`);
  const fields: Record<string, string> = {
    title: castTitle(cast),
    type: "text/vnd.tiddlywiki",
    tags: "oracle/cast",
    method: cast.method,
    entropy: cast.entropy,
    lines: cast.lines.join(" "),
    changing: cast.changing.join(" "),
    primary: String(cast.primary.number),
    "primary-figure": cast.primary.figure,
    caster: cast.caster,
    "cast-at": cast.at,
    readings: readings.map((t) => `[[${t}]]`).join(" "),
    text: body.join("\n"),
  };
  if (cast.relating) {
    fields["relating"] = String(cast.relating.number);
    fields["relating-figure"] = cast.relating.figure;
  }
  if (asked) {
    fields["title"] = asked.title;
    fields["intent"] = asked.intent;
    if (asked.asking) fields["asking"] = asked.asking;
  }
  return fields;
}

/** The cast as a flat record, for an answer's `cast` field. */
export function castRecord(cast: OracleCast): Record<string, unknown> {
  return {
    method: cast.method, entropy: cast.entropy, lines: [...cast.lines], changing: [...cast.changing],
    primary: { ...cast.primary }, relating: cast.relating ? { ...cast.relating } : null,
    caster: cast.caster, at: cast.at, title: castTitle(cast), readings: castReadingTitles(cast),
  };
}
