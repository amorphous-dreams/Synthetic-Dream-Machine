/**
 * openBrowserLarPeer — local-first browser peer factory.
 *
 * Boot sequence — six causal island layers (authority-first-sync-order):
 *   1. Repo — IndexedDB storage + BroadcastChannel + optional WS
 *   2. Catalog doc — URL registry (rooms, corpora, engine)
 *   3. LarariumIsland doc — system bag (grammar + widget tiddlers)  [optional, from catalog.engine]
 *   4. Corpus* docs — per-corpus bags from catalog.corpora[*]       [async, non-blocking render]
 *   5. Room doc — situated content, writable                        [room bag]
 *   6. Room-Drafts doc — same-user multi-device draft sync          [draft bag, user-scoped]
 *
 *   CompositeStore: system → corpus:* → room(writable) → draft(writable)
 *   LarPeer: store = room AutomergeDocStore, composite = full CompositeStore
 *
 * Local-first fast path: IndexedDB materializes in <500ms if previously seen.
 * On miss (first visit, cleared storage), boot from blank and merge remote in background.
 *
 * FPI-5 (trim tab): env-specific adapters live only in this file. Everything
 * above here stays isomorphic.
 */

import { useEffect, useRef, useState, useMemo }        from "react";
import { Repo }                                         from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter }                      from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter }               from "@automerge/automerge-repo-network-broadcastchannel";
import { WebSocketClientAdapter }                       from "@automerge/automerge-repo-network-websocket";
import type { DocHandle, AutomergeUrl }                 from "@automerge/automerge-repo";
import type { CatalogDoc, MemeStoreDoc, LarariumDoc }  from "@lararium/core";
import {
  LarPeer, PEER_CAPABILITIES_BROWSER, OpenIdentitySlot,
  AutomergeDocStore, LarariumDocStore,
  CompositeStore, corpusBagId, emptyLarariumDoc,
}                                                       from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, VmPool }           from "@lararium/tw5";

// ---------------------------------------------------------------------------
// BrowserOpenPhase — clean phase sequence
// ---------------------------------------------------------------------------

export type BrowserOpenPhase =
  | "boot"           // factory called; repo not yet open
  | "repo-open"      // Repo + adapters initialized
  | "catalog-ready"  // catalog DocHandle resolved
  | "island-ready"   // LarariumIsland (system bag) resolved — may arrive async
  | "room-ready"     // room DocHandle resolved
  | "draft-ready"    // room-drafts DocHandle resolved
  | "peer-ready"     // LarPeer constructed, CompositeStore wired
  | "tw5-booted"     // TW5Engine.boot() resolved
  | "corpus-ready"   // corpus bags attached (fires once all initial corpora loaded)
  | "live";          // MemeSyncAdaptor wired, VmPool attached

// 500ms: IndexedDB should materialize immediately if previously seen.
// On miss, boot blank and merge remote in background when it arrives.
const LOCAL_READY_MS = 500;

// Use findWithProgress to get the handle synchronously — repo.find() in 2.5.5
// awaits networkSubsystem.whenReady() which blocks until a peer connects.
async function waitHandleLocal<T>(
  repo: Repo,
  url: AutomergeUrl,
  fallbackFn: () => DocHandle<T>,
): Promise<DocHandle<T>> {
  const progress = repo.findWithProgress<T>(url);
  const handle: DocHandle<T> = progress.handle;
  const localReady = await Promise.race([
    handle.whenReady().then(() => true),
    new Promise<false>((r) => setTimeout(() => r(false), LOCAL_READY_MS)),
  ]);
  if (localReady) return handle;
  const fresh = fallbackFn();
  handle.whenReady().then(() => { fresh.merge(handle); }).catch(() => { /* remote never came */ });
  return fresh;
}

async function readCatalogUrl(hostId: string, wsUrl?: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  // Tier 0a: <meta name="lararium-catalog"> — server-injected into page HTML.
  const meta = document.querySelector('meta[name="lararium-catalog"]')?.getAttribute("content");
  if (meta) {
    try { localStorage.setItem(`lararium:catalog-url:${hostId}`, meta); } catch { /* quota */ }
    return meta;
  }

  // Tier 0b: localStorage cache — warm path after first successful bootstrap.
  try {
    const cached = localStorage.getItem(`lararium:catalog-url:${hostId}`);
    if (cached) return cached;
  } catch { /* quota/private mode */ }

  // Tier 0c: GET /api/catalog — node server HTTP endpoint.
  // Derive base URL from wsUrl (ws://host → http://host) or window.location.
  if (wsUrl ?? (typeof window !== "undefined")) {
    try {
      const base = wsUrl
        ? wsUrl.replace(/^ws(s?):\/\//, "http$1://").replace(/\/ws$/, "")
        : window.location.origin;
      const resp = await fetch(`${base}/api/catalog`, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const { catalogUrl } = await resp.json() as { catalogUrl: string };
        if (catalogUrl) {
          try { localStorage.setItem(`lararium:catalog-url:${hostId}`, catalogUrl); } catch { /* quota */ }
          return catalogUrl;
        }
      }
    } catch { /* node server not up yet — fall through to blank catalog */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// openBrowserLarPeer — async factory
// ---------------------------------------------------------------------------

export interface BrowserLarPeerResult {
  peer:  LarPeer<VmPool<TW5Engine>>;
  tw5:   TW5Engine;
  pool:  VmPool<TW5Engine>;
  phase: BrowserOpenPhase;
}

export async function openBrowserLarPeer(opts: {
  hostId:    string;
  roomId:    string;
  wsUrl?:    string;
  onPhase?:  (phase: BrowserOpenPhase) => void;
}): Promise<BrowserLarPeerResult> {
  const { hostId, roomId, wsUrl, onPhase } = opts;
  const emit = (p: BrowserOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  // Tier 0: fetch catalog URL before Repo opens (meta tag → localStorage → GET /api/catalog).
  // BC peerMetadata (Tier 2) will carry it to other tabs once we have it.
  const catalogUrl = await readCatalogUrl(hostId, wsUrl);

  const storage = new IndexedDBStorageAdapter(`lararium:meme-store:${hostId}`);
  const bcNet   = new BroadcastChannelNetworkAdapter({ channelName: "lararium" });
  const wsNet   = wsUrl ? new WebSocketClientAdapter(wsUrl) : null;
  const network = wsNet ? [bcNet, wsNet] : [bcNet];
  const repo    = new Repo({ storage, network, sharePolicy: async () => true });

  // Tier 2: side-channel BroadcastChannel for catalog URL gossip between tabs.
  // Separate from the automerge sync channel (channelName "lararium").
  // A tab that has the catalog URL announces it; tabs without one listen.
  const _bcDiscovery = (() => {
    if (catalogUrl || typeof BroadcastChannel === "undefined") return null;
    const ch = new BroadcastChannel("lararium:discovery");
    ch.postMessage({ type: "catalog-wanted", hostId });
    ch.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "catalog-here" && ev.data.catalogUrl && !catalogUrl) {
        try { localStorage.setItem(`lararium:catalog-url:${hostId}`, ev.data.catalogUrl); } catch { /* quota */ }
      }
    };
    return ch;
  })();
  if (catalogUrl && typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel("lararium:discovery");
    ch.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "catalog-wanted") ch.postMessage({ type: "catalog-here", catalogUrl });
    };
    // Don't hold this channel open; close after a tick.
    setTimeout(() => ch.close(), 5000);
  }
  void _bcDiscovery;

  emit("repo-open");

  // ── 2. Catalog ────────────────────────────────────────────────────────────
  const blankCatalog = () => repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {} });
  const catalogHandle: DocHandle<CatalogDoc> = catalogUrl
    ? await waitHandleLocal<CatalogDoc>(repo, catalogUrl as AutomergeUrl, blankCatalog)
    : blankCatalog();
  const catalog = catalogHandle.doc();
  emit("catalog-ready");

  // ── 3. CompositeStore — build lowest→highest priority ────────────────────
  const composite = new CompositeStore();

  // ── 3a. LarariumDoc — system bag + TW5 core blob source ──────────────────
  // Browser receives the LarariumDoc URL from the node peer via catalog sync.
  // The core blob inside is injected into TW5Engine.boot() — no static HTTP serve.
  const larariumDocUrl = catalog?.larariumDoc?.docUrl ?? null;
  let larariumDocHandle: DocHandle<LarariumDoc> | null = null;
  if (larariumDocUrl) {
    larariumDocHandle = await waitHandleLocal<LarariumDoc>(
      repo, larariumDocUrl as AutomergeUrl,
      () => repo.create<LarariumDoc>(emptyLarariumDoc()),
    );
    composite.addLayer({ bagId: "system", store: new LarariumDocStore(larariumDocHandle), writable: false });
    emit("island-ready");
  }

  // ── 3b. Corpus docs — one bag per corpus island ───────────────────────────
  // Non-blocking: added in parallel; render proceeds with whatever arrives first.
  const corpusEntries = Object.values(catalog?.corpora ?? {});
  const corpusPromises = corpusEntries.map(async (entry) => {
    const handle = await waitHandleLocal<MemeStoreDoc>(
      repo, entry.docUrl as AutomergeUrl,
      () => repo.create<MemeStoreDoc>({}),
    );
    const bagId = corpusBagId(entry.id);
    composite.addLayer({ bagId, store: new AutomergeDocStore(handle, bagId), writable: false });
  });
  // Await all corpus bags before emitting corpus-ready (fires after tw5-booted below)
  const corpusReadyP = Promise.all(corpusPromises);

  // ── 4. Room doc — writable ─────────────────────────────────────────────────
  const roomDocUrl = catalog?.rooms?.[roomId]?.contentDocUrl ?? null;
  const blankRoom  = () => repo.create<MemeStoreDoc>({});
  const roomHandle: DocHandle<MemeStoreDoc> = roomDocUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, roomDocUrl as AutomergeUrl, blankRoom)
    : blankRoom();

  if (!roomDocUrl) {
    catalogHandle.change((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = doc as any;
      d.rooms ??= {};
      d.rooms[roomId] = { id: roomId, contentDocUrl: roomHandle.url, schemaVersion: "0.1" };
    });
  }
  const roomStore = new AutomergeDocStore(roomHandle, "room");
  composite.addLayer({ bagId: "room", store: roomStore, writable: true });
  emit("room-ready");

  // ── 5. Room-Drafts doc — same-user multi-device sync ─────────────────────
  // Draft URL stored per-user in catalog: rooms[id].draftDocUrls[did]
  // On first session: create a fresh draft doc and register in catalog.
  // Other devices with same DID find it via catalog sync.
  const identity = new OpenIdentitySlot(hostId);
  const draftKey = `drafts_${encodeURIComponent(identity.did)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingDraftUrl: string | null = (catalog?.rooms?.[roomId] as any)?.[draftKey] ?? null;
  const blankDraft = () => repo.create<MemeStoreDoc>({});
  const draftHandle: DocHandle<MemeStoreDoc> = existingDraftUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, existingDraftUrl as AutomergeUrl, blankDraft)
    : blankDraft();

  if (!existingDraftUrl) {
    catalogHandle.change((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = doc as any;
      d.rooms ??= {};
      d.rooms[roomId] ??= {};
      d.rooms[roomId][draftKey] = draftHandle.url;
    });
  }
  composite.addLayer({ bagId: "draft", store: new AutomergeDocStore(draftHandle, "draft"), writable: true });
  emit("draft-ready");

  // ── 6. LarPeer ────────────────────────────────────────────────────────────
  roomStore.markSyncComplete();
  const peer = new LarPeer<VmPool<TW5Engine>>({
    peerId:       repo.peerId ?? hostId,
    store:        composite,
    capabilities: PEER_CAPABILITIES_BROWSER,
    identity,
  });
  emit("peer-ready");

  // ── 7. TW5Engine — boot with core blob from LarariumDoc (web3, no static serve) ──
  // new Uint8Array(raw) normalises Automerge's internal chunk type to a clean ArrayBuffer.
  const coreBlobRaw = larariumDocHandle?.doc()?.blobs?.["tiddlywikicore"]?.blob;
  const coreBlob = coreBlobRaw ? new Uint8Array(coreBlobRaw) : undefined;
  const tw5 = new TW5Engine();
  await tw5.boot(coreBlob);
  emit("tw5-booted");

  // ── 8. Corpus bags — await after TW5 boots so render isn't blocked ────────
  await corpusReadyP;
  emit("corpus-ready");

  // ── 9. MemeSyncAdaptor — reads full stack, writes to room bag via composite.put() ──
  const adaptor = new MemeSyncAdaptor(tw5, peer.store, "room");
  peer.addProjection(adaptor);

  // ── 10. VmPool ────────────────────────────────────────────────────────────
  const pool = new VmPool<TW5Engine>();
  await pool.get("slot-0", async () => tw5);
  peer.attachVmPool(pool);

  emit("live");
  return { peer, tw5, pool, phase: "live" };
}

// ---------------------------------------------------------------------------
// useBrowserLarPeer — React hook
// ---------------------------------------------------------------------------

export interface BrowserPeerState {
  phase: BrowserOpenPhase | null;
  peer:  LarPeer<VmPool<TW5Engine>> | null;
  tw5:   TW5Engine | null;
  pool:  VmPool<TW5Engine> | null;
  error: Error | null;
}

export function useBrowserLarPeer(opts: { hostId: string; roomId: string; wsUrl?: string }): BrowserPeerState {
  const [state, setState] = useState<BrowserPeerState>({
    phase: null, peer: null, tw5: null, pool: null, error: null,
  });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const wsUrl = useMemo(() => opts.wsUrl, [opts.wsUrl]);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: null, peer: null, tw5: null, pool: null, error: null });

    openBrowserLarPeer({
      hostId:  optsRef.current.hostId,
      roomId:  optsRef.current.roomId,
      ...(optsRef.current.wsUrl !== undefined && { wsUrl: optsRef.current.wsUrl }),
      onPhase: (phase) => { if (!cancelled) setState((s) => ({ ...s, phase })); },
    }).then(({ peer, tw5, pool, phase }) => {
      if (!cancelled) setState({ phase, peer, tw5, pool, error: null });
    }).catch((err: unknown) => {
      if (!cancelled) setState({
        phase: null, peer: null, tw5: null, pool: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.hostId, opts.roomId, wsUrl]);

  return state;
}
