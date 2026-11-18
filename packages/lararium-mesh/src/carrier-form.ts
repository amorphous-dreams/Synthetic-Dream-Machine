/**
 * carrier-form — THE ONE DEFINITION OF A RECORD'S CARRIER FORM, and the carrier identity hashed over it.
 *
 * A record's carrier identity (`carrierHash`, `crypto.ts`, tagged `sha256:<hex>`) names the bytes TW5 would write for the
 * record: the disk projector's Synced tree, the INGEST gate and the face bases compare it for every carrier, and an
 * override's fork base (`override-base.ts`) names it for the canon record the copy forked from. Two computations of those
 * bytes agree today and part the day one changes, so the form has one author: this file. It stands synchronous, engine-free
 * and host-neutral (node and browser import it alike), and it ports the pure half of `$tw.Tiddler` and the filesystem
 * adaptor's type selection, the way the fork's `makeTw5FileInfo` (`@lararium/tw5`) reads them:
 *   - a `Tiddler` constructor skips an undefined or null field and parses the four boot field modules (`created` and
 *     `modified` through `parseDate`, `tags` and `list` through `parseStringArray`); a field whose parse answers null
 *     stores null and stringifies empty;
 *   - `getFieldString` stringifies a date as UTC `YYYYMMDDHHMMSSmmm`, a list through `stringifyList` (an entry holding
 *     whitespace other than U+00A0 in `[[…]]`), anything else through `toString`;
 *   - the field block sorts the field names and writes one `name: value` line each, `text`, `bag` and `$origin-bag` out;
 *   - a field name holding `:` or `#`, or a non-text value holding a control character or edge whitespace, sends the record
 *     to the `.json` form (a one-element array of the field strings, four-space indent, `text` in);
 *   - a `text/vnd.tiddlywiki` or `text/vnd.tiddlywiki-multiple` record (or one holding `_canonical_uri`) rides the `.tid`
 *     form: the block, then a blank line and the text where the text holds any; every other type rides a content file with
 *     a `.meta` sidecar: the text as the body, the block as the sidecar.
 * `carrierFormOf` answers `{ body, meta? }`, the pair `carrierHash(body, meta)` folds (the meta, a blank line, the body).
 *
 * WHAT THE PORT LEAVES TO THE ENGINE, named: a `$:/config/FileSystemExtensions` filter that re-types a record (the
 * projector's file bytes ride the engine and honour it; this form reads the record's own type alone), and a field module a
 * plugin registers past the four boot ones. `packages/lararium-tw5/tests/carrier-form-agreement.test.ts` pins this form to
 * the engine's own bytes across a corpus of record shapes.
 */

import { carrierHash } from "./crypto.js";

/** A record's tiddler fields, any shape a store holds. */
export type CarrierFields = { readonly [field: string]: unknown };

/** The residency stamps a carrier never persists (TW5's file serializer leaves them out). */
const UNPERSISTED_FIELDS: readonly string[] = ["bag", "$origin-bag"];

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

/** `$tw.utils.parseDate`: a UTC `YYYYMMDDHHMMSSmmm` string (or a Date) to a Date; anything else to null. */
function parseDate(value: unknown): Date | null {
  if (typeof value === "string") {
    let negative = 1;
    let v = value;
    if (v.charAt(0) === "-") { negative = -1; v = v.slice(1); }
    const year = parseInt(v.slice(0, 4), 10) * negative;
    const d = new Date(Date.UTC(year, parseInt(v.slice(4, 6), 10) - 1, parseInt(v.slice(6, 8), 10), parseInt(v.slice(8, 10) || "00", 10), parseInt(v.slice(10, 12) || "00", 10), parseInt(v.slice(12, 14) || "00", 10), parseInt(v.slice(14, 17) || "000", 10)));
    d.setUTCFullYear(year);
    return d;
  }
  return Object.prototype.toString.call(value) === "[object Date]" ? (value as Date) : null;
}

/** `$tw.utils.stringifyDate`. */
function stringifyDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${pad(d.getUTCMilliseconds(), 3)}`;
}

/** `$tw.utils.parseStringArray` (duplicates dropped): a bracketed list string to an array; an array stays; anything else null. */
function parseStringArray(value: unknown): readonly string[] | null {
  if (typeof value === "string") {
    const memberRegExp = /(?:^|[^\S\xA0])(?:\[\[(.*?)\]\])(?=[^\S\xA0]|$)|([\S\xA0]+)/mg;
    const results: string[] = [];
    const names = new Set<string>();
    for (let match = memberRegExp.exec(value); match; match = memberRegExp.exec(value)) {
      const item = match[1] || match[2];
      if (item !== undefined && !names.has(item)) { results.push(item); names.add(item); }
    }
    return results;
  }
  return Array.isArray(value) ? (value as readonly string[]) : null;
}

/** `$tw.utils.stringifyList`. */
function stringifyList(value: readonly unknown[]): string {
  return value.map((v) => { const entry = typeof v === "string" ? v : v ? String(v) : ""; return /[^\S\xA0]/m.test(entry) ? `[[${entry}]]` : entry; }).join(" ");
}

/** The fields as a `$tw.Tiddler` holds them, in the order it holds them: undefined and null skipped, the boot field modules parsed. */
function tiddlerFields(fields: CarrierFields): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (v === undefined || v === null) continue;
    out.push([k, k === "created" || k === "modified" ? parseDate(v) : k === "tags" || k === "list" ? parseStringArray(v) : v]);
  }
  return out;
}

/** `Tiddler.getFieldString` over one stored value. */
function fieldString(name: string, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (name === "created" || name === "modified") return stringifyDate(value as Date);
  if (name === "tags" || name === "list") return stringifyList(value as readonly unknown[]);
  return String(value);
}

/**
 * The record's carrier form: the pair of strings `carrierHash(body, meta)` folds. A `.tid` record answers the block and
 * the text as its body alone; a content-file record answers the text as its body and the block as its `meta`; a record the
 * `.tid` and sidecar forms cannot carry safely answers the `.json` body.
 */
export function carrierFormOf(fields: CarrierFields): { readonly body: string; readonly meta?: string } {
  const stored = tiddlerFields(fields);
  const strings = stored.map(([k, v]) => [k, fieldString(k, v)] as const);
  const unsafe = strings.some(([k, s]) => (k !== "text" && (/[\x00-\x1F]/m.test(s) || s.trim() !== s)) || /:|#/m.test(k));
  if (unsafe) {
    const shown: Record<string, string> = {};
    for (const [k, s] of strings) if (!UNPERSISTED_FIELDS.includes(k)) shown[k] = s;
    return { body: JSON.stringify([shown], null, 4) };
  }
  const block = strings.filter(([k]) => k !== "text" && !UNPERSISTED_FIELDS.includes(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, s]) => `${k}: ${s}`).join("\n");
  const type = fields["type"];
  const kind = (typeof type === "string" && type !== "" ? type : "text/vnd.tiddlywiki");
  const text = fields["text"];
  if (kind === "text/vnd.tiddlywiki" || kind === "text/vnd.tiddlywiki-multiple" || stored.some(([k]) => k === "_canonical_uri")) {
    return { body: text ? `${block}\n\n${String(text)}` : block };
  }
  return { body: text === undefined || text === null ? "" : String(text), meta: block };
}

/** The carrier identity of a record: `carrierHash` over its carrier form (`sha256:<hex>`). */
export function carrierHashOf(fields: CarrierFields): string {
  const { body, meta } = carrierFormOf(fields);
  return carrierHash(body, meta);
}
