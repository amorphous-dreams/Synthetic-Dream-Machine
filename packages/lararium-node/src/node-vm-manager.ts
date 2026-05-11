/**
 * NodeVmManager — three-tier TW5 VM lifecycle for the Node.js peer.
 *
 * Tiers:
 *   Pinned  — PrimaryWiki + admin; never evicted.
 *   Hot     — LRU of recently-active wikis (max HOT_CAP live TW5Engines).
 *   Cold    — CRDT-only; VmSnapshot stores materialized tiddler view for fast re-boot.
 *
 * On cold eviction: capture VmSnapshot (tiddlers + Automerge heads). CRDT doc
 * stays in BagResidencyManager; the TW5Engine tears down.
 *
 * On warm-up from cold: boot with snapshot.tiddlers as preloadedTiddlers,
 * then replay getChangesSince(heads) so the engine reaches current CRDT state.
 * CRDT remains sole source of truth; snapshot is a disposable render cache.
 *
 * Parse/render split:
 *   deserializeCarrier — grammar-pure, routes to any hot VM (parseMeme).
 *   renderMeme         — template-dependent, routes to the owning wiki's VM.
 *
 * @web2-smell markers:
 *   - P.3: hot-tier VMs still run in-process (piscina worker isolation deferred).
 *   - per-slot projection bus teardown: stub pending vm-projection-bus.md full impl.
 */

import * as Automerge from "@automerge/automerge";
import type { DocHandle } from "@automerge/automerge-repo";
import type { MemeStoreDoc, LarTiddlerStore, ChangeOrigin } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor } from "@lararium/tw5";
import type { TiddlerFields } from "@lararium/tw5";

// ---------------------------------------------------------------------------
// VmSnapshot — cold-tier materialized tiddler cache
// ---------------------------------------------------------------------------

export interface VmSnapshot {
  /** Automerge heads at snapshot capture time — the CRDT authoritative marker. */
  heads:      Automerge.Heads;
  /** Materialized TW5 tiddler view. Cache only — CRDT always authoritative. */
  tiddlers:   Array<Record<string, unknown>>;
  /** Unix ms of capture — for diagnostics and staleness detection. */
  capturedAt: number;
}

// ---------------------------------------------------------------------------
// SlotState — per-wiki slot in the manager
// ---------------------------------------------------------------------------

type SlotTier = "pinned" | "hot" | "cold";

interface HotSlot {
  tier:       "pinned" | "hot";
  wikiId:     string;
  engine:     TW5Engine;
  adaptor:    MemeSyncAdaptor | null;
  lastUsedAt: number;
}

interface ColdSlot {
  tier:     "cold";
  wikiId:   string;
  snapshot: VmSnapshot | null;
}

type Slot = HotSlot | ColdSlot;

// ---------------------------------------------------------------------------
// BootContext — what the manager needs to (re)boot a wiki VM
// ---------------------------------------------------------------------------

export interface WikiBootContext {
  /** Mounted composite store — provides tiddlers to the VM via MemeSyncAdaptor. */
  composite:   LarTiddlerStore;
  /** Wiki's canonical bag ID — the MemeSyncAdaptor write target. */
  wikiBagId:   string;
  /** Automerge doc handle — used to extract getHeads() for snapshot capture. */
  docHandle:   DocHandle<MemeStoreDoc>;
  /** Plugin tiddlers to preload into every boot of this wiki VM. */
  preloadedTiddlers?: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// NodeVmManager
// ---------------------------------------------------------------------------

const HOT_CAP = 4;

export class NodeVmManager {
  private readonly _slots      = new Map<string, Slot>();
  private readonly _docHandles = new Map<string, DocHandle<MemeStoreDoc>>();

  // ---------------------------------------------------------------------------
  // Pinned tier — PrimaryWiki
  // ---------------------------------------------------------------------------

  /**
   * Register the operator's primary wiki as a pinned (never-evicted) hot slot.
   * Call once after `openNodeLarPeer` returns its booted `tw5` engine.
   */
  mountPrimary(wikiId: string, engine: TW5Engine, adaptor: MemeSyncAdaptor | null): void {
    this._slots.set(wikiId, {
      tier: "pinned",
      wikiId,
      engine,
      adaptor,
      lastUsedAt: Date.now(),
    });
  }

  /** Register or update the MemeSyncAdaptor for an already-mounted pinned slot. */
  updateAdaptor(wikiId: string, adaptor: MemeSyncAdaptor): void {
    const slot = this._slots.get(wikiId);
    if (slot && slot.tier !== "cold") (slot as HotSlot).adaptor = adaptor;
  }

  /** Register a docHandle so eviction can capture a VmSnapshot. */
  registerDocHandle(wikiId: string, handle: DocHandle<MemeStoreDoc>): void {
    this._docHandles.set(wikiId, handle);
  }

  // ---------------------------------------------------------------------------
  // Mount / unmount — hot tier
  // ---------------------------------------------------------------------------

  /**
   * Mount a wiki VM into the hot tier. Boots TW5Engine; uses VmSnapshot as
   * preloadedTiddlers if a cold snapshot exists, then replays CRDT deltas.
   *
   * Evicts the LRU hot slot (non-pinned) when hot tier is at capacity.
   */
  async mountWiki(wikiId: string, ctx: WikiBootContext): Promise<TW5Engine> {
    const existing = this._slots.get(wikiId);
    if (existing && existing.tier !== "cold") {
      (existing as HotSlot).lastUsedAt = Date.now();
      return (existing as HotSlot).engine;
    }

    // Evict LRU hot slot if at capacity.
    this._evictLruIfNeeded();

    const coldSnapshot = existing?.tier === "cold" ? existing.snapshot : null;

    const engine = new TW5Engine();
    const bootTiddlers = coldSnapshot
      ? [...(ctx.preloadedTiddlers ?? []), ...coldSnapshot.tiddlers]
      : ctx.preloadedTiddlers;
    await engine.boot(undefined, bootTiddlers && bootTiddlers.length > 0 ? bootTiddlers : undefined);

    const adaptor = new MemeSyncAdaptor(engine, ctx.composite, `wiki-vm:${wikiId}`, ctx.wikiBagId);
    adaptor.start();

    // Delta replay: apply only the tiddlers that changed between snapshot and now.
    // For cold boots (no snapshot) fall through to onSyncComplete which triggers
    // TW5's getSkinnyTiddlers→loadTiddler full-hydration path.
    if (coldSnapshot) {
      await _replayDelta(coldSnapshot, ctx.docHandle, adaptor, wikiId);
    }
    // Always register island "automerge" as sync-complete so future crdt-remote
    // changes apply immediately rather than buffering.
    adaptor.onSyncComplete("automerge");

    this._slots.set(wikiId, {
      tier: "hot",
      wikiId,
      engine,
      adaptor,
      lastUsedAt: Date.now(),
    });

    console.log(`[vm-manager] ${wikiId}: mounted hot (snapshot: ${coldSnapshot ? "yes" : "no"})`);
    return engine;
  }

  /**
   * Unmount a wiki VM: capture VmSnapshot, tear down TW5Engine, move to cold tier.
   * No-op if wiki is pinned or not mounted.
   * docHandle is optional — falls back to the registered handle for this wikiId.
   */
  async unmountWiki(wikiId: string, docHandle?: DocHandle<MemeStoreDoc>): Promise<void> {
    const slot = this._slots.get(wikiId);
    if (!slot || slot.tier === "pinned" || slot.tier === "cold") return;

    const handle = docHandle ?? this._docHandles.get(wikiId) ?? null;
    const snapshot = handle ? this._captureSnapshot(slot.engine, handle) : null;
    slot.adaptor?.stop();
    slot.engine.dispose();

    this._slots.set(wikiId, { tier: "cold", wikiId, snapshot });
    console.log(
      `[vm-manager] ${wikiId}: unmounted → cold (snapshot: ${snapshot ? `${snapshot.tiddlers.length} tiddlers` : "none — no handle"})`,
    );
  }

  // ---------------------------------------------------------------------------
  // Engine access — touch LRU on every access
  // ---------------------------------------------------------------------------

  getEngine(wikiId: string): TW5Engine | null {
    const slot = this._slots.get(wikiId);
    if (!slot || slot.tier === "cold") return null;
    (slot as HotSlot).lastUsedAt = Date.now();
    return (slot as HotSlot).engine;
  }

  tier(wikiId: string): SlotTier | null {
    return this._slots.get(wikiId)?.tier ?? null;
  }

  snapshot(wikiId: string): VmSnapshot | null {
    const slot = this._slots.get(wikiId);
    return slot?.tier === "cold" ? slot.snapshot : null;
  }

  /** Diagnostics: tier counts for lares status. */
  stats(): { pinned: number; hot: number; cold: number } {
    let pinned = 0, hot = 0, cold = 0;
    for (const slot of this._slots.values()) {
      if (slot.tier === "pinned")  pinned++;
      else if (slot.tier === "hot") hot++;
      else cold++;
    }
    return { pinned, hot, cold };
  }

  // ---------------------------------------------------------------------------
  // Parse/render split
  // ---------------------------------------------------------------------------

  /**
   * Deserialize a meme carrier using any available hot VM (grammar-pure).
   * Returns null when no hot VM exists (daemon still booting).
   */
  parseMeme(uri: string, text: string, extraFields?: Record<string, string>): TiddlerFields[] | null {
    const engine = this._anyHotEngine();
    if (!engine) return null;
    return engine.deserializeCarrier(uri, text, extraFields);
  }

  /**
   * Render a meme URI using the owning wiki's VM (template-dependent).
   * Falls back to any hot VM when the owning wiki isn't mounted.
   */
  async renderMeme(uri: string, wikiId?: string): Promise<string | null> {
    const engine = (wikiId ? this.getEngine(wikiId) : null) ?? this._anyHotEngine();
    if (!engine) return null;
    try {
      const { exportMemeText } = await import("@lararium/tw5");
      return exportMemeText(engine, uri);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Dispose all
  // ---------------------------------------------------------------------------

  disposeAll(): void {
    for (const slot of this._slots.values()) {
      if (slot.tier !== "cold") {
        (slot as HotSlot).adaptor?.stop();
        (slot as HotSlot).engine.dispose();
      }
    }
    this._slots.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _anyHotEngine(): TW5Engine | null {
    for (const slot of this._slots.values()) {
      if (slot.tier !== "cold") return (slot as HotSlot).engine;
    }
    return null;
  }

  private _evictLruIfNeeded(): void {
    const hotSlots = [...this._slots.values()].filter((s): s is HotSlot => s.tier === "hot");
    if (hotSlots.length < HOT_CAP) return;

    const lru = hotSlots.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0]!;
    const handle = this._docHandles.get(lru.wikiId) ?? null;
    const snapshot = handle ? this._captureSnapshot(lru.engine, handle) : null;

    lru.adaptor?.stop();
    lru.engine.dispose();
    this._slots.set(lru.wikiId, { tier: "cold", wikiId: lru.wikiId, snapshot });
    console.log(
      `[vm-manager] ${lru.wikiId}: LRU evicted → cold (snapshot: ${snapshot ? `${snapshot.tiddlers.length} tiddlers` : "none — no handle"})`,
    );
  }

  private _captureSnapshot(engine: TW5Engine, docHandle: DocHandle<MemeStoreDoc>): VmSnapshot | null {
    const doc = docHandle.doc();
    if (!doc) return null;
    try {
      const heads = Automerge.getHeads(doc);
      const wiki    = engine.$tw.wiki;
      const titles  = wiki.filterTiddlers("[all[tiddlers]!prefix[$:/]]");
      const tiddlers: Array<Record<string, unknown>> = [];
      for (const title of titles) {
        const t = wiki.getTiddler(title);
        if (t) tiddlers.push({ ...t.fields });
      }
      return { heads, tiddlers, capturedAt: Date.now() };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// _replayDelta — targeted CRDT delta replay for snapshot warm-up
// ---------------------------------------------------------------------------

/**
 * Apply only the tiddlers that changed between snapshot.heads and the current
 * doc heads, using Automerge.diff to compute the affected URIs.
 *
 * Reuses MemeSyncAdaptor.onChangeset (store-aware, batched, echo-guarded) so
 * the delta lands in TW5 in a single wiki transaction.
 *
 * MemeSyncAdaptor.onChangeset is defined on MemeSyncAdaptor as a public async
 * method; no new API surface needed on either class.
 */
async function _replayDelta(
  snapshot:  VmSnapshot,
  docHandle: DocHandle<MemeStoreDoc>,
  adaptor:   MemeSyncAdaptor,
  wikiId:    string,
): Promise<void> {
  const doc = docHandle.doc();
  if (!doc) return;

  const currentHeads = Automerge.getHeads(doc);

  // Fast-path: no CRDT progress since snapshot.
  // JSON comparison is safe for Heads (array of hex strings).
  if (JSON.stringify(currentHeads) === JSON.stringify(snapshot.heads)) return;

  const patches = Automerge.diff(doc, snapshot.heads, currentHeads);
  const changedUris = new Set<string>();
  for (const patch of patches) {
    // Patches at path ["tiddlers", uri, ...] → uri changed.
    if (patch.path.length >= 2 && patch.path[0] === "tiddlers") {
      changedUris.add(String(patch.path[1]));
    }
  }

  if (changedUris.size === 0) return;

  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "replay" };
  await adaptor.onChangeset(changedUris, origin);
  console.log(`[vm-manager] ${wikiId}: delta replay — ${changedUris.size} tiddlers patched`);
}
