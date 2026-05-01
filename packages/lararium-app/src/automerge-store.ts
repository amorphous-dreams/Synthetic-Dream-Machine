/**
 * automerge-store — local-first Automerge layer for the browser.
 *
 * Local-first law (Brooklyn Zelenka / Beelay pattern):
 *   1. IndexedDB storage materializes first — no network required.
 *   2. BrowserWebSocketClientAdapter connects server as a sync peer.
 *   3. Server pushes deltas; client merges. Neither is authority.
 *   4. handle.whenReady() is the ONLY readiness gate — no synced-event race.
 *
 * Boot sequence (authority-first-sync-order):
 *   auth.ready
 *     → openLarariumRepo(hostId, syncWsUrl, authReceipt)
 *       → larariumRepo.openCatalog(catalogUrl)     // catalog.ready
 *         → larariumRepo.resolveRoomDocUrl(catalog, roomId)
 *           → larariumRepo.openRoomDoc(roomDocUrl) // room-content.ready
 *
 * Catalog URL arrives via <meta name="lararium-catalog"> injected by the server.
 * Never guessed. Cached in localStorage for offline return-visits.
 *
 * Corpus docs (M12): LarariumRepo will gain openCorpusDoc(docUrl) once per-corpus
 * Automerge islands land on the server. CompositeStore will fan-out by bag.
 */

import { Repo, type DocHandle, type AutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter }           from "@automerge/automerge-repo-storage-indexeddb";
import { BrowserWebSocketClientAdapter }     from "@automerge/automerge-repo-network-websocket";
import type {
  LarTiddlerRecord,
  LarTiddlerStore,
  LarTiddlerChange,
  ChangeOrigin,
  LarAuthReceipt,
  MemeProjection,
  CatalogDoc,
} from "@lararium/core";
import { MemeProvider } from "@lararium/core";

// ---------------------------------------------------------------------------
// MemeStoreDoc — Automerge document shape for a room/corpus content island
// ---------------------------------------------------------------------------

interface MutableLarRecord {
  title:        string;
  fields:       Record<string, string>;
  text?:        string;
  deleted?:     boolean;
  sourceUri?:   string;
  contentHash?: string;
  revision?:    string;
  authority?:   string;
  bag?:         string;
  // recipe routing pending M12 corpus bag split
}

export type MemeStoreDoc = Record<string, MutableLarRecord>;

// ---------------------------------------------------------------------------
// AutomergeMemeStore — LarTiddlerStore over one Automerge DocHandle
// ---------------------------------------------------------------------------

export class AutomergeMemeStore implements LarTiddlerStore {
  private handle:   DocHandle<MemeStoreDoc>;
  readonly provider: MemeProvider;

  constructor(handle: DocHandle<MemeStoreDoc>) {
    this.handle = handle;
    this.provider = new MemeProvider(() => (handle.doc() ?? {}) as Record<string, unknown>);

    const remoteOrigin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "automerge" };
    handle.on("change", ({ patches }) => {
      this.provider.handleChange(patches ?? [], remoteOrigin);
    });
  }

  addProjection(p: MemeProjection): () => void {
    return this.provider.addProjection(p);
  }

  markSyncComplete(): void {
    this.provider.markSyncComplete();
  }

  async listVisible(): Promise<string[]> {
    const doc = this.handle.doc();
    if (!doc) return [];
    return Object.values(doc)
      .filter((r) => r && !r.deleted && r.title && !r.title.startsWith("$:/temp/"))
      .map((r) => r.title);
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const raw = this.handle.doc()?.[title];
    return raw ? this._freeze(raw) : null;
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    this.handle.change((doc) => {
      doc[record.title] = {
        title:       record.title,
        fields:      { ...record.fields },
        ...(record.text        !== undefined && { text:        record.text }),
        ...(record.deleted                  && { deleted:     record.deleted }),
        ...(record.sourceUri   !== undefined && { sourceUri:  record.sourceUri }),
        ...(record.contentHash !== undefined && { contentHash: record.contentHash }),
        ...(record.revision    !== undefined && { revision:   record.revision }),
        ...(record.authority   !== undefined && { authority:  record.authority }),
        ...(record.bag         !== undefined && { bag:        record.bag }),
      };
    });
    this.provider.fireImmediate({ title: record.title, record, origin });
  }

  async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    this.handle.change((doc) => {
      const existing = doc[title];
      if (existing) {
        existing.deleted = true;
      } else {
        doc[title] = { title, fields: {}, deleted: true };
      }
    });
    this.provider.fireImmediate({ title, record: null, origin });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    return this.provider.addProjection({ onUriChanged: fn });
  }

  get url(): AutomergeUrl { return this.handle.url; }

  private _freeze(raw: MutableLarRecord): LarTiddlerRecord {
    return Object.freeze({
      title:  raw.title,
      fields: Object.freeze({ ...raw.fields }),
      ...(raw.text        !== undefined && { text:        raw.text }),
      ...(raw.deleted     !== undefined && { deleted:     raw.deleted }),
      ...(raw.sourceUri   !== undefined && { sourceUri:   raw.sourceUri }),
      ...(raw.contentHash !== undefined && { contentHash: raw.contentHash }),
      ...(raw.revision    !== undefined && { revision:    raw.revision }),
      ...(raw.authority   !== undefined && { authority:   raw.authority }),
      ...(raw.bag         !== undefined && { bag:         raw.bag as LarTiddlerRecord["bag"] }),
    }) as LarTiddlerRecord;
  }
}

// ---------------------------------------------------------------------------
// LarariumRepo — local-first Automerge lifecycle manager
//
// One instance per browser session. All island docs share the same Repo
// (same IndexedDB storage, same WebSocket peer connection).
//
// Phase 1: openCatalog → lights catalog.ready
// Phase 2: resolveRoomDocUrl → resolves room content doc URL from catalog
// Phase 3: openRoomDoc → lights room-content.ready
// Phase 4 (M12): openCorpusDoc(id) per corpus island
// ---------------------------------------------------------------------------

const READY_TIMEOUT_MS = 20_000;

async function waitReady(handle: DocHandle<unknown>): Promise<void> {
  await Promise.race([
    handle.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Automerge doc not ready after ${READY_TIMEOUT_MS / 1000}s`)),
        READY_TIMEOUT_MS,
      )
    ),
  ]);
}

export class LarariumRepo {
  readonly repo: Repo;

  constructor(repo: Repo) {
    this.repo = repo;
  }

  async openCatalog(url: string): Promise<DocHandle<CatalogDoc>> {
    const handle = await this.repo.find<CatalogDoc>(url as AutomergeUrl);
    await waitReady(handle);
    return handle;
  }

  resolveRoomDocUrl(catalog: DocHandle<CatalogDoc>, roomId: string): string | null {
    const doc = catalog.doc();
    return (doc?.rooms?.[roomId]?.contentDocUrl) ?? null;
  }

  async openRoomDoc(docUrl: string | null): Promise<AutomergeMemeStore> {
    const handle: DocHandle<MemeStoreDoc> = docUrl
      ? await this.repo.find<MemeStoreDoc>(docUrl as AutomergeUrl)
      : this.repo.create<MemeStoreDoc>({});
    await waitReady(handle);
    const store = new AutomergeMemeStore(handle);
    store.markSyncComplete();
    return store;
  }

  // M12: openCorpusDoc(corpusId, docUrl) — per-corpus Automerge island
  // Will return a read-only AutomergeMemeStore scoped to corpus bag.
  // Placeholder for the corpus island split.
}

// ---------------------------------------------------------------------------
// openLarariumRepo — factory; creates the Repo and fires /auth/session claim
// ---------------------------------------------------------------------------

export async function openLarariumRepo(opts: {
  hostId:       string;
  syncWsUrl:    string;
  authReceipt?: LarAuthReceipt;
}): Promise<LarariumRepo> {
  const { hostId, syncWsUrl, authReceipt } = opts;

  const storage = new IndexedDBStorageAdapter(`lararium:meme-store:${hostId}`);
  const network = new BrowserWebSocketClientAdapter(syncWsUrl);
  const repo    = new Repo({ storage, network: [network], sharePolicy: async () => true });

  if (authReceipt) {
    _performAuthSessionClaim({ authReceipt, syncWsUrl, peerId: repo.peerId }).catch(
      (e) => console.warn("[lararium] /auth/session claim failed (non-fatal in local-dev):", e),
    );
  }

  return new LarariumRepo(repo);
}

// ---------------------------------------------------------------------------
// readCatalogUrl — read server-injected catalog URL; cache for offline boot
// ---------------------------------------------------------------------------

export function readCatalogUrl(hostId: string): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector('meta[name="lararium-catalog"]')?.getAttribute("content");
  if (meta) {
    try { localStorage.setItem(`lararium:catalog-url:${hostId}`, meta); } catch { /* quota */ }
    return meta;
  }
  try { return localStorage.getItem(`lararium:catalog-url:${hostId}`); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Internal: /auth/session claim
// ---------------------------------------------------------------------------

async function _performAuthSessionClaim(opts: {
  authReceipt: LarAuthReceipt;
  syncWsUrl:   string;
  peerId:      string | undefined;
}): Promise<void> {
  const { authReceipt, syncWsUrl, peerId } = opts;
  if (!peerId) return;
  const base = syncWsUrl
    .replace(/^wss?:/, (p) => (p === "wss:" ? "https:" : "http:"))
    .replace(/\/meme-sync.*$/, "");
  await fetch(`${base}/auth/session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ peerId, provider: authReceipt.provider, receipt: authReceipt }),
  });
}
