/**
 * MemeProvider — coalescing fan-out layer between an Automerge DocHandle
 * and multiple typed projections (TW5 wiki, disk write-back, canvas, MCP).
 *
 * Motivation:
 *   Automerge replays all historical patches to new peers on connect. Without
 *   coalescing, each patch fires every subscriber: the same URI is deserialized
 *   8+ times, TW5 accumulates hundreds of addTiddler calls before its first
 *   refresh, and disk write-back hammers the filesystem redundantly.
 *
 * Contract:
 *   - Caller owns the DocHandle and feeds raw patches via handleChange().
 *   - Each projection is registered via addProjection(); receives one coalesced
 *     LarTiddlerChange per URI per debounce window (DEBOUNCE_MS).
 *   - After the initial Automerge replay settles, caller calls markSyncComplete().
 *     MemeProvider flushes all pending timers immediately and fires onSyncComplete
 *     on every registered projection — the TW5 projection uses this to trigger a
 *     single bulk-refresh instead of one refresh per tiddler.
 *
 * Isomorphic: zero Automerge import. Works identically in Node and browser.
 * Lives in @lararium/core so @lararium/app, @lararium/node, and future packages
 * all share one implementation without circular dependencies.
 */

import type { LarTiddlerRecord, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";

// ---------------------------------------------------------------------------
// MemeProjection — typed slot for a downstream integration
// ---------------------------------------------------------------------------

export interface MemeProjection {
  /**
   * Fired once per coalesced URI, after DEBOUNCE_MS has elapsed since the
   * last patch touching that URI. record is null for tombstoned/deleted URIs.
   */
  onUriChanged(change: LarTiddlerChange): void;

  /**
   * Fired once per island when its initial Automerge sync replay has settled.
   * islandId identifies which doc completed — projections buffer per-island and
   * flush only that island's queue, so a slow corpus doc cannot gate a fast catalog.
   *
   * Single-doc default: islandId = "automerge" (matches AutomergeMemeStore origin).
   * M-bags: each DocHandle passes its own edgeIslandId.
   */
  onSyncComplete?(islandId: string): void;
}

// Minimal patch shape — only path[0] (the top-level doc key) is needed.
export interface RawPatch {
  path: unknown[];
}

// ---------------------------------------------------------------------------
// MemeProvider
// ---------------------------------------------------------------------------

export class MemeProvider {
  /**
   * Debounce window in ms. Coalesces rapid same-URI patches from Automerge
   * replay (8–50 patches per URI on a fresh peer connect). 40ms is tight
   * enough to feel synchronous on a local connection; loose enough to absorb
   * a full initial-sync burst before the first projection callback fires.
   */
  static readonly DEBOUNCE_MS = 40;

  private readonly _projections = new Set<MemeProjection>();
  private readonly _pending     = new Map<string, { origin: ChangeOrigin; timer: ReturnType<typeof setTimeout> }>();
  /** Set of island IDs whose initial replay has settled. Default island: "automerge". */
  private readonly _syncComplete = new Set<string>();

  constructor(
    /** Returns the current full document state. Called at debounce-fire time, not patch time. */
    private readonly _getDoc: () => Record<string, unknown>,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /** True after markSyncComplete() has been called for the given island (default "automerge"). */
  isSyncComplete(islandId = "automerge"): boolean { return this._syncComplete.has(islandId); }

  /**
   * Register a projection. Returns an unsubscribe function.
   *
   * If markSyncComplete() has already fired (late registration — e.g. an adaptor
   * created after initMemeRepo returns), onSyncComplete is called immediately so
   * the projection enters its live state rather than buffering indefinitely.
   */
  addProjection(p: MemeProjection): () => void {
    this._projections.add(p);
    // Late registration — fire onSyncComplete for every already-complete island.
    for (const islandId of this._syncComplete) {
      try { p.onSyncComplete?.(islandId); }
      catch (e) { console.error("[MemeProvider] projection error in late onSyncComplete:", e); }
    }
    return () => this._projections.delete(p);
  }

  // ---------------------------------------------------------------------------
  // Patch ingestion — call from handle.on("change", ...)
  // ---------------------------------------------------------------------------

  /**
   * Feed raw Automerge patches. Schedules a debounced fire for each touched key.
   *
   * Eligible keys:
   *   lar:    — canonical meme URIs (corpus, room, system)
   *   Draft of — identity-scoped drafts synced across user devices
   *
   * $:/temp/ and $:/ system tiddlers are excluded — they never enter the store.
   * Natural language titles (personal bag, imported wikis) will be included once
   * the personal bag Automerge doc lands (M-bags). The filter here stays in sync
   * with the save cascade — whatever the adaptor writes, the provider must fan out.
   */
  handleChange(patches: RawPatch[], origin: ChangeOrigin): void {
    for (const p of patches) {
      const key = p.path[0];
      if (typeof key !== "string") continue;
      if (key.startsWith("lar:") || key.startsWith("Draft of ")) {
        this._schedule(key, origin);
      }
    }
  }

  /**
   * Fire a change immediately, bypassing the debounce. Use for local writes
   * (put / tombstone) where the caller already holds the authoritative value
   * and echo-loop guards depend on synchronous delivery.
   */
  fireImmediate(change: LarTiddlerChange): void {
    for (const p of this._projections) {
      try { p.onUriChanged(change); }
      catch (e) { console.error("[MemeProvider] projection error in onUriChanged:", e); }
    }
  }

  // ---------------------------------------------------------------------------
  // Sync-complete gate — call once after initial Automerge replay settles
  // ---------------------------------------------------------------------------

  /**
   * Signal that the initial Automerge sync replay has settled. Flushes all
   * pending debounce timers immediately (so projections receive the full initial
   * state before onSyncComplete fires), then fires onSyncComplete on every
   * registered projection. Idempotent — safe to call more than once.
   */
  /**
   * Signal that an island's initial Automerge replay has settled.
   * Flushes all pending debounce timers (for lar: URIs in this island's replay),
   * then fires onSyncComplete(islandId) on every registered projection.
   * Idempotent per island — safe to call more than once for the same id.
   *
   * Single-doc default: islandId = "automerge".
   * M-bags: each DocHandle calls this with its own edgeIslandId after whenReady().
   */
  markSyncComplete(islandId = "automerge"): void {
    if (this._syncComplete.has(islandId)) return;
    this._syncComplete.add(islandId);

    // Flush all pending debounces — deliver final state now, don't wait.
    for (const [uri, { origin, timer }] of this._pending) {
      clearTimeout(timer);
      this._pending.delete(uri);
      this._fire(uri, origin);
    }

    for (const p of this._projections) {
      try { p.onSyncComplete?.(islandId); }
      catch (e) { console.error("[MemeProvider] projection error in onSyncComplete:", e); }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _schedule(uri: string, origin: ChangeOrigin): void {
    const existing = this._pending.get(uri);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => {
      this._pending.delete(uri);
      this._fire(uri, origin);
    }, MemeProvider.DEBOUNCE_MS);

    this._pending.set(uri, { origin, timer });
  }

  private _fire(uri: string, origin: ChangeOrigin): void {
    const doc = this._getDoc();
    const raw = doc[uri] as {
      title?:   string;
      fields?:  Record<string, string>;
      text?:    string;
      deleted?: boolean;
    } | undefined;

    const inferredBag = uri.startsWith("Draft of ")
      ? "session" as const   // drafts: identity-scoped but not yet in dedicated draft bag
      : "room"    as const;  // lar: URIs: live room content

    const record: LarTiddlerRecord | null = raw
      ? Object.freeze({
          title:   raw.title ?? uri,
          fields:  Object.freeze({ ...(raw.fields ?? {}) }),
          ...(raw.text    !== undefined && { text:    raw.text    }),
          ...(raw.deleted !== undefined && { deleted: raw.deleted }),
          bag: inferredBag,
        })
      : null;

    const change: LarTiddlerChange = { title: uri, record, origin };
    for (const p of this._projections) {
      try { p.onUriChanged(change); }
      catch (e) { console.error("[MemeProvider] projection error in onUriChanged:", e); }
    }
  }
}
