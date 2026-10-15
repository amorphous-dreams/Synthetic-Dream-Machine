/**
 * base-doc — LarDoc: the one root type for ALL Lararium Automerge documents.
 *
 * Invariant: every Automerge doc in the Lararium system satisfies `LarDoc`:
 *
 *   { schemaVersion, tiddlers, blobs? }
 *
 * Every out-of-tiddlers field carries a corresponding descriptor tiddler so the
 * TW5 wiki surface can introspect it without TS interop. Binary blobs live in
 * `blobs`; their metadata tiddlers live in `tiddlers` at blobDescriptorUri(id).
 *
 * All named doc shapes (LarariumDoc, MemeStoreDoc, IdentitiesDoc, CirclesDoc,
 * SessionsDoc) collapse to LarDoc.
 *
 * Keyhive / Ink & Switch / Zelenka:
 *   Access-control policy ("public" | "private" | "keyhive:{groupUri}") lives
 *   inside the tiddler fields — queryable from TW5 filters, not a runtime flag.
 *   Principal verifyingKey, group BeeKEM hints, session capability tokens are
 *   all tiddler fields so they arrive via CRDT sync alongside the content.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/base-doc
 */

import type { LarTiddlerRecord } from "./tiddler-store.js";
import { plainField, type StoredLarRecord } from "./stored-value.js";

/** A plain record a hand builds: hand it to a store, or wrap it (`storedLarRecord`, `stored-record.ts`)
 *  for a document. */
export function mutableLarRecord(
  title: string,
  fields: Record<string, string>,
  authority: string,
): LarTiddlerRecord {
  return {
    tiddler: { title, ...fields },
    meta: { authority },
  };
}

// ---------------------------------------------------------------------------
// LarDoc — base contract every Lararium Automerge document extends.
// ---------------------------------------------------------------------------

/**
 * LarBlobEntry — a content-addressed artefact REFERENCED by a LarDoc.
 *
 * The entry carries the artefact's METADATA (id, sha256 = CID, version, mimeType);
 * the bytes themselves live in the content-addressed store (CAS), keyed by sha256,
 * NEVER in the CRDT. The optional `blob` field carries inline bytes only for ad-hoc
 * bags (images, attachments not yet promoted to the CAS); the genesis engine + plugin
 * bytes ship as `genesis/cas/<cid>` files named by the immutable seed, so the genesis CRDT holds
 * metadata only and the merge-conflict-on-bytes class vanishes structurally.
 * Each blob MUST have a descriptor tiddler at blobDescriptorUri(id).
 */
export interface LarBlobEntry {
  readonly id:       string;
  readonly version:  string;
  readonly sha256:   string;
  readonly mimeType: string;
  /** Which genesis REGION this blob belongs to — "grammar" | "base" | "plugin". DECLARED at mint and
   *  carried here so a VERIFY classifies exactly as the mint did; a region derived from the path or the
   *  filename instead would drift the moment a file moved, and a drifted region reads as a corrupt genesis. */
  readonly kind?:    string;
  /** Inline bytes — present only for ad-hoc bags; absent for CAS-sourced genesis blobs. */
  readonly blob?:    Uint8Array;
  readonly author?:  string;
  readonly license?: string;
  readonly source?:  string;
}

/**
 * LarDoc — the one root type every Lararium Automerge document satisfies.
 *
 * `tiddlers` — mutable inside Automerge `handle.change()` callbacks; readonly elsewhere. Each value
 *   stands as a `StoredLarRecord`: its strings rest as immutable scalars, so a reader unwraps it through
 *   `stored-value.ts` (`plainRecord` · `plainField` · `tiddlerText`) and a writer wraps through
 *   `storedRecord` · `storedLarRecord` (`stored-record.ts`). The type exposes no field, so a raw read does not compile.
 * `blobs` — optional binary store; any bag may carry image/attachment blobs.
 */
export interface LarDoc {
  readonly schemaVersion: string;
  readonly tiddlers:      Record<string, StoredLarRecord>;
  readonly blobs?:        Record<string, LarBlobEntry>;
}

/** Read the `text` field of a record, stored or plain. Returns null when absent. */
export function tiddlerText(record: StoredLarRecord | { tiddler: { text?: unknown } } | null | undefined): string | null {
  const t = plainField(record as StoredLarRecord | null | undefined, "text");
  return typeof t === "string" ? t : null;
}

/** Safe empty state for repo.create<LarDoc>(). */
export function emptyLarDoc(): LarDoc {
  return { schemaVersion: "0.1", tiddlers: {} };
}

// ── Blob helpers (any bag may carry blobs) ────────────────────────────────

/** TW5 boot kernel key — primary entry in `LarDoc.blobs`. */
export const ENGINE_CORE_ID = "tiddlywikicore";

/**
 * Stable lar: URI for a blob descriptor tiddler.
 * Each blob MUST have a descriptor tiddler at this URI carrying sha256/version/mimeType.
 * Blobs live in the runtime SYSTEM ISLAND (oracle), beside the core engine bytes.
 * e.g. blobDescriptorUri("tiddlywikicore") → "lar:///ha.ka.ba/bags/oracle/blobs/tiddlywikicore"
 */
export function blobDescriptorUri(blobId: string): string {
  const safe = blobId.replace(/^\$:\//, "").replace(/[^a-zA-Z0-9/_.-]/g, "_");
  return `lar:///ha.ka.ba/bags/oracle/blobs/${safe}`;
}
