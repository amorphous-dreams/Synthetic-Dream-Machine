/**
 * mu — THE DEPTH OF EVERY CALL (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing 6; the model's #/mu slot,
 * lar:///ha.ka.ba/kahua/memory/draft/comms-ux). The `mu` param takes the seed's five pattern-match operators, each beside its
 * word (a shell's nomatch refuses a bare `?`, so the word rides everywhere a glyph does):
 *
 *   ?  relate  Cup       zoom axis, out   the card: the has line, what stands, its size, its base
 *   !  assert  Sword     zoom axis, in    the whole, every slot; `slot=` narrows it to one span
 *   *  many    Wand      feed axis, seen  a filter's page (a filter call reads as `*` already)
 *   _  dry     Pentacle  feed axis, held  a dry run: what a write would land and the base it needs, landing nothing
 *   0  unask   Arcana    no axis          the caller withdrawing its own ask
 *
 * Two tools across the axes carry together (complementary: `*?` a page of has lines, `*!` a page whose rows carry their lines,
 * `_?` a dry summary, `_!` a dry diff); two on one axis fight (conflict: `*_`, `?!`), and the call answers the FIRST tool's depth
 * and names the second as the next call, the seed's own recovery (drop one tool). `0` beside a tool reads as the empty hand
 * (`*0` carries `*` alone); `0` alone asks unask.
 *
 * MU NAMES DEPTH ALONE AND NEVER REPEATS A PARAM: `filter=` already means many and `match=` already adds lines. With no `mu`
 * the read gradient stands (a record within one page answers fat, a longer one its has line).
 *
 * THE CELLS REST IN CARRIER ROWS (fork 7): each carrier's `#/takes` tables the depths it answers, one `cell` row per carry
 * (``<<has entity=`cell` name=`*?` params=`mu/many-relate ~ a page of has lines`>>``), so a layer above re-tables a door's depths
 * like any other row. `implied/true` on a one-tool cell joins that tool to every carry that lacks its axis (the filter's `*`);
 * `owed/<why>` tables a cell whose door does not answer it yet, and it refuses as an empty cell. A carry outside the table
 * refuses `mu-cell-empty` and names the nearest cell as a call: one sharing a tool, else the plain call with no `mu`.
 *
 * A LEAF: pure over the rows the call already read; `modules/call.ts` turns a fault into a refusal with a cure sigil, and the
 * seats (`TIDDLER_CALL_SEATS`) turn a carry into their reactor's args (`readDepthArgs`, `filterDepthArgs`, `dryDepthOf`).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/affordance
 */
import type { HasRow } from "../affordance-rows.js";

/** The five operators, in the seed's order. */
export const MU_GLYPHS = ["*", "?", "!", "_", "0"] as const;
export type MuGlyph = typeof MU_GLYPHS[number];

/** One operator: its glyph, the word a shell may carry, the tool, and the axis it rides (null for Arcana). */
export interface MuTool { readonly glyph: MuGlyph; readonly word: string; readonly tool: string; readonly axis: "feed" | "zoom" | null }

export const MU_TOOLS: Readonly<Record<MuGlyph, MuTool>> = Object.freeze({
  "*": { glyph: "*", word: "many", tool: "Wand", axis: "feed" },
  "?": { glyph: "?", word: "relate", tool: "Cup", axis: "zoom" },
  "!": { glyph: "!", word: "assert", tool: "Sword", axis: "zoom" },
  "_": { glyph: "_", word: "dry", tool: "Pentacle", axis: "feed" },
  "0": { glyph: "0", word: "unask", tool: "Arcana", axis: null },
});

const BY_WORD: ReadonlyMap<string, MuGlyph> = new Map(MU_GLYPHS.map((g) => [MU_TOOLS[g].word, g] as const));
const isGlyph = (c: string): c is MuGlyph => (MU_GLYPHS as readonly string[]).includes(c);

/** How a carry's tools sit: one tool, two across the axes, two on one axis, or the rest (`0` alone). */
export type MuAxis = "single" | "complementary" | "conflict" | "rest";

/** A read `mu` value: its tools in the order written (the order decides a conflict), and how they sit. */
export interface MuCarry { readonly tools: readonly MuGlyph[]; readonly axis: MuAxis }

/** A `mu` value no carry reads: the words it holds and why. */
export interface MuFault { readonly reason: "mu-malformed" | "mu-cell-empty"; readonly message: string; readonly cure: string | null }

/** The words a carry spells (`*?` → `many-relate`): what a cure writes, safe on every shell. */
export const muWordsOf = (glyphs: string): string => [...glyphs].map((g) => (isGlyph(g) ? MU_TOOLS[g].word : g)).join("-");

/** A carry's canonical glyphs: the feed tool first, then the zoom tool (`?*` → `*?`); one tool stands as written. */
export function canonicalCarry(tools: readonly MuGlyph[]): string {
  const rank = (g: MuGlyph): number => (MU_TOOLS[g].axis === "feed" ? 0 : MU_TOOLS[g].axis === "zoom" ? 1 : 2);
  return [...tools].sort((a, b) => rank(a) - rank(b)).join("");
}

function axisOf(tools: readonly MuGlyph[]): MuAxis {
  if (tools.length === 1) return tools[0] === "0" ? "rest" : "single";
  return MU_TOOLS[tools[0]!].axis === MU_TOOLS[tools[1]!].axis ? "conflict" : "complementary";
}

/**
 * READ A `mu` VALUE: glyphs (`*?`), words (`many-relate`, `many relate`, `many,relate`, `many+relate`) or both mixed. A tool
 * written twice reads once; `0` beside a tool reads as the empty hand. More than two tools, or a token that names none,
 * answers a fault.
 */
export function readMu(raw: unknown): MuCarry | MuFault {
  const text = typeof raw === "string" ? raw.trim() : raw === true ? "" : String(raw ?? "");
  const words = MU_GLYPHS.map((g) => `${g} ${MU_TOOLS[g].word}`).join(" · ");
  if (text === "") return { reason: "mu-malformed", message: `mu names a depth: ${words}`, cure: null };
  const tools: MuGlyph[] = [];
  for (const token of text.split(/[\s,+-]+/).filter(Boolean)) {
    const word = BY_WORD.get(token.toLowerCase());
    const glyphs: string[] = word !== undefined ? [word] : [...token];
    for (const g of glyphs) {
      if (!isGlyph(g)) return { reason: "mu-malformed", message: `mu reads no tool in "${token}"; it reads ${words}`, cure: null };
      if (!tools.includes(g)) tools.push(g);
    }
  }
  const held = tools.length > 1 ? tools.filter((g) => g !== "0") : tools;
  if (held.length > 2) {
    return { reason: "mu-malformed", message: `mu carries two tools at most (a hand holds two); "${text}" names ${held.join(" ")}`, cure: muWordsOf(canonicalCarry(held.slice(0, 2))) };
  }
  return { tools: held, axis: axisOf(held) };
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
    cells.push({ carry: canonicalCarry(read.tools), owed: row.params["owed"] ?? null, implied: row.params["implied"] === "true", role: row.role });
  }
  return cells;
}

/** What a carrier answers for one `mu`: the carry asked, the carry its cell answers, how the asked tools sat, any next carry. */
export interface MuReading {
  readonly asked: string;
  /** The canonical carry the cell answers (`*?`); the seat turns it into its reactor's args. */
  readonly carry: string;
  readonly axis: MuAxis;
  readonly role: string;
  /** A conflict's second tool, as the carry the next call asks (the cell's implied tool joined). */
  readonly then: string | null;
}

/** The carry once a cell's implied tool joins it: `?` on a filter carrier reads `*?`. */
function joinImplied(tools: readonly MuGlyph[], cells: readonly MuCell[]): string {
  const lone = tools.length === 1 ? tools[0]! : null;
  if (lone !== null) {
    for (const cell of cells) {
      if (!cell.implied || cell.carry.length !== 1) continue;
      const g = cell.carry as MuGlyph;
      if (g !== lone && MU_TOOLS[g].axis !== null && MU_TOOLS[lone].axis !== null && MU_TOOLS[g].axis !== MU_TOOLS[lone].axis) return canonicalCarry([g, lone]);
    }
  }
  return canonicalCarry(tools);
}

/** The nearest answered cell to a carry: the first that shares a tool and owes nothing; null where none does. */
function nearestCell(carry: string, cells: readonly MuCell[]): MuCell | null {
  return cells.find((c) => c.owed === null && [...c.carry].some((g) => carry.includes(g))) ?? null;
}

/**
 * THE CELL LOOKUP: a carry against a carrier's cells. A conflict answers its first tool and names the second as `then`; an
 * implied tool joins a lone one; the cell answers, or the lookup faults `mu-cell-empty` naming the nearest cell's words as the
 * cure (null: the plain call with no `mu`, the gradient).
 */
export function lookupMu(asked: string, read: MuCarry, cells: readonly MuCell[]): MuReading | MuFault {
  const first = read.axis === "conflict" ? [read.tools[0]!] : read.tools;
  const carry = joinImplied(first, cells);
  const then = read.axis === "conflict" ? joinImplied([read.tools[1]!], cells) : null;
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
 * THE READ DOOR'S DEPTH (`engine.record.reads`): `?` the card (a meme's has-stack, a record's has line with its text left home;
 * beside a slot, `slot=` or a `#/` title, the slot record's own card), `!` the whole (a meme's carrier paged on slot boundaries;
 * beside a slot, that one span). Any other carry adds nothing.
 */
export function readDepthArgs(carry: string, slotted: boolean): Record<string, unknown> {
  if (carry === "?") return slotted ? { grain: "skinny" } : { meme: true, grain: "skinny" };
  // Beside a slot the meme lens answers that span by itself (its `slot` grain); the whole grain would read past it.
  if (carry === "!") return slotted ? { meme: true } : { meme: true, grain: "whole" };
  return {};
}

/** THE FILTER DOOR'S DEPTH (`engine.filter.pages`): `*?` a page of has lines, `*!` a page whose rows carry their text or lines. */
export function filterDepthArgs(carry: string): Record<string, unknown> {
  if (carry === "*?") return { depth: "card" };
  if (carry === "*!") return { depth: "whole" };
  return {};
}

/**
 * THE WRITE DOORS' DEPTH (landing 7: `engine.record.puts`, `removes`, `renames`): `_` (dry) and `_?` (dry-relate) the summary
 * (the decision, the bag and layer it would land in, the base it needs, what it keeps and tombstones, a delete's consequence),
 * `_!` (dry-assert) the summary and the full diff of text and fields. Null: the carry names no dry depth.
 */
export function dryDepthOf(carry: string): "summary" | "diff" | null {
  if (carry === "_" || carry === "_?") return "summary";
  if (carry === "_!") return "diff";
  return null;
}

/** True where a carry holds the dry tool: the call walks its door's law to the last step and lands nothing. */
export const isDryCarry = (carry: string): boolean => carry.includes("_");
