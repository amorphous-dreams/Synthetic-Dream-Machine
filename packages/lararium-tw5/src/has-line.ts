/**
 * has-line — the `has` line and a carrier's slot measures: the pure pieces a read's gradient and a carrier's fold both write.
 *
 * THE `has` LINE, in the pono grammar: `<<~ has name=`…` params=`…`>>`. The params run as the caller orders them, then a `~`
 * tagline quoting a description, a role or a slot's first line. A carrier's slots measure through the decomposer's own
 * top-level ahu scan, so the slots a line names stand as the slots the family stores.
 *
 * Platform-blind pure functions that reach nothing past the meme-ast scan, so a plugin module bundles them whole and small.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/read-gradient
 */

import { findTopLevelAhuBlocks, type AhuBlock } from "./meme-ast/ahu-scan.js";

/**
 * A text's length in UTF-8 bytes, counted by code point: a module tiddler's sandbox lends no `TextEncoder`, and the count reads
 * the same (a lone surrogate weighs the three bytes its replacement encodes to).
 */
export function byteLength(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const point = ch.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// ── the has line ─────────────────────────────────────────────────────────────────────────────────────

/** A value quoted for a sigil attribute: one backtick each side, or three where the value holds a backtick. */
function quoted(value: string): string {
  return value.includes("`") ? `\`\`\`${value}\`\`\`` : `\`${value}\``;
}

/** One param token: `key/value`, a value with whitespace bracketed as TiddlyWiki brackets a title. */
export function param(key: string, value: string | number | boolean): string {
  const text = String(value);
  return `${key}/${/\s/.test(text) ? `[[${text}]]` : text}`;
}

/** A tagline, one line and short: the description or role a reader meets first. */
function taglineOf(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const line = raw.replace(/\s+/g, " ").trim();
  if (line === "") return null;
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

/** THE `has` LINE: `<<~ has name=`…` params=`… ~ tagline`>>`. */
export function hasLine(name: string, params: readonly string[], tagline?: string | null): string {
  const tail = taglineOf(tagline);
  const body = [...params, ...(tail ? [`~ ${tail}`] : [])].join(" ");
  return `<<~ has name=${quoted(name)} params=${quoted(body)}>>`;
}

// ── the carrier's slots ──────────────────────────────────────────────────────────────────────────────

/** One top-level slot of a carrier: its name, its bytes, and its first line (the tagline a has line quotes). */
export interface CarrierSlot {
  readonly slot: string;
  readonly bytes: number;
  readonly first: string | null;
}

/** The first prose line of a slot's body: its heading, the `!` marks dropped. */
function firstLineOf(body: string): string | null {
  for (const line of body.split("\n")) {
    const bare = line.trim();
    if (bare === "" || bare.startsWith("<<~") || bare.startsWith("<<^")) continue;
    return bare.replace(/^!+\s*/, "");
  }
  return null;
}

/** The span a block owns: its opener through its closer, and the line end that follows. */
export function blockSpan(text: string, block: AhuBlock): string {
  const end = text.startsWith("\r\n", block.closeEnd) ? block.closeEnd + 2 : text[block.closeEnd] === "\n" ? block.closeEnd + 1 : block.closeEnd;
  return text.slice(block.openStart, end);
}

/** Every top-level slot of a carrier, in order, with its bytes and first line. */
export function carrierSlots(text: string): CarrierSlot[] {
  return findTopLevelAhuBlocks(text).map((block) => ({
    slot: block.slot, bytes: byteLength(blockSpan(text, block)), first: firstLineOf(text.slice(block.bodyStart, block.bodyEnd)),
  }));
}
