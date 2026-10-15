/**
 * bag-stack-from-rec — extract the bag-stack from a LarTiddlerRecord.
 *
 * Recipe tiddlers carry `bag-stack` as a space-separated string field.
 * `parseBagStack` tolerates undefined, but call sites carry a repeated
 * inline coercion. This helper owns that coercion once.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/bag-stack-from-rec
 */

import type { LarTiddlerRecord } from "./tiddler-store.js";

/**
 * Parse a `bag-stack` value from a tiddler field into a string array — a TW5 list string
 * (space-separated; no spaces appear in lar: URIs so no [[...]] quoting) or a JS/JSON array.
 * Returns [] for null / undefined / unrecognised types.
 */
export function parseBagStack(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter((x): x is string => typeof x === "string");
  }
  if (typeof raw === "string") {
    return raw.trim().split(/\s+/).filter(Boolean);
  }
  return [];
}

export function bagStackFromRec(rec: LarTiddlerRecord): string[] {
  const raw = rec.tiddler["bag-stack"];
  return parseBagStack(typeof raw === "string" ? raw : undefined);
}
