/**
 * mu — THE LENS OF EVERY CALL (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 6, re-cut by the keypad head to the
 * boot seed's own values: lar:///ha.ka.ba/lares/api/noosphere-boot #/mu-five-tools). A `lares` call and a `set` firing share
 * one param set, so `mu` takes the seed's TOOL-CARRIES, character for character: always two hands, the active tool first and
 * the empty hand (`0`) second.
 *
 *   *0  wand      Fire   visual feed    ignition: many, seen
 *   ?0  cup       Water  macro zoom     sympathy: relation
 *   !0  sword     Air    micro zoom     discernment: certainty, assert
 *   _0  pentacle  Earth  hidden feed    ground: match without binding (the dry band: an act that runs without landing)
 *   00  rest      Arcana no axis        the ground state, where the system rests (`arcana` reads it too)
 *
 *   *!  detail       complementary (visual + micro)     *?  relation   complementary (visual + macro)
 *   _!  precision    complementary (hidden + micro)     _?  overview   complementary (hidden + macro)
 *   *_  signal-jam   conflict on the feed axis          ?!  dubious-move   conflict on the zoom axis
 *
 * A LONE GLYPH, WORD OR VALUE READS PONO: `?` reads `?0`, `!` reads `!0`, `*` `*0`, `_` `_0`, and `0` reads `00` (Rest); a
 * lone word names its tool or its carry; two tools in either order read their canonical carry (`!*` reads `*!`), while an empty
 * hand written first (`0*`) refuses naming the seed carry (`*0`): the active hand leads. Every answer
 * echoes the full carry it read. Landing 6's words (relate · assert · many · dry · unask) burned in this head: each refuses
 * `mu-malformed` naming the seed's carry that stands for it.
 *
 * MU NAMES THE LENS, NEVER THE RANGE: how much a call answers rides `aperture=` (`modules/aperture.ts`): the card moved to
 * `aperture=measure` and the whole to `aperture=arc`. The zoom axis runs certainty (Sword) against relation (Cup), never size.
 *
 * THE CELLS REST IN CARRIER ROWS (fork 7): each carrier's `#/takes` tables the carries it answers, one `cell` row per carry
 * (``<<has entity=`cell` name=`_?` params=`mu/overview ~ the dry summary`>>``), so a layer above re-tables a door's lenses like
 * any other row. Rest (`00`) needs no cell: it reads the door's own default, the ground. `implied/true` on a single-tool cell
 * joins that tool to every single-tool carry on the other axis (a filter's `*0`: `?0` there reads `*?`); `owed/<why>` tables a
 * cell whose door does not answer it yet, and it refuses as an empty cell. A carry outside the table refuses `mu-cell-empty`
 * and names the nearest cell as a call: one sharing a tool, else the plain call with no `mu`.
 *
 * A conflict carry answers its FIRST tool as written (`_*` answers `_0`) and names the second as the next call: the seed's own
 * recovery (drop one tool, return to single-axis).
 *
 * A LEAF: pure over the rows the call already read; `modules/call.ts` turns a fault into a refusal with a cure sigil, and the
 * seats (`TIDDLER_CALL_SEATS`) turn a carry into their reactor's args (`dryDepthOf`).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import type { HasRow } from "../affordance-rows.js";

/** The five tools, in the seed's row order (`* ? ! _ 0`). */
export const MU_GLYPHS = ["*", "?", "!", "_", "0"] as const;
export type MuGlyph = typeof MU_GLYPHS[number];

/** One tool: its glyph, the seed's word for it, the element, the axis it rides (null for Arcana) and the axis pole. */
export interface MuTool { readonly glyph: MuGlyph; readonly word: string; readonly tool: string; readonly axis: "feed" | "zoom" | null; readonly pole: string }

export const MU_TOOLS: Readonly<Record<MuGlyph, MuTool>> = Object.freeze({
  "*": { glyph: "*", word: "wand", tool: "Wand", axis: "feed", pole: "visual" },
  "?": { glyph: "?", word: "cup", tool: "Cup", axis: "zoom", pole: "macro" },
  "!": { glyph: "!", word: "sword", tool: "Sword", axis: "zoom", pole: "micro" },
  "_": { glyph: "_", word: "pentacle", tool: "Pentacle", axis: "feed", pole: "hidden" },
  "0": { glyph: "0", word: "arcana", tool: "Arcana", axis: null, pole: "rest" },
});

/** How a carry's hands sit: one tool and the empty hand, two across the axes, two on one axis, or both hands empty. */
export type MuAxis = "single" | "complementary" | "conflict" | "rest";

/** The eleven carries the seed names, canonical glyphs to the seed's carry name. */
export const MU_CARRIES: Readonly<Record<string, { readonly name: string; readonly axis: MuAxis }>> = Object.freeze({
  "*0": { name: "wand", axis: "single" },
  "?0": { name: "cup", axis: "single" },
  "!0": { name: "sword", axis: "single" },
  "_0": { name: "pentacle", axis: "single" },
  "00": { name: "rest", axis: "rest" },
  "*!": { name: "detail", axis: "complementary" },
  "*?": { name: "relation", axis: "complementary" },
  "_!": { name: "precision", axis: "complementary" },
  "_?": { name: "overview", axis: "complementary" },
  "*_": { name: "signal-jam", axis: "conflict" },
  "?!": { name: "dubious-move", axis: "conflict" },
});

/** Every carry in the seed's order: the four single tools, Rest, the complementary four, the two conflicts. */
export const MU_CARRY_ORDER: readonly string[] = Object.freeze(Object.keys(MU_CARRIES));

/** The seed's words, each to its canonical carry (`arcana` and `rest` both read `00`). */
const BY_WORD: ReadonlyMap<string, string> = new Map<string, string>([
  ...MU_CARRY_ORDER.map((c) => [MU_CARRIES[c]!.name, c] as const),
  ["arcana", "00"],
]);

/** Landing 6's burned words, each to the seed carry that stands for it: a refusal teaches the new spelling. */
const BURNED: ReadonlyMap<string, string> = new Map<string, string>([
  ["relate", "?0"], ["assert", "!0"], ["many", "*0"], ["dry", "_0"], ["unask", "00"],
  ["many-relate", "*?"], ["many-assert", "*!"], ["dry-relate", "_?"], ["dry-assert", "_!"], ["many-dry", "*_"], ["relate-assert", "?!"],
]);

const isGlyph = (c: string): c is MuGlyph => (MU_GLYPHS as readonly string[]).includes(c);

/** A read `mu` value: the canonical carry, its tools in the order written (the order decides a conflict), and how they sit. */
export interface MuCarry {
  /** The canonical carry, always two hands (`?0`, `*!`, `00`). */
  readonly carry: string;
  /** The tools held, empty hands left out, in the order written (`[]` for Rest). */
  readonly tools: readonly MuGlyph[];
  readonly axis: MuAxis;
}

/** A `mu` value no carry reads: the words it holds and why. */
export interface MuFault { readonly reason: "mu-malformed" | "mu-cell-empty"; readonly message: string; readonly cure: string | null }

/** The seed's name for a carry (`*?` → `relation`, `?0` → `cup`): what a cure writes, safe on every shell. */
export const muWordsOf = (carry: string): string => MU_CARRIES[carry]?.name ?? carry;

/** The carry a set of held tools spells: the feed tool first, then the zoom tool; one tool takes the empty hand second. */
export function canonicalCarry(tools: readonly MuGlyph[]): string {
  const held = [...new Set(tools.filter((g) => g !== "0"))];
  if (held.length === 0) return "00";
  if (held.length === 1) return `${held[0]}0`;
  const [a, b] = held as [MuGlyph, MuGlyph];
  if (MU_TOOLS[a].axis === MU_TOOLS[b].axis) {
    // A conflict keeps the seed's own spelling (`*_`, `?!`), whichever hand the caller wrote first.
    return MU_TOOLS[a].axis === "feed" ? "*_" : "?!";
  }
  const feed = MU_TOOLS[a].axis === "feed" ? a : b;
  const zoom = feed === a ? b : a;
  return `${feed}${zoom}`;
}

/** The table a fault names: every carry beside its word. */
const TABLE = MU_CARRY_ORDER.map((c) => `${c} ${MU_CARRIES[c]!.name}`).join(" · ");

/**
 * READ A `mu` VALUE: a tool-carry in glyphs (`?0`, `*!`, either order), a lone glyph (`?` reads `?0`, `0` reads `00`), or one of
 * the seed's words (a tool: wand · cup · sword · pentacle · arcana; a carry: rest · detail · relation · precision · overview ·
 * signal-jam · dubious-move). A burned landing-6 word refuses naming its seed carry; more than two tools, or a token naming
 * none, answers a fault.
 */
export function readMu(raw: unknown): MuCarry | MuFault {
  const text = (typeof raw === "string" ? raw : raw === true || raw === undefined || raw === null ? "" : String(raw)).trim();
  if (text === "") return { reason: "mu-malformed", message: `mu names a tool-carry: ${TABLE}`, cure: null };
  const lower = text.toLowerCase();
  const worded = BY_WORD.get(lower);
  if (worded !== undefined) return carryOf(worded, [...worded].filter((g): g is MuGlyph => isGlyph(g) && g !== "0"));
  const burned = BURNED.get(lower);
  if (burned !== undefined) {
    return { reason: "mu-malformed", message: `mu reads the seed's tool-carries, and "${text}" burned with landing 6: it reads ${burned} (${muWordsOf(burned)})`, cure: muWordsOf(burned) };
  }
  const glyphs = [...text];
  if (glyphs.length > 2 || !glyphs.every(isGlyph)) {
    const held = glyphs.filter((g): g is MuGlyph => isGlyph(g) && g !== "0");
    const cure = glyphs.every(isGlyph) && held.length > 2 ? muWordsOf(canonicalCarry(held.slice(0, 2))) : null;
    return { reason: "mu-malformed", message: glyphs.every(isGlyph) ? `mu carries two hands at most; "${text}" names ${glyphs.join(" ")}` : `mu reads no tool-carry in "${text}"; it reads ${TABLE}`, cure };
  }
  // THE ACTIVE HAND LEADS (the seed's single-tool carries read `*0`, never `0*`): an empty hand written first refuses, naming the
  // seed carry it meant.
  if (glyphs.length === 2 && glyphs[0] === "0" && glyphs[1] !== "0") {
    const meant = `${glyphs[1]}0`;
    return { reason: "mu-malformed", message: `mu writes the active tool first and the empty hand second: "${text}" reads as ${meant} (${muWordsOf(meant)})`, cure: muWordsOf(meant) };
  }
  const written = (glyphs as MuGlyph[]).filter((g) => g !== "0");
  if (written.length === 2 && written[0] === written[1]) return { reason: "mu-malformed", message: `mu holds one tool per hand; "${text}" names ${written[0]} twice (it reads ${written[0]}0, ${muWordsOf(`${written[0]}0`)})`, cure: muWordsOf(`${written[0]}0`) };
  return carryOf(canonicalCarry(written), written);
}

function carryOf(carry: string, written: readonly MuGlyph[]): MuCarry {
  return { carry, tools: written, axis: MU_CARRIES[carry]!.axis };
}

export const isMuFault = <T extends object>(read: T | MuFault): read is MuFault => "reason" in read;

/** One cell a carrier tables: its canonical carry, whether its door owes it yet, whether its tool rides every carry, its line. */
export interface MuCell { readonly carry: string; readonly owed: string | null; readonly implied: boolean; readonly role: string }

/** The cells a carrier's `#/takes` rows table (`cell` rows), in authored order; a misspelt cell name reads as no cell. */
export function muCellsOf(rows: readonly HasRow[]): MuCell[] {
  const cells: MuCell[] = [];
  for (const row of rows) {
    if (row.entity !== "cell") continue;
    const read = readMu(row.name);
    if (isMuFault(read)) continue;
    cells.push({ carry: read.carry, owed: row.params["owed"] ?? null, implied: row.params["implied"] === "true", role: row.role });
  }
  return cells;
}

/** What a carrier answers for one `mu`: the value asked, the carry its cell answers, how the asked tools sat, any next carry. */
export interface MuReading {
  readonly asked: string;
  /** The canonical carry the cell answers (`*?`); the seat turns it into its reactor's args. */
  readonly carry: string;
  readonly axis: MuAxis;
  readonly role: string;
  /** A conflict's second tool, as the carry the next call asks (the cell's implied tool joined). */
  readonly then: string | null;
}

/** The carry once a cell's implied tool joins a single-tool carry on the other axis: `?0` on a filter carrier reads `*?`. */
function joinImplied(carry: string, cells: readonly MuCell[]): string {
  if (MU_CARRIES[carry]?.axis !== "single") return carry;
  const lone = carry[0] as MuGlyph;
  for (const cell of cells) {
    if (!cell.implied || MU_CARRIES[cell.carry]?.axis !== "single") continue;
    const g = cell.carry[0] as MuGlyph;
    if (g !== lone && MU_TOOLS[g].axis !== MU_TOOLS[lone].axis) return canonicalCarry([g, lone]);
  }
  return carry;
}

/** The nearest answered cell to a carry: the first that shares a held tool and owes nothing; null where none does. */
function nearestCell(carry: string, cells: readonly MuCell[]): MuCell | null {
  const held = [...carry].filter((g) => g !== "0");
  return cells.find((c) => c.owed === null && [...c.carry].some((g) => g !== "0" && held.includes(g))) ?? null;
}

/**
 * THE CELL LOOKUP: a carry against a carrier's cells. Rest answers the ground with no cell (a cell tabling `00` lends its line);
 * a conflict answers its first tool and names the second as `then`; an implied tool joins a single-tool carry; the cell
 * answers, or the lookup faults `mu-cell-empty` naming the nearest cell's word as the cure (null: the plain call with no `mu`).
 */
export function lookupMu(asked: string, read: MuCarry, cells: readonly MuCell[]): MuReading | MuFault {
  if (read.axis === "rest") {
    const own = cells.find((c) => c.carry === "00");
    return { asked, carry: "00", axis: "rest", role: own?.role ?? "the ground: the door's own default", then: null };
  }
  const conflict = read.axis === "conflict";
  const carry = joinImplied(conflict ? `${read.tools[0]}0` : read.carry, cells);
  const then = conflict ? joinImplied(`${read.tools[1]}0`, cells) : null;
  const cell = cells.find((c) => c.carry === carry);
  const tabled = cells.map((c) => c.carry + (c.owed !== null ? " (owed)" : "")).join(" · ") || "none";
  if (cell === undefined) {
    const near = nearestCell(carry, cells);
    return { reason: "mu-cell-empty", message: `this carrier tables no ${carry} (${muWordsOf(carry)}) cell; its cells: ${tabled}`, cure: near === null ? null : muWordsOf(near.carry) };
  }
  if (cell.owed !== null) {
    const near = nearestCell(carry, cells.filter((c) => c !== cell));
    return { reason: "mu-cell-empty", message: `the ${carry} (${muWordsOf(carry)}) cell stands owed: ${cell.owed}`, cure: near === null ? null : muWordsOf(near.carry) };
  }
  return { asked, carry, axis: read.axis, role: cell.role, then };
}

/**
 * THE WRITE DOORS' DRY BAND (landing 7, riding the Pentacle's hidden feed: match without binding): `_0` and `_?` (overview) the
 * summary (the decision, the bag and layer it would land in, the base it needs, what it keeps and tombstones, a delete's
 * consequence), `_!` (precision) the summary and the full diff of text and fields. Null: the carry names no dry depth.
 */
export function dryDepthOf(carry: string): "summary" | "diff" | null {
  if (carry === "_0" || carry === "_?") return "summary";
  if (carry === "_!") return "diff";
  return null;
}

/** True where a carry holds the Pentacle: the call walks its door's law to the last step and lands nothing. */
export const isDryCarry = (carry: string): boolean => carry.includes("_");
