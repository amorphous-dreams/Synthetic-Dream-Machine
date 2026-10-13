/**
 * stored-value — the ONE door between a record as a hand holds it and a record as a document rests it.
 *
 * A document rests every string of a record as an IMMUTABLE SCALAR: a tiddler stands as an invariant,
 * every write replaces a field whole, and nothing in the house edits a value at character grain. A plain
 * string handed to Automerge rests as a Text object, one operation per character, and every peer that
 * receives the document pays that cost again; an immutable scalar rests as one operation per field.
 *
 * Automerge hands an immutable scalar back as a wrapper object, never as a string. So a document's
 * record never reads directly: `plainRecord` · `plainField` · `plainValue` · `plainEntries` unwrap it on
 * the way out (this module, the READ door), and `storedRecord` · `storedValue` wrap it on the way in
 * (`stored-record.ts`, the WRITE door). The types hold the law: a record read out of `LarDoc.tiddlers`
 * carries the type `StoredLarRecord`, which exposes no field, so a reader that skips this door does not
 * compile (`tests/stored-value-census.test.ts` plants that fault).
 *
 * This module imports no Automerge: the wiki's packed plugin modules read through it, and they run
 * where no CRDT engine loads. The write door alone imports the scalar's class.
 *
 * Field grain stays whole. Two writers that set one field to different values still leave a multi-value
 * conflict on that field (`parallel-drafts.ts` surfaces both); two writers that set different fields
 * both land.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/stored-value
 */

import type { LarTiddlerRecord } from "./tiddler-store.js";

/** Automerge marks its immutable scalar with a registered symbol, so the mark reads the same across
 *  every loaded copy of the library (`instanceof` would not). */
const IMMUTABLE_MARK = Symbol.for("_am_immutableString");

declare const WRAPPED: unique symbol;

/** A record whose strings rest as immutable scalars. Opaque by design: it exposes no field. */
export interface WrappedLarRecord { readonly [WRAPPED]: true }

/**
 * A record as a document holds it. A reader cannot tell from the outside whether its strings rest
 * wrapped, so the type offers no field at all: read it through `plainRecord` / `plainField`.
 */
export type StoredLarRecord = WrappedLarRecord | LarTiddlerRecord;

/** A document's `tiddlers` map as Automerge hands it out. */
export type StoredTiddlers = Record<string, StoredLarRecord>;

/** Inside a change a list stands as a document proxy that answers "own" for any key, so the mark alone
 *  does not decide: an immutable scalar never reads as an array, and it carries its string in `val`. */
export function isWrappedString(value: unknown): value is { val: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, IMMUTABLE_MARK)
    && typeof (value as { val?: unknown }).val === "string";
}

export function isPlainMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && !(value instanceof Uint8Array) && !(value instanceof Date) && !isWrappedString(value);
}

// ── THE READ DOOR ────────────────────────────────────────────────────────────────────────────────

/** A stored value as a hand reads it: every immutable scalar becomes its string, at any depth. */
export function plainValue(value: unknown): unknown {
  if (isWrappedString(value)) return value.val;
  if (Array.isArray(value)) {
    // Read by index: inside a change the list stands as a document proxy, whose `map` answers no array.
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) out.push(plainValue(value[i]));
    return out;
  }
  if (isPlainMap(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = plainValue(inner);
    return out;
  }
  return value;
}

/** One field of a stored record, unwrapped; `undefined` where the record or the field stands absent. */
export function plainField(record: StoredLarRecord | null | undefined, field: string): unknown {
  const tiddler = (record as { tiddler?: Record<string, unknown> } | null | undefined)?.tiddler;
  return tiddler ? plainValue(tiddler[field]) : undefined;
}

/** One `meta` key of a stored record, unwrapped. */
export function plainMeta(record: StoredLarRecord | null | undefined, key: string): unknown {
  const meta = (record as { meta?: Record<string, unknown> } | null | undefined)?.meta;
  return meta ? plainValue(meta[key]) : undefined;
}

/** Does the stored record read as a tombstone? */
export function storedDeleted(record: StoredLarRecord | null | undefined): boolean {
  return (record as { meta?: { deleted?: unknown } } | null | undefined)?.meta?.deleted === true;
}

/** A stored record as a frozen plain record: what every reader past the shore holds. */
export function plainRecord(record: StoredLarRecord): LarTiddlerRecord {
  const raw = record as { tiddler?: Record<string, unknown>; meta?: Record<string, unknown> };
  const tiddler = Object.freeze(plainValue(raw.tiddler ?? {}) as LarTiddlerRecord["tiddler"]);
  return Object.freeze(raw.meta !== undefined
    ? { tiddler, meta: Object.freeze(plainValue(raw.meta) as NonNullable<LarTiddlerRecord["meta"]>) }
    : { tiddler });
}

/** `plainRecord` for a slot that may stand empty. */
export function plainRecordOrNull(record: StoredLarRecord | null | undefined): LarTiddlerRecord | null {
  return record ? plainRecord(record) : null;
}

/** Every record of a document's `tiddlers` map, unwrapped, as `[title, record]` pairs. */
export function plainEntries(tiddlers: StoredTiddlers | null | undefined): Array<[string, LarTiddlerRecord]> {
  const out: Array<[string, LarTiddlerRecord]> = [];
  for (const [title, record] of Object.entries(tiddlers ?? {})) {
    if (record) out.push([title, plainRecord(record)]);
  }
  return out;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v);
}

/** Does a stored record hold exactly this record (every field and every `meta` key, in any key order)? */
export function sameStoredRecord(stored: StoredLarRecord | null | undefined, record: LarTiddlerRecord | StoredLarRecord): boolean {
  if (!stored) return false;
  return canonicalJson(plainRecord(stored)) === canonicalJson(plainRecord(record));
}
