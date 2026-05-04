/**
 * openBrowserLarPeer — local-first browser peer factory.
 *
 * Boot sequence — Automerge Tiga + leaves (authority-first-sync-order):
 *   1. Repo     — IndexedDB storage + BroadcastChannel + optional WS
 *   2. ha opens — LarariumDoc: system bag + oracle tiddlers
 *                 reads CATALOG_DOC_URI → ka URL
 *                 reads LARES_DOC_URI   → ba URL
 *   3. ka opens — CatalogDoc: URL registry (rooms, corpora)
 *   4. ba opens — LaresDoc: personality bag                         [from ha oracle]
 *   5. Corpus*  — per-corpus bags from CatalogDoc.tiddlers          [async, non-blocking]
 *   6. Room     — situated content, writable                        [room bag]
 *   7. Drafts   — per-user draft sync                               [draft bag, user-scoped]
 *
 *   CompositeStore: system → lares → corpus:* → room(writable) → draft(writable)
 *   LarPeer: store = room AutomergeDocStore, composite = full CompositeStore
 *
 * Zelenka: the browser is just another peer.  The node peer wrote all three
 * Tiga oracle tiddlers (self, ka, ba) into LarariumDoc at seed time.
 * The browser reads them using the same constants — no HTTP oracle, no server privilege.
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
  emptyMemeStoreDoc,
  emptyIdentitiesDoc, emptyGroupsDoc, emptySessionsDoc,
  LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI,
  IDENTITIES_DOC_URI, GROUPS_DOC_URI, SESSIONS_DOC_URI,
  roomLarUri, corpusLarUri, BAG_IDS, recipeUri,
  sha256Hex, defaultCryptoProvider,
  VmPool,
}                                                       from "@lararium/core";
import type { MemeRecipeVm, LarOpenPhase, IdentitiesDoc, GroupsDoc, SessionsDoc } from "@lararium/core";
import { TW5Engine, MemeSyncAdaptor, DirectMemeRecipeVm } from "@lararium/tw5";

// ---------------------------------------------------------------------------
// BrowserOpenPhase — alias of the canonical LarOpenPhase from @lararium/core
// ---------------------------------------------------------------------------

/** @see LarOpenPhase in @lararium/core */
export type BrowserOpenPhase = LarOpenPhase;

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

/**
 * readBootstrap — extract the LarariumDoc (or legacy catalog) URL from the
 * browser environment.  Returns whichever address lives in the fragment /
 * localStorage, leaving the caller to discriminate by shape.
 *
 * Tier order:
 *   0a: URL fragment   (#automerge:…)
 *   0b: localStorage   (lararium:bootstrap-url:{hostId})
 *   0c: null           (blank local state)
 */
function readBootstrap(hostId: string): string | null {
  if (typeof window !== "undefined") {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("automerge:")) {
      try { localStorage.setItem(`lararium:bootstrap-url:${hostId}`, hash); } catch { /* quota */ }
      return hash;
    }
  }
  try {
    return localStorage.getItem(`lararium:bootstrap-url:${hostId}`) ?? null;
  } catch { /* quota/private mode */ }
  return null;
}

// ---------------------------------------------------------------------------
// openBrowserLarPeer — async factory
// ---------------------------------------------------------------------------

export interface BrowserLarPeerResult {
  peer:  LarPeer<VmPool<MemeRecipeVm>>;
  tw5:   TW5Engine;
  pool:  VmPool<MemeRecipeVm>;
  phase: BrowserOpenPhase;
}

export async function openBrowserLarPeer(opts: {
  hostId:    string;
  roomId:    string;
  wsUrl?:    string;
  /**
   * Optional recipe URI to scope the VM's tiddler view.
   * Defaults to `lar:///ha.ka.ba/@lararium/recipes/default` (content Tiga).
   * Pass `recipeUri("@lararium", "full")` to include the social plane.
   */
  recipeUri?: string;
  onPhase?:  (phase: BrowserOpenPhase) => void;
  /**
   * Optional factory for the per-recipe VM.  Defaults to DirectMemeRecipeVm (same-thread).
   * Pass a TW5WorkerProxy factory for Worker isolation (Sprint 6 browser Worker isolation).
   *
   * @param recipeUri - The resolved recipe URI for the VM scope.
   * @param tw5       - The booted TW5Engine for this peer.
   * @param bagStack  - Ordered bag stack for this recipe's tiddler view.
   */
  vmFactory?: (recipeUri: string, tw5: TW5Engine, bagStack: readonly string[]) => Promise<MemeRecipeVm>;
}): Promise<BrowserLarPeerResult> {
  const { hostId, roomId, wsUrl, recipeUri: recipeUriOpt, onPhase, vmFactory } = opts;
  const emit = (p: BrowserOpenPhase) => onPhase?.(p);
  // Stable identity URI for this room — the map key in CatalogDoc.rooms.
  const roomKey = roomLarUri(roomId);

  emit("boot");

  // ── 1. Repo ───────────────────────────────────────────────────────────────
  // Bootstrap URL from fragment → localStorage.  May be a LarariumDoc URL
  // (new path) or a CatalogDoc URL (legacy/direct invite).
  // BC gossip (Tier 2) propagates it between tabs once any tab has it.
  const bootstrapUrl = readBootstrap(hostId);

  const storage = new IndexedDBStorageAdapter(`lararium:meme-store:${hostId}`);
  const bcNet   = new BroadcastChannelNetworkAdapter({ channelName: "lararium" });
  const wsNet   = wsUrl ? new WebSocketClientAdapter(wsUrl) : null;
  const network = wsNet ? [bcNet, wsNet] : [bcNet];
  const repo    = new Repo({ storage, network, sharePolicy: async () => true });

  // Tier 2: side-channel BroadcastChannel for bootstrap URL gossip between tabs.
  const _bcDiscovery = (() => {
    if (bootstrapUrl || typeof BroadcastChannel === "undefined") return null;
    const ch = new BroadcastChannel("lararium:discovery");
    ch.postMessage({ type: "bootstrap-wanted", hostId });
    ch.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "bootstrap-here" && ev.data.bootstrapUrl && !bootstrapUrl) {
        try { localStorage.setItem(`lararium:bootstrap-url:${hostId}`, ev.data.bootstrapUrl); } catch { /* quota */ }
      }
    };
    return ch;
  })();
  if (bootstrapUrl && typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel("lararium:discovery");
    ch.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "bootstrap-wanted") ch.postMessage({ type: "bootstrap-here", bootstrapUrl });
    };
    setTimeout(() => ch.close(), 5000);
  }
  void _bcDiscovery;

  emit("repo-open");

  // ── 2. LarariumDoc — system bag + oracle tiddlers ─────────────────────────
  // Zelenka: the browser is just another peer.  It reads the same well-known
  // tiddlers (LARARIUM_DOC_URI, CATALOG_DOC_URI_SLOT) that the node peer wrote
  // at seed time.  No HTTP oracle; no server privilege.
  //
  // Boot path A (new):  fragment = LarariumDoc URL
  //   → open LarariumDoc → read CATALOG_DOC_URI_SLOT tiddler → open CatalogDoc
  // Boot path B (legacy): fragment = CatalogDoc URL (no tiddlywikicore blob)
  //   → open as catalog directly (backward compat for dev/testing)
  const composite = new CompositeStore();

  let larariumDocHandle: DocHandle<LarariumDoc> | null = null;
  let resolvedCatalogUrl: string | null = null;

  if (bootstrapUrl) {
    // Speculatively open as LarariumDoc.  Inspect for blobs field after local
    // materialisation — if present, it IS the engine doc (path A).
    const candidate = await waitHandleLocal<LarariumDoc>(
      repo, bootstrapUrl as AutomergeUrl,
      () => repo.create<LarariumDoc>(emptyLarariumDoc()),
    );
    const maybeEngine = candidate.doc();
    if (maybeEngine?.blobs && Object.keys(maybeEngine.blobs).length > 0) {
      // Path A: bootstrapUrl is the LarariumDoc URL.
      larariumDocHandle = candidate;
      emit("island-ready");
      composite.addLayer({ bagId: BAG_IDS.lararium, store: new LarariumDocStore(larariumDocHandle, BAG_IDS.lararium), writable: false });
      // Read catalog URL from oracle tiddler.
      resolvedCatalogUrl = larariumDocHandle.doc()?.tiddlers?.[CATALOG_DOC_URI]?.text ?? null;
    } else {
      // Path B: legacy — treat bootstrapUrl as the CatalogDoc URL directly.
      resolvedCatalogUrl = bootstrapUrl;
    }
  }

  // ── 3. Catalog (ka) ──────────────────────────────────────────────────────
  const blankCatalog = () => repo.create<CatalogDoc>({ schemaVersion: "0.1", corpora: {}, rooms: {}, recipes: {}, projections: {}, tiddlers: {} });
  const catalogHandle: DocHandle<CatalogDoc> = resolvedCatalogUrl
    ? await waitHandleLocal<CatalogDoc>(repo, resolvedCatalogUrl as AutomergeUrl, blankCatalog)
    : blankCatalog();
  composite.addLayer({ bagId: BAG_IDS.catalog, store: new LarariumDocStore(catalogHandle, BAG_IDS.catalog), writable: false });
  const catalog = catalogHandle.doc();
  emit("catalog-ready");

  // ── 3a. LarariumDoc (path B) — oracle tiddler or legacy catalog.larariumDoc ─
  // Node peer now writes LARARIUM_DOC_URI oracle into catalog.tiddlers (M25 Loop 3).
  // Legacy fallback: catalog.larariumDoc?.docUrl (M24 compat — nodes that haven't upgraded).
  if (!larariumDocHandle) {
    const larariumDocUrl = catalog?.tiddlers?.[LARARIUM_DOC_URI]?.text ?? catalog?.larariumDoc?.docUrl ?? null;
    if (larariumDocUrl) {
      larariumDocHandle = await waitHandleLocal<LarariumDoc>(
        repo, larariumDocUrl as AutomergeUrl,
        () => repo.create<LarariumDoc>(emptyLarariumDoc()),
      );
      composite.addLayer({ bagId: BAG_IDS.lararium, store: new LarariumDocStore(larariumDocHandle, BAG_IDS.lararium), writable: false });
      emit("island-ready");
    }
  }

  // ── 4. LaresDoc (ba) — personality bag ───────────────────────────────────
  // Ha → ba oracle: LarariumDoc.tiddlers[LARES_DOC_URI].text = LaresDoc automerge URL.
  // Zelenka: browser reads the same oracle tiddler the node peer wrote at seed time.
  // No server privilege — ba is just another doc the browser finds via ha.
  const laresDocUrl = larariumDocHandle?.doc()?.tiddlers?.[LARES_DOC_URI]?.text ?? null;
  if (laresDocUrl) {
    const laresHandle = await waitHandleLocal<MemeStoreDoc>(
      repo, laresDocUrl as AutomergeUrl,
      () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc()),
    );
    composite.addLayer({ bagId: BAG_IDS.lares, store: new AutomergeDocStore(laresHandle, BAG_IDS.lares), writable: false });
  }
  // ── 4-social. Social plane docs — @identities / @groups / @sessions ────────────
  // Browser reads oracle tiddlers the node peer wrote; same local-first boot path.
  const identitiesDocUrl = larariumDocHandle?.doc()?.tiddlers?.[IDENTITIES_DOC_URI]?.text ?? null;
  if (identitiesDocUrl) {
    const idHandle = await waitHandleLocal<IdentitiesDoc>(
      repo, identitiesDocUrl as AutomergeUrl,
      () => repo.create<IdentitiesDoc>(emptyIdentitiesDoc()),
    );
    composite.addLayer({ bagId: BAG_IDS.identities, store: new AutomergeDocStore(idHandle, BAG_IDS.identities), writable: false });
  }
  const groupsDocUrl = larariumDocHandle?.doc()?.tiddlers?.[GROUPS_DOC_URI]?.text ?? null;
  if (groupsDocUrl) {
    const grHandle = await waitHandleLocal<GroupsDoc>(
      repo, groupsDocUrl as AutomergeUrl,
      () => repo.create<GroupsDoc>(emptyGroupsDoc()),
    );
    composite.addLayer({ bagId: BAG_IDS.groups, store: new AutomergeDocStore(grHandle, BAG_IDS.groups), writable: false });
  }
  const sessionsDocUrl = larariumDocHandle?.doc()?.tiddlers?.[SESSIONS_DOC_URI]?.text ?? null;
  if (sessionsDocUrl) {
    const seHandle = await waitHandleLocal<SessionsDoc>(
      repo, sessionsDocUrl as AutomergeUrl,
      () => repo.create<SessionsDoc>(emptySessionsDoc()),
    );
    composite.addLayer({ bagId: BAG_IDS.sessions, store: new AutomergeDocStore(seHandle, BAG_IDS.sessions), writable: false });
  }
  // ── 5. Corpus docs — one bag per corpus child-doc ──────────────────────────
  // Isomorphic oracle path: read from CatalogDoc.tiddlers keyed by corpusLarUri(slug).
  // corpusLarUri(slug) = "lar:///ha.ka.ba/@catalog/@{slug}" (pos-2 child-doc slot).
  // Node peer writes these tiddlers; browser peer reads them — single source of truth.
  // catalog.corpora is a legacy optimization index only; tiddlers oracle is authoritative.
  const CORPUS_PREFIX = "lar:///ha.ka.ba/@catalog/@";
  const corpusEntries = Object.entries(catalog?.tiddlers ?? {})
    .filter(([uri]) => uri.startsWith(CORPUS_PREFIX))
    .map(([uri, tiddler]) => ({
      id: uri.slice(CORPUS_PREFIX.length),
      docUrl: tiddler.text ?? null,
    }))
    .filter((e): e is { id: string; docUrl: string } => Boolean(e.docUrl));
  const corpusPromises = corpusEntries.map(async (entry) => {
    const handle = await waitHandleLocal<MemeStoreDoc>(
      repo, entry.docUrl as AutomergeUrl,
      () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc()),
    );
    const bagId = corpusBagId(entry.id);
    composite.addLayer({ bagId, store: new AutomergeDocStore(handle, bagId), writable: false });
    // Self-describing: corpus doc carries its own lar: URI + automerge URL as a tiddler.
    const corpusUri = corpusLarUri(entry.id);
    const existingSelfRef = handle.doc()?.tiddlers?.[corpusUri]?.text;
    if (existingSelfRef !== handle.url) {
      handle.change((doc) => {
        doc.tiddlers[corpusUri] = {
          title: corpusUri, text: handle.url, fields: {}, bag: bagId, authority: "lararium-seed",
        };
      });
    }
  });
  // Await all corpus bags before emitting corpus-ready (fires after tw5-booted below)
  const corpusReadyP = Promise.all(corpusPromises);

  // ── 4. Room doc — writable ─────────────────────────────────────────────────
  // Oracle tiddler path: catalog.tiddlers[roomKey].text = room contentDocUrl.
  // Wiki-first law: room registration lives as a tiddler, visible in TW5.
  const roomDocUrl =
    catalog?.tiddlers?.[roomKey]?.text
    ?? catalog?.rooms?.[roomKey]?.contentDocUrl  // legacy fallback
    ?? null;
  const blankRoom  = () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  const roomHandle: DocHandle<MemeStoreDoc> = roomDocUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, roomDocUrl as AutomergeUrl, blankRoom)
    : blankRoom();

  if (!roomDocUrl) {
    catalogHandle.change((doc) => {
      doc.tiddlers[roomKey] = {
        title: roomKey, text: roomHandle.url,
        fields: { bag: BAG_IDS.catalog, authority: "lararium-boot" },
      };
    });
  }
  const roomBagId = roomLarUri(roomId);
  const roomStore = new AutomergeDocStore(roomHandle, roomBagId);
  composite.addLayer({ bagId: roomBagId, store: roomStore, writable: true });
  emit("room-ready");

  // ── 5. Room-Drafts doc — same-user multi-device sync ─────────────────────
  // Oracle tiddler path: catalog.tiddlers[draftTiddlerKey].text = draft contentDocUrl.
  // Key: {roomKey}/drafts/{encodedDid} — stable per-user per-room URI.
  // Other devices with same DID find it via catalog tiddler sync.
  const identity = new OpenIdentitySlot(hostId);
  const draftTiddlerKey = `${roomKey}/drafts/${encodeURIComponent(identity.did)}`;
  const existingDraftUrl = catalog?.tiddlers?.[draftTiddlerKey]?.text ?? null;
  const blankDraft = () => repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
  const draftHandle: DocHandle<MemeStoreDoc> = existingDraftUrl
    ? await waitHandleLocal<MemeStoreDoc>(repo, existingDraftUrl as AutomergeUrl, blankDraft)
    : blankDraft();

  if (!existingDraftUrl) {
    catalogHandle.change((doc) => {
      doc.tiddlers[draftTiddlerKey] = {
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
    peerId:       repo.peerId ?? hostId,
    store:        composite,
    capabilities: PEER_CAPABILITIES_BROWSER,
    identity,
  });
  emit("peer-ready");

  // ── 7. TW5Engine — boot with core blob + lares plugin + vendor plugins from LarariumDoc ──
  // new Uint8Array(raw) normalises Automerge's internal chunk type to a clean ArrayBuffer.
  const doc = larariumDocHandle?.doc();
  const coreBlobEntry = doc?.blobs?.["tiddlywikicore"];
  const coreBlobRaw   = coreBlobEntry?.blob;
  const coreBlob      = coreBlobRaw ? new Uint8Array(coreBlobRaw) : undefined;

  // Integrity gate — verify sha256 of engine bytes against the oracle tiddler stamp.
  // This replaces the sw.web2.ts CDN-boundary check. The CRDT channel is trusted
  // by Automerge sync, but we still verify content-address matches the declared hash.
  if (coreBlob && coreBlobEntry?.sha256) {
    const actualSha = await sha256Hex(coreBlob, defaultCryptoProvider);
    if (actualSha !== coreBlobEntry.sha256) {
      console.error(
        `[lararium] tiddlywikicore sha256 mismatch: got=${actualSha.slice(0, 12)}… want=${coreBlobEntry.sha256.slice(0, 12)}…`,
      );
      // Don't boot with a tampered blob — throw so the hook surfaces error state.
      throw new Error(`tiddlywikicore sha256 mismatch: got=${actualSha}, want=${coreBlobEntry.sha256}`);
    }
  }

  const blobs = doc?.blobs ?? {};
  const preloadedTiddlers: Array<Record<string, unknown>> = [];

  // Lares first-party memes plugin (packed by Seed VM on the server).
  const laresBlob = blobs["lararium-lares"]?.blob;
  if (laresBlob) {
    try {
      preloadedTiddlers.push(
        JSON.parse(new TextDecoder().decode(new Uint8Array(laresBlob))) as Record<string, unknown>,
      );
    } catch { /* malformed — skip */ }
  }

  // Vendor plugin blobs — keyed by their TW5 plugin title.
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

  const tw5 = new TW5Engine();
  await tw5.boot(coreBlob, preloadedTiddlers.length > 0 ? preloadedTiddlers : undefined);
  emit("tw5-booted");

  // ── 8. Corpus bags — await after TW5 boots so render isn't blocked ────────
  await corpusReadyP;
  emit("corpus-ready");

  // ── 9. MemeSyncAdaptor — reads full stack, writes to room bag via composite.put() ──
  const adaptor = new MemeSyncAdaptor(tw5, peer.store, roomBagId);
  adaptor.start();

  // ── 10. VmPool — recipe-scoped VM ─────────────────────────────────────────
  // Derive bag stack from the recipe tiddler seeded into ha island.
  // Falls back to composite.layerIds (full view) if recipe is not yet available.
  const resolvedRecipeUri = recipeUriOpt ?? recipeUri("@lararium", "default");
  const vmRecipe = await composite.getRecipe(resolvedRecipeUri);
  const vmBagStack: readonly string[] = vmRecipe?.bagStack ?? composite.layerIds;

  const pool = new VmPool<MemeRecipeVm>();
  const _vmFactory = vmFactory ?? (
    async (_uri: string, engine: TW5Engine, bags: readonly string[]) =>
      new DirectMemeRecipeVm(engine, bags)
  );
  await pool.get(resolvedRecipeUri, () => _vmFactory(resolvedRecipeUri, tw5, vmBagStack));
  peer.attachVmPool(pool);

  emit("live");
  return { peer, tw5, pool, phase: "live" };
}

// ---------------------------------------------------------------------------
// useBrowserLarPeer — React hook
// ---------------------------------------------------------------------------

export interface BrowserPeerState {
  phase: BrowserOpenPhase | null;
  peer:  LarPeer<VmPool<MemeRecipeVm>> | null;
  tw5:   TW5Engine | null;
  pool:  VmPool<MemeRecipeVm> | null;
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
