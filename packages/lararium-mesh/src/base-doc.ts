/**
 * base-doc — MutableLarRecord + LarDoc: the one root type for ALL Lararium Automerge documents.
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
 * SessionsDoc) collapse to type aliases of LarDoc. CatalogDoc adds deprecated
 * legacy fields and will alias once the migration completes.
 *
 * Keyhive / Ink & Switch / Zelenka:
 *   Access-control policy ("public" | "private" | "keyhive:{groupUri}") lives
 *   inside the tiddler fields — queryable from TW5 filters, not a runtime flag.
 *   Principal verifyingKey, group BeeKEM hints, session capability tokens are
 *   all tiddler fields so they arrive via CRDT sync alongside the content.
 *
 * Meme: lar:///ha.ka.ba/@lararium/mesh/v0.1/base-doc
 */

// ---------------------------------------------------------------------------
// MutableLarRecord — canonical Automerge tiddler record.
//
// Lives here (not meme-store-doc.ts) to break the LarDoc ↔ MemeStoreDoc
// circular dependency.  meme-store-doc.ts re-exports for backward-compat.
// ---------------------------------------------------------------------------

export interface MutableLarRecord {
  tiddler: {
    title:        string;
    text?:        string;
    tags?:        string | string[];
    type?:        string;
    created?:     string;
    modified?:    string;
    creator?:     string;
    modifier?:    string;
    [field: string]: string | string[] | undefined;
  };
  meta?: {
    deleted?:     boolean;
    sourceUri?:   string;
    contentHash?: string;
    authority?:   string;
    recipe?:      string;
  };
}

export function mutableLarRecord(
  title: string,
  fields: Record<string, string>,
  authority: string,
): MutableLarRecord {
  return {
    tiddler: { title, ...fields },
    meta: { authority },
  };
}

// ---------------------------------------------------------------------------
// LarDoc — base contract every Lararium Automerge document extends.
// ---------------------------------------------------------------------------

/**
 * LarBlobEntry — binary artefact stored in a LarDoc.
 *
 * Automerge stores the blob as an immutable Uint8Array — O(1) sync cost after
 * the initial transfer. Any bag may carry blobs: engine bundles, images,
 * attachments. Each blob MUST have a descriptor tiddler at blobDescriptorUri(id).
 */
export interface LarBlobEntry {
  readonly id:       string;
  readonly version:  string;
  readonly sha256:   string;
  readonly mimeType: string;
  readonly blob:     Uint8Array;
  readonly author?:  string;
  readonly license?: string;
  readonly source?:  string;
}

/**
 * LarDoc — the one root type every Lararium Automerge document satisfies.
 *
 * `tiddlers` uses `MutableLarRecord` (not `Readonly<>`) so call sites can
 * choose: read-only bags narrow to `Readonly<MutableLarRecord>` at the usage
 * site; writable bags keep the mutable form.
 *
 * `blobs` — optional binary store; any bag may carry image/attachment blobs.
 * `systemTitles` — optional engine manifest; set once at genesis, read by VMs.
 */
export interface LarDoc {
  readonly schemaVersion: string;
  readonly tiddlers:      Record<string, MutableLarRecord>;
  readonly blobs?:        Record<string, LarBlobEntry>;
  readonly systemTitles?: readonly string[];
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
 * e.g. blobDescriptorUri("tiddlywikicore") → "lar:///ha.ka.ba/@lararium/blobs/tiddlywikicore"
 */
export function blobDescriptorUri(blobId: string): string {
  const safe = blobId.replace(/^\$:\//, "").replace(/[^a-zA-Z0-9/_.-]/g, "_");
  return `lar:///ha.ka.ba/@lararium/blobs/${safe}`;
}
