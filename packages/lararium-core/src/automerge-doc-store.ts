import type { DocHandle } from "@automerge/automerge-repo";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { LarDoc, MutableLarRecord } from "./base-doc.js";
import type { MemeProjection } from "./meme-provider.js";
import { MemeProvider } from "./meme-provider.js";

/**
 * AutomergeDocStore — the one LarTiddlerStore for every peer.
 *
 * Browser, Node, and worker peers all instantiate this directly.
 * Platform differences (IndexedDB vs fs vs memory) live in the Repo's
 * storage/network adapters — never in the store. Server-as-peer doctrine.
 *
 * LarDoc alignment (M24): the Automerge doc carries a `tiddlers` submap.
 *   doc.tiddlers[title] = MutableLarRecord
 *
 * Automerge patches arrive with path = ["tiddlers", title, fieldName].
 * AutomergeDocStore strips the leading "tiddlers" segment before handing
 * patches to MemeProvider so the provider stays path-agnostic.
 *
 * FPI-3 (synergy): same mutation/subscription API runs on every peer.
 * Local-first Ideal 1 (fast): get/listVisible read from the in-memory doc.
 */
function _contentEquals(cur: MutableLarRecord, rec: LarTiddlerRecord): boolean {
  if (cur.text      !== rec.text)      return false;
  if (cur.deleted   !== rec.deleted)   return false;
  if (cur.sourceUri !== rec.sourceUri) return false;
  if (cur.contentHash !== rec.contentHash) return false;
  if (cur.authority !== rec.authority) return false;
  if (cur.bag       !== rec.bag)       return false;
  const cf = cur.fields as Record<string, unknown>;
  const rf = rec.fields as Record<string, unknown>;
  const ck = Object.keys(cf);
  const rk = Object.keys(rf);
  if (ck.length !== rk.length) return false;
  for (const k of rk) { if (cf[k] !== rf[k]) return false; }
  return true;
}

export class AutomergeDocStore implements LarTiddlerStore {
  protected readonly handle: DocHandle<LarDoc>;
  readonly provider: MemeProvider;
  readonly bagId: string | undefined;

  constructor(handle: DocHandle<LarDoc>, bagId?: string) {
    this.handle  = handle;
    this.bagId   = bagId;
    // MemeProvider gets the tiddlers submap — keeps MemeProvider path-agnostic.
    this.provider = new MemeProvider(() => (handle.doc()?.tiddlers ?? {}) as Record<string, unknown>);

    const remoteOrigin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "automerge" };
    handle.on("change", ({ patches }) => {
      // Re-map ["tiddlers", title, ...] → [title, ...] before fan-out.
      // Patches that touch doc-level fields (schemaVersion, etc.) are dropped here
      // since MemeProvider only tracks tiddler-keyed URIs.
      const remapped = (patches ?? [])
        .filter((p) => Array.isArray(p.path) && p.path[0] === "tiddlers")
        .map((p) => ({ ...p, path: (p.path as unknown[]).slice(1) }));
      this.provider.handleChange(remapped, remoteOrigin);
    });
  }

  addProjection(p: MemeProjection): () => void {
    return this.provider.addProjection(p);
  }

  markSyncComplete(): void {
    this.provider.markSyncComplete();
  }

  async listVisible(): Promise<string[]> {
    const tiddlers = this.handle.doc()?.tiddlers;
    if (!tiddlers) return [];
    return (Object.values(tiddlers) as MutableLarRecord[])
      .filter((r) => r && !r.deleted && r.title && !r.title.startsWith("$:/temp/"))
      .map((r) => r.title);
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const raw = this.handle.doc()?.tiddlers?.[title];
    return raw ? this._freeze(raw) : null;
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    const existing = this.handle.doc()?.tiddlers?.[record.title];
    if (existing && _contentEquals(existing, record)) return;

    this.handle.change((doc) => {
      (doc.tiddlers as Record<string, MutableLarRecord>)[record.title] = {
        title:  record.title,
        fields: { ...record.fields },
        ...(record.text        !== undefined && { text:        record.text }),
        ...(record.deleted                  && { deleted:     record.deleted }),
        ...(record.sourceUri   !== undefined && { sourceUri:  record.sourceUri }),
        ...(record.contentHash !== undefined && { contentHash: record.contentHash }),
        ...(record.authority   !== undefined && { authority:  record.authority }),
        ...(record.bag         !== undefined && { bag:        record.bag }),
      };
    });
    this.provider.fireImmediate({ title: record.title, record, origin });
  }

  async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    this.handle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
      const existing = tiddlers[title];
      if (existing) { existing.deleted = true; }
      else { tiddlers[title] = { title, fields: {}, deleted: true }; }
    });
    // Carry a deleted record (rather than null) so listeners can reason about
    // which bag emitted the tombstone — needed by disk-projector unlink
    // routing and by MemeSyncAdaptor's "remove only when no live copy" logic.
    const tombstone: LarTiddlerRecord = Object.freeze({
      title,
      fields:  Object.freeze({}),
      deleted: true,
      ...(this.bagId !== undefined && { bag: this.bagId }),
    });
    this.provider.fireImmediate({ title, record: tombstone, origin });
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
