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

export type LiveServerMsg = LiveMsgSnapshot | LiveMsgDelta | LiveMsgEvent | LiveMsgError;

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
