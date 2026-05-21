/**
 * tw5-fields-flat — normalise a TW5TiddlerFields bag to Record<string, string>.
 *
 * TW5 runtime field bags carry arrays (tags, list), Dates (created, modified),
 * and arbitrary unknowns. Store-bound paths (IslandAdaptor, promote, sync) need
 * a flat string map. This module owns that normalisation once.
 *
 * Meme: lar:///ha.ka.ba/@lararium/tw5/tw5-fields-flat
 */

import type { TW5TiddlerFields } from "./types/tiddlywiki.d.ts";

export function tw5FieldsToRecord(fields: Readonly<TW5TiddlerFields>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (value instanceof Date) { out[key] = value.toISOString(); continue; }
    if (Array.isArray(value))  { out[key] = (value as unknown[]).map(String).join(" "); continue; }
    out[key] = String(value);
  }
  return out;
}
