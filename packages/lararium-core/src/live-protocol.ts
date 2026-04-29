/**
 * Lararium live protocol — WebSocket message contract.
 *
 * Isomorphic: no Node or browser APIs. Both the Node broadcaster and the
 * browser client import from here.
 *
 * Flow:
 *   Server → client: "snapshot" (full state on connect) then "delta" (incremental)
 *   Client → server: "fire" (trigger a reaction edge event)
 *   Server → all:    "event" (broadcast a fired reaction)
 *
 * Reaction edges (papalohe, family:reaction) become live subscriptions.
 * "fire" carries the trigger name and args; the server fans it out to all
 * clients that have a handler registered on the target URI.
 */

// ---------------------------------------------------------------------------
// LarariumBootReceiptMeta — authority receipt carried in a hidden tldraw frame shape.
//
// Transitional metadata carrier: stored as shape.meta on a hidden frame (opacity:0,
// isLocked:true, x/y far off-screen) so it travels with the room CRDT snapshot
// without requiring a custom TLRecord schema.
//
// Brooklyn compatibility slots (reserved, not enforced this lap):
//   issuer/subject → UCAN iss/aud + Keyhive Ed25519 principal
//   capability     → UCAN cap { can, with, nb } + Orichalcum stub
//   proofs         → UCAN prf CID chain + Keyhive membership op head
//   graph          → Keyhive membershipHead + Beelay collectionHead/manifestHead
//   receiptHash    → SHA-256 hex today; evolves to DAG-CBOR CIDv1 when crypto lands
//
// Hard rules:
//   - Receipt does not carry full state. It authorizes graph opening.
//   - Absent issuer/subject signals local-operator mode (no real principal yet).
//   - Must migrate to a proper room-meta TLRecord during a schema-hardening lap.
// ---------------------------------------------------------------------------

export interface LarariumBootReceiptMeta {
  readonly id:       "lararium:boot-receipt";
  readonly typeName: "lararium:room-meta";

  readonly roomId:        string;
  readonly receiptHash:   string;   // SHA-256 hex → future: base32 CIDv1 sha2-256
  readonly issuedAt:      string;   // ISO 8601
  readonly authorityMode: "local-operator" | "ucan-delegated" | "keyhive";

  /** UCAN iss / Keyhive Ed25519 principal — absent in local-operator mode. */
  readonly issuer?: {
    readonly kind: "did" | "ed25519" | "local";
    readonly id:   string;
  };

  /** UCAN aud / Keyhive document-group principal — absent in local-operator mode. */
  readonly subject?: {
    readonly kind: "did" | "ed25519" | "local";
    readonly id:   string;
  };

  /** Orichalcum capability envelope — UCAN can/with/nb analog. */
  readonly capability?: {
    readonly kind:      "orichalcum";
    readonly abilities: readonly string[];
    readonly resource:  string;
    readonly caveats?:  Record<string, unknown>;
  };

  /** Proof chain — UCAN prf CIDs, Keyhive membership op heads. */
  readonly proofs?: ReadonlyArray<{
    readonly kind:   "ucan" | "keyhive" | "orichalcum";
    readonly cid?:   string;    // base32 CIDv1 — present when crypto lands
    readonly bytes?: string;    // base64url raw bytes — pre-CID phase
    readonly hash?:  string;    // SHA-256 hex fallback
  }>;

  /** Authority graph heads — Keyhive membershipHead, Beelay collectionHead/manifestHead. */
  readonly graph?: {
    readonly membershipHead?:  string;
    readonly manifestHead?:    string;
    readonly collectionHead?:  string;
  };
}

// ---------------------------------------------------------------------------
// LarariumOpenPhase — async host opening sequence (authority-first ordering)
// ---------------------------------------------------------------------------

export type LarariumOpenPhase =
  | { readonly kind: "host-opening";       readonly hostId:    string }
  | { readonly kind: "authority-opening";  readonly hostId:    string }
  | { readonly kind: "authority-ready";    readonly receipt:   string }
  | { readonly kind: "manifest-opening";   readonly recipeUri: string }
  | { readonly kind: "manifest-ready";     readonly titles:    readonly string[] }
  | { readonly kind: "store-opening";      readonly recipeUri: string }
  | { readonly kind: "store-ready";        readonly titleCount: number }
  | { readonly kind: "tw5-opening";        readonly hostId:    string }
  | { readonly kind: "tw5-ready";          readonly hostId:    string }
  | { readonly kind: "projection-opening"; readonly roomId:    string }
  | { readonly kind: "projection-ready";   readonly roomId:    string }
  | { readonly kind: "live";              readonly offset:    number }
  | { readonly kind: "error";             readonly message:   string };

// ---------------------------------------------------------------------------
// Carrier payload — one meme's parsed state
// ---------------------------------------------------------------------------

export interface LiveCarrier {
  uri: string;
  laresRelPath: string | null;
  text: string;
  contentHash: string;
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

/** Full initial state — sent once on WebSocket connect. */
export interface LiveMsgSnapshot {
  type: "snapshot";
  compiledAt: string;
  carriers: LiveCarrier[];
  /** Pre-computed room filter results (server-side TW engine). */
  rooms?: Record<string, string[]>;
}

/** Incremental update — sent whenever lares/ files change. */
export interface LiveMsgDelta {
  type: "delta";
  timestamp: string;
  added:    LiveCarrier[];
  modified: LiveCarrier[];
  removed:  string[];   // URIs only
}

/** Reaction event broadcast — fan-out from a fire() call. */
export interface LiveMsgEvent {
  type: "event";
  fromUri:  string;
  trigger:  string;
  targetFn: string | null;
  payload:  unknown;
  timestamp: string;
}

/** Server error / diagnostic. */
export interface LiveMsgError {
  type: "error";
  code: string;
  message: string;
}

/**
 * Boot receipt — causal island join artifact.
 *
 * Sent by the server BEFORE any CRDT frames flow. This is the "shape of the
 * visible world at join time" (federated-causal-islands lifecycle law).
 * Not a full CRDT sync — a snapshot of what this peer is currently authorized to see.
 *
 * Usable as a prompt cache key via receiptHash.
 * The offset belongs to the edge island: reconnect resumes from here, not from zero.
 */
export interface LiveMsgBootReceipt {
  type:          "boot-receipt";
  /** Edge island ID for this connection: "edge:${sourceNode}:${targetNode}:${epoch}" */
  edgeIslandId:  string;
  /** ISO timestamp when this receipt was issued. */
  issuedAt:      string;
  /** Visible room IDs at join time (derived from Orichalcum authority graph). */
  visibleRooms:  string[];
  /** Meme count visible to this peer at join time. */
  visibleMemes:  number;
  /** Monotonic offset — resume from here on reconnect (not from zero). */
  offset:        number;
  /** SHA-256 of the boot artifact receipt — prompt cache key. */
  receiptHash:   string;
  /** Authority mode for this session. "local-operator" in development. */
  authorityMode: "local-operator" | "ucan-delegated";
}

export type LiveServerMsg =
  | LiveMsgSnapshot
  | LiveMsgDelta
  | LiveMsgEvent
  | LiveMsgError
  | LiveMsgBootReceipt;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

/** Fire a reaction trigger — broadcasts as LiveMsgEvent to all clients. */
export interface LiveMsgFire {
  type: "fire";
  fromUri:  string;
  trigger:  string;
  payload?: unknown;
}

/** Subscribe to events from a specific URI (future: presence, cursors). */
export interface LiveMsgSubscribe {
  type: "subscribe";
  uri: string;
}

export type LiveClientMsg = LiveMsgFire | LiveMsgSubscribe;

// ---------------------------------------------------------------------------
// Reaction graph — built from PranaEdge[] on both sides
// ---------------------------------------------------------------------------

export interface ReactionBinding {
  fromUri:  string;
  toUri:    string;
  trigger:  string | null;
  fn:       string | null;
  role:     string | null;
}

/** Extract reaction bindings from a flat edge list (isomorphic). */
export function extractReactionBindings(
  edges: readonly { fromUri: string; toUri: string; family: string; role: string | null; payload: Record<string, unknown> }[]
): ReactionBinding[] {
  return edges
    .filter((e) => e.family === "reaction")
    .map((e) => ({
      fromUri: e.fromUri,
      toUri:   e.toUri,
      trigger: (e.payload["trigger"] as string | undefined) ?? null,
      fn:      (e.payload["fn"]      as string | undefined) ?? null,
      role:    e.role,
    }));
}

export type ReactionHandler = (binding: ReactionBinding, payload: unknown) => void | Promise<void>;

/** In-memory reaction graph — subscribe + fire. Isomorphic. Async-first. */
export class ReactionGraph {
  private handlers = new Map<string, ReactionHandler[]>();
  private _bindings: ReactionBinding[] = [];

  /**
   * Load bindings — replaces the current set.
   * Does not register handlers; use subscribe() for live callbacks.
   */
  load(bindings: ReactionBinding[]): void {
    this.handlers.clear();
    for (const b of bindings) {
      const key = reactionKey(b.fromUri, b.trigger);
      if (!this.handlers.has(key)) this.handlers.set(key, []);
    }
    this._bindings = bindings;
  }

  get bindings(): readonly ReactionBinding[] { return this._bindings; }

  /** Register a live handler for a (fromUri, trigger) pair. Returns unsubscribe fn. */
  subscribe(fromUri: string, trigger: string, handler: ReactionHandler): () => void {
    const key = reactionKey(fromUri, trigger);
    if (!this.handlers.has(key)) this.handlers.set(key, []);
    const list = this.handlers.get(key)!;
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  private _resolveBinding(fromUri: string, trigger: string): ReactionBinding {
    return (
      this._bindings.find((b) => b.fromUri === fromUri && b.trigger === trigger) ??
      { fromUri, toUri: "", trigger, fn: null, role: null }
    );
  }

  /**
   * Fire all handlers for (fromUri, trigger) — `hui` / all-complete semantics.
   * Awaits every handler. Use as the default fire() mode.
   */
  async fire(fromUri: string, trigger: string, payload: unknown = {}): Promise<void> {
    const key = reactionKey(fromUri, trigger);
    const list = this.handlers.get(key) ?? [];
    if (list.length === 0) return;
    const binding = this._resolveBinding(fromUri, trigger);
    await Promise.all(list.map((h) => Promise.resolve(h(binding, payload))));
  }

  /** `hui` — wait for all handlers to complete (alias for fire). */
  fireAll(fromUri: string, trigger: string, payload: unknown = {}): Promise<void> {
    return this.fire(fromUri, trigger, payload);
  }

  /**
   * `heihei` — first handler to settle wins; all continue running.
   * Returns when the fastest handler resolves or rejects.
   */
  async fireRace(fromUri: string, trigger: string, payload: unknown = {}): Promise<void> {
    const key = reactionKey(fromUri, trigger);
    const list = this.handlers.get(key) ?? [];
    if (list.length === 0) return;
    const binding = this._resolveBinding(fromUri, trigger);
    await Promise.race(list.map((h) => Promise.resolve(h(binding, payload))));
  }

  /**
   * `puka` — first handler to resolve wins; others receive an abort signal.
   * Handlers that respect abortSignal can cancel in-flight work.
   * Returns when the first handler resolves (rejects if all reject).
   */
  async fireRush(
    fromUri: string,
    trigger: string,
    payload: unknown = {},
  ): Promise<void> {
    const key = reactionKey(fromUri, trigger);
    const list = this.handlers.get(key) ?? [];
    if (list.length === 0) return;
    const binding = this._resolveBinding(fromUri, trigger);
    const ac = new AbortController();
    const augmented = { ...((payload as object) ?? {}), abortSignal: ac.signal };
    try {
      await Promise.any(list.map((h) => Promise.resolve(h(binding, augmented))));
    } finally {
      ac.abort();
    }
  }
}

function reactionKey(fromUri: string, trigger: string | null): string {
  return `${fromUri}\x00${trigger ?? "*"}`;
}
