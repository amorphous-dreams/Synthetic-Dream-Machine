/**
 * oracle-loop — the cast as an OODA-HA meme, its slots read from canon.
 *
 * THE PROCEDURE LIVES IN CANON, never here. The affordance carrier (`lar:///ha.ka.ba/lares/afford/oracle.cast.throws`,
 * tagged with its address `lar:///oracle.cast.throws`) calls the slot of the law that owns the procedure from its own
 * `#/loop` (`<<~ kahea uri=`lar:///ha.ka.ba/lares/api/pono/oracle-loop#/loop`>>`), and that slot's `has` rows name each
 * act slot in loop order, its phase, its writer, what the house fills there (`fills/`) and what the seat owes (`owes/`).
 * This module reads those rows and fills what the ask and the throw carry; it names no slot and writes no ask of its own.
 *
 * WHAT STAYS HERE: the row reader, the throw's plain facts, and the reading-and-credit logic (each distinct reading text
 * quoted once, EVERY source's credit beneath it, since each quote rides with the attribution its page gives it).
 *
 * Platform-blind and pure: no clock, no door, no frame (the verb frames the body it gets back).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/oracle-loop
 */

import { CARRIER_TYPE } from "./carrier-type.js";
import { ORACLE_THROW_STANDS, castFields, type Hexagram, type OracleCast } from "./oracle-cast.js";

/** The affordance address every cast record tags, so one filter gathers carrier, code, tests and casts. */
export const ORACLE_AFFORDANCE = "lar:///oracle.cast.throws";

/** The carrier's canon seat: the canon walk seats no bare root, so the carrier rests here and tags the address. */
export const ORACLE_CARRIER = "lar:///ha.ka.ba/lares/afford/oracle.cast.throws";

/** The slot a carrier declares its act shape in (`api/pono/affordance#/loop`). */
export const LOOP_SLOT = "#/loop";

/** One `has` row as canon writes it: ``<<has entity=`E` name=`N` params=`k/v k/[[v w]] ~ tagline`>>``. */
export interface HasRow {
  readonly entity: string;
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly tagline: string;
}

const HAS_ROW_RE = /<<~?\s*has\s+entity=`([^`]*)`\s+name=`([^`]*)`\s+params=`([^`]*)`\s*>>/g;
const PARAM_RE = /([^\s/]+)\/(?:\[\[([^\]]*)\]\]|(\S*))/g;

/** Every `has` row a text carries, in order. */
export function parseHasRows(text: string): HasRow[] {
  const rows: HasRow[] = [];
  for (const m of text.matchAll(HAS_ROW_RE)) {
    const raw = m[3]!;
    const cut = raw.indexOf(" ~ ");
    const body = cut >= 0 ? raw.slice(0, cut) : raw;
    const tagline = cut >= 0 ? raw.slice(cut + 3).trim() : "";
    const params: Record<string, string> = {};
    for (const p of body.matchAll(PARAM_RE)) params[p[1]!] = p[2] ?? p[3] ?? "";
    rows.push({ entity: m[1]!, name: m[2]!, params, tagline });
  }
  return rows;
}

/** The address a slot's `kahea` call names, split into the carrier and the slot; null where the text calls none. */
export function kaheaTarget(text: string): { readonly uri: string; readonly slot: string | null } | null {
  const m = /<<~\s*kahea\s+uri=`([^`#]+)(#[^`]*)?`\s*>>/.exec(text);
  return m ? { uri: m[1]!, slot: m[2] ?? null } : null;
}

/** One act slot, as its canon row names it. */
export interface LoopSlot {
  readonly name: string;
  readonly phase: string;
  readonly writer: string;
  /** What the house fills there from the ask or the throw (`observe` · `uncertain` · `throw`), or null. */
  readonly fills: string | null;
  /** What the seat owes there; the row's tagline where the row names no `owes/`. */
  readonly owes: string;
}

/** The act slots a loop's rows name, in the order canon writes them. */
export function loopSlots(rows: readonly HasRow[]): LoopSlot[] {
  return rows.filter((r) => r.entity === "slot" && r.name.startsWith("#/")).map((r) => ({
    name: r.name,
    phase: r.params["phase"] ?? "",
    writer: r.params["writer"] ?? "seat",
    fills: r.params["fills"] ? r.params["fills"] : null,
    owes: r.params["owes"] || r.tagline,
  }));
}

/** A writer whose last hand reaches the seat (`seat`, `house-then-seat`) leaves the slot owed after any fill. */
const seatWritesLast = (writer: string): boolean => /(^|-)seat$/.test(writer);

/** One reading as a door answered it. */
export interface LoopReading {
  readonly title: string;
  readonly absent?: boolean;
  readonly caption?: string;
  readonly text?: string;
  readonly attribution?: string;
  readonly license?: string;
}

/** A reading's credit: its attribution and license, or its title where it names neither. */
function creditOf(r: LoopReading): string {
  return [r.attribution, r.license].filter((s): s is string => typeof s === "string" && s !== "").join(" · ") || r.title;
}

/** One quoted text and every source that carries it. */
export interface QuotedText { readonly caption: string; readonly text: string; readonly credits: readonly string[] }

/**
 * The readings worth quoting: each distinct text once (the DOA and e-jing carry the same prose for most figures), with
 * EVERY source's credit kept beside it, since each quote rides with the attribution its page gives it.
 */
export function quotedReadings(readings: readonly LoopReading[]): QuotedText[] {
  const byText = new Map<string, { caption: string; text: string; credits: string[] }>();
  for (const r of readings) {
    if (r.absent || typeof r.text !== "string" || r.text.trim() === "") continue;
    const key = r.text.trim();
    const held = byText.get(key);
    const credit = creditOf(r);
    if (held) { if (!held.credits.includes(credit)) held.credits.push(credit); continue; }
    byText.set(key, { caption: r.caption ?? r.title, text: key, credits: [credit] });
  }
  return [...byText.values()];
}

/** The readings quoted, each with its credits, and the ones the wiki holds none of named. */
export function readingsText(readings: readonly LoopReading[]): string {
  const quoted = quotedReadings(readings);
  const absent = readings.filter((r) => r.absent).map((r) => r.title);
  const blocks = quoted.map((q) => [`''${q.caption}''`, "", q.text, "", ...q.credits.map((c) => `//${c}//`)].join("\n"));
  if (absent.length > 0) blocks.push(`(this wiki holds none of: ${absent.join(" · ")})`);
  if (quoted.length === 0) blocks.unshift("(no reading answered; the throw stands without a quoted text)");
  return blocks.join("\n\n");
}

function hexagramName(h: Hexagram): string {
  return `${h.glyph} ${h.number} (${h.lower} below, ${h.upper} above)`;
}

/** The throw's plain facts: both hexagrams, the lines and the changing ones, the door, the time as testimony. */
export function throwText(cast: OracleCast): string {
  return [
    `Hexagram ${hexagramName(cast.primary)}${cast.relating ? `, changing to ${hexagramName(cast.relating)}` : ", no line changes"}`,
    `Lines, bottom first: ${cast.lines.join(" ")}${cast.changing.length > 0 ? ` · changing: ${cast.changing.join(", ")}` : ""}`,
    `Entropy: \`${cast.entropy}\` · caster: ${cast.caster} · at: ${cast.at} (testimony; the time names nothing)`,
  ].join("\n");
}

/** What the ask carried and the house measured, the fills a loop's rows draw on. */
export interface LoopFill {
  readonly observe: readonly string[];
  readonly uncertain: string;
  readonly asking: string;
  readonly cast: OracleCast;
  readonly readings: readonly LoopReading[];
}

/** One act slot as the house lands it: what the house filled, and whether the seat owes the slot still. */
export interface FilledSlot {
  readonly slot: string;
  readonly phase: string;
  readonly writer: string;
  readonly owed: boolean;
  readonly text: string;
}

/** Each act slot filled from the ask and the throw, as far as the house reaches; the rest names its owed ask. */
export function fillLoop(slots: readonly LoopSlot[], fill: LoopFill): FilledSlot[] {
  return slots.map((s) => {
    const parts: string[] = [];
    if (s.fills === "observe" && fill.observe.length > 0) parts.push(fill.observe.map((p) => `* ${p}`).join("\n"));
    if (s.fills === "uncertain") {
      if (fill.uncertain.trim() !== "") parts.push(fill.uncertain.trim());
      if (fill.asking.trim() !== "") parts.push(`''query:'' ${fill.asking.trim()}`);
    }
    if (s.fills === "throw") parts.push(throwText(fill.cast), readingsText(fill.readings));
    const owed = parts.length === 0 || seatWritesLast(s.writer);
    if (owed) parts.push(`(owed: ${s.owes})`);
    return { slot: s.name, phase: s.phase, writer: s.writer, owed, text: parts.join("\n\n") };
  });
}

/** A TOML basic string (JSON's escapes read as TOML's). */
const tomlString = (value: string): string => JSON.stringify(value);

/** The root meta a cast meme carries: the cast's facts as flat fields, the ask's words kept, the address tagged. */
export function castMeta(cast: OracleCast, asked: { readonly title: string; readonly intent: string; readonly asking?: string; readonly uncertain?: string; readonly observe?: readonly string[] }): Record<string, string> {
  const { text: _text, type: _type, tags: _tags, ...fields } = castFields(cast, { title: asked.title, intent: asked.intent, ...(asked.asking ? { asking: asked.asking } : {}) });
  if (asked.uncertain && asked.uncertain.trim() !== "") fields["uncertain"] = asked.uncertain.trim();
  if (asked.observe && asked.observe.length > 0) fields["observe"] = asked.observe.join(" ");
  return fields;
}

/** The tags every cast meme carries: the cast's own kind and the affordance address. */
export const CAST_MEME_TAGS = ["oracle/cast", ORACLE_AFFORDANCE] as const;

/**
 * The cast meme's body (everything between STX and ETX): the root meta, one line naming the throw, then one ahu slot per
 * act slot in the order canon wrote them. The verb frames it.
 */
export function castMemeBody(input: { readonly title: string; readonly meta: Readonly<Record<string, string>>; readonly cast: OracleCast; readonly slots: readonly FilledSlot[] }): string {
  if (!input.title.startsWith("lar:///")) throw new RangeError(`oracle loop: a cast meme's title names a lar:/// address; got "${input.title}"`);
  const meta: Record<string, string> = { ...input.meta, title: input.title, type: CARRIER_TYPE, "uri-path": input.title.slice("lar:///".length) };
  const lines = Object.keys(meta).sort().map((k) => `${k} = ${tomlString(meta[k]!)}`);
  lines.push(`tags = [${CAST_MEME_TAGS.map(tomlString).join(", ")}]`);
  lines.sort();
  const { primary, relating } = input.cast;
  const head = `! ${primary.glyph} Hexagram ${primary.number}${relating ? ` changing to ${relating.glyph} ${relating.number}` : ""}`;
  const slots = input.slots.map((s) => `<<~ ahu slot=\`${s.slot}\`>>\n\n${s.text}\n\n<<~/ahu>>`);
  return ["```toml meta\n" + lines.join("\n") + "\n```", head, `//(${ORACLE_THROW_STANDS})//`, ...slots].join("\n\n");
}
