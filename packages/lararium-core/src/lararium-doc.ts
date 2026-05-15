/**
 * LarariumDoc — Automerge corpus doc for the TW5 engine and bundled plugins.
 *
 * Each blob is stored as Uint8Array (Automerge binary, not CRDT string).
 * This gives O(1) sync cost after the initial transfer — the blob is treated
 * as an immutable unit, not a character sequence.
 *
 * Key conventions:
 *   "tiddlywikicore"            — the TW5 boot kernel (tiddlywikicore-*.js)
 *   "$:/plugins/<author>/<id>"  — vendored TW5 plugins (JSON plugin bundle bytes)
 *
 * Island law: engine doc is separate from the catalog. Catalog holds the URL
 * reference only. Engine doc may be large (~2.5MB) — catalog stays small.
 *
 * LarDoc alignment (M24): LarariumDoc extends LarDoc.  The `blobs` field lives
 * outside `tiddlers` — therefore each blob MUST have a self-describing tiddler
 * in `tiddlers` at `blobDescriptorUri(blob.id)`.  `systemTitles` likewise gets
 * a descriptor tiddler.
 *
 * Keyhive: each blob entry carries a sha256 for content-addressing.
 * Signature verification is added at the Keyhive layer (planned).
 */

import type { LarDoc, MutableLarRecord } from "./base-doc.js";
export type { MutableLarRecord } from "./base-doc.js";

export interface LarariumBlobEntry {
  /** Stable id — "tiddlywikicore" or TW5 plugin title like "$:/plugins/sq/streams". */
  readonly id:       string;
  readonly version:  string;
  readonly sha256:   string;   // hex-encoded SHA-256 of blob bytes
  readonly mimeType: string;   // "application/javascript" | "application/json"
  /** Binary blob. Automerge stores as immutable bytes — no per-byte CRDT overhead. */
  readonly blob:     Uint8Array;
  readonly author?:  string;
  readonly license?: string;
  readonly source?:  string;
}

/**
 * LarariumDoc extends LarDoc — `tiddlers` required (not optional).
 *
 * Out-of-tiddlers fields:
 *   `blobs`        — binary engine artefacts; each blob MUST have a tiddler
 *                    at blobDescriptorUri(blob.id) carrying sha256, version, etc.
 *   `systemTitles` — written once at seed time; descriptor tiddler at
 *                    lar:///ha.ka.ba/@lararium/system/titles
 */
export interface LarariumDoc extends LarDoc {
  readonly tiddlers: Record<string, Readonly<MutableLarRecord>>;
  /** Keyed by LarariumBlobEntry.id. */
  readonly blobs: Record<string, LarariumBlobEntry>;
  /**
   * Sorted list of $:/ tiddler titles present in a freshly booted TW5 VM
   * before any corpus tiddlers are loaded.  Written once at seedLarariumDoc time.
   *
   * Authority boundary: any $:/ title in this list is engine-owned.
   * Corpus Automerge docs MUST NOT store these titles.
   * TW5 state that falls outside this set (plugin config, personal state)
   * belongs in the personal or session/presence doc.
   *
   * Keyhive: this manifest will be signed as part of the lararium island
   * authority proof — changes require a new signed engine doc.
   */
  readonly systemTitles?: readonly string[];
}

export function emptyLarariumDoc(): LarariumDoc {
  return { schemaVersion: "0.1", blobs: {}, tiddlers: {}, systemTitles: [] };
}

export const ENGINE_CORE_ID = "tiddlywikicore";

/**
 * Stable lar: URI for a blob descriptor tiddler.
 *
 * The descriptor tiddler title = `lar:///ha.ka.ba/@lararium/blobs/{blobId}`.
 * Stored in LarariumDoc.tiddlers — carries sha256, version, mimeType as fields
 * but NOT the binary data (which stays in LarariumDoc.blobs).
 *
 * Self-describing law: any peer that syncs LarariumDoc can read blob metadata
 * via the TW5 wiki (filter on tag[blob-descriptor]) without TS interop.
 *
 * @param blobId  - LarariumBlobEntry.id, e.g. "tiddlywikicore" or "$:/plugins/sq/streams"
 * @returns       - e.g. "lar:///ha.ka.ba/@lararium/blobs/tiddlywikicore"
 */
export function blobDescriptorUri(blobId: string): string {
  // Sanitise plugin titles: "$:/plugins/sq/streams" → "plugins/sq/streams"
  const safe = blobId.replace(/^\$:\//, "").replace(/[^a-zA-Z0-9/_.-]/g, "_");
  return `lar:///ha.ka.ba/@lararium/blobs/${safe}`;
}

/**
 * lar: URI grammar — six root docs in two planes.
 *
 * Position semantics (zero-indexed path segments after lar:///)
 *
 *   pos 0  — what3words tagspace host, e.g. "ha.ka.ba"
 *   pos 1  — @-prefixed root doc identity (EXACTLY six reserved slots, see below)
 *   pos 2  — @-prefixed child doc identity   e.g. @catalog/@elyncia
 *            OR plain leaf path segment      e.g. @lararium/wikis/altar-fire
 *   pos 3+ — plain leaf path segments, never @-prefixed
 *
 * Rule: @ ONLY at pos 1 (root doc) or pos 2 (child doc under a root).
 *       @ NEVER at pos 3+.
 *       Any bare @name at pos 1 = exactly one Automerge doc identity.
 *
 * CONTENT PLANE (Content Tiga — engine / corpus / person):
 *   @lararium   LarariumDoc  — ha: engine, grammar, admin wikis, ha-recipes
 *   @catalog    CatalogDoc   — ka: corpus discovery, user wikis, ka-recipes
 *   @lares      LaresDoc     — ba: persona/doctrine, ba-recipes
 *
 * SOCIAL PLANE (Social Tiga - identity / authority / session):
 *   @identities  IdentitiesDoc — ha: stable principal records (operators, agents, services)
 *   @circles     CirclesDoc    — ka: collective authority + durable membership
 *   @sessions    SessionsDoc   — ba: live operator-agent session docs
 *
 * Child-docs live under parent docs (pos-2 @ slot):
 *   lar:///ha.ka.ba/@lararium/@admin   → admin wiki doc (distinct from wiki leaf doc at pos-3)
 *   lar:///ha.ka.ba/@catalog/@elyncia   → elyncia corpus doc
 *   lar:///ha.ka.ba/@catalog/@ftls      → ftls corpus doc
 *
 * Wikis remain leaf paths (no @ at pos 2):
 *   lar:///ha.ka.ba/@lararium/wikis/{slug}  → admin/operator wiki (ha branch)
 *   lar:///ha.ka.ba/@catalog/wikis/{slug}   → user wiki (ka branch, M22+)
 *
 * Oracle chain:
 *   fragment → LarariumDoc → tiddlers[CATALOG_DOC_URI]     → CatalogDoc
 *                          → tiddlers[LARES_DOC_URI]       → LaresDoc
 *                          → tiddlers[IDENTITIES_DOC_URI]  → IdentitiesDoc
 *                          → tiddlers[CIRCLES_DOC_URI]     → CirclesDoc
 *                          → tiddlers[SESSIONS_DOC_URI]     → SessionsDoc
 *   CatalogDoc → tiddlers[corpusLarUri(slug)]  → corpus child-docs
 *              → tiddlers[wikiLarUri(slug)]    → wiki leaf docs
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga
 */

// ── Content plane — engine / corpuses / personas ──────────────────────────────────────────

/** ha vertex — engine / grammar / admin wikis / system-recipes. */
export const LARARIUM_DOC_URI = "lar:///ha.ka.ba/@lararium";

/** ka vertex — corpus discovery / user wikis / corpus-recipes. */
export const CATALOG_DOC_URI = "lar:///ha.ka.ba/@catalog";

/** ba vertex — persona / doctrine / agent-recipes. */
export const LARES_DOC_URI = "lar:///ha.ka.ba/@lares";

// ── Social plane — identity / authority / session ───────────────────────────

/** ha vertex — Stable principal records — operators, agents, services, devices. */
export const IDENTITIES_DOC_URI = "lar:///ha.ka.ba/@identities";

/** ka vertex — Collective authority + durable group membership. */
export const CIRCLES_DOC_URI = "lar:///ha.ka.ba/@circles";

/** ba vertex — Live operator-agent session docs; hostful overlays project into these. */
export const SESSIONS_DOC_URI = "lar:///ha.ka.ba/@sessions";

/**
 * Derive the stable lar: URI identity for a named corpus child-doc.
 * Corpus docs sit at pos-2 under the @catalog root doc.
 * e.g. corpusLarUri("elyncia") → "lar:///ha.ka.ba/@catalog/@elyncia"
 */
export function corpusLarUri(slug: string): string {
  return `lar:///ha.ka.ba/@catalog/@${slug}`;
}

/**
 * Derive the stable lar: URI identity for a wiki.
 * Wikis live in the @lararium sub-namespace — no collision with @-scope doc roots.
 * e.g. wikiLarUri("altar-fire") → "lar:///ha.ka.ba/@lararium/wikis/altar-fire"
 *
 * This URI forms the map key in CatalogDoc.wikis.
 * The CatalogRoomEntry.id field retains the short slug for readability.
 */
export function wikiLarUri(slug: string): string {
  return `lar:///ha.ka.ba/@lararium/wikis/${slug}`;
}

/**
 * Derive the per-wiki draft bagId. Each wiki mints its own draft Automerge
 * doc; the composite-layer bagId encodes which wiki owns the drafts so
 * multiple wikis can mount simultaneously without intermingling.
 *
 * e.g. wikiDraftLarUri("altar-fire") → "lar:///ha.ka.ba/@lararium/wikis/altar-fire/draft"
 *
 * Replaces the static `BAG_IDS.draft` constant in composite-layer bagId
 * usage. The Automerge doc URL itself still lives in the catalog under
 * `${wikiLarUri(slug)}/drafts/${peerDid}`.
 */
export function wikiDraftLarUri(slug: string): string {
  return `${wikiLarUri(slug)}/draft`;
}

/**
 * Admin wiki — operator-private state for a single Lararium node.
 *
 * Federation: scoped to the operator's own devices (via cap=infrastructure
 * device delegations, S7.1 / ingress gate S7.4). Never federates to wiki peers.
 *
 * Holds:
 *   - DeviceDelegationTiddlers (operator-private credential proofs)
 *   - ProjectionTiddlers tagged $:/tags/LarariumProjection (declarative manifest)
 *   - SessionTiddlers (operator → agent, not wiki → agent)
 *   - Future: ceremony state (key rotation, invite acceptance)
 */
export const ADMIN_WIKI_SLUG = "admin";
export const ADMIN_WIKI_URI  = wikiLarUri(ADMIN_WIKI_SLUG);
/**
 * Admin Automerge doc URI — direct child of @lararium, sibling to
 * @identities / @circles / @sessions in the @-scope namespace.
 * Distinct from ADMIN_ROOM_URI: the logical wiki lives at pos-3 under /wikis/;
 * the doc itself sits at pos-2 as its own namespaced child.
 */
export const ADMIN_BAG_ID = "lar:///ha.ka.ba/@lararium/@admin";
