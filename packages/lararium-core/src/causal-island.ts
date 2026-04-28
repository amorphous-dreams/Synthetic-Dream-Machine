/**
 * Causal Island primitives — law-level types from federated-causal-islands.md
 *
 * Law: A node-to-node pranala connection IS a causal island.
 * Not a transport. Not a socket. A named, capability-gated causal boundary
 * carrying its own identity, durable offset, stream log, reconciliation state,
 * visibility predicate, revocation epoch, and receipt history.
 *
 * Three tiers:
 *   Tier 1 — kumu instances (inside a carrier): papalohe-declared causal islands
 *   Tier 2 — memes inside rooms (inside a Lares node): CRDT document islands
 *   Tier 3 — Lares nodes (the federated layer): node-to-node edge islands (THIS LAW)
 */

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

export interface LarPrincipalDid      { readonly kind: "did";            readonly id: string; }
export interface LarPrincipalEd25519  { readonly kind: "ed25519";        readonly publicKey: string; }
export interface LarPrincipalLocal    { readonly kind: "local-operator"; readonly alias: string; readonly tier?: string; readonly host?: string; }

export type LarPrincipal =
  | LarPrincipalDid
  | LarPrincipalEd25519
  | LarPrincipalLocal;

// ---------------------------------------------------------------------------
// Ability Ladder
//
// Ordered from least to most privileged.
// EXCEPTION: pull does NOT imply read. A relay holds pull without read.
// All other abilities imply every ability below them in the ladder.
// ---------------------------------------------------------------------------

export const ABILITY_LADDER = [
  "pull",     // retrieve encrypted bytes and forward; cannot decrypt or render
  "read",     // decrypt and render semantic content
  "sync",     // participate in CRDT reconciliation
  "write",    // produce accepted mutations
  "propose",  // suggest hostful changes (pending; not yet hostless canon)
  "promote",  // hostful → hostless canon-promotion ceremony
  "admin",    // manage room, recipe, edge island membership
  "revoke",   // roll epoch; terminate future live tail for a principal
] as const;

export type OrichalcumAbility = typeof ABILITY_LADDER[number];

/**
 * Returns true if holding `have` implies holding `need`.
 *
 * Relay-law exception: pull does NOT imply read.
 * A shrine relay carries offerings it cannot understand.
 */
export function abilityImplies(have: OrichalcumAbility, need: OrichalcumAbility): boolean {
  if (have === need) return true;
  // pull only implies itself — relay-law exception
  if (have === "pull") return false;
  const haveIdx = ABILITY_LADDER.indexOf(have);
  const needIdx = ABILITY_LADDER.indexOf(need);
  return haveIdx >= needIdx;
}

// ---------------------------------------------------------------------------
// Caveats — Lararium-native predicates evaluated at gate time
//
// A capability with no caveats is maximally permissive within its ability scope.
// Stage band is NOT a capability gate condition (UX annotation only).
// ---------------------------------------------------------------------------

export interface CaveatRatingAtLeast { readonly kind: "rating-at-least";  readonly rating: string; }
export interface CaveatManaoioAtLeast { readonly kind: "manaoio-at-least"; readonly threshold: number; }
export interface CaveatRoomRecipe    { readonly kind: "room-recipe";       readonly recipeUri: string; }
export interface CaveatKapuScope     { readonly kind: "kapu-scope";        readonly scope: "personal" | "consensual" | "collective" | "universal"; }
export interface CaveatHostBoundary  { readonly kind: "host-boundary";     readonly value: "hostless-only" | "hostful-ok"; }
export interface CaveatEdgeIsland    { readonly kind: "edge-island";       readonly edgeId: string; }
export interface CaveatEpoch         { readonly kind: "epoch";             readonly epoch: string; }

export type OrichalcumCaveat =
  | CaveatRatingAtLeast
  | CaveatManaoioAtLeast
  | CaveatRoomRecipe
  | CaveatKapuScope
  | CaveatHostBoundary
  | CaveatEdgeIsland
  | CaveatEpoch;

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

export interface OrichalcumCapability {
  readonly issuer:    LarPrincipal;
  readonly audience:  LarPrincipal;
  /** lar:/// canonical URI or edge: island id */
  readonly resource:  string;
  readonly abilities: readonly OrichalcumAbility[];
  readonly caveats:   readonly OrichalcumCaveat[];
}

/** True if the capability grants the requested ability (respects pull≠read). */
export function capabilityHasAbility(cap: OrichalcumCapability, need: OrichalcumAbility): boolean {
  return cap.abilities.some((a) => abilityImplies(a, need));
}

// ---------------------------------------------------------------------------
// Edge Island Identity
// ---------------------------------------------------------------------------

/** Branded ID: "edge:${sourceNode}:${targetNode}:${epoch}" */
export type EdgeIslandId = `edge:${string}`;

export function makeEdgeIslandId(
  sourceNode: string,
  targetNode: string,
  epoch: string,
): EdgeIslandId {
  return `edge:${sourceNode}:${targetNode}:${epoch}`;
}

// ---------------------------------------------------------------------------
// Edge Island Lifecycle
//
// stable sediment | current boot receipt | live delta tail
//
// Revocation is forward-only. Past sediment encrypted at prior epoch keys
// remains readable by those who held those keys.
// ---------------------------------------------------------------------------

export type EdgeIslandLifecycle =
  | "boot-receipt"   // join snapshot issued; peer authorized to see visible world
  | "live-tail"      // receiving delta stream from last known offset
  | "sediment"       // historical compacted state; no longer receiving deltas
  | "revoked";       // epoch rolled; no future live-tail frames for this principal

// ---------------------------------------------------------------------------
// Edge Island Shape
//
// Every edge island MUST carry these fields.
// The offset belongs to the edge island — NOT to the remote node.
// An edge island that reconnects resumes from its last known offset.
// ---------------------------------------------------------------------------

export interface EdgeIslandShape {
  readonly id:          EdgeIslandId;
  readonly capability:  OrichalcumCapability;
  /** Monotonic frame count — belongs to the edge island, not the remote node. */
  readonly offset:      number;
  /** Revocation generation; rolling epoch terminates prior live-tail access. */
  readonly epoch:       string;
  readonly lifecycle:   EdgeIslandLifecycle;
  /**
   * Hash-stable receipt — updated after join, after each epoch change, after
   * each canon-promotion ceremony. Usable as a prompt cache key.
   */
  readonly receipt:     string | null;
}

// ---------------------------------------------------------------------------
// Visibility Gate
//
// A meme passes the federation gate when ALL conditions hold.
// Stage band is a UX annotation — NOT a gate condition here.
// Room recipes MAY filter by stage as operator configuration.
// ---------------------------------------------------------------------------

export interface VisibilityGateInput {
  /** Structural rating of the meme carrier (noise | data | meme | ano | kapu). */
  memeRating:      string;
  /** Community-weighted believability scalar [0.0–1.0]. */
  memeManaoio:     number;
  /** Room's minimum manaoio threshold. */
  roomMinManaoio:  number;
  /** Whether the room recipe matches this meme (operator-configured predicate). */
  recipeMatches:   boolean;
  /** Whether the subject holds the "sync" ability on this edge island. */
  subjectCanSync:  boolean;
  /** Whether the edge island's epoch has been revoked. */
  edgeRevoked:     boolean;
  /** Whether the meme violates a kapu constraint for this subject. */
  violatesKapu:    boolean;
}

/** Ratings that are structurally eligible to federate. Noise and Data are node-local only. */
const FEDERABLE_RATINGS = new Set(["meme", "ano", "kapu"]);

/**
 * Federation visibility gate — ALL conditions must hold.
 *
 *   rating(meme)    >= Meme
 *   manaoio(meme)   >= room.minManaoio
 *   recipe(room).matches(meme)
 *   hasAbility(subject, "sync", edge.id)
 *   !edge.revoked
 *   !violatesKapu(meme, subject)
 */
export function visibilityGate(input: VisibilityGateInput): boolean {
  if (!FEDERABLE_RATINGS.has(input.memeRating.toLowerCase())) return false;
  if (input.memeManaoio < input.roomMinManaoio)                return false;
  if (!input.recipeMatches)                                    return false;
  if (!input.subjectCanSync)                                   return false;
  if (input.edgeRevoked)                                       return false;
  if (input.violatesKapu)                                      return false;
  return true;
}

// ---------------------------------------------------------------------------
// Authority-First Sync Order
//
// Content MUST NOT precede authority. This invariant has no exceptions.
//
//   1. authenticate peer / node / device
//   2. sync Orichalcum authority graph (membership, capabilities, delegations, revocations)
//   3. derive visible room recipe + visible causal islands
//   4. sync collection manifest (rooms, memes, edge islands, receipts)
//   5. per-island: a) capability/epoch ops  b) CRDT heads  c) delta payloads  d) receipts
//
// A relay that has not completed step 2 MUST NOT receive step 4 or later.
// A peer that has not completed step 3 MUST NOT request individual meme deltas.
// ---------------------------------------------------------------------------

export const AUTHORITY_FIRST_ORDER = [
  "authenticate-peer",         // 1
  "sync-authority-graph",      // 2
  "derive-visible-rooms",      // 3
  "sync-collection-manifest",  // 4
  "capability-epoch-ops",      // 5a
  "sync-crdt-heads",           // 5b
  "sync-delta-payloads",       // 5c
  "sync-projection-receipts",  // 5d
] as const;

export type AuthorityFirstStep = typeof AUTHORITY_FIRST_ORDER[number];

export type AuthorityFirstState =
  | "authenticating"     // step 1 — peer not verified
  | "syncing-authority"  // step 2 — Orichalcum graph not yet reconciled
  | "syncing-manifest"   // steps 3–4 — rooms/memes/islands deriving
  | "live";              // steps 5+ — delta stream active

/**
 * Per-connection state machine enforcing authority-first sync ordering.
 *
 * Gate failures at join (steps 1–3) close the connection.
 * Gate failures at delta receipt (step 4) drop the frame and log a receipt violation.
 */
export class AuthorityFirstGuard {
  private _state: AuthorityFirstState = "authenticating";

  get state(): AuthorityFirstState { return this._state; }

  /** True if content (manifests, receipts) may flow. False until step 4 begins. */
  get contentAllowed(): boolean {
    return this._state === "syncing-manifest" || this._state === "live";
  }

  /** True if delta payloads may flow. False until after manifest sync. */
  get deltaAllowed(): boolean {
    return this._state === "live";
  }

  /** Returns true if the guard permits proceeding with the given step. */
  canProceed(step: AuthorityFirstStep): boolean {
    switch (step) {
      case "authenticate-peer":
        return true;
      case "sync-authority-graph":
        return this._state !== "authenticating";
      case "derive-visible-rooms":
      case "sync-collection-manifest":
        return this._state === "syncing-manifest" || this._state === "live";
      case "capability-epoch-ops":
      case "sync-crdt-heads":
      case "sync-delta-payloads":
      case "sync-projection-receipts":
        return this._state === "live";
      default:
        return false;
    }
  }

  /** Advance the guard after completing a step. */
  advance(step: AuthorityFirstStep): void {
    switch (step) {
      case "authenticate-peer":
        if (this._state === "authenticating") this._state = "syncing-authority";
        break;
      case "sync-authority-graph":
        if (this._state === "syncing-authority") this._state = "syncing-manifest";
        break;
      case "sync-collection-manifest":
        if (this._state === "syncing-manifest") this._state = "live";
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Causal Island Doctrine — MAY vs MUST
// ---------------------------------------------------------------------------

/**
 * Things that MUST become causal islands (cross-node causality errors become
 * federation corruption and cannot be corrected inside a single node).
 */
export const CAUSAL_ISLAND_MUST = [
  "node-to-node-federation-edge",
  "cross-node-pranala-connection",
  "canon-promotion-ceremony",
  "revocation-epoch-change",
  "encrypted-sync-membership-change",
  "live-hostful-record-proposing-hostless-canon-mutation",
] as const;

export type CausalIslandMust = typeof CAUSAL_ISLAND_MUST[number];

/**
 * Things that MAY become causal islands (local causality errors can be
 * corrected inside a node; promotion to causal island is optional).
 */
export const CAUSAL_ISLAND_MAY = [
  "room",
  "meme",
  "sigil",
  "kumu-instance",
  "kahea-invocation",
  "local-room-projection",
  "long-lived-runtime-actor",
] as const;

export type CausalIslandMay = typeof CAUSAL_ISLAND_MAY[number];
