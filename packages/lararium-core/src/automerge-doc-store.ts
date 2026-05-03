import type { DocHandle } from "@automerge/automerge-repo";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MemeStoreDoc, MutableLarRecord } from "./meme-store-doc.js";
import type { MemeProjection } from "./meme-provider.js";
import { MemeProvider } from "./meme-provider.js";

/**
 * AutomergeDocStore — the one LarTiddlerStore for every peer.
 *
 * Browser, Node, and worker peers all instantiate this directly.
 * Platform differences (IndexedDB vs fs vs memory) live in the Repo's
 * storage/network adapters — never in the store. Server-as-peer doctrine.
 *
 * FPI-3 (synergy): same mutation/subscription API runs on every peer.
 * Local-first Ideal 1 (fast): get/listVisible read from the in-memory doc.
 */
export class AutomergeDocStore implements LarTiddlerStore {
  protected readonly handle: DocHandle<MemeStoreDoc>;
  readonly provider: MemeProvider;
  readonly bagId: string | undefined;

  constructor(handle: DocHandle<MemeStoreDoc>, bagId?: string) {
    this.handle  = handle;
    this.bagId   = bagId;
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
    return (Object.values(doc) as MutableLarRecord[])
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
        title:  record.title,
        fields: { ...record.fields },
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
      if (existing) { existing.deleted = true; }
      else { doc[title] = { title, fields: {}, deleted: true }; }
    });
    this.provider.fireImmediate({ title, record: null, origin });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    return this.provider.addProjection({ onUriChanged: fn });
  }

  protected _freeze(raw: MutableLarRecord): LarTiddlerRecord {
    const effectiveBag: string | undefined =
      (raw.bag as string | undefined) ?? this.bagId ?? undefined;
    return Object.freeze({
      title:  raw.title,
      fields: Object.freeze({ ...raw.fields }),
      ...(raw.text        !== undefined && { text:        raw.text }),
      ...(raw.deleted     !== undefined && { deleted:     raw.deleted }),
      ...(raw.sourceUri   !== undefined && { sourceUri:   raw.sourceUri }),
      ...(raw.contentHash !== undefined && { contentHash: raw.contentHash }),
      ...(raw.revision    !== undefined && { revision:    raw.revision }),
      ...(raw.authority   !== undefined && { authority:   raw.authority }),
      ...(effectiveBag    !== undefined && { bag: effectiveBag }),
    }) as LarTiddlerRecord;
  }
}
