/**
 * ReadinessMap — observable progressive-readiness registry.
 *
 * Replaces the single "app ready" gate with a named vector per shrine-light.
 * Well-known keys are typed; dynamic corpus/projection keys use string suffixes.
 *
 * Boot doctrine (research packet §8, principle 1):
 *   auth → catalog → snapshot → room-content → room-presence
 *                             ↘ tw-vm → tldraw-doc
 *                             ↘ mcp-index → disk-projector → kowloon-feed
 *                             ↘ corpus:<id> ...
 *                             ↘ projection:<id> ...
 *
 * Presence does not share fate with content. Each vector lights independently.
 */

// ---------------------------------------------------------------------------
// Well-known readiness keys
// ---------------------------------------------------------------------------

// Corpus meme: lar:///ha.ka.ba/api/v0.1/lararium/schema/readiness-keys
export const READINESS_KEYS = [
  "auth",
  "catalog",
  "snapshot",
  "room-content",
  "room-presence",
  "tw-vm",
  "tldraw-doc",
  "mcp-index",
  "disk-projector",
  "kowloon-feed",
] as const;

export type WellKnownReadinessKey = typeof READINESS_KEYS[number];

/**
 * Dynamic key forms:
 *   corpus:<id>       e.g. "corpus:sdm-ftls"
 *   projection:<id>   e.g. "projection:hud-render"
 */
export type ReadinessKey = WellKnownReadinessKey | `corpus:${string}` | `projection:${string}`;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

export type ReadinessListener = (key: ReadinessKey, ready: boolean, map: ReadonlyMap<ReadinessKey, boolean>) => void;

// ---------------------------------------------------------------------------
// ReadinessMap
// ---------------------------------------------------------------------------

export class ReadinessMap {
  private readonly _state = new Map<ReadinessKey, boolean>();
  private readonly _listeners = new Set<ReadinessListener>();

  /** Mark a key ready. No-op if already true. */
  set(key: ReadinessKey, ready: boolean): void {
    if (this._state.get(key) === ready) return;
    this._state.set(key, ready);
    for (const fn of this._listeners) fn(key, ready, this._state);
  }

  mark(key: ReadinessKey): void { this.set(key, true); }
  unmark(key: ReadinessKey): void { this.set(key, false); }

  get(key: ReadinessKey): boolean { return this._state.get(key) ?? false; }

  /** True only if every supplied key reports ready. */
  allReady(...keys: ReadinessKey[]): boolean {
    return keys.every((k) => this._state.get(k) === true);
  }

  /** Subscribe to any readiness change. Returns unsubscribe fn. */
  subscribe(fn: ReadinessListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Current snapshot as a plain object — useful for HUD serialization. */
  snapshot(): Record<string, boolean> {
    return Object.fromEntries(this._state);
  }
}
