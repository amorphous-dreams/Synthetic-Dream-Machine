/**
 * cas — platform-blind content-addressed-store helpers (the breath path).
 *
 * Heavy immutable engine bytes (the TW5 core + the plugin tiddlers) ride a local
 * content-addressed store, keyed by sha256 hex (the CID), written once by the
 * vessel on genesis-load and pulled by each island worker via `resolveByCid` —
 * NEVER CRDT-synced over the sync port. Every vessel — Herm, Lararium, browser —
 * composes the SAME two derivations here over its own platform I/O (OPFS · nodefs):
 * vessels-as-nameless-entities-with-#has-caps align isomorphically by composition,
 * never by a platform interface.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/cas
 */

import { ENGINE_CORE_ID } from "./base-doc.js";
import { cidFromUri } from "./lar-uris.js";

/** A blob entry shape the CAS reads — id + sha256 (the CID) + the raw bytes. */
export interface CasBlobLike {
  readonly id?:       string;
  readonly sha256?:   string;
  readonly mimeType?: string;
  readonly blob?:     unknown;
}

// ── Genesis CAS manifest (the byte SOURCE the genesis doc no longer carries) ──
//
// The genesis CRDT (materialized only for verification) holds blob METADATA only; the engine + plugin
// bytes ship as content-addressed `genesis/cas/<cid>` files. This manifest names
// which files belong to a genesis artifact so the loader (node fs · browser OPFS)
// mirrors exactly them into the runtime CAS the workers read via resolveByCid. The
// `cid` field IS the sha256 hex = the CAS filename = the key the worker requests.

export const GENESIS_CAS_MANIFEST_FORMAT = "lararium-genesis-cas/v1" as const;

/** One CAS-resident genesis blob — metadata mirror of a LarBlobEntry, no bytes. */
export interface GenesisCasManifestEntry {
  /** sha256 hex — the CAS filename AND the key the worker requests. */
  readonly cid:      string;
  /** Blob id (e.g. "tiddlywikicore" or the plugin URI). */
  readonly id:       string;
  readonly mimeType: string;
  readonly version:  string;
}

/** The genesis CAS manifest — the three region CIDs plus every blob's cid. */
export interface GenesisCasManifest {
  readonly format:     typeof GENESIS_CAS_MANIFEST_FORMAT;
  /** engine region content-CID — the hearth true-name, the SLOW ratchet. */
  readonly engineCid:  string;
  /** grammar region content-CID — the required grammar alone, kāhuli's FAST ratchet. Without it the
   *  manifest could not tell two bakes apart by the one fact an overturn moves. */
  readonly grammarCid: string;
  /** plugins region content-CID — this operator's own collection. A REGION, never a kāhuli tier. */
  readonly pluginsCid: string;
  /** Every CAS blob this genesis artifact ships, sorted by id (deterministic). */
  readonly blobs:      readonly GenesisCasManifestEntry[];
}

/**
 * Build a deterministic genesis CAS manifest from blob metadata + the three region
 * CIDs. Sorted by id so write-order never perturbs the serialized bytes — the
 * manifest JSON is byte-stable across re-bakes; deterministic CRDT bytes remain a test witness only.
 */
export function buildGenesisCasManifest(
  engineCid:  string,
  grammarCid: string,
  pluginsCid: string,
  blobs:      readonly { readonly id: string; readonly sha256: string; readonly mimeType: string; readonly version: string }[],
): GenesisCasManifest {
  const entries = blobs
    .map((b) => ({ cid: b.sha256, id: b.id, mimeType: b.mimeType, version: b.version }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { format: GENESIS_CAS_MANIFEST_FORMAT, engineCid, grammarCid, pluginsCid, blobs: entries };
}

/**
 * The engine's plugin-tiddler CIDs from an island doc's blobs — every non-engine
 * JSON blob, by sha256. The daemon AND every wiki island resolve these by CID from
 * the local CAS (the breath path), never CRDT-syncing the bytes. One derivation,
 * fed to every island of the runtime.
 */
export function pluginCidsFromIslandBlobs(
  blobs: Record<string, CasBlobLike> | undefined,
): readonly string[] {
  return Object.values(blobs ?? {})
    .filter((b) => b.id !== ENGINE_CORE_ID && b.mimeType === "application/json" && typeof b.sha256 === "string")
    .map((b) => b.sha256 as string);
}

/**
 * Yield every writable {cid, bytes} pair from an island doc's blobs — the engine
 * core AND the plugin tiddlers, each keyed by its sha256 (the CID). Platform write
 * loops (OPFS · nodefs) consume this one iteration; the worker reads back by the
 * same key, so the CID it requests IS the hash it re-verifies.
 */
export function* casBlobEntries(
  blobs: Record<string, CasBlobLike> | undefined,
): Iterable<{ cid: string; bytes: Uint8Array }> {
  for (const e of Object.values(blobs ?? {})) {
    if (!e.sha256 || !e.blob) continue;
    const bytes = e.blob instanceof Uint8Array ? e.blob : new Uint8Array(e.blob as ArrayBufferLike);
    yield { cid: e.sha256, bytes };
  }
}

// ── The derived reference count (tiddler-carriage #/pin-and-release) ──────────
//
// A blob is RETAINED while any tiddler in any locally-held bag references its CID. No field
// stores that count — it DERIVES from the records, so it can never drift from them: a record
// carrying `textCid` (the skinny handle's CAS key), else a `lar:///…/cid/<hash>` `_canonical_uri`
// (the same scheme discrimination the lazy resolver reads), references exactly one blob.

/** One locally-held record the reference reader walks — a CompositeEntry's title · bag · record. */
export interface CasReferenceEntry {
  readonly title:  string;
  /** The holding bag — a record held by two bags counts twice, so DROP of one leaves the other. */
  readonly bagId?: string;
  readonly record: { readonly tiddler: Record<string, unknown> };
}

/** Read the CAS key a record references, or null when it carries a body inline / a web2 src. */
export function casCidOfRecord(fields: Record<string, unknown>): string | null {
  const textCid = fields["textCid"];
  if (typeof textCid === "string" && textCid.length > 0) return textCid;
  const canonical = fields["_canonical_uri"];
  if (typeof canonical === "string") return cidFromUri(canonical);
  return null;
}

/**
 * Derive `cid → the addresses ({bag} {title}) that reference it` over every locally-held record.
 * A cid absent from the map is UNREFERENCED — sweepable once its grace passes and no PIN names it.
 */
export function casReferences(entries: Iterable<CasReferenceEntry>): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  for (const e of entries) {
    const cid = casCidOfRecord(e.record.tiddler);
    if (!cid) continue;
    const address = e.bagId ? `${e.bagId} ${e.title}` : e.title;
    const set = refs.get(cid) ?? new Set<string>();
    set.add(address);
    refs.set(cid, set);
  }
  return refs;
}

/** The store-level read a `cas` inspection reports: blobs · referenced · unreferenced · pending · bytes. */
export interface CasSummary {
  readonly blobs:        number;
  readonly referenced:   number;
  readonly unreferenced: number;
  /** Referenced cids the store LACKS — a pointer whose bytes have not arrived (the fleet peer after a record crossed). */
  readonly pending:      number;
  readonly bytes:        number;
}

/** Fold a store's `{cid, size}` listing against the derived references. */
export function summarizeCas(
  blobs: Iterable<{ readonly cid: string; readonly size: number }>,
  refs:  ReadonlyMap<string, ReadonlySet<string>>,
): CasSummary {
  let count = 0, referenced = 0, bytes = 0;
  const held = new Set<string>();
  for (const b of blobs) {
    count += 1;
    bytes += b.size;
    held.add(b.cid);
    if ((refs.get(b.cid)?.size ?? 0) > 0) referenced += 1;
  }
  let pending = 0;
  for (const [cid, set] of refs) if (set.size > 0 && !held.has(cid)) pending += 1;
  return { blobs: count, referenced, unreferenced: count - referenced, pending, bytes };
}
