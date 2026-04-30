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
// LarariumAuthorityEnvelope — discriminated union for the three authority modes.
//
// local-operator: development and single-operator rooms — no crypto required.
// ucan-delegated: public-key-verifiable capability chain (Brooklyn / Fission model).
// keyhive:        encrypted group sync with membership graph (Brooklyn / Beelay model).
//
// Only "local-operator" executes today. The other two arms are type-only protocol
// sockets — not instantiated in any runtime path until crypto lands.
// ---------------------------------------------------------------------------

export type LarariumAuthorityEnvelope =
  | {
      readonly mode:        "local-operator";
      readonly roomId:      string;
      readonly receiptHash: string;
      readonly issuedAt:    string;
    }
  | {
      readonly mode:       "ucan-delegated";
      readonly issuer:     string;
      readonly subject:    string;
      readonly capability: unknown;
      readonly proofs?:    readonly unknown[];
    }
  | {
      readonly mode:      "keyhive";
      readonly graph:     unknown;
      readonly peer?:     string;
      readonly group?:    string;
      readonly document?: string;
    };

// ---------------------------------------------------------------------------
// canPromoteToCanon — authority policy guard for canon-promotion ceremony.
//
// Only operator-import with local-operator mode may promote to canon.
// All live-edit origins (tw-local, crdt-remote, canvas-draft, mcp-draft)
// require the explicit PUT /admin/promote ceremony to reach lares/.
// ---------------------------------------------------------------------------

export interface CanPromoteInput {
  readonly origin:        { readonly kind: string };
  readonly authorityMode: LarariumAuthorityEnvelope["mode"];
  readonly target:        string;
}

export interface CanPromoteResult {
  readonly ok:     boolean;
  readonly reason?: string;
}

export function canPromoteToCanon(input: CanPromoteInput): CanPromoteResult {
  if (input.origin.kind === "canvas-draft") {
    // Canvas/TW5 edits accumulate in Automerge room state (branch/live commit).
    // They require the explicit PUT /admin/promote ceremony to reach canon.
    return { ok: false, reason: "canvas-draft-requires-promote-ceremony" };
  }
  if (input.origin.kind === "tw-local" || input.origin.kind === "crdt-remote") {
    return { ok: false, reason: "live-edit-origin-cannot-promote-canon-without-ceremony" };
  }
  if (input.origin.kind === "canon-hydrate") {
    return { ok: true };
  }
  if (input.origin.kind === "mcp-draft" || input.origin.kind === "operator-import") {
    // Operator-trusted paths — allowed but should pass through review ceremony in production.
    return { ok: true };
  }
  return { ok: false, reason: `unknown-origin-kind:${input.origin.kind}` };
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
// Reaction graph — built from PranaEdge[] on both sides
// ---------------------------------------------------------------------------

export interface ReactionBinding {
  fromUri:  string;
  toUri:    string;
  trigger:  string | null;
  fn:       string | null;
  role:     string | null;
  /**
   * "static"  — declared in carrier text (pranala edge, design-time wiring).
   *             Equivalent to UEFN editor-side device graph connections.
   * "dynamic" — established at runtime via subscribe(). Equivalent to
   *             Verse code calling DeviceA.EventX.Subscribe(handler).
   */
  source:   "static" | "dynamic";
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
      source:  "static" as const,
    }));
}

export type ReactionHandler = (binding: ReactionBinding, payload: unknown) => void | Promise<void>;

/** In-memory reaction graph — subscribe + fire. Isomorphic. Async-first. */
export class ReactionGraph {
  // Per-(fromUri, trigger) handlers — wired by subscribe()
  private handlers    = new Map<string, ReactionHandler[]>();
  // Per-fn handlers — wired by subscribeByFn(); fire for any binding with that fn
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
      const key = reactionKey(b.fromUri, b.trigger);
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
   * Handler slots for new (fromUri, trigger) keys are created automatically;
   * subscribeByFn() handlers fire for them immediately on next fire() call.
   */
  updateUri(uri: string, bindings: ReactionBinding[]): void {
    // Remove old bindings for this URI, add new ones.
    const kept    = this._bindings.filter((b) => b.fromUri !== uri);
    const oldKeys = new Set(
      this._bindings.filter((b) => b.fromUri === uri).map((b) => reactionKey(b.fromUri, b.trigger))
    );
    const newKeys = new Set(bindings.map((b) => reactionKey(b.fromUri, b.trigger)));

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
      this.handlers.delete(reactionKey(b.fromUri, b.trigger));
    }
    this._bindings = this._bindings.filter((b) => b.fromUri !== uri);
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

  /**
   * Register a handler for ALL bindings with a given fn value.
   * Fires for any (fromUri, trigger) whose resolved binding has fn === fnName.
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
   * Verse `suspends` bridge primitive — resolves when (fromUri, trigger) fires once.
   * Returns a Promise augmented with a `cancel()` method; cancel() rejects the Promise.
   */
  subscribeOnce(fromUri: string, trigger: string): Promise<unknown> & { cancel(): void } {
    let unsub: (() => void) | null = null;
    let reject_: ((reason?: unknown) => void) | null = null;
    const p = new Promise<unknown>((resolve, reject) => {
      reject_ = reject;
      unsub = this.subscribe(fromUri, trigger, (_binding, payload) => {
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

  private _resolveBinding(fromUri: string, trigger: string): ReactionBinding {
    return (
      this._bindings.find((b) => b.fromUri === fromUri && b.trigger === trigger) ??
      { fromUri, toUri: "", trigger, fn: null, role: null, source: "dynamic" as const }
    );
  }

  private _dispatchToFnHandlers(binding: ReactionBinding, _payload: unknown): ReactionHandler[] {
    if (!binding.fn) return [];
    return this.fnHandlers.get(binding.fn) ?? [];
  }

  /**
   * Fire all handlers for (fromUri, trigger) — `hui` / all-complete semantics.
   * Runs both per-key handlers (subscribe) and fn handlers (subscribeByFn).
   */
  async fire(fromUri: string, trigger: string, payload: unknown = {}): Promise<void> {
    const key     = reactionKey(fromUri, trigger);
    const binding = this._resolveBinding(fromUri, trigger);
    const list    = [...(this.handlers.get(key) ?? []), ...this._dispatchToFnHandlers(binding, payload)];
    if (list.length === 0) return;
    await Promise.all(list.map((h) => Promise.resolve(h(binding, payload))));
  }

  /** `hui` — wait for all handlers to complete (alias for fire). */
  fireAll(fromUri: string, trigger: string, payload: unknown = {}): Promise<void> {
    return this.fire(fromUri, trigger, payload);
  }

  /**
   * Synchronous tick dispatch — UEFN fidelity mode.
   * Runs per-key handlers then fn handlers in subscription order.
   */
  fireSync(fromUri: string, trigger: string, payload: unknown = {}): void {
    const key     = reactionKey(fromUri, trigger);
    const binding = this._resolveBinding(fromUri, trigger);
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
