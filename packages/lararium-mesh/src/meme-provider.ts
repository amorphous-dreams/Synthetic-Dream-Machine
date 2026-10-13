/**
 * MemeProvider — coalescing fan-out layer between an Automerge DocHandle
 * and multiple typed projections (TW5 wiki, disk write-back, canvas, MCP).
 *
 * Motivation:
 *   Automerge replays all historical patches to new vessels on connect. Without
 *   coalescing, each patch fires every subscriber: the same URI gets deserialized
 *   8+ times, TW5 accumulates hundreds of addTiddler calls before its first
 *   refresh, and disk write-back hammers the filesystem redundantly.
 *
 * Contract:
 *   - Caller owns the document and feeds raw patches via handleChange().
 *   - Each projection receives state envelopes with the record, bag, and heads
 *     read together at delivery time.
 *   - After initial replay settles, caller calls markSyncComplete(); pending
 *     projection work drains before onSyncComplete fires.
 *
 * Isomorphic: zero Automerge import. Works identically in Node and browser.
 * Lives in @lararium/mesh so @dreamdeck/app, @lararium/node, and future packages
 * all share one implementation without circular dependencies.
 */

import type { LarTiddlerRecord, LarTiddlerChange, ChangeOrigin, MemeProjection, RawPatch } from "./tiddler-store.js";
import { KeyedCoalesceGate } from "./projection-nalu.js";
import { neverSyncs } from "./lar-uris.js";
export type { MemeProjection, RawPatch } from "./tiddler-store.js";

// ---------------------------------------------------------------------------
// MemeProvider
// ---------------------------------------------------------------------------

export class MemeProvider {
  /**
   * Debounce window in ms. Coalesces rapid same-URI patches from Automerge
   * replay (8–50 patches per URI on a fresh vessel connect). 40ms is tight
   * enough to feel synchronous on a local connection; loose enough to absorb
   * a full initial-sync burst before the first projection callback fires.
   */
  static readonly DEBOUNCE_MS = 40;

  private readonly _projections = new Set<MemeProjection>();
  private readonly _pending     = new Map<string, { origin: ChangeOrigin; timer: ReturnType<typeof setTimeout> }>();
  /** Set of island IDs whose initial replay has settled. Default island: "automerge". */
  private readonly _syncComplete = new Set<string>();

  /** Per-bag accumulator for the gated changeset path — retain each touched URI's origin and read
   *  its current record and heads together when the changeset leaves. */
  private readonly _changesetPending = new Map<string, { touched: Map<string, ChangeOrigin> }>();
  /** The Automerge-boundary nalu (the 5th shore): coalesce a storm of changeset emissions per bag,
   *  storm-safe via maxWaitMs (auditTime — never starves the re-projection under an unbroken flood). */
  private readonly _changesetGate = new KeyedCoalesceGate<string>({
    debounceMs: MemeProvider.DEBOUNCE_MS,
    maxWaitMs: 120,
    onFlush: (bagId) => this._flushChangeset(bagId),
  });

  constructor(
    /** Reads one title's current record, unwrapped, or null where the document holds none. Called at
     *  debounce-fire time, never at patch time. */
    private readonly _getRecord: (title: string) => LarTiddlerRecord | null,
    /** Optional bag context for projections that need source-bag awareness. */
    private readonly _getBag: (() => string | undefined) | undefined,
    /** Synchronous heads snapshot paired with document reads. */
    private readonly _getHeads: () => readonly string[] | null,
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
   * Feed the patches of one change event. A projection that declares `onChangeset` receives each bag's
   * gathered events as one array of complete state envelopes; any other receives one debounced call
   * per title.
   *
   * EVERY TITLE A DOCUMENT HOLDS FANS OUT. The save cascade routes more than `lar:` titles into a
   * document (an ordinary title, a system title, a personal-layer title, a draft under any title), and
   * whatever a writer lands there a reader's open wiki must receive. One class stays home: a title that
   * never persists (`neverSyncs`: the device-only `$:/temp/` plane and the volatile VM plane). No lawful
   * writer lands one in a document, so a peer's document that carries one names a fault at that peer,
   * and this shore does not spread it.
   */
  handleChange(patches: RawPatch[], origin: ChangeOrigin): void {
    // Collect all touched URIs from this Automerge change() transaction.
    const touched = new Set<string>();
    for (const p of patches) {
      const key = p.path[0];
      if (typeof key !== "string" || key === "" || neverSyncs(key)) continue;
      touched.add(key);
    }
    if (touched.size === 0) return;

    // ONE EVENT, ONE GRAIN. A change event applies whole store changes, so its touched set never cuts a
    // family (a root, its children and its orphans' tombstones ride one change). A projection that declares
    // `onChangeset` receives the union of the events gathered for its bag as ONE array, so a shore can land
    // it with no turn handed to the host in between. The gate's max wait guarantees progress under an
    // unbroken flood (Mogul–Ramakrishnan receive-livelock); the union only ever grows by whole events.
    const projections = [...this._projections];
    if (projections.some((p) => p.onChangeset)) {
      const bagId = this._getBag?.() ?? "automerge";
      const acc = this._changesetPending.get(bagId);
      if (acc) { for (const u of touched) acc.touched.set(u, origin); }
      else { this._changesetPending.set(bagId, { touched: new Map([...touched].map((u) => [u, origin])) }); }
      this._changesetGate.mark(bagId);
    }
    // A projection that declares no changeset keeps its per-URI path, one debounce per title.
    if (projections.some((p) => !p.onChangeset)) {
      for (const uri of touched) this._schedule(uri, origin);
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

  /**
   * Fire the envelopes of ONE store change together, bypassing the debounce: a local family write. A
   * projection that declares `onChangeset` receives the family as one array; any other receives its
   * members in order. A family of one fires as a single change.
   */
  fireFamily(changes: readonly LarTiddlerChange[]): void {
    if (changes.length === 0) return;
    if (changes.length === 1) { this.fireImmediate(changes[0]!); return; }
    for (const p of this._projections) {
      try {
        if (p.onChangeset) p.onChangeset(changes);
        else for (const change of changes) p.onUriChanged(change);
      } catch (e) { console.error("[MemeProvider] projection error in a family fire:", e); }
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

    // Flush every gated changeset accumulator too — the bulk state MUST land before onSyncComplete
    // (the gate's lingering timers later fire a harmless no-op on the emptied accumulator).
    for (const bagId of [...this._changesetPending.keys()]) this._flushChangeset(bagId);

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

  /** Read complete current envelopes and deliver one coalesced changeset per bag. */
  private _flushChangeset(bagId: string): void {
    const acc = this._changesetPending.get(bagId);
    if (!acc || acc.touched.size === 0) return;
    this._changesetPending.delete(bagId);
    const bag = this._getBag?.();
    const heads = this._getHeads() ?? undefined;
    const changes: LarTiddlerChange[] = [];
    for (const [uri, origin] of acc.touched) {
      changes.push({
        title: uri,
        record: this._getRecord(uri),
        origin,
        ...(bag !== undefined ? { bag } : {}),
        ...(heads !== undefined ? { heads } : {}),
      });
    }
    for (const p of this._projections) {
      if (p.onChangeset) {
        try { p.onChangeset(changes); }
        catch (e) { console.error("[MemeProvider] projection error in onChangeset:", e); }
      }
    }
  }

  private _fire(uri: string, origin: ChangeOrigin): void {
    const record = this._getRecord(uri);
    const bag = this._getBag?.();
    const heads = this._getHeads() ?? undefined;
    const change: LarTiddlerChange = { title: uri, record, origin, ...(bag !== undefined && { bag }), ...(heads !== undefined && { heads }) };
    for (const p of this._projections) {
      // A projection that declares a changeset received this title in its bag's union already.
      if (p.onChangeset) continue;
      try { p.onUriChanged(change); }
      catch (e) { console.error("[MemeProvider] projection error in onUriChanged:", e); }
    }
  }
}
