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
// LarariumOpenPhase — async host opening sequence (authority-first ordering)
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/open-phases
// ---------------------------------------------------------------------------

export type LarariumOpenPhase =
  | { readonly kind: "host-opening";       readonly hostId:    string }
  | { readonly kind: "authority-opening";  readonly hostId:    string }
  | { readonly kind: "authority-ready";    readonly receipt:   string }
  | { readonly kind: "store-opening";      readonly recipeUri: string }
  | { readonly kind: "store-ready";        readonly titleCount: number }
  | { readonly kind: "tw5-opening";        readonly hostId:    string }
  | { readonly kind: "tw5-hydrating";      readonly loaded:    number; readonly total: number }
  | { readonly kind: "tw5-ready";          readonly hostId:    string }
  | { readonly kind: "live";              readonly offset:    number }
  | { readonly kind: "error";             readonly message:   string };

// ---------------------------------------------------------------------------
// LarariumAuthorityEnvelope — auth/session envelope for live protocol seams.
//
// local-dev: provider-neutral development receipt; no cryptographic authority.
// keyhive:   future encrypted group sync with membership graph (Brooklyn / Beelay).
//
// Only "local-dev" executes today. The Keyhive arm is a type-only socket until
// the membership graph and encrypted sync layer land.
// ---------------------------------------------------------------------------

export type LarariumAuthorityEnvelope =
  | {
      readonly mode:        "local-dev";
      readonly roomId:      string;
      readonly receiptHash: string;
      readonly issuedAt:    string;
    }
  | {
      readonly mode:      "keyhive";
      readonly graph:     unknown;
      readonly peer?:     string;
      readonly group?:    string;
      readonly document?: string;
    };

// ---------------------------------------------------------------------------
// Keyhive promotion seam — stub only.
//
// The old localhost mutation ceremony has been removed. Future canon
// crossing should not mutate lares/ directly from a live edit path. It should
// submit a proposal to the Keyhive-backed authority graph:
//
//   draft/room record
//     → promotion proposal
//     → Keyhive membership/capability check
//     → review/signature receipt
//     → projection/write-back worker materializes canon
//
// This module only names the request/result shape so callers have a stable place
// to aim. No runtime path calls this yet.
// ---------------------------------------------------------------------------

export interface KeyhivePromotionRequest {
  readonly fromUri:      string;
  readonly targetUri:    string;
  readonly roomId:       string;
  readonly corpusId?:    string;
  readonly proposedText?: string;
  readonly reason?:      string;
}

export interface KeyhivePromotionResult {
  readonly ok:     boolean;
  readonly status: "not-implemented" | "queued" | "rejected" | "accepted";
  readonly reason?: string;
  readonly receipt?: unknown;
}

export async function requestKeyhivePromotion(
  _request: KeyhivePromotionRequest,
): Promise<KeyhivePromotionResult> {
  return {
    ok: false,
    status: "not-implemented",
    reason: "keyhive-promotion-graph-not-wired",
  };
}

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

/** Reaction event broadcast — fan-out from a fire() call. */
export interface LiveMsgEvent {
  type: "event";
  fromUri:  string;
  trigger:  string;
  targetFn: string | null;
  payload:  unknown;
  timestamp: string;
}


// ---------------------------------------------------------------------------
// Reaction graph — built from PranalaEdge[] on both sides
// ---------------------------------------------------------------------------

export interface ReactionBinding {
  fromUri:      string;
  toUri:        string;
  listenable:   string | null;
  subscribable: string | null;
  role:         string | null;
  /**
   * "wired"      — declared in carrier text (papalohe pranala edge, design-time wiring).
   *                Equivalent to UEFN editor-side device graph pin connections.
   * "subscribed" — established at runtime via subscribe(). Equivalent to
   *                Verse code calling DeviceA.OnActivated.Subscribe(handler).
   */
  source:   "wired" | "subscribed";
}

/** Extract reaction bindings from a flat edge list (isomorphic). */
export function extractReactionBindings(
  edges: readonly { fromUri: string; toUri: string; family: string; role: string | null; payload: Record<string, unknown> }[]
): ReactionBinding[] {
  return edges
    .filter((e) => e.family === "reaction")
    .map((e) => ({
      fromUri:      e.fromUri,
      toUri:        e.toUri,
      listenable:   (e.payload["listenable"] as string | undefined) ?? null,
      subscribable: (e.payload["subscribable"] as string | undefined) ?? null,
      role:    e.role,
      source:  "wired" as const,
    }));
}

export type ReactionHandler = (binding: ReactionBinding, payload: unknown) => void | Promise<void>;

/** In-memory reaction graph — subscribe + fire. Isomorphic. Async-first. */
export class ReactionGraph {
  // Per-(fromUri, listenable) handlers — wired by subscribe()
  private handlers    = new Map<string, ReactionHandler[]>();
  // Per-subscribable handlers — wired by subscribeByFn(); fire for any binding with that subscribable
  private fnHandlers  = new Map<string, ReactionHandler[]>();
  private _bindings: ReactionBinding[] = [];

  /**
   * Load bindings — replaces the entire set.
   * Preserves existing handlers (subscribe/subscribeByFn calls remain valid).
   * For incremental updates prefer updateUri() / removeUri().
   */
  load(bindings: readonly ReactionBinding[]): void {
    // Preserve handler lists; just ensure slots exist for new keys.
    const seen = new Set<string>();
    for (const b of bindings) {
      const key = reactionKey(b.fromUri, b.listenable);
      if (!this.handlers.has(key)) this.handlers.set(key, []);
      seen.add(key);
    }
    // Drop handler slots for bindings that no longer exist AND are unoccupied.
    // Occupied slots (subscribeOnce, kukali suspensions) must survive graph rebuilds.
    for (const key of this.handlers.keys()) {
      if (!seen.has(key) && (this.handlers.get(key)?.length ?? 0) === 0) {
        this.handlers.delete(key);
      }
    }
    this._bindings = bindings.slice();
  }

  /**
   * Incremental update — replace bindings for one URI without touching others.
   * Handler slots for new (fromUri, listenable) keys are created automatically;
   * subscribeByFn() handlers fire for them immediately on next fire() call.
   */
  updateUri(uri: string, bindings: ReactionBinding[]): void {
    // Remove old bindings for this URI, add new ones.
    const kept    = this._bindings.filter((b) => b.fromUri !== uri);
    const oldKeys = new Set(
      this._bindings.filter((b) => b.fromUri === uri).map((b) => reactionKey(b.fromUri, b.listenable))
    );
    const newKeys = new Set(bindings.map((b) => reactionKey(b.fromUri, b.listenable)));

    // Drop handler slots that disappeared.
    for (const key of oldKeys) {
      if (!newKeys.has(key)) this.handlers.delete(key);
    }
    // Ensure slots exist for new keys.
    for (const key of newKeys) {
      if (!this.handlers.has(key)) this.handlers.set(key, []);
    }
    this._bindings = [...kept, ...bindings];
  }

  /** Remove all bindings for a URI (tiddler deleted). */
  removeUri(uri: string): void {
    for (const b of this._bindings.filter((b) => b.fromUri === uri)) {
      this.handlers.delete(reactionKey(b.fromUri, b.listenable));
    }
    this._bindings = this._bindings.filter((b) => b.fromUri !== uri);
  }

  get bindings(): readonly ReactionBinding[] { return this._bindings; }

  /** Register a live handler for a (fromUri, listenable) pair. Returns unsubscribe fn. */
  subscribe(fromUri: string, listenable: string, handler: ReactionHandler): () => void {
    const key = reactionKey(fromUri, listenable);
    if (!this.handlers.has(key)) this.handlers.set(key, []);
    const list = this.handlers.get(key)!;
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  /**
   * Register a handler for ALL bindings with a given subscribable value.
   * Fires for any (fromUri, listenable) whose resolved binding has subscribable === name.
   * This is the preferred wiring point for view-layer actions — subscribe once,
   * automatically handles bindings that arrive after boot via updateUri().
   * Equivalent to subscribing to a UEFN Relay device by name rather than by source.
   */
  subscribeByFn(fnName: string, handler: ReactionHandler): () => void {
    if (!this.fnHandlers.has(fnName)) this.fnHandlers.set(fnName, []);
    const list = this.fnHandlers.get(fnName)!;
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  /**
   * Verse `suspends` bridge primitive — resolves when (fromUri, listenable) fires once.
   * Returns a Promise augmented with a `cancel()` method; cancel() rejects the Promise.
   */
  subscribeOnce(fromUri: string, listenable: string): Promise<unknown> & { cancel(): void } {
    let unsub: (() => void) | null = null;
    let reject_: ((reason?: unknown) => void) | null = null;
    const p = new Promise<unknown>((resolve, reject) => {
      reject_ = reject;
      unsub = this.subscribe(fromUri, listenable, (_binding, payload) => {
        unsub!();
        unsub = null;
        resolve(payload);
      });
    }) as Promise<unknown> & { cancel(): void };
    p.cancel = () => {
      unsub?.();
      unsub = null;
      reject_?.(new Error("subscribeOnce cancelled"));
    };
    return p;
  }

  private _resolveBinding(fromUri: string, listenable: string): ReactionBinding {
    return (
      this._bindings.find((b) => b.fromUri === fromUri && b.listenable === listenable) ??
      { fromUri, toUri: "", listenable, subscribable: null, role: null, source: "subscribed" as const }
    );
  }

  private _dispatchToFnHandlers(binding: ReactionBinding, _payload: unknown): ReactionHandler[] {
    if (!binding.subscribable) return [];
    return this.fnHandlers.get(binding.subscribable) ?? [];
  }

  /**
   * Fire all handlers for (fromUri, listenable) — `hui` / all-complete semantics.
   * Runs both per-key handlers (subscribe) and fn handlers (subscribeByFn).
   */
  async fire(fromUri: string, listenable: string, payload: unknown = {}): Promise<void> {
    const key     = reactionKey(fromUri, listenable);
    const binding = this._resolveBinding(fromUri, listenable);
    const list    = [...(this.handlers.get(key) ?? []), ...this._dispatchToFnHandlers(binding, payload)];
    if (list.length === 0) return;
    await Promise.all(list.map((h) => Promise.resolve(h(binding, payload))));
  }

  /** `hui` — wait for all handlers to complete (alias for fire). */
  fireAll(fromUri: string, listenable: string, payload: unknown = {}): Promise<void> {
    return this.fire(fromUri, listenable, payload);
  }

  /**
   * Synchronous tick dispatch — UEFN fidelity mode.
   * Runs per-key handlers then fn handlers in subscription order.
   */
  fireSync(fromUri: string, listenable: string, payload: unknown = {}): void {
    const key     = reactionKey(fromUri, listenable);
    const binding = this._resolveBinding(fromUri, listenable);
    const list    = [...(this.handlers.get(key) ?? []), ...this._dispatchToFnHandlers(binding, payload)];
    if (list.length === 0) return;
    for (const h of list) {
      try { h(binding, payload); } catch { /* handler errors are isolated */ }
    }
  }

  /**
   * `heihei` — first handler to settle wins; all continue running.
   * Returns when the fastest handler resolves or rejects.
   */
  async fireRace(fromUri: string, listenable: string, payload: unknown = {}): Promise<void> {
    const key = reactionKey(fromUri, listenable);
    const list = this.handlers.get(key) ?? [];
    if (list.length === 0) return;
    const binding = this._resolveBinding(fromUri, listenable);
    await Promise.race(list.map((h) => Promise.resolve(h(binding, payload))));
  }

  /**
   * `puka` — first handler to resolve wins; others receive an abort signal.
   * Handlers that respect abortSignal can cancel in-flight work.
   * Returns when the first handler resolves (rejects if all reject).
   */
  async fireRush(
    fromUri: string,
    listenable: string,
    payload: unknown = {},
  ): Promise<void> {
    const key = reactionKey(fromUri, listenable);
    const list = this.handlers.get(key) ?? [];
    if (list.length === 0) return;
    const binding = this._resolveBinding(fromUri, listenable);
    const ac = new AbortController();
    const augmented = { ...((payload as object) ?? {}), abortSignal: ac.signal };
    try {
      await Promise.any(list.map((h) => Promise.resolve(h(binding, augmented))));
    } finally {
      ac.abort();
    }
  }
}

function reactionKey(fromUri: string, listenable: string | null): string {
  return `${fromUri}\x00${listenable ?? "*"}`;
}
