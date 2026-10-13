/**
 * stored-record — the WRITE door: a record as a document rests it.
 *
 * Every string becomes an Automerge immutable scalar, one operation per field, never a Text object of
 * one operation per character. `stored-value.ts` states the law and holds the read door; this module
 * holds the half that needs the scalar's class, so a reader that never writes loads no CRDT engine.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/stored-value
 */

import { ImmutableString } from "@automerge/automerge";
import type { LarTiddlerRecord } from "./tiddler-store.js";
import { mutableLarRecord } from "./base-doc.js";
import { isPlainMap, isWrappedString, type StoredLarRecord, type WrappedLarRecord } from "./stored-value.js";

/** A value as a document rests it: every string becomes an immutable scalar, a Date its ISO form. */
export function storedValue(value: unknown): unknown {
  if (typeof value === "string") return new ImmutableString(value);
  if (value instanceof Date) return new ImmutableString(value.toISOString());
  if (isWrappedString(value)) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) out.push(storedValue(value[i]));
    return out;
  }
  if (isPlainMap(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (inner !== undefined) out[key] = storedValue(inner);
    }
    return out;
  }
  return value;
}

/** A record as a document rests it. Assign the result into a document's `tiddlers` map. */
export function storedRecord(record: LarTiddlerRecord | StoredLarRecord): WrappedLarRecord {
  const raw = record as { tiddler: Record<string, unknown>; meta?: Record<string, unknown> };
  return {
    tiddler: storedValue(raw.tiddler),
    ...(raw.meta !== undefined ? { meta: storedValue(raw.meta) } : {}),
  } as unknown as WrappedLarRecord;
}

/** `mutableLarRecord` as a document rests it: assign the result into a document's `tiddlers` map. */
export function storedLarRecord(
  title: string,
  fields: Record<string, string>,
  authority: string,
): WrappedLarRecord {
  return storedRecord(mutableLarRecord(title, fields, authority));
}
