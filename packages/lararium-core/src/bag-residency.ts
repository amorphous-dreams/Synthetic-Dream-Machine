/**
 * BagResidencyManager — three-tier residency model for Automerge bags.
 *
 * Each bag in the lararium stack maps to one Automerge document. As an
 * operator's wiki grows (corpus + room + recipe + identity + circles +
 * sessions + admin + N corpus children + N rooms…), the count crosses what
 * any single peer can keep hot in RAM. Browser tabs hit IndexedDB pressure;
 * Node daemons hit handle-cache growth that automerge-repo does NOT today
 * evict (see https://github.com/automerge/automerge-repo/issues/358).
 *
 * Three tiers:
 *   PINNED  — never evicted. Identity, active room, admin, sessions.
 *   HOT     — actively in handle-cache; LRU under cap (default 32).
 *   COLD    — URL known, doc NOT loaded. Stub-on-oracle traversal lands
 *             URLs here without forcing hydration.
 *
 * Golden principles encoded (sourced from research synthesis 2026-05-08):
 *   - Tier by attention, not policy. User-driven hydration; idle eviction.
 *   - Always-hot set: pin identity, active room, sessions, admin.
 *   - Don't evict while syncing. Mid-replication = unsafe to drop handle.
 *   - Compact-before-evict. Skip the multi-second rehydrate replay.
 *   - Stub on oracle traversal. Don't `find()` URLs found in tiddler.text
 *     until something reads through them.
 *
 * Forward note (Beelay/Sedimentree alignment):
 *   The `ChunkStore` interface below mirrors what Beelay's Sedimentree-
 *   shaped store is heading toward (load / save / loadRange / remove /
 *   compact). Today the only implementation wraps Automerge's existing
 *   storage adapters; when Beelay ships a stable JS adapter we swap a
 *   single class. The `compact()` hook is reserved for that future.
 *
 * Phase 1 (this file, C.1): instrumentation only — pinned/hot/cold sets,
 * pin / unpin / hydrate API, stats reporting. NO eviction yet. C.2 lands
 * the LRU + idle sweeper.
 *
 * Architecture invariants preserved:
 *   - Local-first: this manager is per-peer; no central authority.
 *   - Web2 smell test: no RPC; pin state lives as tiddlers in the admin
 *     doc (durable, federates to operator devices via the existing
 *     admin-doc sync surface).
 *   - Causal-island model: eviction operates on whole bags (whole docs),
 *     never on slices within a doc.
 */

/** A bag's URL — Automerge doc URL, e.g. "automerge:abc123…". */
export type BagUrl = string;

/** Residency tier of a single bag. */
export type ResidencyTier = "pinned" | "hot" | "cold";

/**
 * ChunkStore — storage abstraction shaped to match Beelay's Sedimentree
 * format when that ships. Today's only impl wraps Automerge-repo's
 * StorageAdapter. The `compact()` hook stays a no-op until a Sedimentree-
 * aware backend lands.
 *
 * Keys use Automerge's tuple convention: [docId, "snapshot"|"incremental",
 * chunkId]. Values are opaque binary blobs.
 */
export interface ChunkStore {
  load(key: readonly string[]): Promise<Uint8Array | undefined>;
  save(key: readonly string[], data: Uint8Array): Promise<void>;
  remove(key: readonly string[]): Promise<void>;
  loadRange(prefix: readonly string[]): Promise<{ key: readonly string[]; data: Uint8Array }[]>;
  removeRange(prefix: readonly string[]): Promise<void>;
  /** Sedimentree compaction hook — Phase 2; today's impls may no-op. */
  compact?(docId: string): Promise<void>;
}

/** Snapshot of one bag's residency record. */
export interface BagResidencyEntry {
  readonly url:          BagUrl;
  readonly tier:         ResidencyTier;
  readonly lastTouched:  number;   // ms epoch
  readonly pinReason?:   string;   // operator-supplied or system pin reason
  readonly syncActive?:  boolean;  // true when peers are mid-replication
}

/** Stats summary for `lares residency` instrumentation. */
export interface BagResidencyStats {
  readonly pinned:    readonly BagUrl[];
  readonly hot:       readonly BagResidencyEntry[];
  readonly coldCount: number;
  readonly hotCap:    number;
}

export interface BagResidencyManagerOptions {
  /** Soft cap on hot-tier bag count. Default 32. */
  readonly hotCap?:     number;
  /** Hook the manager calls when transitioning cold → hot. C.4 wires
   *  this into Automerge's repo.find(). Today (C.1) it's a stub. */
  readonly onHydrate?:  (url: BagUrl) => Promise<void>;
  /** Hook called when transitioning hot → cold. C.2 wires this into
   *  compact-then-drop. Today a stub. */
  readonly onEvict?:    (url: BagUrl) => Promise<void>;
}

/**
 * BagResidencyManager — owns the residency state for one peer's bags.
 *
 * Phase 1 surface (C.1): pin / unpin / mark hot / mark cold / stats.
 * No eviction triggered automatically; callers can request it but the
 * manager just routes to onEvict() (C.2 wires the LRU + sweeper).
 */
export class BagResidencyManager {
  private readonly _pinned     = new Map<BagUrl, string | undefined>();
  private readonly _hot        = new Map<BagUrl, BagResidencyEntry>();
  private readonly _cold       = new Set<BagUrl>();
  private readonly hotCap:       number;
  private readonly onHydrate?:   (url: BagUrl) => Promise<void>;
  private readonly onEvict?:     (url: BagUrl) => Promise<void>;

  constructor(opts: BagResidencyManagerOptions = {}) {
    this.hotCap     = opts.hotCap ?? 32;
    if (opts.onHydrate) this.onHydrate = opts.onHydrate;
    if (opts.onEvict)   this.onEvict   = opts.onEvict;
  }

  /** Pin a bag — never evict it. Pinning a hot bag promotes; pinning a
   *  cold bag both promotes AND triggers hydrate. */
  async pin(url: BagUrl, reason?: string): Promise<void> {
    this._pinned.set(url, reason);
    this._hot.delete(url);
    if (this._cold.has(url)) {
      this._cold.delete(url);
      if (this.onHydrate) await this.onHydrate(url);
    }
  }

  unpin(url: BagUrl): void {
    if (!this._pinned.has(url)) return;
    this._pinned.delete(url);
    // Demote to hot — operator unpinned but the doc still lives in RAM.
    this._hot.set(url, { url, tier: "hot", lastTouched: Date.now() });
  }

  /** Note that a bag was just touched (read or write). Promotes cold → hot
   *  via the onHydrate hook; bumps lastTouched for hot bags. */
  async touch(url: BagUrl): Promise<void> {
    if (this._pinned.has(url)) return;        // already always-hot
    if (this._cold.has(url)) {
      this._cold.delete(url);
      if (this.onHydrate) await this.onHydrate(url);
    }
    this._hot.set(url, { url, tier: "hot", lastTouched: Date.now() });
  }

  /** Register a URL we know about but haven't loaded. Oracle traversal
   *  calls this when it sees a `tiddler.text → automerge:URL` pointer
   *  for a bag that isn't already pinned or hot. */
  registerCold(url: BagUrl): void {
    if (this._pinned.has(url)) return;
    if (this._hot.has(url))    return;
    this._cold.add(url);
  }

  /** Demote a hot bag to cold — calls onEvict hook for compact-then-drop.
   *  Refuses to evict pinned bags. C.2 wires this into the idle sweeper. */
  async evict(url: BagUrl): Promise<boolean> {
    if (this._pinned.has(url)) return false;
    if (!this._hot.has(url))   return false;
    if (this.onEvict) await this.onEvict(url);
    this._hot.delete(url);
    this._cold.add(url);
    return true;
  }

  /** Mark or unmark a bag as mid-sync. C.2's sweeper consults this before
   *  eviction (the automerge-repo#358 invariant: "don't evict while
   *  another peer is actively replicating to us"). */
  setSyncActive(url: BagUrl, active: boolean): void {
    const entry = this._hot.get(url);
    if (!entry) return;
    this._hot.set(url, { ...entry, syncActive: active });
  }

  has(url: BagUrl): boolean {
    return this._pinned.has(url) || this._hot.has(url) || this._cold.has(url);
  }

  tier(url: BagUrl): ResidencyTier | null {
    if (this._pinned.has(url)) return "pinned";
    if (this._hot.has(url))    return "hot";
    if (this._cold.has(url))   return "cold";
    return null;
  }

  pinned(): readonly BagUrl[] {
    return [...this._pinned.keys()];
  }

  /** Hot entries sorted by lastTouched DESC (most-recent first). */
  hot(): readonly BagResidencyEntry[] {
    return [...this._hot.values()].sort((a, b) => b.lastTouched - a.lastTouched);
  }

  cold(): readonly BagUrl[] {
    return [...this._cold];
  }

  stats(): BagResidencyStats {
    return {
      pinned:    this.pinned(),
      hot:       this.hot(),
      coldCount: this._cold.size,
      hotCap:    this.hotCap,
    };
  }
}

// ---------------------------------------------------------------------------
// Pin tiddler shape — pins persist as tiddlers in the admin doc.
// Same pattern as bag-mirror configs (S5.6 A.5). The dispatcher's residency
// manager reads pin tiddlers at boot and applies them.
// ---------------------------------------------------------------------------

/** Tag every operator-pin tiddler carries. */
export const LARES_PIN_TAG = "$:/tags/LaresPin";

/** Build the URI for a pin tiddler under the admin doc. */
export function pinTiddlerUri(bagUrl: BagUrl): string {
  return `lar:///ha.ka.ba/@lararium/@admin/pin/${encodeURIComponent(bagUrl)}`;
}
