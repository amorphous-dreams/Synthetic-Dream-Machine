/**
 * openNodeLarPeer — local-first Node.js peer factory.
 *
 * Boot sequence — Automerge Tiga + leaves (authority-first-sync-order):
 *   1. Repo     — NodeFS storage + WebSocket server
 *   2. ka opens — CatalogDoc: URL registry (rooms, corpora, engine)
 *   3. ha opens — LarariumDoc: system bag                           [from catalog.larariumDoc]
 *   4. ba opens — LaresDoc: personality bag                         [from ha oracle tiddler]
 *   5. Corpus*  — per-corpus bags from catalog.corpora[*]           [async, non-blocking]
 *   6. Room     — situated content, writable                        [room bag]
 *   7. Drafts   — per-user draft sync                               [draft bag]
 *
 *   CompositeStore: system → lares → corpus:* → room(writable) → draft(writable)
 *   LarPeer: store = room AutomergeDocStore, composite = full CompositeStore
 *
 * The server holds no privilege. It relays; it does not adjudicate content truth.
 * Multiple rooms → multiple openNodeLarPeer calls, one LarPeer per DocHandle.
 *
 * FPI-5 (trim tab): all Node-specific code lives here.
 *
 * Boot phases: 10 LarOpenPhase transitions emitted; see LarOpenPhase in @lararium/core.
 * waitHandleLocal: uses DocHandle.merge() (present in @automerge/automerge-repo@2.5.5).
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join }                         from "path";
import type { DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import { Repo }                         from "@automerge/automerge-repo";
import { NodeFSStorageAdapter }         from "@automerge/automerge-repo-storage-nodefs";
import { NodeWSServerAdapter }          from "@automerge/automerge-repo-network-websocket";
import type { WebSocketServer }         from "isomorphic-ws";
import type { CatalogDoc, MemeStoreDoc, LarariumDoc, IdentitiesDoc, CirclesDoc, SessionsDoc } from "@lararium/core";
import type { MutableLarRecord }        from "@lararium/core";
import {
  LarPeer, PEER_CAPABILITIES_NODE, OpenIdentitySlot,
  AutomergeDocStore, LarariumDocStore,
  CompositeStore, corpusBagId,
  emptyMemeStoreDoc,
  emptyIdentitiesDoc, emptyCirclesDoc, emptySessionsDoc,
  LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI,
  IDENTITIES_DOC_URI, CIRCLES_DOC_URI, SESSIONS_DOC_URI,
  corpusLarUri, roomLarUri, BAG_IDS, recipeUri,
  VmPool,
}                                       from "@lararium/core";
import type { MemeRecipeVm, LarOpenPhase } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, DirectMemeRecipeVm, buildCeremonyTiddlers } from "@lararium/tw5";
import type { OperatorIdentity } from "./operator-key.js";
import {
  loadGenesisIsland, reconcileIslandFromGenesis,
  reconcileWellKnownTiddlers,
  seedLaresDoc, seedIdentitiesDoc, seedCirclesDoc, seedSessionsDoc,
} from "./genesis-island.js";

/** @see LarOpenPhase in @lararium/core */
export type NodeOpenPhase = LarOpenPhase;

export interface NodeLarPeerOptions {
  hostId:     string;
  roomId:     string;
  storageDir: string;
  wss:        WebSocketServer;
  catalogUrl?: string | null;
  /**
   * Optional recipe URI to scope the VM's tiddler view.
   * Defaults to `lar:///ha.ka.ba/@lararium/recipes/default` (content Tiga).
   * Pass `recipeUri("@lararium", "full")` to include the social plane.
   * The VM receives only tiddlers from the recipe's bagStack.
   */
  recipeUri?: string;
  onPhase?:   (phase: NodeOpenPhase) => void;
  /**
   * Device Ed25519 operator identity for the cold-boot ceremony.
   * When present and IdentitiesDoc is freshly seeded (void-start), the ceremony
   * writes an IdentityTiddler + operators CircleTiddler into the social docs.
   * Omitting this skips the ceremony (useful for tests / replica nodes).
   */
  operatorIdentity?: OperatorIdentity;
  /**
   * Optional factory for the per-recipe VM.  Defaults to DirectMemeRecipeVm (same-thread).
   * Pass a TW5WorkerProxy factory for Worker isolation (Sprint 6 node Worker isolation).
   *
   * @param recipeUri - The resolved recipe URI for the VM scope.
   * @param tw5       - The booted TW5Engine for this peer.
   * @param bagStack  - Ordered bag stack for this recipe's tiddler view.
   */
  vmFactory?: (recipeUri: string, tw5: TW5Engine, bagStack: readonly string[]) => Promise<MemeRecipeVm>;
}

export interface NodeLarPeerResult {
  peer:             LarPeer<VmPool<MemeRecipeVm>>;
  tw5:              TW5Engine;
  pool:             VmPool<MemeRecipeVm>;
  repo:             Repo;
  /** Automerge URL of the catalog doc. */
  catalogHandleUrl: string;
  /** Automerge URL of the LarariumDoc — share this as the connect invite URL. */
  larariumDocUrl:   string | null;
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
  const handle = progress.handle;
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
  const { hostId, roomId, storageDir, wss, catalogUrl, recipeUri: recipeUriOpt, onPhase, vmFactory, operatorIdentity } = opts;
  const emit = (p: NodeOpenPhase) => onPhase?.(p);
  // Stable identity URI for this room — the map key in CatalogDoc.rooms.
  const roomKey = roomLarUri(roomId);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  const storage = new NodeFSStorageAdapter(storageDir);
  // Tier-3 causal-island boundary: WebSocket server serves as the network relay.
  // wss is typed via isomorphic-ws — the same module NodeWSServerAdapter uses.
  const network = new NodeWSServerAdapter(wss);
  // sharePolicy: alpha stub — open federation.
  // Keyhive/UCAN injection point: async (peerId) => identity.verifyCapability(peerId, "read")
  const repo    = new Repo({ storage, network: [network], sharePolicy: async () => true });
  emit("repo-open");

  // ── 2. Catalog ────────────────────────────────────────────────────────────
  // Local-first rendezvous anchor: catalog URL persisted to storageDir/catalog-url.
  // On first boot: create blank catalog, write URL to disk immediately.
  // On subsequent boots: read URL from disk, call repo.find() — already in NodeFS, fast.
  // NOT seed-then-hydrate: the URL file serves as the stable rendezvous anchor.
  // GET /api/catalog serves this file's content — available before any sync completes.
  // catalog-url: named infrastructure exception — stores this peer's own Automerge
  // doc URL, not content. Peer-symmetric: any peer writes only its own URL here.
  // Analogous to BOOTSTRAP_SCANS (codec layer) — intentionally not in the CRDT.
  const catalogUrlFile = join(storageDir, "catalog-url");
  let resolvedCatalogUrl: string | null = catalogUrl ?? null;
  if (!resolvedCatalogUrl) {
    try { resolvedCatalogUrl = readFileSync(catalogUrlFile, "utf8").trim() || null; } catch { /* first boot */ }
  }

  const blankCatalog = (): DocHandle<CatalogDoc> => {
    const h = repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {}, tiddlers: {} });
    // Self-reference: catalog doc holds its own lar: URI and automerge: URL.
    // Follows the same pattern as LarariumDoc — any peer that syncs this doc self-discovers.
    h.change((doc) => {
      doc.tiddlers[CATALOG_DOC_URI] = {
        title: CATALOG_DOC_URI, text: h.url, fields: {},
        bag: CATALOG_DOC_URI, authority: "lararium-seed",
      };
    });
    // Persist URL synchronously before returning.
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

  // ── 3. CompositeStore — lowest→highest priority ──────────────────────────
  // Recipe: LARARIUM_DOC_URI → CATALOG_DOC_URI → LARES_DOC_URI → corpusLarUri(*) → roomLarUri → draft
  const composite = new CompositeStore();

  // ── 3a. CatalogDoc (ka) — bag = CATALOG_DOC_URI ──────────────────────────
  composite.addLayer({ bagId: BAG_IDS.catalog, store: new LarariumDocStore(catalogHandle, BAG_IDS.catalog), writable: false });

  // ── 3b. LarariumIsland doc (ha) — lararium bag ───────────────────────────
  // Genesis-first boot: load the build-time artifact, then reconcile with any
  // existing live doc. Both cold and resume boot call loadGenesisIsland so the
  // peer always holds the full engine content, even before any network sync.
  const genesisHandle = await loadGenesisIsland(repo);

  const islandDocUrl = catalog?.tiddlers?.[LARARIUM_DOC_URI]?.text ?? catalog?.larariumDoc?.docUrl ?? null;
  let islandHandle: DocHandle<LarariumDoc>;

  if (islandDocUrl) {
    // Resume boot — load existing island doc; merge genesis if CID diverged.
    islandHandle = await waitHandleLocal<LarariumDoc>(
      repo, islandDocUrl as AutomergeUrl,
      () => genesisHandle,
    );
    await reconcileIslandFromGenesis(islandHandle, genesisHandle);
  } else {
    // Cold boot — genesis IS the island doc; register URL in catalog.
    islandHandle = genesisHandle;
    const blobEntry = islandHandle.doc()?.blobs?.["tiddlywikicore"];
    catalogHandle.change((doc) => {
      doc.tiddlers[LARARIUM_DOC_URI] = {
        title:     LARARIUM_DOC_URI,
        text:      islandHandle.url,
        fields:    {
          ...(blobEntry?.version && { version: blobEntry.version }),
          ...(blobEntry?.sha256  && { sha256:  blobEntry.sha256 }),
        },
        bag:       CATALOG_DOC_URI,
        authority: "lararium-boot",
      };
    });
  }

  composite.addLayer({ bagId: BAG_IDS.lararium, store: new LarariumDocStore(islandHandle, BAG_IDS.lararium), writable: false });
  emit("island-ready");

  // ── 3b. LaresDoc (ba) — personality bag ──────────────────────────────────
  // Ha → ba oracle: LarariumDoc.tiddlers[LARES_DOC_URI].text = LaresDoc automerge URL.
  // On resume: read URL from oracle tiddler, open existing doc.
  // On first boot: seed a new doc, then write the oracle tiddler into LarariumDoc.
  // Zelenka: server is just another peer — no privilege over ba.
  let laresHandle: DocHandle<MemeStoreDoc> | null = null;
  {
    const laresDocUrl = islandHandle.doc()?.tiddlers?.[LARES_DOC_URI]?.text ?? null;
    if (laresDocUrl) {
      laresHandle = await waitHandleLocal<MemeStoreDoc>(
        repo, laresDocUrl as AutomergeUrl,
        () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc()),
      );
    } else {
      laresHandle = seedLaresDoc(repo);
    }
    composite.addLayer({ bagId: BAG_IDS.lares, store: new AutomergeDocStore(laresHandle, BAG_IDS.lares), writable: false });
  }

  // ── 3b-social. Social plane docs — @identities / @circles / @sessions ─────
  // Oracle pattern identical to LaresDoc: ha oracle tiddler → automerge: URL → doc.
  // Social docs boot after content Tiga so ha island handle is available for oracle.
  let identitiesHandle: DocHandle<IdentitiesDoc> | null = null;
  let groupsHandle: DocHandle<CirclesDoc> | null = null;
  let sessionsHandle: DocHandle<SessionsDoc> | null = null;
  let socialPlaneIsNew = false;
  {
    const identitiesUrl = islandHandle.doc()?.tiddlers?.[IDENTITIES_DOC_URI]?.text ?? null;
    socialPlaneIsNew    = identitiesUrl === null;
    identitiesHandle = identitiesUrl
      ? await waitHandleLocal<IdentitiesDoc>(repo, identitiesUrl as AutomergeUrl, () => repo.create<IdentitiesDoc>(emptyIdentitiesDoc()))
      : seedIdentitiesDoc(repo);
    composite.addLayer({ bagId: BAG_IDS.identities, store: new AutomergeDocStore(identitiesHandle, BAG_IDS.identities), writable: false });

    const groupsUrl = islandHandle.doc()?.tiddlers?.[CIRCLES_DOC_URI]?.text ?? null;
    groupsHandle = groupsUrl
      ? await waitHandleLocal<CirclesDoc>(repo, groupsUrl as AutomergeUrl, () => repo.create<CirclesDoc>(emptyCirclesDoc()))
      : seedCirclesDoc(repo);
    composite.addLayer({ bagId: BAG_IDS.groups, store: new AutomergeDocStore(groupsHandle, BAG_IDS.groups), writable: false });

    const sessionsUrl = islandHandle.doc()?.tiddlers?.[SESSIONS_DOC_URI]?.text ?? null;
    sessionsHandle = sessionsUrl
      ? await waitHandleLocal<SessionsDoc>(repo, sessionsUrl as AutomergeUrl, () => repo.create<SessionsDoc>(emptySessionsDoc()))
      : seedSessionsDoc(repo);
    composite.addLayer({ bagId: BAG_IDS.sessions, store: new AutomergeDocStore(sessionsHandle, BAG_IDS.sessions), writable: false });

    // Cold-boot ceremony: write operator principal on void-start.
    // Runs before TW5 boots so the sync adaptor picks up the tiddlers on first load.
    // Guard: skip if identity tiddler already exists (idempotent across replica boots).
    if (socialPlaneIsNew && operatorIdentity && identitiesHandle && groupsHandle) {
      const tiddlers = buildCeremonyTiddlers(operatorIdentity.verifyingKey, operatorIdentity.displayName);
      for (const t of tiddlers) {
        if (t.bag === (IDENTITIES_DOC_URI as string)) {
          identitiesHandle.change((doc) => {
            if (!doc.tiddlers[t.title]) {
              doc.tiddlers[t.title] = { title: t.title, bag: t.bag, authority: t.authority, fields: { ...t.fields } };
            }
          });
        } else {
          groupsHandle.change((doc) => {
            if (!doc.tiddlers[t.title]) {
              doc.tiddlers[t.title] = { title: t.title, bag: t.bag, authority: t.authority, fields: { ...t.fields } };
            }
          });
        }
      }
      console.log(`[lararium] cold-boot ceremony complete — operator did:key written to IdentitiesDoc`);
    }

    // Zelenka: keep oracle tiddlers current on every boot — self, ka, ba, social plane.
    // Recipes, bag descriptors, and blob descriptors are baked into the genesis artifact.
    reconcileWellKnownTiddlers(
      islandHandle, catalogHandle.url,
      laresHandle?.url,
      identitiesHandle.url,
      groupsHandle.url,
      sessionsHandle.url,
    );
  }

  // ── 3c. Corpus docs — one bag per corpus child-doc ───────────────────────
  // Isomorphic oracle path: read from CatalogDoc.tiddlers keyed by corpusLarUri(slug).
  // corpusLarUri(slug) = "lar:///ha.ka.ba/@catalog/@{slug}" (pos-2 child-doc slot).
  // catalog.corpora Record is a legacy optimization index only; tiddlers oracle authoritative.
  const CORPUS_PREFIX = "lar:///ha.ka.ba/@catalog/@";
  const corpusEntries = Object.entries(catalog?.tiddlers ?? {})
    .filter(([uri]) => uri.startsWith(CORPUS_PREFIX))
    .map(([uri, tiddler]) => ({
      id: uri.slice(CORPUS_PREFIX.length),
      docUrl: tiddler.text ?? null,
    }))
    .filter((e): e is { id: string; docUrl: string } => Boolean(e.docUrl));
  const corpusReadyP = Promise.all(corpusEntries.map(async (entry) => {
    const handle = await waitHandleLocal<MemeStoreDoc>(
      repo, entry.docUrl as AutomergeUrl,
      () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc()),
    );
    const bagId = corpusBagId(entry.id);
    composite.addLayer({ bagId, store: new AutomergeDocStore(handle, bagId), writable: false });

    // Self-describing: corpus doc holds its own lar: URI + automerge URL as a tiddler.
    // Any peer that opens the doc can discover its canonical lar: address without a catalog lookup.
    const corpusUri = corpusLarUri(entry.id);
    const existingCorpusSelfRef = handle.doc()?.tiddlers?.[corpusUri]?.text;
    if (existingCorpusSelfRef !== handle.url) {
      handle.change((doc) => {
        doc.tiddlers[corpusUri] = {
          title: corpusUri, text: handle.url, fields: {}, bag: bagId, authority: "lararium-seed",
        };
      });
    }

    // Zelenka: keep tiddler store current so any peer can enumerate corpora
    // without walking the corpora Record — same pattern as LarariumDoc oracle.
    const existingText = catalogHandle.doc()?.tiddlers?.[corpusUri]?.text;
    if (existingText !== entry.docUrl) {
      catalogHandle.change((doc) => {
        doc.tiddlers[corpusUri] = {
          title: corpusUri, text: entry.docUrl, fields: {},
          bag: CATALOG_DOC_URI, authority: "lararium-seed",
        };
      });
    }
  }));

  // ── 4. Room doc — oracle tiddler path (mirrors browser peer M25 Loop 1) ──
  // Read from catalog.tiddlers[roomKey].text (oracle). Legacy catalog.rooms fallback retained.
  const roomDocUrl =
    catalog?.tiddlers?.[roomKey]?.text ??
    catalog?.rooms?.[roomKey]?.contentDocUrl ??
    null;
  const blankRoom  = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  const roomHandle: DocHandle<MemeStoreDoc> = roomDocUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, roomDocUrl as AutomergeUrl, blankRoom)
    : blankRoom();

  if (!roomDocUrl) {
    // Write as oracle tiddler — same schema as browser peer.
    catalogHandle.change((doc) => {
      (doc.tiddlers as Record<string, MutableLarRecord>)[roomKey] = {
        title: roomKey, text: roomHandle.url,
        fields: { bag: BAG_IDS.catalog, authority: "lararium-boot" },
      };
    });
  }
  const roomBagId = roomLarUri(roomId);
  const roomStore = new AutomergeDocStore(roomHandle, roomBagId);
  composite.addLayer({ bagId: roomBagId, store: roomStore, writable: true });
  emit("room-ready");

  // ── 5. Room-Drafts doc — per-user, stored in catalog oracle tiddler ───────
  // Node peer uses hostId:roomId identity for its own drafts (operator drafts).
  // User drafts from browser peers are stored under each browser peer's DID key.
  const identity = new OpenIdentitySlot(`${hostId}:${roomId}`);
  const draftTiddlerKey = `${roomKey}/drafts/${encodeURIComponent(identity.did)}`;
  const existingDraftUrl: string | null = catalog?.tiddlers?.[draftTiddlerKey]?.text ?? null;
  const blankDraft = (): DocHandle<MemeStoreDoc> => repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  const draftHandle: DocHandle<MemeStoreDoc> = existingDraftUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, existingDraftUrl as AutomergeUrl, blankDraft)
    : blankDraft();

  if (!existingDraftUrl) {
    catalogHandle.change((doc) => {
      (doc.tiddlers as Record<string, MutableLarRecord>)[draftTiddlerKey] = {
        title: draftTiddlerKey, text: draftHandle.url,
        fields: { bag: BAG_IDS.catalog, authority: "lararium-boot" },
      };
    });
  }
  composite.addLayer({ bagId: BAG_IDS.draft, store: new AutomergeDocStore(draftHandle, BAG_IDS.draft), writable: true });
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
  // Derive VM bag stack from the recipe tiddler seeded into ha island.
  // Falls back to composite.layerIds (full view) if recipe is not yet available.
  // Default recipe: content Tiga — ha + ka + ba, no social plane, no room leaf.
  const resolvedRecipeUri = recipeUriOpt ?? recipeUri("@lararium", "default");
  const vmRecipe = await composite.getRecipe(resolvedRecipeUri);
  const vmBagStack: readonly string[] = vmRecipe?.bagStack ?? composite.layerIds;

  // Decode lares plugin + vendor plugin blobs from the island doc.
  // "lararium-lares" always preloads — it functions as the lares corpus plugin and remains non-optional.
  // Vendored community plugins ($:/plugins/*) are opt-in per Recipe via the plugins field.
  // When the resolved Recipe declares no plugins, no vendored plugins are preloaded.
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

  // Only preload vendored plugins declared in the resolved Recipe's plugins list.
  const recipePlugins = new Set(vmRecipe?.plugins ?? []);
  for (const [id, entry] of Object.entries(blobs)) {
    if (!id.startsWith("$:/plugins/")) continue;
    if (!recipePlugins.has(id)) continue;
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
  const adaptor = new MemeSyncAdaptor(tw5, peer.store, roomBagId);
  peer.addProjection(adaptor);

  // ── 10. VmPool ────────────────────────────────────────────────────────────
  const pool = new VmPool<MemeRecipeVm>();
  const _vmFactory = vmFactory ?? (
    async (_uri: string, engine: TW5Engine, bags: readonly string[]) =>
      new DirectMemeRecipeVm(engine, bags)
  );
  await pool.get(resolvedRecipeUri, () => _vmFactory(resolvedRecipeUri, tw5, vmBagStack));
  peer.attachVmPool(pool);

  emit("live");
  return { peer, tw5, pool, repo, catalogHandleUrl: catalogHandle.url, larariumDocUrl: islandHandle?.url ?? null, phase: "live" };
}
