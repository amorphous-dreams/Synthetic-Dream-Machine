/**
 * social-doc — Automerge doc shapes for the social plane.
 *
 * Social plane = three root docs parallel to the content Tiga (ha/ka/ba):
 *
 *   @identities  IdentitiesDoc  — stable principal records
 *   @circles      CirclesDoc      — collective authority + durable membership
 *   @sessions    SessionsDoc    — live operator-agent session docs
 *
 * TIDDLER-FIRST (M24 alignment):
 *   All principal / group / session data lives in `tiddlers`.  No separate
 *   typed Records outside `tiddlers` — that would violate the LarDoc invariant:
 *   "anything outside tiddlers needs a self-describing meme in tiddlers."
 *
 *   Each entity = one tiddler at its canonical lar: URI:
 *     principal  →  identityTiddlerUri(did)   = "@identities/{did}"
 *     group      →  circleTiddlerUri(id)        = "@circles/{id}"
 *     session    →  sessionTiddlerUri(id)      = "@sessions/{id}"
 *
 * KEYHIVE / INK & SWITCH / ZELENKA:
 *   Capability-based access control without a central authority.  Fields mirror
 *   the Keyhive three-layer stack (convergent capabilities + Group CRDT + BeeKEM):
 *
 *   IdentityTiddler.verifyingKey     — Ed25519 public key (hex); basis for DID
 *                                      capability delegation and actor-ID derivation
 *   CircleTiddler.encryptedShareHint  — BeeKEM encrypted share hint for key recovery
 *                                      across group membership changes
 *   CircleTiddler.capabilityPolicy    — policy expression, e.g. "keyhive:{groupUri}"
 *   SessionTiddler.capabilityToken   — ConcAp / UCAN token proving session authority
 *
 *   All fields arrive via CRDT sync — queryable from TW5 `[field[verifyingKey]]`
 *   without any TS interop.  The TW5 wiki surface serves as the ACL query surface.
 *
 * POLICY EXPRESSIONS (open-ended strings; Keyhive layer enforces at runtime):
 *   "public"              — any peer may read / write
 *   "private"             — owning operator only
 *   "group:{uri}"         — members of the group at lar: uri (plain group CRDT)
 *   "keyhive:{groupUri}"  — members with a valid Keyhive capability token for the group
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/social-doc
 */

import type { LarDoc, MutableLarRecord } from "./base-doc.js";

// ---------------------------------------------------------------------------
// URI helpers — derive canonical tiddler title from principal/group/session ID
// ---------------------------------------------------------------------------

/** Stable host used by all social-plane lar: URIs. */
const SOCIAL_HOST = "ha.ka.ba";

/**
 * Canonical tiddler URI for a principal identity.
 *
 * @param did  - DID string, e.g. "did:web:user.bsky.social" or "did:plc:xxxxx"
 * @returns    - e.g. "lar:///ha.ka.ba/@identities/did:web:user.bsky.social"
 */
export function identityTiddlerUri(did: string): string {
  return `lar:///${SOCIAL_HOST}/@identities/${did}`;
}

/**
 * Canonical tiddler URI for a group.
 *
 * @param id   - Group ID (short slug or UUID)
 * @returns    - e.g. "lar:///ha.ka.ba/@circles/admins"
 */
export function circleTiddlerUri(id: string): string {
  return `lar:///${SOCIAL_HOST}/@circles/${id}`;
}

/**
 * Canonical tiddler URI for a session.
 *
 * @param id   - Session ID (short slug or UUID)
 * @returns    - e.g. "lar:///ha.ka.ba/@sessions/sess-abc123"
 */
export function sessionTiddlerUri(id: string): string {
  return `lar:///${SOCIAL_HOST}/@sessions/${id}`;
}

// ---------------------------------------------------------------------------
// Tiddler field shapes — typed views over the MutableLarRecord.fields map.
//
// These are DESCRIPTIVE only.  The actual fields live inside `tiddler.fields`
// (plus `tiddler.text` for extended content like doc-level notes).
// Helper readers below extract typed values from a raw MutableLarRecord.
// ---------------------------------------------------------------------------

/**
 * IdentityTiddler — field shape for a principal identity tiddler.
 *
 * Lives at identityTiddlerUri(did) inside IdentitiesDoc.tiddlers.
 * Bag = IDENTITIES_DOC_URI.
 *
 * Keyhive: `verifyingKey` (Ed25519 public key hex) enables capability delegation
 * without a central CA.  Peers derive their Automerge actor IDs from this key.
 */
export interface IdentityTiddler {
  /** Stable DID — "did:web:user.bsky.social" or "did:plc:xxxxx". */
  readonly did:           string;
  /** Human-readable display name for UX. */
  readonly displayName:   string;
  /** ISO 8601 creation timestamp. */
  readonly createdAt:     string;
  /** Principal kind. */
  readonly kind:          "operator" | "agent" | "service" | "device";
  /**
   * Ed25519 verifying key (hex-encoded 32 bytes).
   * Basis for Keyhive capability delegation and deterministic actor-ID derivation.
   * Absent for identity tiddlers seeded before key exchange (upgrade path).
   */
  readonly verifyingKey?: string;
  /**
   * Policy expression controlling which peers may read this tiddler.
   * Default: "private" (operator only).
   */
  readonly readPolicy?:   string;
}

/**
 * CircleTiddler — field shape for a circle membership tiddler.
 *
 * Lives at circleTiddlerUri(id) inside CirclesDoc.tiddlers.
 * Bag = CIRCLES_DOC_URI.
 *
 * Kowloon model (jzellis): Circles replace the follow/unfollow system entirely.
 * Adding someone to a circle IS the follow. Circle membership never federates —
 * the social graph is private to the owner's home node. No remote server can
 * reconstruct who follows whom. System circles auto-boot on identity creation;
 * user circles are operator-created.
 *
 * Addressing: `to`, `canReply`, `canReact` on *content* tiddlers reference a
 * circle ID to gate visibility. A circle can only be targeted by its owner.
 *
 * Keyhive: `encryptedShareHint` carries BeeKEM encrypted-share material for
 * key recovery across membership changes. `capabilityPolicy` declares what
 * capability proof a peer must present to be considered a member.
 */
export interface CircleTiddler {
  /** Short circle ID (slug or UUID). */
  readonly id:                  string;
  /** Human-readable display name. */
  readonly displayName:         string;
  /** ISO 8601 creation timestamp. */
  readonly createdAt:           string;
  /**
   * Circle kind.
   *
   * "System" — auto-created at identity boot; cannot be deleted.
   *   Built-in system circles per identity:
   *     "following"     — people the operator actively reads
   *     "all-following" — superset: followed nodes + circles
   *     "circles"       — tracks circle memberships (members are circles, not identities)
   *     "blocked"       — blocked identities
   *     "muted"         — muted identities
   *   Built-in system circles per nexus (authorization tiers):
   *     "nexus:anon", "nexus:user", "nexus:operator", "nexus:admin"
   *
   * "Circle" — user-created personal circle (e.g. "Close Friends", "Work").
   */
  readonly kind:                "Circle" | "System";
  /**
   * TW5 list format: space-separated DIDs of current members.
   * parseable with `parseBagStack()` or `split(" ")`.
   * e.g. "did:web:alice.bsky.social did:web:bob.bsky.social"
   * Never federates — private to the owning node.
   */
  readonly memberDids:          string;
  /**
   * Addressing scope for content targeting this circle.
   * Mirrors Kowloon's `to` field: who can see content addressed to this circle.
   * Values: "@public" | "@{domain}" | "{circleId}" | "{did}" | "" (owner only)
   * Default: "" (private — only the owning operator sees it)
   */
  readonly addressingScope?:    string;
  /**
   * Keyhive BeeKEM hint: content-addressed encrypted share material.
   * Opaque bytes (base64) — interpreted by the Keyhive WASM layer (planned).
   * Lets peers recover the circle encryption key after membership changes
   * without trusting a central key server.
   */
  readonly encryptedShareHint?: string;
  /**
   * Capability policy expression for this circle.
   * "keyhive:{circleUri}" — Keyhive convergent capability required
   * "circle:{uri}"        — simple membership check via CRDT
   * "public"              — open circle
   */
  readonly capabilityPolicy?:   string;
  /** Policy expression controlling read access to this tiddler. */
  readonly readPolicy?:         string;
}

/**
 * SessionTiddler — field shape for a live operator-agent session.
 *
 * Lives at sessionTiddlerUri(id) inside SessionsDoc.tiddlers.
 * Bag = SESSIONS_DOC_URI.
 *
 * Keyhive: `capabilityToken` carries the ConcAp / UCAN token proving this
 * session's authority.  A session doc in a future milestone may acquire its
 * own pos-2 child-doc slot: @sessions/@{sessionSlug}.
 */
export interface SessionTiddler {
  /** Short session ID (slug or UUID). */
  readonly id:                string;
  /** DID of the operating principal. */
  readonly operatorDid:       string;
  /** ID of the agent (device, process, worker) running this session. */
  readonly agentId:           string;
  /** ISO 8601 session start timestamp. */
  readonly startedAt:         string;
  /** Session lifecycle state. */
  readonly state:             "active" | "closed";
  /**
   * Keyhive ConcAp or UCAN capability token proving this session's authority.
   * Opaque string — interpreted by the Keyhive capability layer.
   * Absent for sessions bootstrapped before capability exchange.
   */
  readonly capabilityToken?:  string;
  /** Policy expression controlling read access to this tiddler. */
  readonly readPolicy?:       string;
}

// ---------------------------------------------------------------------------
// Doc interfaces — extend LarDoc; no typed Records outside tiddlers
// ---------------------------------------------------------------------------

/**
 * IdentitiesDoc — stable principal records, tiddler-first.
 *
 * Each principal = one tiddler at identityTiddlerUri(did).
 * Self-reference tiddler at IDENTITIES_DOC_URI.
 */
export interface IdentitiesDoc extends LarDoc {
  readonly tiddlers: Record<string, MutableLarRecord>;
}

/**
 * CirclesDoc — collective authority + durable membership, tiddler-first.
 *
 * Each group = one tiddler at circleTiddlerUri(id).
 * Self-reference tiddler at CIRCLES_DOC_URI.
 */
export interface CirclesDoc extends LarDoc {
  readonly tiddlers: Record<string, MutableLarRecord>;
}

/**
 * SessionsDoc — live operator-agent session docs, tiddler-first.
 *
 * Each session = one tiddler at sessionTiddlerUri(id).
 * Self-reference tiddler at SESSIONS_DOC_URI.
 */
export interface SessionsDoc extends LarDoc {
  readonly tiddlers: Record<string, MutableLarRecord>;
}

// ---------------------------------------------------------------------------
// Empty constructors — safe initial state for repo.create()
// ---------------------------------------------------------------------------

export function emptyIdentitiesDoc(): IdentitiesDoc {
  return { schemaVersion: "0.1", tiddlers: {} };
}

export function emptyCirclesDoc(): CirclesDoc {
  return { schemaVersion: "0.1", tiddlers: {} };
}

export function emptySessionsDoc(): SessionsDoc {
  return { schemaVersion: "0.1", tiddlers: {} };
}

// ---------------------------------------------------------------------------
// Typed read helpers — extract typed views from raw MutableLarRecord
// ---------------------------------------------------------------------------

/**
 * Read an IdentityTiddler from a raw tiddler record.
 * Returns null if the tiddler lacks a `did` field.
 */
export function readIdentityTiddler(raw: MutableLarRecord): IdentityTiddler | null {
  const did = raw.fields["did"] ?? (raw.title.startsWith("lar:///") ? undefined : raw.title);
  const didValue = raw.fields["did"] ?? undefined;
  if (!didValue) return null;
  return {
    did:            didValue,
    displayName:    raw.fields["displayName"] ?? didValue,
    createdAt:      raw.fields["createdAt"]   ?? raw.fields["created"]  ?? "",
    kind:           (raw.fields["kind"] as IdentityTiddler["kind"]) ?? "operator",
    ...(raw.fields["verifyingKey"]  && { verifyingKey:  raw.fields["verifyingKey"] }),
    ...(raw.fields["readPolicy"]    && { readPolicy:    raw.fields["readPolicy"] }),
  };
}

/**
 * Read a CircleTiddler from a raw tiddler record.
 * Returns null if the tiddler lacks an `id` field.
 */
export function readCircleTiddler(raw: MutableLarRecord): CircleTiddler | null {
  const id = raw.fields["id"];
  if (!id) return null;
  return {
    id,
    displayName:          raw.fields["displayName"]        ?? id,
    createdAt:            raw.fields["createdAt"]          ?? raw.fields["created"] ?? "",
    kind:                 (raw.fields["kind"] as CircleTiddler["kind"]) ?? "Circle",
    memberDids:           raw.fields["memberDids"]         ?? "",
    ...(raw.fields["addressingScope"]    && { addressingScope:    raw.fields["addressingScope"] }),
    ...(raw.fields["encryptedShareHint"] && { encryptedShareHint: raw.fields["encryptedShareHint"] }),
    ...(raw.fields["capabilityPolicy"]   && { capabilityPolicy:   raw.fields["capabilityPolicy"] }),
    ...(raw.fields["readPolicy"]         && { readPolicy:         raw.fields["readPolicy"] }),
  };
}

/**
 * Read a SessionTiddler from a raw tiddler record.
 * Returns null if the tiddler lacks an `id` field.
 */
export function readSessionTiddler(raw: MutableLarRecord): SessionTiddler | null {
  const id = raw.fields["id"];
  if (!id) return null;
  return {
    id,
    operatorDid:        raw.fields["operatorDid"]   ?? "",
    agentId:            raw.fields["agentId"]       ?? "",
    startedAt:          raw.fields["startedAt"]     ?? raw.fields["created"] ?? "",
    state:              (raw.fields["state"] as SessionTiddler["state"]) ?? "active",
    ...(raw.fields["capabilityToken"] && { capabilityToken: raw.fields["capabilityToken"] }),
    ...(raw.fields["readPolicy"]      && { readPolicy:      raw.fields["readPolicy"] }),
  };
}
// Re-export legacy aliases so callers that used IdentityRecord / CircleRecord / SessionRecord
// can migrate gradually.  These will be removed in a future milestone.
/** @deprecated Use IdentityTiddler instead. */
export type IdentityRecord = IdentityTiddler;
/** @deprecated Use CircleTiddler instead. */
export type CircleRecord    = CircleTiddler & { readonly memberDids: string };
/** @deprecated Use SessionTiddler instead. */
export type SessionRecord  = SessionTiddler;

