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
import type { FfzClock, ExchangeState, LarTickCounter } from "./ffz-clock.js";

// ---------------------------------------------------------------------------
// URI helpers — derive canonical tiddler title from principal/group/session ID
// ---------------------------------------------------------------------------

/** Stable host used by all social-plane lar: URIs. */
const STABLE_TAGSPACE = "ha.ka.ba";

/**
 * Canonical tiddler URI for a principal identity.
 *
 * @param did  - DID string, e.g. "did:web:user.bsky.social" or "did:plc:xxxxx"
 * @returns    - e.g. "lar:///ha.ka.ba/@identities/did:web:user.bsky.social"
 */
export function identityTiddlerUri(did: string): string {
  return `lar:///${STABLE_TAGSPACE}/@identities/${did}`;
}

/**
 * Canonical tiddler URI for a group.
 *
 * @param id   - Group ID (short slug or UUID)
 * @returns    - e.g. "lar:///ha.ka.ba/@circles/admins"
 */
export function circleTiddlerUri(id: string): string {
  return `lar:///${STABLE_TAGSPACE}/@circles/${id}`;
}

/**
 * Canonical tiddler URI for a session.
 *
 * @param id   - Session ID (short slug or UUID)
 * @returns    - e.g. "lar:///ha.ka.ba/@sessions/sess-abc123"
 */
export function sessionTiddlerUri(id: string): string {
  return `lar:///${STABLE_TAGSPACE}/@sessions/${id}`;
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
  /** Stable DID — "did:key:z…" (Ed25519) or "did:plc:xxxxx". */
  readonly did:             string;
  /** Human-readable display name for UX. */
  readonly displayName:     string;
  /** ISO 8601 creation timestamp. */
  readonly createdAt:       string;
  /** Principal kind. */
  readonly kind:            "operator" | "agent" | "service" | "device";
  /**
   * Ed25519 verifying key (hex-encoded 32 bytes).
   * Basis for Keyhive capability delegation and deterministic actor-ID derivation.
   * Absent for identity tiddlers seeded before key exchange (upgrade path).
   */
  readonly verifyingKey?:   string;
  /**
   * Nexus this identity primarily operates within.
   * lar: URI of the NexusRegistryDoc, e.g. "lar:///ha.ka.ba/@nexus/{pubkey}".
   * Absent for purely local identities not yet associated with a Nexus.
   */
  readonly nexusId?:        string;
  /**
   * Key rotation history — JSON array of { key: string, rotatedAt: string } objects.
   * Maintained by the Keyhive layer; present here for TW5-queryable audit trail.
   * Never decreases — old keys remain visible (revoked, not erased).
   */
  readonly keyHistory?:     string;
  /**
   * Trust tier for this identity from the local node's perspective.
   * "local"       — operator's own devices; full trust
   * "nexus"       — authenticated Nexus member (Tier 2 verified)
   * "cross-nexus" — identity from an allied Nexus (Tier 3 token required)
   * "public"      — unknown / unauthenticated; read-only, @public content only
   */
  readonly trustTier?:      "local" | "nexus" | "cross-nexus" | "public";
  /**
   * Policy expression controlling which peers may read this tiddler.
   * Default: "private" (operator only).
   */
  readonly readPolicy?:     string;
}

/**
 * CircleTiddler — field shape for a circle membership tiddler.
 *
 * Lives at circleTiddlerUri(id) inside CirclesDoc.tiddlers.
 * Bag = CIRCLES_DOC_URI.
 *
 * Social graph inversion (jzellis principle, web3 implementation):
 * Adding someone to a circle IS the follow. The followed party never knows.
 * Circle membership never federates — the graph is private to its center.
 * No remote peer can reconstruct who follows whom from outside.
 *
 * Capability model (Tier 1 local CRDT):
 * Membership in a circle IS the capability grant for content addressed to it.
 * `to`/`canReply`/`canReact` on content tiddlers reference this circle ID.
 * Check is purely local: read `memberDids`, verify viewer DID appears in it.
 * No server query, no token exchange, no network call at check time.
 *
 * Scope: personal circles never replicate beyond the owning Lararium.
 * Nexus-scoped circles (`nexusScope: "nexus"`) replicate to all Nexus peers
 * via Keyhive Group CRDT when S7.2+ lands. `nexusScope` field enforces the
 * boundary; the sync adaptor filters on it.
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
   *   Personal system circles (never replicate beyond owning Lararium):
   *     "following"       — operators the local user actively reads
   *     "all-following"   — superset: following + transitively followed circles
   *     "circles"         — circle-of-circles (members are circles, not identities)
   *     "blocked"         — blocked DIDs; inbound content from these never processes
   *     "muted"           — muted DIDs; filtered at feed render, not at ingest
   *   Nexus authorization tier circles (nexusScope: "nexus"; replicate to Nexus peers):
   *     "nexus:anon"      — unauthenticated / @public access only
   *     "nexus:user"      — authenticated Nexus member (Tier 2 verified)
   *     "nexus:operator"  — local operator (can promote content, manage sessions)
   *     "nexus:admin"     — Nexus admin (Keyhive Group key, S7.2+)
   *
   * "Circle" — operator-created personal circle (e.g. "Close Friends", "Work").
   *            Always nexusScope: "local".
   */
  readonly kind:                "Circle" | "System";
  /**
   * Space-separated DIDs of current members (TW5 list format).
   * `split(" ")` or `[list[memberDids]]` to enumerate.
   * e.g. "did:key:z6Mk… did:key:z6Mk…"
   * Never federates — private to the owning node unless nexusScope says otherwise.
   */
  readonly memberDids:          string;
  /**
   * Replication scope for this circle.
   * "local"        — stays within the owning Lararium (default for personal circles)
   * "nexus"        — replicates to all Nexus peers via Keyhive Group CRDT (S7.2+)
   * Absent = "local".
   */
  readonly nexusScope?:         "local" | "nexus";
  /**
   * Ed25519 signature over "id|name|nexusScope|sortedMemberDids" by the owning
   * operator's verifyingKey. Provides integrity without a central server.
   * Absent on legacy circles seeded before S7.
   */
  readonly memberSignature?:    string;
  /**
   * Space-separated burned nonces — anti-replay guard for inbound circle invites.
   * A Seitan-style invite token's nonce lands here on acceptance; retransmitted
   * tokens with burned nonces are silently dropped.
   */
  readonly nonceBurnSet?:       string;
  /**
   * Keyhive BeeKEM hint: content-addressed encrypted share material.
   * Opaque bytes (base64) — interpreted by the Keyhive WASM layer (S7.2+).
   * Allows peers to recover the circle encryption key after membership changes
   * without trusting a central authority.
   */
  readonly encryptedShareHint?: string;
  /**
   * Capability policy expression — which proof a peer must present for membership.
   * "keyhive:{circleUri}" — Keyhive convergent capability (S7.2+)
   * "circle:{lar-uri}"   — CRDT membership check (Tier 1, S7.0)
   * "public"             — open circle
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
   * AutomergeUrl of the per-session `SessionEventLog` child doc.
   * Written on session open; read by any peer that wants to replay events.
   */
  readonly eventLogUrl?:      string;
  /**
   * Automerge heads (hex strings, space-separated) of the event log
   * at the time of last sync — used as a stable replay cursor.
   * Updated alongside `eventLogUrl` on each sync checkpoint.
   */
  readonly eventLogHeads?:    string;
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
// ---------------------------------------------------------------------------
// Ephemeral presence — broadcast via DocHandle.broadcast(), never persisted
// ---------------------------------------------------------------------------

/**
 * PresenceSlot — live peer position broadcast over Automerge ephemeral channel.
 *
 * `clocks` carries named FfzClock instances keyed by profile name.
 * Standard keys: "session-clock" (operator session), "diegetic-clock" (fiction
 * enactment), "world-clock" (campaign calendar). Additional profiles via adapters.
 *
 * Each clock serializes to wire via `ffzSerialize(clock)` for compact broadcast.
 */
export interface PresenceSlot {
  /** DID of the operating principal. */
  readonly userId:    string;
  /** Device/agent ID — matches SessionTiddler.agentId. */
  readonly deviceId:  string;
  /** Last known cursor position in the current canvas/document, or null. */
  readonly cursor:    { x: number; y: number } | null;
  /** Last known viewport state, or null. */
  readonly viewport:  { x: number; y: number; zoom: number } | null;
  /** Currently selected tiddler titles or element IDs. */
  readonly selection: string[];
  /**
   * Named FfzClock instances — keyed by profile name.
   * "session-clock"  → operator-agent exchange rhythm (owned)
   * "diegetic-clock" → fiction enactment / FTLS exploration (observed via world doc)
   * Additional profiles registered by tool adapters at connect time.
   */
  readonly clocks:         Record<string, FfzClock>;
  /**
   * lar: URI of the active WorldClockTiddler.
   * References the shared world clock without owning it.
   * Absent when no world context is active.
   */
  readonly worldClockRef?: string;
  /**
   * Lifecycle state of the current operator-agent exchange turn.
   * L1 tick fires on transition to "grounded"; stays stable during async wait.
   * Absent for non-alignment presence slots.
   */
  readonly exchangeState?: ExchangeState;
}

// ---------------------------------------------------------------------------
// World clock — shared diegetic time; lives in the world's LarDoc
// ---------------------------------------------------------------------------

/**
 * WorldClockTiddler — shared diegetic clock for a game/fiction world.
 *
 * Lives at lar:///ha.ka.ba/@world/{worldId}/clock inside the world's LarDoc.
 * Owned collectively by the world document; individual nodes observe via sync.
 * Write authority flows through `writePolicy` (Keyhive capability or circle).
 *
 * Two orthogonal axes coexist: "world-time" (campaign calendar) and
 * "diegetic" (exploration/combat). The diegetic ₄ (Theme) rollover ticks
 * the world-time ₀ (Pulse) — they share the Week boundary.
 */
export interface WorldClockTiddler {
  readonly worldId:    string;
  readonly kind:       "world-clock";
  /**
   * Named clock profiles — each value serialized via ffzSerialize(FfzClock).
   * Standard keys: "world-time", "diegetic".
   */
  readonly clocks:     Record<string, string>;
  /**
   * Bound sets per profile — JSON-encoded FfzLevel tuple.
   * Stored separately so the tiddler remains self-describing on the wire.
   */
  readonly clockBounds: Record<string, string>;
  /**
   * Write policy — who may call ffzTick on this clock.
   * "keyhive:{gmCircleUri}"       — GM-only (TTRPG)
   * "group:{allPlayersCircleUri}" — any connected operator (Minecraft model)
   * "private"                     — lararium-node process only (autonomous)
   */
  readonly writePolicy:  string;
  /**
   * Tick policy — Layer 2 behavior when no operator connects.
   * "autonomous" — lararium-node advances continuously (Minecraft model)
   * "freeze"     — pauses when no authorized operator present (Foundry model)
   * "manual"     — advances only by explicit operator action
   */
  readonly tickPolicy:   "autonomous" | "freeze" | "manual";
  /** ISO 8601 timestamp of last clock advancement — for drift detection. */
  readonly lastTickedAt?: string;
}

/**
 * ObservedClockTiddler — read-only mirror of an external system's clock.
 *
 * Lives at $:/lares/clocks/{domain}/{systemId} inside the node's local store.
 * Only the named ingress adapter holds write authority on clock-value fields.
 * All other code reads `external-clock-hwm` and never calls ffzTick here.
 *
 * Pattern: Flink watermark + bi-temporal anchor.
 * `hwm` (high-water-mark) never decreases — implements "at least T" semantics.
 * `receivedAt` serializes the local session FfzClock at moment of observation.
 */
export interface ObservedClockTiddler {
  readonly kind:              "observed-clock";
  /** Domain path, e.g. "connected-world/valheim", "market/NYSE". */
  readonly externalClockDomain: string;
  /** Current observed value — in the external system's own units. */
  readonly externalClockValue:  string;
  /** Human-readable unit name, e.g. "in-game-days", "trading-sessions". */
  readonly externalClockUnits:  string;
  /**
   * High-water-mark — maximum observed value; never decreases.
   * Use this field for threshold queries: hwm >= targetValue.
   */
  readonly externalClockHwm:    string;
  /**
   * Stale flag — true when no update arrived within the adapter's timeout window.
   * The last known hwm becomes a lower bound, not a current fact.
   */
  readonly externalClockStale:  string;    // "true" | "false" (TW5 field format)
  /**
   * The local session FfzClock (ffzSerialize) at the moment this observation arrived.
   * Provides the bi-temporal anchor: "what was the operator doing when Valheim hit day 47?"
   */
  readonly externalClockReceived: string;
  /** Name of the ingress adapter that owns writes to this tiddler. */
  readonly externalClockSource:   string;
}

// ---------------------------------------------------------------------------
// World time event — bi-temporal record of explicit clock advancement
// ---------------------------------------------------------------------------

/**
 * WorldTimeAdvancedEvent — emitted when an authorized operator advances the world clock.
 *
 * Carries both clock values (bi-temporal pattern per Verraes 2022):
 * `atTickCounter`  — the Lararium tick sequence number when this occurred
 * `atSessionClock` — the operator's FfzClock position (session profile)
 * `worldClockDelta`— the FfzClock after advancement (world-time profile)
 *
 * Enables future queries: "what was the session clock when the world advanced 3 weeks?"
 */
export interface WorldTimeAdvancedEvent {
  readonly kind:             "world-time-advanced";
  readonly worldId:          string;
  readonly profileName:      string;         // e.g. "world-time" or "diegetic"
  readonly worldClockBefore: string;         // ffzSerialize — position before
  readonly worldClockAfter:  string;         // ffzSerialize — position after
  readonly atSessionClock:   FfzClock;       // operator's owned session clock
  readonly atTickCounter:    LarTickCounter; // node tick sequence number
  readonly byOperator:       string;         // DID
  readonly sessionId:        string;
}

// ---------------------------------------------------------------------------
// Session event log — ordered append-only doc per session (S6)
// ---------------------------------------------------------------------------

/**
 * SessionEvent — one entry in a session's event log.
 *
 * `clock` encodes position within the session (session-clock profile).
 * L1 ticks per grounded exchange turn; L0 ticks per agent sub-step.
 *
 * The event log lives in a child doc referenced by SessionTiddler.eventLogUrl.
 * Replay via `Automerge.view(doc, heads)` using the stored `eventLogHeads`.
 */
export interface SessionEvent {
  /** Unique event ID (UUID or nanoid). */
  readonly id:           string;
  /** Session-clock FfzClock position at event time. */
  readonly clock:        FfzClock;
  /** Node tick counter at event time — causal join key across sources. */
  readonly tickCounter:  LarTickCounter;
  /**
   * Event kind — discriminator for payload shape.
   * Standard kinds:
   *   "exchange:operator-sent"   — operator presented intent
   *   "exchange:agent-working"   — agent processing (L0 sub-steps in flight)
   *   "exchange:agent-responded" — response delivered
   *   "exchange:grounded"        — operator grounded; L1 ticks here
   *   "exchange:blocked"         — agent waiting for operator input
   *   "tiddler:change"           — tiddler mutated within this session
   *   "nav:open"                 — tiddler or canvas node opened
   *   "tool:run"                 — external tool call dispatched
   *   "world:clock-advanced"     — world clock advanced (see WorldTimeAdvancedEvent)
   */
  readonly kind:         string;
  /** Event payload — shape varies by `kind`. Use `kind` to narrow before casting. */
  readonly payload:      unknown;
}

/**
 * SessionEventLog — append-only Automerge doc; one per session.
 *
 * Referenced by `SessionTiddler.eventLogUrl`.
 * Extends LarDoc for schema versioning; the `tiddlers` map holds the log entries
 * keyed by event ID — this preserves the LarDoc invariant while giving each event
 * a stable Automerge map key for concurrent append from multiple peers.
 *
 * Compaction: when `events` count exceeds a threshold, a lossless snapshot entry
 * (kind: "snapshot") collapses earlier entries; peers MUST replay from the latest
 * snapshot head. (Patternist.xyz lossless snapshot pattern.)
 */
export interface SessionEventLog extends LarDoc {
  /**
   * Ordered event entries keyed by event ID.
   * Use `Object.values(events).sort(…)` over `tickCounter` to get causal order.
   */
  readonly events: Record<string, SessionEvent>;
}

/** Canonical URI helper for a session's event log doc. */
export function sessionEventLogUri(sessionId: string): string {
  return `lar:///${STABLE_TAGSPACE}/@sessions/${sessionId}/events`;
}

// ---------------------------------------------------------------------------
// S7 capability layer — Tier 1 type stubs (web3 only; no server-trust model)
// ---------------------------------------------------------------------------

/**
 * ContentAddressing — the three capability slots on every content tiddler.
 *
 * Web3 addressing model (NOT ActivityPub / server-scoped):
 * Identity anchors to keypairs (`did:key:`), not server domains.
 *
 * Token vocabulary:
 *   "@public"            — any peer may read/reply/react
 *   "circle:{id}"        — Tier 1: local CRDT membership check (S7.0)
 *   "group:{lar-uri}"    — Tier 1/2: resolves via lar: URI to a CircleTiddler
 *   "@nexus:{pubkey}"    — Tier 2: authenticated Nexus member (S7.2+)
 *
 * Capability check is purely local — read memberDids from CirclesDoc, verify
 * viewer DID appears in it. No network call, no token exchange at check time.
 *
 * These fields live in the content tiddler's `fields` map, queryable from TW5:
 *   `[field[to]match[circle:]]`  — all circle-gated content
 *   `[field[to]exact[@public]]`  — all public content
 */
export interface ContentAddressing {
  /** Who may read this tiddler. Default: "@public" */
  readonly to:        string;
  /** Who may append a reply. Defaults to `to` when absent. */
  readonly canReply?: string;
  /** Who may append a reaction. Defaults to `to` when absent. */
  readonly canReact?: string;
}

/**
 * DeviceDelegationTiddler — UCAN-compatible proof that a device key speaks as an operator.
 *
 * Lives at "lar:///ha.ka.ba/@identities/{operatorDid}/devices/{deviceDid}"
 * inside IdentitiesDoc.
 *
 * Chain of trust: deviceVerifyingKey →(signs)→ delegation →(attests)→ operatorDid
 * Any peer holding the operator's verifyingKey can verify this locally with
 * no network call — the tiddler arrives via CRDT sync.
 *
 * Implements Plane 0→1 of the five identity planes (S7.1 target).
 */
export interface DeviceDelegationTiddler {
  readonly kind:                "device-delegation";
  /** The operator DID this device speaks on behalf of. */
  readonly operatorDid:         string;
  /** The device DID being delegated (did:key: from device Ed25519 keypair). */
  readonly deviceDid:           string;
  /** Ed25519 verifying key of the device (hex). */
  readonly deviceVerifyingKey:  string;
  /** ISO 8601 — when this delegation was issued. */
  readonly issuedAt:            string;
  /** ISO 8601 — when this delegation expires. Absent = no expiry. */
  readonly expiresAt?:          string;
  /**
   * Ed25519 signature by the OPERATOR's key over:
   * "device-delegation|{operatorDid}|{deviceDid}|{deviceVerifyingKey}|{issuedAt}"
   * Verifiable against IdentityTiddler.verifyingKey with no network call.
   */
  readonly operatorSignature:   string;
}

/**
 * CircleInviteToken — Seitan-style invite for circle membership.
 *
 * Issued by the circle owner; accepted once; nonce burned on acceptance.
 * Transport is out-of-band (QR code, link, DM) — not stored in the CRDT.
 * The token itself burns: after acceptance, only the nonce scar in
 * CircleTiddler.nonceBurnSet remains as evidence.
 *
 * Implements Plane 2 invite flow (S7.2 target).
 */
export interface CircleInviteToken {
  /** Issuing operator's DID. */
  readonly iss:         string;
  /** Target circle ID. */
  readonly circleId:    string;
  /** Capability granted: "join" = membership. */
  readonly cap:         "join";
  /** ISO 8601 expiry. */
  readonly exp:         string;
  /** Random nonce — burned on acceptance; prevents replay. */
  readonly nonce:       string;
  /**
   * Ed25519 signature by issuer's key over:
   * "circle-invite|{iss}|{circleId}|{cap}|{exp}|{nonce}"
   */
  readonly signature:   string;
}

/**
 * NexusTrustTiddler — local node's trust posture toward a specific Nexus.
 *
 * Lives at "lar:///ha.ka.ba/@identities/trust/nexus/{nexusPubkey}"
 * inside the local IdentitiesDoc. Write authority: this Lararium only.
 * Never replicates beyond the owning node (nexusScope: "local" implied).
 *
 * Implements Plane 3→4 circuit breakers (S7.4 target).
 *
 * Hostile mesh operation:
 * "ally"    — cross-Nexus Tier 3 tokens from this Nexus are accepted
 * "neutral" — @public content only; no Tier 3 tokens accepted
 * "hostile" — all inbound content from this Nexus is dropped at ingress
 * "unknown" — not yet evaluated; treated as "neutral" by CrdtIngressAdapter
 */
export interface NexusTrustTiddler {
  readonly kind:           "nexus-trust";
  /** lar: URI of the NexusRegistryDoc, e.g. "lar:///ha.ka.ba/@nexus/{pubkey}" */
  readonly nexusId:        string;
  /** Ed25519 public key of the Nexus (hex) — used to verify cross-Nexus tokens. */
  readonly nexusVerifyingKey: string;
  readonly trustLevel:     "ally" | "neutral" | "hostile" | "unknown";
  /** ISO 8601 — when this trust assertion was last updated. */
  readonly since:          string;
  /** AutomergeUrl of the treaty doc, if any bilateral treaty exists. S9+. */
  readonly treatyRef?:     string;
  /**
   * Space-separated burned nonces from this Nexus — anti-replay guard.
   * Inbound cross-Nexus activities carry a nonce; if already present here,
   * the CrdtIngressAdapter drops the activity silently.
   */
  readonly nonceBurnSet?:  string;
}

/** URI helper for a device delegation tiddler. */
export function deviceDelegationUri(operatorDid: string, deviceDid: string): string {
  return `lar:///${STABLE_TAGSPACE}/@identities/${encodeURIComponent(operatorDid)}/devices/${encodeURIComponent(deviceDid)}`;
}

/** URI helper for a Nexus trust tiddler. */
export function nexusTrustUri(nexusPubkey: string): string {
  return `lar:///${STABLE_TAGSPACE}/@identities/trust/nexus/${nexusPubkey}`;
}

// ---------------------------------------------------------------------------
// Legacy aliases — migrate callers gradually; remove in a future milestone
// ---------------------------------------------------------------------------

/** @deprecated Use IdentityTiddler instead. */
export type IdentityRecord = IdentityTiddler;
/** @deprecated Use CircleTiddler instead. */
export type CircleRecord    = CircleTiddler & { readonly memberDids: string };
/** @deprecated Use SessionTiddler instead. */
export type SessionRecord  = SessionTiddler;

