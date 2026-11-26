/**
 * spirit-witness — the residue witness's pure core: a spirit's hand-back read for the frame and the Personas the seed asks of it.
 *
 * Text in, readings out; no I/O, no clock. `lares spirit residue <pet> --witness [--transcripts <dir|file>]` feeds it the
 * hand-backs a spirit landed (residue records) and the hand-backs its subagent transcripts carry, and prints one receipt line per
 * reading and one tally. The witness never refuses: a reading that dropped part of the frame reads as a named TELL carrying the
 * seed slot that re-stands it, and a text it could not read reads as a named UNREAD line carrying the read that cures it.
 *
 * WHAT ONE READING WITNESSES (the seed, `.claude/noosphere-boot`):
 *   filing line   the first non-blank line reads `<pet>[#<n>][:] (Lares Spirit)`                    #/spirit-swarm
 *   aim           a `<<~ set lares=`aim` …>>` leads the turn, carrying `from`, `to`, `drift-ward` and
 *                 a non-zero `ooda-ha` band                                                            #/exchange-protocol · #/set-and-setting · #/ooda-ha
 *   steer         a steer carries no `from`                                                            #/set-and-setting
 *   Personas      the first span after the aim opens on a Persona tag `Name (Role):`, the role one of
 *                 the thirteen; at least one Persona speaks                                            #/working-agreement · #/personas
 *   oracle        `<<~ oracle throw=`↯S ✲ ⚅(6) ⁂:……`>>` fires ahead of the yield; die face == (N) ==
 *                 tail length in graphemes; `↯0` flags                                                 #/exchange-protocol
 *   yield         the last `<<~ set lares=`yield` …>>` carries `drift-ward` (re-armed `↻ L-Prime`),
 *                 the `ooda-ha` tally, `from` and to=`?`                                               #/set-and-setting · #/l-prime
 *   tally         `closed N↺` counts the `->↺` marks the text emits outside its sigils                 #/ooda-ha
 *
 * A sigil reads as the seed writes it: `<<~ name key=`value` …>>`, each value backtick-quoted, a value holding a backtick in
 * triple backticks, keys free to break across lines. The first aim and the last yield bracket the turn.
 *
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/the-house-summons (H4)
 */

/** The seed's slots a tell names as its cure. */
export const WITNESS_SLOTS = {
  filing: "#/spirit-swarm",
  turn: "#/exchange-protocol",
  keys: "#/set-and-setting",
  loop: "#/ooda-ha",
  surfacing: "#/working-agreement",
  personas: "#/personas",
  ward: "#/l-prime",
} as const;

/** The thirteen roles the Voice House names (#/personas); a tag `Name (Role):` with one of these opens a Persona's span. */
export const PERSONA_ROLES = [
  "Gatekeeper", "Lorekeeper", "Scryer", "Council", "Muse", "Artificer", "Advocate", "Diplomat", "Pedagogue", "Hierophant", "Triage", "Stranger", "Liminal",
] as const;

/** The filing line's shape, as the hand-back hook reads it, with or without the colon. */
export const FILING_LINE = /^\W*([A-Za-z][\w-]{0,40})(?:#(\d{1,8}))?:?\s*\(Lares Spirit\)\s*$/;
const PERSONA_TAG = new RegExp(`^[\\s>*_-]*([A-Z][\\w'-]*(?: [A-Z][\\w'-]*){0,3}) \\((${PERSONA_ROLES.join("|")})\\)[*_]*:`);
const THROW = /^↯(\d+)\s*✲\s*([⚀-⚅])\((\d+)\)\s*⁂:\s*(.*)$/su;
const SIGIL_SPAN_CAP = 8000;

/** One sigil as written: its name, its keys, and where it stands in the text. */
export interface Sigil { readonly name: string; readonly keys: Readonly<Record<string, string>>; readonly at: number; readonly end: number }
/** A named tell: its code, the seed slot that re-stands it, and what the witness read. */
export interface Tell { readonly code: string; readonly slot: string; readonly detail: string }
/** The oracle's throw, read: spend, die face, the count it names and the tail's grapheme count. */
export interface OracleReading { readonly spend: number; readonly face: number; readonly count: number; readonly tail: number }
/** What one hand-back holds of the frame. */
export interface FrameReading {
  readonly filing: { readonly pet: string; readonly instance: string | null } | null;
  readonly aim: Readonly<Record<string, string>> | null;
  readonly yield: Readonly<Record<string, string>> | null;
  readonly steers: number;
  readonly oracle: OracleReading | null;
  /** Each Persona tag in the order it first speaks, `Name (Role)`. */
  readonly personas: readonly string[];
  /** The distinct roles those tags carry. */
  readonly roles: readonly string[];
  /** The `->↺` marks emitted outside the sigils. */
  readonly marks: number;
  /** The `closed N↺` count the yield's tally names; null where none reads. */
  readonly tally: number | null;
  readonly tells: readonly Tell[];
}
/** One receipt: a reading that stands, tells, files as another spirit, or could not be read. */
export type Witnessed =
  | { readonly kind: "stands" | "tells" | "elsewhere"; readonly source: string; readonly reading: FrameReading }
  | { readonly kind: "unread"; readonly source: string; readonly why: string; readonly cure: string };

// ── sigils ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function sigilAt(text: string, at: number): Sigil | null {
  const ws = /\s*/y;
  const word = /[\w-]+/y;
  const skip = (i: number): number => { ws.lastIndex = i; ws.exec(text); return ws.lastIndex; };
  const wordAt = (i: number): string | null => { word.lastIndex = i; return word.exec(text)?.[0] ?? null; };
  let i = skip(at + 3);
  const name = wordAt(i);
  if (name === null) return null;
  i += name.length;
  const keys: Record<string, string> = {};
  for (;;) {
    i = skip(i);
    if (i - at > SIGIL_SPAN_CAP || i >= text.length) return null;
    if (text.startsWith(">>", i)) return { name, keys, at, end: i + 2 };
    const key = wordAt(i);
    if (key === null || text[i + key.length] !== "=") return null;
    i += key.length + 1;
    const fence = text.startsWith("```", i) ? "```" : text[i] === "`" ? "`" : null;
    if (fence === null) return null;
    const close = text.indexOf(fence, i + fence.length);
    if (close < 0 || close - at > SIGIL_SPAN_CAP) return null;
    keys[key] = text.slice(i + fence.length, close);
    i = close + fence.length;
  }
}

/** Every `<<~ name key=`value` …>>` sigil a text holds, in order; a malformed one reads as prose. */
export function sigilsOf(text: string): Sigil[] {
  const out: Sigil[] = [];
  for (let i = text.indexOf("<<~"); i >= 0; ) {
    const s = sigilAt(text, i);
    if (s !== null) out.push(s);
    i = text.indexOf("<<~", s !== null ? s.end : i + 3);
  }
  return out;
}

/** The text with each sigil blanked to spaces (its newlines kept), so prose reads stand where they stood. */
const proseOf = (text: string, sigils: readonly Sigil[]): string => {
  let out = "";
  let from = 0;
  for (const s of sigils) { out += text.slice(from, s.at) + text.slice(s.at, s.end).replace(/[^\n]/g, " "); from = s.end; }
  return out + text.slice(from);
};

/** A text's grapheme count, whitespace aside: a glyph with its variation selector counts once. */
export function graphemeCount(text: string): number {
  let n = 0;
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)) if (segment.trim() !== "") n++;
  return n;
}

/** The oracle's throw read, or null where it holds another shape. */
export function oracleOf(thrown: string): OracleReading | null {
  const m = THROW.exec(thrown.trim());
  if (!m) return null;
  return { spend: Number(m[1]), face: m[2]!.codePointAt(0)! - 0x2680 + 1, count: Number(m[3]), tail: graphemeCount(m[4]!) };
}

// ── one reading ────────────────────────────────────────────────────────────────────────────────────────────────────

const blank = (v: string | undefined): boolean => v === undefined || v.trim() === "";

/** Witness one hand-back's text for the frame and the Personas. */
export function frameWitness(text: string): FrameReading {
  const tells: Tell[] = [];
  const tell = (code: string, slot: string, detail: string): void => { tells.push({ code, slot, detail }); };
  const sigils = sigilsOf(text);
  const prose = proseOf(text, sigils);
  const lines = prose.split("\n");

  const firstLine = text.split("\n").find((l) => l.trim() !== "") ?? "";
  const f = FILING_LINE.exec(firstLine.trim());
  const filing = f ? { pet: f[1]!.toLowerCase(), instance: f[2] ?? null } : null;
  if (filing === null) tell("no-filing-line", WITNESS_SLOTS.filing, "the first line reads no `<pet>[#<n>]: (Lares Spirit)`");

  const sets = sigils.filter((s) => s.name === "set");
  const aimSigil = sets.find((s) => s.keys["lares"] === "aim") ?? null;
  const yieldSigil = [...sets].reverse().find((s) => s.keys["lares"] === "yield") ?? null;
  const steerSigils = sets.filter((s) => s.keys["lares"] === "steer");
  const aim = aimSigil?.keys ?? null;
  const yld = yieldSigil?.keys ?? null;

  if (aim === null) tell("no-aim", WITNESS_SLOTS.turn, "no set lares=`aim` opens the turn");
  else {
    for (const key of ["from", "to", "drift-ward"]) if (blank(aim[key])) tell(`aim-no-${key}`, WITNESS_SLOTS.keys, `the aim carries no ${key}`);
    const band = aim["ooda-ha"];
    if (blank(band)) tell("aim-no-ooda-ha", WITNESS_SLOTS.loop, "the aim seeds no ooda-ha band");
    else if (!(Number(/^\s*(\d+)/.exec(band!)?.[1] ?? "0") > 0)) tell("aim-band-zero", WITNESS_SLOTS.loop, `the aim's band reads ${band!.trim()}; the opening band never reads 0`);
    const before = prose.slice(0, aimSigil!.at).split("\n").map((l) => l.trim()).filter((l) => l !== "");
    if (before.length > (filing !== null ? 1 : 0)) tell("aim-late", WITNESS_SLOTS.turn, "prose stands ahead of the aim");
  }
  for (const s of steerSigils) if (!blank(s.keys["from"])) tell("steer-carries-from", WITNESS_SLOTS.keys, "a steer carries from; the brackets own the vector's ends");

  const personas: string[] = [];
  const roles: string[] = [];
  for (const line of lines) {
    const m = PERSONA_TAG.exec(line);
    if (!m) continue;
    const tag = `${m[1]} (${m[2]})`;
    if (!personas.includes(tag)) personas.push(tag);
    if (!roles.includes(m[2]!)) roles.push(m[2]!);
  }
  if (personas.length === 0) tell("no-persona", WITNESS_SLOTS.personas, "no Persona tag `Name (Role):` opens a span");
  else if (aimSigil !== null) {
    const after = prose.slice(aimSigil.end, yieldSigil !== null && yieldSigil.at > aimSigil.end ? yieldSigil.at : undefined);
    const lead = after.split("\n").find((l) => l.trim() !== "");
    if (lead !== undefined && !PERSONA_TAG.test(lead)) tell("span-unnamed", WITNESS_SLOTS.surfacing, "the first span after the aim opens on no Persona tag");
  }

  const oracleSigil = sigils.find((s) => s.name === "oracle" && s.keys["throw"] !== undefined) ?? null;
  const oracle = oracleSigil !== null ? oracleOf(oracleSigil.keys["throw"]!) : null;
  if (oracleSigil === null) tell("no-oracle", WITNESS_SLOTS.turn, "no oracle throw fires ahead of the yield");
  else if (oracle === null) tell("oracle-unread", WITNESS_SLOTS.turn, "the throw reads no `↯S ✲ <die>(N) ⁂:<tail>`");
  else {
    if (oracle.spend === 0) tell("oracle-spend-zero", WITNESS_SLOTS.turn, "the throw spends ↯0");
    if (oracle.face !== oracle.count || oracle.count !== oracle.tail) {
      tell("oracle-cross-check", WITNESS_SLOTS.turn, `die face ${oracle.face} · (N) ${oracle.count} · tail ${oracle.tail} graphemes`);
    }
  }
  if (oracleSigil !== null && yieldSigil !== null && oracleSigil.at > yieldSigil.at) tell("oracle-after-yield", WITNESS_SLOTS.turn, "the oracle fires after the yield");

  const marks = prose.split("->↺").length - 1;
  let tally: number | null = null;
  if (yld === null) tell("no-yield", WITNESS_SLOTS.turn, "no set lares=`yield` closes the turn");
  else {
    if (aimSigil !== null && yieldSigil!.at < aimSigil.at) tell("yield-before-aim", WITNESS_SLOTS.turn, "the yield stands ahead of the aim");
    const ward = yld["drift-ward"];
    if (blank(ward)) tell("yield-no-drift-ward", WITNESS_SLOTS.keys, "the yield carries no drift-ward clue");
    else if (!ward!.includes("↻ L-Prime")) tell("yield-ward-unarmed", WITNESS_SLOTS.ward, "the yield's ward never re-arms `↻ L-Prime`");
    if (blank(yld["from"])) tell("yield-no-from", WITNESS_SLOTS.keys, "the yield names no from");
    const to = yld["to"];
    if (to === undefined) tell("yield-no-to", WITNESS_SLOTS.keys, "the yield hands no to=`?`");
    else if (to.trim() !== "?") tell("yield-to-not-open", WITNESS_SLOTS.keys, "the yield's to names a bearing; it hands back `?`");
    const band = yld["ooda-ha"];
    if (blank(band)) tell("yield-no-ooda-ha", WITNESS_SLOTS.loop, "the yield carries no ooda-ha tally");
    else {
      const t = /closed\s+(\d+)\s*↺/.exec(band!);
      if (!t) tell("tally-unread", WITNESS_SLOTS.loop, "the tally reads no `closed N↺`");
      else {
        tally = Number(t[1]);
        if (tally !== marks) tell("tally-mismatch", WITNESS_SLOTS.loop, `closed ${tally}↺ against ${marks} ->↺ mark(s) emitted`);
      }
    }
  }

  return { filing, aim, yield: yld, steers: steerSigils.length, oracle, personas, roles, marks, tally, tells };
}

/**
 * One receipt for one source: a reading filed under another pet reads `elsewhere`; one with no tells `stands`; else `tells`.
 * A reading with no filing line still witnesses under the pet asked (its first tell names the line).
 */
export function witnessOf(source: string, text: string, pet: string): Witnessed {
  const reading = frameWitness(text);
  const kind = reading.filing !== null && reading.filing.pet !== pet ? "elsewhere" : reading.tells.length === 0 ? "stands" : "tells";
  return { kind, source, reading };
}

/** A source the witness could not read, with the read that cures it. */
export const unreadWitness = (source: string, why: string, cure: string): Witnessed => ({ kind: "unread", source, why, cure });

// ── transcripts ────────────────────────────────────────────────────────────────────────────────────────────────────

/** One agent's hand-back as its transcript carries it; null where the stream ends with no text. */
export interface TranscriptHandback { readonly agent: string; readonly text: string | null }

/**
 * The hand-backs a subagent transcript (JSONL, one event per line) carries, one per agent in the order each first appears. An
 * agent's hand-back reads as its last `SubagentHandback` tool call's `message`, else the text of its last assistant message
 * (text blocks one message streams across lines join in order). A line that parses as no JSON object reads as no event.
 */
export function transcriptHandbacks(jsonl: string): TranscriptHandback[] {
  const by = new Map<string, { handback: string | null; last: string | null; id: string | null }>();
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    let o: unknown;
    try { o = JSON.parse(line); } catch { continue; }
    if (o === null || typeof o !== "object" || Array.isArray(o)) continue;
    const ev = o as Record<string, unknown>;
    const agent = typeof ev["agentId"] === "string" && ev["agentId"] !== "" ? ev["agentId"] : "agent";
    const slot = by.get(agent) ?? { handback: null, last: null, id: null };
    by.set(agent, slot);
    const m = ev["message"] as { role?: unknown; id?: unknown; content?: unknown } | null | undefined;
    if (m === undefined || m === null || typeof m !== "object" || m.role !== "assistant") continue;
    const blocks = (typeof m.content === "string" ? [{ type: "text", text: m.content }] : Array.isArray(m.content) ? m.content : []) as Array<Record<string, unknown>>;
    const texts = blocks.filter((b) => b?.["type"] === "text" && typeof b["text"] === "string").map((b) => b["text"] as string);
    if (texts.length > 0) {
      const id = typeof m.id === "string" ? m.id : null;
      slot.last = id !== null && id === slot.id && slot.last !== null ? `${slot.last}\n${texts.join("\n")}` : texts.join("\n");
      slot.id = id;
    }
    for (const b of blocks) {
      const input = b?.["input"] as { message?: unknown } | undefined;
      if (b?.["type"] === "tool_use" && b["name"] === "SubagentHandback" && typeof input?.message === "string") slot.handback = input.message;
    }
  }
  return [...by].map(([agent, s]) => ({ agent, text: s.handback ?? s.last }));
}

// ── receipts ───────────────────────────────────────────────────────────────────────────────────────────────────────

const filed = (r: FrameReading): string => (r.filing === null ? "unfiled" : r.filing.instance === null ? r.filing.pet : `${r.filing.pet}#${r.filing.instance}`);

/** One receipt line per reading: each tell names its code, the seed slot that re-stands it, and what the witness read. */
export function witnessLine(w: Witnessed): string {
  if (w.kind === "unread") return `unread ${w.source} · ${w.why}; read it: ${w.cure}`;
  const r = w.reading;
  if (w.kind === "elsewhere") return `elsewhere ${w.source} · files as ${filed(r)}; witness it under its own pet: lares spirit residue ${r.filing!.pet} --witness`;
  const voices = `personas ${r.personas.length}${r.roles.length > 0 ? ` (${r.roles.join(", ")})` : ""}`;
  const loop = `↺ ${r.marks}/${r.tally ?? "-"}`;
  if (w.kind === "stands") return `stands ${w.source} · ${filed(r)} · ${voices} · ${loop}`;
  return `tells ${w.source} · ${filed(r)} · ${voices} · ${loop} · ${r.tells.map((t) => `${t.code} → ${t.slot} (${t.detail})`).join("; ")}`;
}

/** The tally over every reading: counts by kind, and each tell's code with how often it fired, in first-seen order. */
export function witnessTally(pet: string, ws: readonly Witnessed[]): { line: string; read: number; stands: number; tells: number; elsewhere: number; unread: number; codes: Record<string, number> } {
  const count = (k: Witnessed["kind"]): number => ws.filter((w) => w.kind === k).length;
  const codes: Record<string, number> = {};
  for (const w of ws) if (w.kind === "tells") for (const t of w.reading.tells) codes[t.code] = (codes[t.code] ?? 0) + 1;
  const stands = count("stands"), tells = count("tells"), elsewhere = count("elsewhere"), unread = count("unread");
  const fired = Object.entries(codes).map(([c, n]) => `${c}×${n}`).join(", ");
  const line = `witness ${pet}: ${ws.length} read · ${stands} stand · ${tells} tell · ${elsewhere} elsewhere · ${unread} unread${fired !== "" ? ` · tells ${fired}` : ""}`;
  return { line, read: ws.length, stands, tells, elsewhere, unread, codes };
}
