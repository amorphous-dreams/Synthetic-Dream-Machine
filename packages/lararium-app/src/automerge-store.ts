/**
 * AutomergeMemeStore — local-first LarTiddlerStore backed by Automerge-repo.
 *
 * Architecture (Brooklyn Zelenka / Beelay pattern):
 *   1. Repo opens with IndexedDB storage — local snapshot materializes first.
 *   2. BrowserWebSocketClientAdapter connects to /meme-sync on the server.
 *   3. Server is a sync peer: it pushes deltas it cannot read into the client doc.
 *   4. await handle.doc() blocks until the doc is materialized — NO synced-event race.
 *
 * Boot sequence (called from lararium-browser-host.ts):
 *   const { store, storeUrl } = await initMemeRepo({ hostId, syncWsUrl, storeUrl });
 *   // store is immediately populated from IDB (or server on first boot)
 *   // TW5 can boot — no gate on WebSocket sync event
 *
 * Doc schema: Record<lar:///uri, MutableLarRecord>
 * One Automerge document per Lararium room, URL persisted in localStorage.
 */

import { Repo, type DocHandle, type AutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter }    from "@automerge/automerge-repo-storage-indexeddb";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import type {
  LarTiddlerRecord,
  LarTiddlerStore,
  LarTiddlerChange,
  ChangeOrigin,
  LarAuthReceipt,
  MemeProjection,
} from "@lararium/core";
import { MemeProvider } from "@lararium/core";

// ---------------------------------------------------------------------------
// Doc schema — mutable counterpart of LarTiddlerRecord for Automerge proxy
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
  // bag / recipe intentionally omitted — multi-doc bags/recipe routing is pending
  // the local-first multi-Automerge-doc refactor (M-bags). Wire them back then.
}

export type MemeStoreDoc = Record<string, MutableLarRecord>;

// ---------------------------------------------------------------------------
// AutomergeMemeStore
// ---------------------------------------------------------------------------

export class AutomergeMemeStore implements LarTiddlerStore {
  private handle:   DocHandle<MemeStoreDoc>;
  readonly provider: MemeProvider;

  constructor(handle: DocHandle<MemeStoreDoc>) {
    this.handle = handle;
    this.provider = new MemeProvider(() => (handle.doc() ?? {}) as Record<string, unknown>);

    // Feed remote Automerge patches into the provider for coalesced fan-out.
    const remoteOrigin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "automerge" };
    handle.on("change", ({ patches }) => {
      this.provider.handleChange(patches ?? [], remoteOrigin);
    });
  }

  /** Expose projection registration so callers outside the store (e.g. canvas,
   *  MCP) can receive coalesced change events without going through subscribe(). */
  addProjection(p: MemeProjection): () => void {
    return this.provider.addProjection(p);
  }

  /** Signal that initial Automerge sync has settled. Flushes pending debounces
   *  and fires onSyncComplete on all projections. Call after handle.whenReady(). */
  markSyncComplete(): void {
    this.provider.markSyncComplete();
  }

  async listVisible(): Promise<string[]> {
    const doc = this.handle.doc();
    if (!doc) return [];
    return Object.values(doc)
      .filter((r) => r && !r.deleted && r.title?.startsWith("lar:"))
      .map((r) => r.title);
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const doc = this.handle.doc();
    const raw = doc?.[title];
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
      };
    });
    // Local writes bypass the debounce — echo-loop guards need synchronous delivery.
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

  // Freeze Automerge proxy to a plain LarTiddlerRecord
  private _freeze(raw: MutableLarRecord): LarTiddlerRecord {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.freeze({
      title:  raw.title,
      fields: Object.freeze({ ...raw.fields }),
      ...(raw.text        !== undefined && { text:        raw.text }),
      ...(raw.deleted     !== undefined && { deleted:     raw.deleted }),
      ...(raw.sourceUri   !== undefined && { sourceUri:   raw.sourceUri }),
      ...(raw.contentHash !== undefined && { contentHash: raw.contentHash }),
      ...(raw.revision    !== undefined && { revision:    raw.revision }),
      ...(raw.authority   !== undefined && { authority:   raw.authority }),
    }) as LarTiddlerRecord;
  }
}

// ---------------------------------------------------------------------------
// initMemeRepo — boot entry point (called from lararium-browser-host.ts)
//
// storeUrl: Automerge URL for the tiddler doc.
//   - Injected by serve.ts via <meta name="lararium-meme-store">.
//   - Cached in localStorage for subsequent offline boots.
//   - If both are absent (clean offline first boot), creates a new empty doc.
// ---------------------------------------------------------------------------

export interface MemeRepoResult {
  repo:     Repo;
  store:    AutomergeMemeStore;
  storeUrl: AutomergeUrl;
}

export async function initMemeRepo(opts: {
  hostId:     string;
  syncWsUrl:  string;
  storeUrl:   string | null;
  authReceipt?: LarAuthReceipt; // browser/provider receipt for /auth/session claim
}): Promise<MemeRepoResult> {
  const { hostId, syncWsUrl, storeUrl, authReceipt } = opts;

  const storage = new IndexedDBStorageAdapter(`lararium:meme-store:${hostId}`);
  const network = new BrowserWebSocketClientAdapter(syncWsUrl);

  // Authorization hook — browser accepts peers locally; server-side sharePolicy
  // gates remote sync by provider-neutral /auth/session receipts.
  const repo = new Repo({ storage, network: [network], sharePolicy: async () => true });

  // repo.find is async (waits for the doc to be known); repo.create is sync.
  // Both return a DocHandle. We then await handle.doc() to materialize content.
  const handle: DocHandle<MemeStoreDoc> = storeUrl
    ? await repo.find<MemeStoreDoc>(storeUrl as AutomergeUrl)
    : repo.create<MemeStoreDoc>({});

  // whenReady() resolves when doc is materialized from IDB or network.
  // Hard timeout: if the Automerge doc hasn't resolved in 20s (network down, IDB
  // corrupt, server unreachable), throw so the caller can surface an error phase
  // instead of hanging the BootSplash indefinitely.
  const READY_TIMEOUT_MS = 20_000;
  await Promise.race([
    handle.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Automerge doc not ready after ${READY_TIMEOUT_MS / 1000}s — server unreachable or IndexedDB corrupt`)),
        READY_TIMEOUT_MS,
      )
    ),
  ]);

  // /auth/session claim — provider-neutral replacement for the removed UCAN
  // peer gate. Fire-and-forget while local-dev remains permissive; when provider
  // verification lands this should complete before content doc sync.
  if (authReceipt) {
    performAuthSessionClaim({ authReceipt, syncWsUrl, peerId: repo.peerId }).catch(
      (e) => console.warn("[lararium] /auth/session claim failed (non-fatal in local-dev):", e),
    );
  }

  const store = new AutomergeMemeStore(handle);
  // Signal projections that the initial replay has settled — flushes debounce
  // timers and fires onSyncComplete so TW5 can do one bulk refresh instead of
  // one refresh per tiddler during boot.
  store.markSyncComplete();
  return { repo, store, storeUrl: handle.url };
}

async function performAuthSessionClaim(opts: {
  authReceipt: LarAuthReceipt;
  syncWsUrl:    string;
  peerId:       string | undefined;
}): Promise<void> {
  const { authReceipt, syncWsUrl, peerId } = opts;
  if (!peerId) return; // peerId not yet assigned (no peers connected)

  // Derive the HTTP base URL from the WS sync URL.
  const base = syncWsUrl.replace(/^wss?:/, (p) => (p === "wss:" ? "https:" : "http:"))
    .replace(/\/meme-sync.*$/, "");

  await fetch(`${base}/auth/session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ peerId, provider: authReceipt.provider, receipt: authReceipt }),
  });
}

// ---------------------------------------------------------------------------
// readMemeStoreUrl — read server-injected or localStorage-cached Automerge URL
// ---------------------------------------------------------------------------

export function readMemeStoreUrl(hostId: string): string | null {
  // 1. Server injection (present on every page load if server is reachable)
  const meta = typeof document !== "undefined"
    ? document.querySelector('meta[name="lararium-meme-store"]')?.getAttribute("content")
    : null;
  if (meta) {
    localStorage.setItem(`lararium:meme-store-url:${hostId}`, meta);
    return meta;
  }
  // 2. Cached from a previous connected session (offline local-first boot)
  return localStorage.getItem(`lararium:meme-store-url:${hostId}`);
}
