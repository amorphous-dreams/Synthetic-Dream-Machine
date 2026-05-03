/**
 * openNodeLarPeer — local-first Node.js peer factory.
 *
 * Boot sequence — six causal island layers (authority-first-sync-order):
 *   1. Repo — NodeFS storage + WebSocket server
 *   2. Catalog doc — URL registry (rooms, corpora, engine)
 *   3. LarariumIsland doc — system bag (grammar + widget tiddlers)  [from catalog.engine]
 *   4. Corpus* docs — per-corpus bags from catalog.corpora[*]       [async, non-blocking]
 *   5. Room doc — situated content, writable                        [room bag]
 *   6. Room-Drafts doc — per-user draft sync                        [draft bag]
 *
 *   CompositeStore: system → corpus:* → room(writable) → draft(writable)
 *   LarPeer: store = room AutomergeDocStore, composite = full CompositeStore
 *
 * The server holds no privilege. It relays; it does not adjudicate content truth.
 * Multiple rooms → multiple openNodeLarPeer calls, one LarPeer per DocHandle.
 *
 * FPI-5 (trim tab): all Node-specific code lives here.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join }                         from "path";
import type { DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import { Repo }                         from "@automerge/automerge-repo";
import { NodeFSStorageAdapter }         from "@automerge/automerge-repo-storage-nodefs";
import { NodeWSServerAdapter }          from "@automerge/automerge-repo-network-websocket";
import type { WebSocketServer }         from "ws";
import type { CatalogDoc, MemeStoreDoc, LarariumDoc } from "@lararium/core";
import {
  LarPeer, PEER_CAPABILITIES_NODE, OpenIdentitySlot,
  AutomergeDocStore, LarariumDocStore,
  CompositeStore, corpusBagId,
}                                       from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, VmPool } from "@lararium/tw5";

export type NodeOpenPhase =
  | "boot"
  | "repo-open"
  | "catalog-ready"
  | "island-ready"
  | "room-ready"
  | "draft-ready"
  | "peer-ready"
  | "tw5-booted"
  | "corpus-ready"
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
  peer:             LarPeer<VmPool<TW5Engine>>;
  tw5:              TW5Engine;
  pool:             VmPool<TW5Engine>;
  repo:             Repo;
  /** Automerge URL of the catalog doc — exposed for GET /api/catalog bootstrap. */
  catalogHandleUrl: string;
  phase:            NodeOpenPhase;
}

// Local-first: NodeFS serves immediately if previously seen (< 500ms).
// On miss (fresh deploy, remote-only catalog), boot blank and merge in background.
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

export async function openNodeLarPeer(opts: NodeLarPeerOptions): Promise<NodeLarPeerResult> {
  const { hostId, roomId, storageDir, wss, catalogUrl, onPhase } = opts;
  const emit = (p: NodeOpenPhase) => onPhase?.(p);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  const storage = new NodeFSStorageAdapter(storageDir);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const network = new NodeWSServerAdapter(wss as any);
  // sharePolicy: alpha stub — open federation.
  // Keyhive/UCAN injection point: async (peerId) => identity.verifyCapability(peerId, "read")
  const repo    = new Repo({ storage, network: [network], sharePolicy: async () => true });
  emit("repo-open");

  // ── 2. Catalog ────────────────────────────────────────────────────────────
  // Local-first rendezvous anchor: catalog URL persisted to storageDir/catalog-url.
  // On first boot: create blank catalog, write URL to disk immediately.
  // On subsequent boots: read URL from disk, call repo.find() — already in NodeFS, fast.
  // This is NOT seed-then-hydrate: the URL file is the stable rendezvous anchor.
  // GET /api/catalog serves this file's content — available before any sync completes.
  const catalogUrlFile = join(storageDir, "catalog-url");
  let resolvedCatalogUrl: string | null = catalogUrl ?? null;
  if (!resolvedCatalogUrl) {
    try { resolvedCatalogUrl = readFileSync(catalogUrlFile, "utf8").trim() || null; } catch { /* first boot */ }
  }

  const blankCatalog = (): DocHandle<CatalogDoc> => {
    const h = repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {} });
    // Persist URL synchronously before returning — GET /api/catalog is servable immediately.
    try { mkdirSync(storageDir, { recursive: true }); writeFileSync(catalogUrlFile, h.url, "utf8"); } catch { /* quota */ }
    return h;
  };

  const catalogHandle: DocHandle<CatalogDoc> = resolvedCatalogUrl
    ? await waitHandleLocal(repo.find<CatalogDoc>(resolvedCatalogUrl as AutomergeUrl), blankCatalog)
    : blankCatalog();

  // Ensure the URL file exists even if catalog came from env/arg rather than disk.
  if (resolvedCatalogUrl && resolvedCatalogUrl !== catalogUrl) {
    try { mkdirSync(storageDir, { recursive: true }); writeFileSync(catalogUrlFile, catalogHandle.url, "utf8"); } catch { /* quota */ }
  }

  const catalog = catalogHandle.doc();
  emit("catalog-ready");

  // ── 3. CompositeStore — build lowest→highest priority ────────────────────
  const composite = new CompositeStore();

  // ── 3a. LarariumIsland doc — system bag ───────────────────────────────────
  // Node peer is the authority for the island doc — it creates it if missing.
  // catalogHandle.engine.docUrl is set by lararium-island.ts seeder.
  const islandDocUrl = catalog?.engine?.docUrl ?? null;
  if (islandDocUrl) {
    const islandHandle = await waitHandleLocal(
      repo.find<LarariumDoc>(islandDocUrl as AutomergeUrl),
      () => repo.create<LarariumDoc>({ schemaVersion: "0.1", blobs: {}, tiddlers: {} }),
    );
    composite.addLayer({ bagId: "system", store: new LarariumDocStore(islandHandle), writable: false });
    emit("island-ready");
  }

  // ── 3b. Corpus docs — one bag per corpus island ───────────────────────────
  const corpusEntries = Object.values(catalog?.corpora ?? {});
  const corpusReadyP = Promise.all(corpusEntries.map(async (entry) => {
    const handle = await waitHandleLocal(
      repo.find<MemeStoreDoc>(entry.docUrl as AutomergeUrl),
      () => repo.create<MemeStoreDoc>({}),
    );
    const bagId = corpusBagId(entry.id);
    composite.addLayer({ bagId, store: new AutomergeDocStore(handle, bagId), writable: false });
  }));

  // ── 4. Room doc — local-first, writable ───────────────────────────────────
  const roomDocUrl = catalog?.rooms?.[roomId]?.contentDocUrl ?? null;
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
  const roomStore = new AutomergeDocStore(roomHandle, "room");
  composite.addLayer({ bagId: "room", store: roomStore, writable: true });
  emit("room-ready");

  // ── 5. Room-Drafts doc — per-user, stored in catalog ─────────────────────
  // Node peer uses hostId:roomId identity for its own drafts (operator drafts).
  // User drafts from browser peers are stored under each browser peer's DID key.
  const identity = new OpenIdentitySlot(`${hostId}:${roomId}`);
  const draftKey = `drafts_${encodeURIComponent(identity.did)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingDraftUrl: string | null = (catalog?.rooms?.[roomId] as any)?.[draftKey] ?? null;
  const blankDraft = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>({});
  const draftHandle: DocHandle<MemeStoreDoc> = existingDraftUrl
    ? await waitHandleLocal(repo.find<MemeStoreDoc>(existingDraftUrl as AutomergeUrl), blankDraft)
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
    peerId:       `${hostId}:${roomId}`,
    store:        composite,
    capabilities: PEER_CAPABILITIES_NODE,
    identity,
  });
  emit("peer-ready");

  // ── 7. TW5Engine ──────────────────────────────────────────────────────────
  const tw5 = new TW5Engine();
  await tw5.boot();
  emit("tw5-booted");

  // ── 8. Corpus bags — await after TW5 boots ────────────────────────────────
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
  return { peer, tw5, pool, repo, catalogHandleUrl: catalogHandle.url, phase: "live" };
}
