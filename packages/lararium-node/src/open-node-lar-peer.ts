/**
 * openNodeLarPeer — local-first Node.js peer factory.
 *
 * Same LarPeer model as the browser; different Repo adapters:
 *   NodeFSStorageAdapter  → filesystem-backed persistence
 *   NodeWSServerAdapter   → WebSocket server for browser peers to sync against
 *
 * The server holds no privilege. It relays; it does not adjudicate content truth.
 * Multiple rooms → multiple openNodeLarPeer calls, one LarPeer per DocHandle.
 *
 * FPI-5 (trim tab): all Node-specific code lives here. Everything above stays
 * isomorphic.
 */

import type { DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import { Repo }                         from "@automerge/automerge-repo";
import { NodeFSStorageAdapter }         from "@automerge/automerge-repo-storage-nodefs";
import { NodeWSServerAdapter }          from "@automerge/automerge-repo-network-websocket";
import type { WebSocketServer }         from "ws";
import type { CatalogDoc, MemeStoreDoc } from "@lararium/core";
import { LarPeer, PEER_CAPABILITIES_NODE } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, VmPool } from "@lararium/tw5";

export type NodeOpenPhase =
  | "boot"
  | "repo-open"
  | "catalog-ready"
  | "room-ready"
  | "peer-ready"
  | "tw5-booted"
  | "live";

export interface NodeLarPeerOptions {
  hostId:     string;
  roomId:     string;
  storageDir: string;
  wss:        WebSocketServer;
  catalogUrl?: string | null;
  onPhase?:   (phase: NodeOpenPhase) => void;
}

export interface NodeLarPeerResult {
  peer:  LarPeer<VmPool<TW5Engine>>;
  tw5:   TW5Engine;
  pool:  VmPool<TW5Engine>;
  repo:  Repo;
  phase: NodeOpenPhase;
}

// Local-first: prefer locally available doc; remote sync is opportunistic.
// If the doc is in NodeFS, Automerge serves it immediately — no network wait.
// If it has never been seen locally (first boot, remote offline), fall back
// to a fresh doc rather than blocking boot.
const LOCAL_READY_MS = 500; // fast path: doc should be in NodeFS if previously seen

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
  // Doc not in local storage — boot fresh; merge remote in background when it comes online.
  const fresh = fallbackFn();
  handle.whenReady().then(() => {
    fresh.merge(handle);
  }).catch(() => { /* remote never came — fresh doc stands */ });
  return fresh;
}

export async function openNodeLarPeer(opts: NodeLarPeerOptions): Promise<NodeLarPeerResult> {
  const { hostId, roomId, storageDir, wss, catalogUrl, onPhase } = opts;
  const emit = (p: NodeOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  const storage = new NodeFSStorageAdapter(storageDir);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const network = new NodeWSServerAdapter(wss as any);
  const repo    = new Repo({ storage, network: [network], sharePolicy: async () => true });
  emit("repo-open");

  // ── 2. Catalog — local-first ───────────────────────────────────────────────
  // repo.find() serves from NodeFS immediately if previously seen.
  // If catalogUrl is remote-only and offline, waitHandleLocal falls back to
  // a fresh catalog and merges the remote in the background when it comes online.
  const blankCatalog = (): DocHandle<CatalogDoc> =>
    repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {} });
  const catalogHandle: DocHandle<CatalogDoc> = catalogUrl
    ? await waitHandleLocal(repo.find<CatalogDoc>(catalogUrl as AutomergeUrl), blankCatalog)
    : blankCatalog();
  emit("catalog-ready");

  // ── 3. Room doc — local-first ─────────────────────────────────────────────
  const roomDocUrl = catalogHandle.doc()?.rooms?.[roomId]?.contentDocUrl ?? null;
  const blankRoom  = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>({});
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
  const peer = new LarPeer<VmPool<TW5Engine>>({
    peerId:       `${hostId}:${roomId}`,
    handle:       roomHandle,
    bagId:        "room",
    capabilities: PEER_CAPABILITIES_NODE,
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
  return { peer, tw5, pool, repo, phase: "live" };
}
