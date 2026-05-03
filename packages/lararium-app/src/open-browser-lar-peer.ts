/**
 * openBrowserLarPeer — local-first browser peer factory.
 *
 * Boot sequence (authority-first-sync-order from local-first.md):
 *   1. Open Automerge Repo — IndexedDB storage + BroadcastChannel network
 *   2. Find/create catalog doc (from meta tag or localStorage cache)
 *   3. Open/create room doc from catalog
 *   4. Construct LarPeer — AutomergeDocStore wired by the room DocHandle
 *   5. Boot TW5Engine
 *   6. Wire MemeSyncAdaptor: TW5Engine ← store (inbound CRDT path)
 *   7. Attach VmPool<TW5Engine> — slot 0 = local room, booted
 *
 * Local-first Ideal 3 (offline): IndexedDB materializes first; network absent
 * is the normal case. BroadcastChannel syncs other browser tabs. WebSocket
 * to the server peer slots in as an additional NetworkAdapter when available.
 *
 * FPI-5 (trim tab): env-specific adapters live only in this file. Everything
 * above here stays isomorphic.
 */

import { useEffect, useRef, useState } from "react";
import { Repo }                                    from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter }                 from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter }          from "@automerge/automerge-repo-network-broadcastchannel";
import { WebSocketClientAdapter }                  from "@automerge/automerge-repo-network-websocket";
import type { DocHandle, AutomergeUrl }            from "@automerge/automerge-repo";
import type { CatalogDoc, MemeStoreDoc }           from "@lararium/core";
import { LarPeer, PEER_CAPABILITIES_BROWSER, OpenIdentitySlot } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, VmPool }      from "@lararium/tw5";

// ---------------------------------------------------------------------------
// BrowserOpenPhase — clean phase sequence replacing LarariumOpenPhase (web2)
// ---------------------------------------------------------------------------

export type BrowserOpenPhase =
  | "boot"           // factory called; repo not yet open
  | "repo-open"      // Repo + adapters initialized
  | "catalog-ready"  // catalog DocHandle resolved
  | "room-ready"     // room DocHandle resolved
  | "peer-ready"     // LarPeer constructed, store synced
  | "tw5-booted"     // TW5Engine.boot() resolved
  | "live";          // MemeSyncAdaptor wired, VmPool attached

// 500ms: IndexedDB should materialize immediately if previously seen.
// On miss (first visit, cleared storage), boot fresh and merge remote in background.
const LOCAL_READY_MS = 500;

async function waitHandleLocal<T>(
  handleP: Promise<DocHandle<T>>,
  fallbackFn: () => DocHandle<T>,
): Promise<DocHandle<T>> {
  const handle = await handleP;
  const localReady = await Promise.race([
    handle.whenReady().then(() => true),
    new Promise<false>((r) => setTimeout(() => r(false), LOCAL_READY_MS)),
  ]);
  if (localReady) return handle;
  const fresh = fallbackFn();
  handle.whenReady().then(() => { fresh.merge(handle); }).catch(() => { /* remote never came */ });
  return fresh;
}

function readCatalogUrl(hostId: string): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector('meta[name="lararium-catalog"]')?.getAttribute("content");
  if (meta) {
    try { localStorage.setItem(`lararium:catalog-url:${hostId}`, meta); } catch { /* quota */ }
    return meta;
  }
  try { return localStorage.getItem(`lararium:catalog-url:${hostId}`); } catch { return null; }
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
  wsUrl?:    string;   // e.g. "ws://localhost:8080" — omit to skip WS peer sync
  onPhase?:  (phase: BrowserOpenPhase) => void;
}): Promise<BrowserLarPeerResult> {
  const { hostId, roomId, wsUrl, onPhase } = opts;
  const emit = (p: BrowserOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  const storage  = new IndexedDBStorageAdapter(`lararium:meme-store:${hostId}`);
  const bcNet    = new BroadcastChannelNetworkAdapter();
  // WS adapter connects to the node peer when a URL is provided.
  // In dev: wsUrl = "ws://localhost:8080" via Vite proxy.
  // Omitting wsUrl gives a tabs-only offline-capable peer.
  // sharePolicy injection point: swap async () => true for identity.verifyCapability()
  const wsNet    = wsUrl ? new WebSocketClientAdapter(wsUrl) : null;
  const network  = wsNet ? [bcNet, wsNet] : [bcNet];
  const repo     = new Repo({ storage, network, sharePolicy: async () => true });
  emit("repo-open");

  // ── 2. Catalog ────────────────────────────────────────────────────────────
  const catalogUrl = readCatalogUrl(hostId);
  const blankCatalog = () => repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {} });
  const catalogHandle: DocHandle<CatalogDoc> = catalogUrl
    ? await waitHandleLocal(repo.find<CatalogDoc>(catalogUrl as AutomergeUrl), blankCatalog)
    : blankCatalog();
  emit("catalog-ready");

  // ── 3. Room doc ───────────────────────────────────────────────────────────
  const roomDocUrl = catalogHandle.doc()?.rooms?.[roomId]?.contentDocUrl ?? null;
  const blankRoom  = () => repo.create<MemeStoreDoc>({});
  const roomHandle: DocHandle<MemeStoreDoc> = roomDocUrl
    ? await waitHandleLocal(repo.find<MemeStoreDoc>(roomDocUrl as AutomergeUrl), blankRoom)
    : blankRoom();

  if (!roomDocUrl) {
    catalogHandle.change((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = doc as any;
      d.rooms ??= {};
      d.rooms[roomId] = { id: roomId, contentDocUrl: roomHandle.url, schemaVersion: "0.1" };
    });
  }
  emit("room-ready");

  // ── 4. LarPeer ────────────────────────────────────────────────────────────
  // identity: OpenIdentitySlot derives stable actorId from hostId (SHA-256 truncated).
  // Swap for BlueskyIdentitySlot / KeyhiveIdentitySlot when auth lands.
  const identity = new OpenIdentitySlot(hostId);
  const peer = new LarPeer<VmPool<TW5Engine>>({
    peerId:       repo.peerId ?? hostId,
    handle:       roomHandle,
    bagId:        "room",
    capabilities: PEER_CAPABILITIES_BROWSER,
    identity,
  });
  peer.store.markSyncComplete();
  emit("peer-ready");

  // ── 5. TW5Engine ──────────────────────────────────────────────────────────
  const tw5 = new TW5Engine();
  await tw5.boot();
  emit("tw5-booted");

  // ── 6. MemeSyncAdaptor ────────────────────────────────────────────────────
  const adaptor = new MemeSyncAdaptor(tw5, peer.store, "room");
  peer.store.addProjection(adaptor);

  // ── 7. VmPool ─────────────────────────────────────────────────────────────
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
  }, [opts.hostId, opts.roomId, opts.wsUrl]);

  return state;
}
