/**
 * closure-fields — ClosureEntry ↔ TW5 tiddler field mapping.
 *
 * Projection codec for the closure/edge graph → TW5 tiddler boundary.
 * These functions operate at the tiddler-record boundary defined by
 * lar:///ha.ka.ba/api/v0.1/lararium/schema/tiddler-record.
 */

import type { ClosureEntry, EdgeRecord } from "@lararium/core";

/**
 * Map a ClosureEntry to a flat TW5 tiddler field record.
 *
 * implements URIs + UI tags both live in TW5 tags — interface membership IS
 * tag membership. [tag[lar:///pono/invariant]] and [tag[$:/tags/LarariumKumu]]
 * both work.
 */
export function entryToFields(
  entry: ClosureEntry,
  extra?: Record<string, string>,
): Record<string, string | string[]> {
  return {
    title:        entry.uri,
    tags:         [...(entry.implements ?? []), ...(entry.tags ?? [])],
    implements:   entry.implements.join(" "),
    depth:        String(entry.depth),
    rating:       entry.kind,
    confidence:   String(entry.confidence),
    register:     entry.register,
    manaoio:      String(entry.manaoio),
    mana:         String(entry.mana),
    manao:        String(entry.manao),
    role:         entry.role ?? "",
    exists:       String(entry.exists),
    laresRelPath: entry.laresRelPath ?? "",
    contentHash:  entry.contentHash,
    ...extra,
  };
}

/**
 * Pre-build a map from URI → flat edge field record from a list of EdgeRecords.
 *
 * Each EdgeRecord contributes:
 *   edge-out-FAMILY          space-separated list of toUri values
 *   edge-out-FAMILY-ROLE     space-separated list of toUri values (when role set)
 */
export function buildEdgeFieldMap(edges: readonly EdgeRecord[]): Map<string, Record<string, string>> {
  const byUri = new Map<string, Record<string, string[]>>();
  for (const e of edges) {
    let fields = byUri.get(e.fromUri);
    if (!fields) { fields = {}; byUri.set(e.fromUri, fields); }
    const fKey = `edge-out-${e.family}`;
    (fields[fKey] ??= []).push(e.toUri);
    if (e.role) {
      const frKey = `edge-out-${e.family}-${e.role}`;
      (fields[frKey] ??= []).push(e.toUri);
    }
  }
  const result = new Map<string, Record<string, string>>();
  for (const [uri, fields] of byUri) {
    const str: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) str[k] = v.join(" ");
    result.set(uri, str);
  }
  return result;
}
