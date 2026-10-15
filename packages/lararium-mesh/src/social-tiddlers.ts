/**
 * social-tiddlers — tiddler field shapes and typed read helpers for the social plane.
 *
 * TIDDLER-FIRST: all principal / group / session / presence / world-clock data lives
 * in `tiddlers`. No separate typed Records outside `tiddlers`.
 *
 * Keyhive / Ink & Switch / Zelenka: capability fields mirror the three-layer stack
 * (convergent capabilities + Group CRDT + BeeKEM). Queryable from TW5 field filters.
 */

import type { LarDoc } from "./base-doc.js";
import type { FfzClock, ExchangeState, LarTickCounter } from "./ffz-clock.js";

// ── Principal identity ────────────────────────────────────────────────────

export interface IdentityTiddler {
  readonly did:             string;
  readonly displayName:     string;
  readonly createdAt:       string;
  readonly kind:            "operator" | "agent" | "service" | "device";
  /** Ed25519 verifying key (hex). Basis for Keyhive capability delegation. */
  readonly verifyingKey?:   string;
  /** lar: URI of the NexusRegistryDoc. */
  readonly nexusId?:        string;
  /** JSON array of { key, rotatedAt } — audit trail; never decreases. */
  readonly keyHistory?:     string;
  readonly trustTier?:      "local" | "nexus" | "cross-nexus" | "public";
  readonly readPolicy?:     string;
}

// ── Circle (group) ────────────────────────────────────────────────────────

/** The per-nym follow stamp a `CircleTiddler` carries membership through: `mbr+:<nym>` holds the add
 *  timestamp. Shared between the writer (cold-boot-ceremony, social-seed) and the reader
 *  (circle-verbs' `foldMembers`) — no whole-field `memberDids` register; see circle-verbs.ts. */
export const MEMBER_ADD_PREFIX = "mbr+:";

export interface CircleTiddler {
  readonly id:                  string;
  readonly displayName:         string;
  readonly createdAt:           string;
  readonly kind:                "Circle" | "System";
  readonly nexusScope?:         "local" | "nexus";
  /** Ed25519 signature over "id|name|nexusScope|sortedMemberDids". */
  readonly memberSignature?:    string;
  /** Space-separated burned nonces — anti-replay for inbound invites. */
  readonly nonceBurnSet?:       string;
  /** BeeKEM encrypted share hint (base64). Keyhive layer. */
  readonly encryptedShareHint?: string;
  readonly capabilityPolicy?:   string;
  readonly readPolicy?:         string;
}

// ── Session ───────────────────────────────────────────────────────────────

export interface SessionTiddler {
  readonly id:                string;
  readonly operatorDid:       string;
  readonly agentId:           string;
  readonly startedAt:         string;
  readonly state:             "active" | "closed";
  readonly eventLogUrl?:      string;
  readonly eventLogHeads?:    string;
  readonly capabilityToken?:  string;
  readonly readPolicy?:       string;
}


// ── Session event log ─────────────────────────────────────────────────────

export interface SessionEvent {
  readonly id:           string;
  readonly clock:        FfzClock;
  readonly tickCounter:  LarTickCounter;
  readonly kind:         string;
  readonly payload:      unknown;
}

export interface SessionEventLog extends LarDoc {
  readonly events: Record<string, SessionEvent>;
}

// ── Ephemeral presence ────────────────────────────────────────────────────

export interface PresenceSlot {
  readonly userId:         string;
  readonly deviceId:       string;
  readonly cursor:         { x: number; y: number } | null;
  readonly viewport:       { x: number; y: number; zoom: number } | null;
  readonly selection:      string[];
  readonly clocks:         Record<string, FfzClock>;
  readonly worldClockRef?: string;
  readonly exchangeState?: ExchangeState;
}

