/**
 * openNodeLarPeer — local-first Node.js peer factory.
 *
 * Boot sequence — six causal island layers (authority-first-sync-order):
 *   1. Repo — NodeFS storage + WebSocket server
 *   2. Catalog doc — URL registry (rooms, corpora, engine)
 *   3. LarariumDoc — system bag (grammar + widget tiddlers + TW5 core blob)  [from catalog.larariumDoc]
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
  CompositeStore, corpusBagId, emptyLarariumDoc,
}                                       from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, VmPool, DirectMemeRecipeVm } from "@lararium/tw5";
import type { MemeRecipeVm } from "@lararium/tw5";
import {
  seedLarariumDoc,
  reconcileEngineBlobIfChanged,
  reconcileLaresPluginBlobIfChanged,
} from "./lararium-island.js";

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
  peer:             LarPeer<VmPool<MemeRecipeVm>>;
  tw5:              TW5Engine;
  pool:             VmPool<MemeRecipeVm>;
  repo:             Repo;
  /** Automerge URL of the catalog doc — printed to console as the connect invite URL. */
  catalogHandleUrl: string;
  phase:            NodeOpenPhase;
}

// Local-first: NodeFS serves immediately if previously seen (< 500ms).
// LOCAL_READY_MS: NodeFS should materialize in < 500ms if data is on disk.
// On miss, boot blank and merge remote in background when it arrives.
const LOCAL_READY_MS = 500;

// Use findWithProgress to get the handle synchronously (never blocks on network),
// then race whenReady() against a 500ms fallback. repo.find() in 2.5.5 awaits
// networkSubsystem.whenReady() before even starting — which hangs at boot.
async function waitHandleLocal<T>(
  repo: Repo,
  url: AutomergeUrl,
  fallbackFn: () => DocHandle<T>,
): Promise<DocHandle<T>> {
  const progress = repo.findWithProgress<T>(url);
  const handle: DocHandle<T> = "subscribe" in progress ? progress.handle : progress.handle;
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
    ? await waitHandleLocal(repo, resolvedCatalogUrl as AutomergeUrl, blankCatalog)
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
  // Node peer is the authority for the island doc.
  // On first boot: seed from disk, register URL in catalog.
  // On resume: reconcile blobs if disk artifacts changed.
  let islandHandle: DocHandle<LarariumDoc> | null = null;
  const islandDocUrl = catalog?.larariumDoc?.docUrl ?? null;
  if (islandDocUrl) {
    // Resume boot — load existing island doc.
    islandHandle = await waitHandleLocal<LarariumDoc>(
      repo, islandDocUrl as AutomergeUrl,
      () => repo.create<LarariumDoc>(emptyLarariumDoc()),
    );
    await reconcileEngineBlobIfChanged(islandHandle);
    await reconcileLaresPluginBlobIfChanged(islandHandle);
    composite.addLayer({ bagId: "system", store: new LarariumDocStore(islandHandle), writable: false });
    emit("island-ready");
  } else {
    // First boot — seed island doc from disk and register in catalog.
    try {
      const { handle } = await seedLarariumDoc(repo);
      islandHandle = handle;
      catalogHandle.change((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).larariumDoc = {
          version: (islandHandle!.doc() as any)?.blobs?.["tiddlywikicore"]?.version ?? "unknown",
          docUrl:  islandHandle!.url,
          sha256:  (islandHandle!.doc() as any)?.blobs?.["tiddlywikicore"]?.sha256 ?? "",
        };
      });
      composite.addLayer({ bagId: "system", store: new LarariumDocStore(islandHandle), writable: false });
      emit("island-ready");
    } catch (err) {
      // Non-fatal: TW5 core blob may be missing in dev without build step.
      console.warn(`[lararium] island seed skipped: ${String(err)}`);
    }
  }

  // ── 3b. Corpus docs — one bag per corpus island ───────────────────────────
  const corpusEntries = Object.values(catalog?.corpora ?? {});
  const corpusReadyP = Promise.all(corpusEntries.map(async (entry) => {
    const handle = await waitHandleLocal<MemeStoreDoc>(
      repo, entry.docUrl as AutomergeUrl,
      () => repo.create<MemeStoreDoc>({}),
    );
    const bagId = corpusBagId(entry.id);
    composite.addLayer({ bagId, store: new AutomergeDocStore(handle, bagId), writable: false });
  }));

  // ── 4. Room doc — local-first, writable ───────────────────────────────────
  const roomDocUrl = catalog?.rooms?.[roomId]?.contentDocUrl ?? null;
  const blankRoom  = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>({});
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

  // ── 5. Room-Drafts doc — per-user, stored in catalog ─────────────────────
  // Node peer uses hostId:roomId identity for its own drafts (operator drafts).
  // User drafts from browser peers are stored under each browser peer's DID key.
  const identity = new OpenIdentitySlot(`${hostId}:${roomId}`);
  const draftKey = `drafts_${encodeURIComponent(identity.did)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingDraftUrl: string | null = (catalog?.rooms?.[roomId] as any)?.[draftKey] ?? null;
  const blankDraft = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>({});
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
  const peer = new LarPeer<VmPool<MemeRecipeVm>>({
    peerId:       `${hostId}:${roomId}`,
    store:        composite,
    capabilities: PEER_CAPABILITIES_NODE,
    identity,
  });
  emit("peer-ready");

  // ── 7. TW5Engine ──────────────────────────────────────────────────────────
  // Decode lares plugin + vendor plugin blobs from the island doc.
  // "lararium-lares" is a TW5 plugin tiddler (type: application/json, plugin-type: plugin).
  // Vendor blobs are keyed by their TW5 plugin title (e.g. "$:/plugins/sq/streams").
  // TW5's preloadTiddlers mechanism unpacks plugin bundles automatically at boot.
  const tw5 = new TW5Engine();
  const blobs = islandHandle?.doc()?.blobs ?? {};
  const preloadedTiddlers: Array<Record<string, unknown>> = [];

  const laresBlob = blobs["lararium-lares"]?.blob;
  if (laresBlob) {
    try {
      preloadedTiddlers.push(
        JSON.parse(new TextDecoder().decode(new Uint8Array(laresBlob))) as Record<string, unknown>,
      );
    } catch { /* malformed — skip */ }
  }

  for (const [id, entry] of Object.entries(blobs)) {
    if (!id.startsWith("$:/plugins/")) continue;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(entry.blob))) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item === "object" && (item as Record<string, unknown>)["title"]) {
          preloadedTiddlers.push(item as Record<string, unknown>);
        }
      }
    } catch { /* malformed — skip */ }
  }

  await tw5.boot(undefined, preloadedTiddlers.length > 0 ? preloadedTiddlers : undefined);
  emit("tw5-booted");

  // ── 8. Corpus bags — await after TW5 boots ────────────────────────────────
  await corpusReadyP;
  emit("corpus-ready");

  // ── 9. MemeSyncAdaptor — reads full stack, writes to room bag via composite.put() ──
  const adaptor = new MemeSyncAdaptor(tw5, peer.store, "room");
  peer.addProjection(adaptor);

  // ── 10. VmPool ────────────────────────────────────────────────────────────
  const pool = new VmPool<MemeRecipeVm>();
  await pool.get("slot-0", async () => new DirectMemeRecipeVm(tw5));
  peer.attachVmPool(pool);

  emit("live");
  return { peer, tw5, pool, repo, catalogHandleUrl: catalogHandle.url, phase: "live" };
}
