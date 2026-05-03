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

const READY_TIMEOUT_MS = 30_000;

async function waitHandle(handle: DocHandle<unknown>): Promise<void> {
  await Promise.race([
    handle.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`DocHandle not ready after ${READY_TIMEOUT_MS / 1000}s`)), READY_TIMEOUT_MS)
    ),
  ]);
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

  // ── 2. Catalog ────────────────────────────────────────────────────────────
  const catalogHandle: DocHandle<CatalogDoc> = catalogUrl
    ? await repo.find<CatalogDoc>(catalogUrl as AutomergeUrl)
    : repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {} });
  await waitHandle(catalogHandle);
  emit("catalog-ready");

  // ── 3. Room doc ───────────────────────────────────────────────────────────
  const roomDocUrl = catalogHandle.doc()?.rooms?.[roomId]?.contentDocUrl ?? null;
  const roomHandle: DocHandle<MemeStoreDoc> = roomDocUrl
    ? await repo.find<MemeStoreDoc>(roomDocUrl as AutomergeUrl)
    : repo.create<MemeStoreDoc>({});
  await waitHandle(roomHandle);

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
