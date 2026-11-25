/**
 * relink-sigil-core — the pure law the house's Relink handler reads a sigil opener by: which named values name a record, and
 * what the opener reads once a record moves.
 *
 * ── WHAT A SIGIL VALUE NAMES ─────────────────────────────────────────────────────────────────────────
 * A sigil names a record through a named value holding a `lar:///` LOCAL URI (``uri=`lar:///…` ``, ``to=`lar:///…` ``,
 * ``from=`lar:///…` ``, any name alike), the URI alone or with a `#fragment` that names a slot of that record's family. A
 * rename of the record moves its slots with it (the family law), so `lar:///old#/a` follows to `lar:///new#/a`.
 *
 * Three spellings name no record, so the core leaves them standing:
 * - the SESSION form, `lar://alias:grant@host/…`: a session span names an exchange, never a record;
 * - a digest (`bcc=`ni:///…``): the seal re-mints, it never relinks;
 * - a positional or a bare word (`<<~ has name=`x`>>`): a word reads the same as a title, so the core claims none.
 * Typed values (a `{{…}}` reference, a `{{{…}}}` filter, a `<<…>>` call) keep their own grammar and stand untouched here.
 *
 * ── A VALUE THAT CANNOT HOLD THE NEW TITLE ───────────────────────────────────────────────────────────
 * The new value takes the delimiter the standing value wears. Where it cannot (a tick inside a ticked value, a `lar:///` title moving
 * onto a title that names no `lar:///` URI), the core answers `impossible` and rewrites nothing in that opener, the way
 * Relink marks a reference it cannot carry.
 *
 * The core reads no clock, no wiki and no host: the house's relinker modules (`relink/relink-sigil`, `relink/relink-memetic`)
 * hand it source text, and a node suite reads it directly.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/research/adopt-relink
 */

import { readSigilAttrs } from "./sigil-attrs.js";

/** The local `lar:` form: authority-less, so it names a stable graph address. */
const LOCAL = "lar:///";

/** One named value in an opener that names a record. Offsets index the opener text. */
export interface SigilReference {
  /** The value's name (`uri`, `to`, …). */
  readonly name: string;
  /** The value as written, fragment included. */
  readonly value: string;
  /** The record the value names: the value without its `#fragment`. */
  readonly title: string;
  readonly start: number;
  readonly end: number;
  /** The delimiter the value wears (`` ` ``, ```` ``` ````, `"`, `"""`, `'`, `[[`), or `""` for a bare value. */
  readonly delimiter: string;
}

/** The record a `lar:///` local value names, or null for any other value. */
export function localRecordOf(value: string): string | null {
  if (!value.startsWith(LOCAL)) return null;
  const hash = value.indexOf("#");
  return hash < 0 ? value : value.slice(0, hash);
}

const DELIMITERS: ReadonlyArray<readonly [open: string, close: string]> = [
  ["```", "```"], ["`", "`"], ['"""', '"""'], ['"', '"'], ["'", "'"], ["[[", "]]"],
];

/** Every named value in an opener (`<<~ name …>>`, `<<^ …>>`, `<<!WORD …>>`) that names a record by its local `lar:` URI. */
export function sigilReferences(opener: string): SigilReference[] {
  const out: SigilReference[] = [];
  for (const attr of readSigilAttrs(opener)) {
    if (attr.kind !== "string" && attr.kind !== "substituted") continue;
    const title = localRecordOf(attr.value);
    if (title === null) continue;
    // The value sits after the separator and any space; the delimiter it opens with names how far in it starts.
    let at = opener.indexOf(attr.sep, attr.start) + 1;
    while (opener[at] === " " || opener[at] === "\t") at++;
    const delimiter = DELIMITERS.find(([open]) => opener.startsWith(open, at))?.[0] ?? "";
    const start = at + delimiter.length;
    const end = start + attr.value.length;
    if (opener.slice(start, end) !== attr.value) continue;
    out.push({ name: attr.name, value: attr.value, title, start, end, delimiter });
  }
  return out;
}

/** Whether a value can stand inside the delimiter the standing value wears. */
function fits(value: string, delimiter: string): boolean {
  if (delimiter === "") return value !== "" && !/[\s"'`]|>>/.test(value);
  const close = DELIMITERS.find(([open]) => open === delimiter)![1];
  return !value.includes(close);
}

/** What a rewrite of one opener answers: the new opener text, or `impossible` where a value cannot hold the new title. */
export interface SigilRelink {
  readonly output?: string;
  readonly impossible?: true;
}

/**
 * The opener once `from` moves to `to`: every value naming `from` (or a slot of it) names `to`. Undefined when no value
 * names `from`; `{ impossible: true }` when a value cannot hold the new title, and then the opener stays as written.
 */
export function relinkSigilOpener(opener: string, from: string, to: string): SigilRelink | undefined {
  const hits = sigilReferences(opener).filter((ref) => ref.title === from);
  if (hits.length === 0) return undefined;
  if (!to.startsWith(LOCAL)) return { impossible: true };
  let output = "";
  let cursor = 0;
  for (const ref of hits) {
    const next = to + ref.value.slice(from.length);
    if (!fits(next, ref.delimiter)) return { impossible: true };
    output += opener.slice(cursor, ref.start) + next;
    cursor = ref.end;
  }
  return { output: output + opener.slice(cursor) };
}

/**
 * The `\rules except …` pragma that hands a walker the memetic parser's deny list, and the text it walks: the pragma rides
 * one line ahead of the source, so every offset the walk reports shifts by the prefix alone. Empty deny list, no prefix.
 */
export function denyListPrefix(denied: string): string {
  const names = denied.split(/\s+/).filter(Boolean);
  return names.length === 0 ? "" : `\\rules except ${names.join(" ")}\n`;
}
