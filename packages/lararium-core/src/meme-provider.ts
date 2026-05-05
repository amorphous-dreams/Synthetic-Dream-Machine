/**
 * MemeProvider — coalescing fan-out layer between an Automerge DocHandle
 * and multiple typed projections (TW5 wiki, disk write-back, canvas, MCP).
 *
 * Motivation:
 *   Automerge replays all historical patches to new peers on connect. Without
 *   coalescing, each patch fires every subscriber: the same URI gets deserialized
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
   *
   * Covers FFZ Scale-1 (single tiddler) and Scale-2 (meme carrier family).
   * Human-speed edit rates — debounce window filters duplicate patches.
   */
  onUriChanged(change: LarTiddlerChange): void;

  /**
   * Fired when a single Automerge change() transaction touches >= CHANGESET_THRESHOLD
   * URIs simultaneously (FFZ Scale-3 — "all actors tick").
   *
   * Called INSTEAD OF N individual onUriChanged calls when the batch is large.
   * The projection should call bulkSetTiddlers() (or equivalent) once, rather than
   * N individual setTiddler() calls — critical for UEFN-scale actor tick rates.
   *
   * `uris` contains all URIs touched in the transaction. The projection is
   * responsible for fetching current records from the store for those URIs.
   *
   * If absent on a projection, MemeProvider falls back to N individual onUriChanged
   * calls regardless of batch size — i.e. Scale-3 awareness is opt-in.
   */
  onChangeset?(uris: ReadonlySet<string>, origin: ChangeOrigin): void;

  /**
   * Fired once per island when its initial Automerge sync replay has settled.
   * islandId identifies which doc completed — projections buffer per-island and
   * flush only that island's queue, so a slow corpus doc cannot gate a fast catalog.
   *
   * Single-doc default: islandId = "automerge" (matches AutomergeMemeStore origin).
   * M-bags: each DocHandle passes its own edgeIslandId.
   *
   * Covers FFZ Scale-4 (realm/federation reconciliation).
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

  /**
   * FFZ Scale-3 threshold. When a single Automerge change() transaction touches
   * >= CHANGESET_THRESHOLD URIs, MemeProvider emits one onChangeset() call on
   * projections that declare it, INSTEAD OF N individual onUriChanged() calls.
   *
   * Rationale: at UEFN scene scale (100 actors × 60fps) per-URI debounce fires
   * 6000 callbacks/second into the TW5 VM. A single onChangeset() call lets the
   * VM call bulkSetTiddlers() once per transaction instead.
   *
   * Below this threshold: per-URI debounce path (human-speed edits).
   * At/above this threshold: onChangeset() path (game-loop/bulk imports).
   */
  static readonly CHANGESET_THRESHOLD = 10;

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

  /** Returns true after markSyncComplete() has been called for the given island (default "automerge"). */
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
    // Collect all touched URIs from this Automerge change() transaction.
    const touched = new Set<string>();
    for (const p of patches) {
      const key = p.path[0];
      if (typeof key !== "string") continue;
      if (key.startsWith("lar:") || key.startsWith("Draft of ")) {
        touched.add(key);
      }
    }
    if (touched.size === 0) return;

    // FFZ Scale-3: large batch → emit onChangeset to projections that declare it.
    // Any projection WITHOUT onChangeset falls back to N individual debounced calls.
    if (touched.size >= MemeProvider.CHANGESET_THRESHOLD) {
      let hasChangesetProjection = false;
      for (const p of this._projections) {
        if (p.onChangeset) {
          hasChangesetProjection = true;
          try { p.onChangeset(touched, origin); }
          catch (e) { console.error("[MemeProvider] projection error in onChangeset:", e); }
        }
      }
      // For projections WITHOUT onChangeset, fall through to debounce path below.
      if (hasChangesetProjection) {
        // Only fan-out to projections that opted out of changeset mode.
        for (const uri of touched) {
          const existing = this._pending.get(uri);
          if (existing) clearTimeout(existing.timer);
          this._pending.delete(uri);
        }
        // Fire debounced for non-changeset projections only when they exist.
        const hasNonChangeset = [...this._projections].some((p) => !p.onChangeset);
        if (hasNonChangeset) {
          for (const uri of touched) this._schedule(uri, origin);
        }
        return;
      }
    }

    // FFZ Scale-1/2: small batch or no changeset projections → debounce per URI.
    for (const uri of touched) {
      this._schedule(uri, origin);
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
