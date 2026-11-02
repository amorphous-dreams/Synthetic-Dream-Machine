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

// ── THE KEY DOOR ─────────────────────────────────────────────────────────────────────────────────
//
// A map the house reads BY KEY (a doc's `tiddlers`, a record's fields, a board's rows) answers its OWN
// properties only. Automerge materializes a key spelled `__proto__` as the object's PROTOTYPE, so a hostile
// writer's `tiddlers.__proto__ = { t: … }` makes a bare `tiddlers[t]` and `t in tiddlers` answer a phantom
// record while `Object.keys` stays empty; and `constructor` answers every plain object's inherited function.
// A doc carrying such a key loads under every engine version (only a LOCAL write throws, from 3.5.0), so
// the read door cannot lean on the write side: it reads `Object.hasOwn`, and a prototype key never answers.
// The ingest shore (`prototype-key-shore.ts`) refuses the bytes by name; the write door (`title-law.ts`,
// `stored-record.ts`) refuses a local key by name. KEEP: these refuse a LIVE hostile form, never a retired
// spelling, so no pyre burns them.

/** The keys a by-key map never answers or stores: the names the object prototype chain owns. */
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** Whether a key names the prototype chain rather than an entry. */
export function isPrototypeKey(key: string): boolean {
  return PROTOTYPE_KEYS.has(key);
}

/**
 * The entry a by-key map holds AS ITS OWN under `key`, or undefined: never an inherited or phantom value.
 * ONE DOOR FOR EVERY MAP: a doc's `tiddlers` and `blobs`, a record's fields and its `meta`, a floor's rows.
 * `__proto__` never answers (inside a change the proxy reports it own, and it names the prototype); a
 * `constructor` or `prototype` key answers only where the map holds it as its own, which a field may (user
 * space) and a title never does (the title law and the ingest shore refuse it by name).
 */
export function ownEntry<T>(map: Readonly<Record<string, T>> | null | undefined, key: string): T | undefined {
  if (map === null || map === undefined || key === "__proto__") return undefined;
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/** Whether a by-key map holds `key` as its own entry: the `in` a reader asks, with no prototype answering. */
export function hasOwnEntry(map: object | null | undefined, key: string): boolean {
  return map !== null && map !== undefined && key !== "__proto__" && Object.hasOwn(map, key);
}

/** True for a class's own prototype (`ImmutableString`, `Date`, `Uint8Array` …): a value, never a forged map. */
function isClassPrototype(proto: object): boolean {
  const ctor = (proto as { constructor?: unknown }).constructor;
  return typeof ctor === "function" && (ctor as { prototype?: unknown }).prototype === proto;
}

/**
 * Where a MATERIALIZED doc carries a prototype key, or null where it carries none. A map whose prototype is
 * neither `Object.prototype`, null, nor a class's own prototype holds a `__proto__` key (the engine seated
 * it as the prototype, so no own-key listing ever shows it); a `tiddlers` map naming `constructor` or
 * `prototype` as a title holds a key no record may take. A field named `constructor` stands: an own key
 * reads as itself through the read door, and refusing it would refuse a user's field name.
 */
export function prototypeKeyFault(value: unknown, path = "doc", depth = 0): string | null {
  if (typeof value !== "object" || value === null || depth > 64) return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const f = prototypeKeyFault(value[i], `${path}[${i}]`, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  if (proto !== null && proto !== Object.prototype) {
    return isClassPrototype(proto) ? null : `${path} carries a \`__proto__\` key`;
  }
  for (const key of Object.keys(value)) {
    if (isPrototypeKey(key) && (key === "__proto__" || path.endsWith(".tiddlers"))) return `${path} carries a \`${key}\` key`;
    const f = prototypeKeyFault((value as Record<string, unknown>)[key], `${path}.${key}`, depth + 1);
    if (f) return f;
  }
  return null;
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
    // `__proto__` never copies: inside a change the proxy lists it own, and assigning it would seat a prototype.
    for (const [key, inner] of Object.entries(value)) if (key !== "__proto__") out[key] = plainValue(inner);
    return out;
  }
  return value;
}

/** One field of a stored record, unwrapped; `undefined` where the record or the field stands absent. */
export function plainField(record: StoredLarRecord | null | undefined, field: string): unknown {
  const tiddler = ownEntry(record as Record<string, Record<string, unknown>> | null | undefined, "tiddler");
  return tiddler ? plainValue(ownEntry(tiddler, field)) : undefined;
}

/** One `meta` key of a stored record, unwrapped. */
export function plainMeta(record: StoredLarRecord | null | undefined, key: string): unknown {
  const meta = ownEntry(record as Record<string, Record<string, unknown>> | null | undefined, "meta");
  return meta ? plainValue(ownEntry(meta, key)) : undefined;
}

/** Does the stored record read as a tombstone? */
export function storedDeleted(record: StoredLarRecord | null | undefined): boolean {
  return (record as { meta?: { deleted?: unknown } } | null | undefined)?.meta?.deleted === true;
}

/** A stored record as a frozen plain record: what every reader past the shore holds. */
export function plainRecord(record: StoredLarRecord): LarTiddlerRecord {
  const raw = record as unknown as Record<string, Record<string, unknown>>;
  const meta = ownEntry(raw, "meta");
  const tiddler = Object.freeze(plainValue(ownEntry(raw, "tiddler") ?? {}) as LarTiddlerRecord["tiddler"]);
  return Object.freeze(meta !== undefined
    ? { tiddler, meta: Object.freeze(plainValue(meta) as NonNullable<LarTiddlerRecord["meta"]>) }
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
    // Inside a change the proxy lists a `__proto__` key as its own; it names no record (THE KEY DOOR below).
    if (record && !isPrototypeKey(title)) out.push([title, plainRecord(record)]);
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
