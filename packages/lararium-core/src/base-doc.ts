/**
 * base-doc — MutableLarRecord + LarDoc: the canonical base for ALL Lararium Automerge documents.
 *
 * Invariant: every Automerge doc in the Lararium system MUST satisfy `LarDoc`:
 *
 *   { schemaVersion: string, tiddlers: Record<title, MutableLarRecord> }
 *
 * Consequence: "if anything exists outside of `doc.tiddlers`, it needs a
 * self-describing meme in `doc.tiddlers`."  Binary blobs, typed principal
 * records, group membership, session tokens — every out-of-tiddlers field
 * carries a corresponding descriptor tiddler so the TW5 wiki surface can
 * introspect and display it without TS interop.
 *
 * Alignment:
 *   LarariumDoc  extends LarDoc  (adds blobs, systemTitles)
 *   CatalogDoc   extends LarDoc  (adds corpora/rooms legacy, deprecated)
 *   MemeStoreDoc extends LarDoc  (tiddlers IS the payload — no extra fields)
 *   IdentitiesDoc extends LarDoc (tiddler-first: each principal = one tiddler)
 *   GroupsDoc    extends LarDoc  (tiddler-first: each group = one tiddler)
 *   SessionsDoc  extends LarDoc  (tiddler-first: each session = one tiddler)
 *
 * Keyhive / Ink & Switch / Zelenka:
 *   Access-control policy ("public" | "private" | "keyhive:{groupUri}") lives
 *   inside the tiddler fields — queryable from TW5 filters, not a runtime flag.
 *   Principal verifyingKey, group BeeKEM hints, session capability tokens are
 *   all tiddler fields so they arrive via CRDT sync alongside the content.
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/base-doc
 */

// ---------------------------------------------------------------------------
// MutableLarRecord — canonical Automerge tiddler record.
//
// Lives here (not meme-store-doc.ts) to break the LarDoc ↔ MemeStoreDoc
// circular dependency.  meme-store-doc.ts re-exports for backward-compat.
// ---------------------------------------------------------------------------

export interface MutableLarRecord {
  title:        string;
  fields:       Record<string, string>;
  text?:        string;
  deleted?:     boolean;
  sourceUri?:   string;
  contentHash?: string;
  revision?:    string;
  authority?:   string;
  /** Bag ID (lar: URI of owning doc) — stamped at write time. */
  bag?:         string;
}

// ---------------------------------------------------------------------------
// LarDoc — base contract every Lararium Automerge document extends.
// ---------------------------------------------------------------------------

/**
 * LarDoc — the base contract every Lararium Automerge document extends.
 *
 * `tiddlers` uses `MutableLarRecord` (not `Readonly<>`) so implementors can
 * choose: read-only docs narrow to `Readonly<MutableLarRecord>` at the usage
 * site; writable docs (rooms, corpus, LaresDoc) keep the mutable form.
 */
export interface LarDoc {
  readonly schemaVersion: string;
  /**
   * All semantic content lives here as first-class tiddlers.
   * Key = tiddler title (lar:/// URI for named content; short slug for room local tiddlers).
   *
   * Every out-of-tiddlers field on a concrete doc (blobs, systemTitles, etc.)
   * MUST have a corresponding self-describing tiddler in this map so the TW5
   * wiki surface can introspect it without TS interop.
   */
  readonly tiddlers: Record<string, MutableLarRecord>;
}
