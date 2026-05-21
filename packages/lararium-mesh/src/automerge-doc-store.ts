import type { DocHandle } from "@automerge/automerge-repo";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin, MemeProjection } from "@lararium/types";
import { MemeProvider } from "@lararium/types";
import type { LarDoc, MutableLarRecord } from "./base-doc.js";

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
  return JSON.stringify(cur) === JSON.stringify(rec);
}

function _mergeRecord(target: MutableLarRecord, record: LarTiddlerRecord): void {
  for (const key of Object.keys(target.tiddler)) {
    if (!(key in record.tiddler)) delete target.tiddler[key];
  }
  for (const [key, value] of Object.entries(record.tiddler)) {
    if (typeof value === "string" || Array.isArray(value) || value === undefined) {
      target.tiddler[key] = value;
    }
  }

  const nextMeta = record.meta ?? {};
  if (!target.meta) target.meta = {};
  for (const key of Object.keys(target.meta)) {
    if (!(key in nextMeta)) delete target.meta[key as keyof NonNullable<MutableLarRecord["meta"]>];
  }
  for (const [key, value] of Object.entries(nextMeta)) {
    switch (key) {
      case "deleted":
        target.meta.deleted = value === true;
        break;
      case "sourceUri":
        if (typeof value === "string") target.meta.sourceUri = value;
        else delete target.meta.sourceUri;
        break;
      case "contentHash":
        if (typeof value === "string") target.meta.contentHash = value;
        else delete target.meta.contentHash;
        break;
      case "authority":
        if (typeof value === "string") target.meta.authority = value;
        else delete target.meta.authority;
        break;
      case "recipe":
        if (typeof value === "string") target.meta.recipe = value;
        else delete target.meta.recipe;
        break;
    }
  }
  if (Object.keys(target.meta).length === 0) delete target.meta;
}

function _normalizeFields(fields: LarTiddlerRecord["tiddler"]): MutableLarRecord["tiddler"] {
  const { created: rawCreated, modified: rawModified, ...rest } = fields;
  const created = rawCreated instanceof Date ? rawCreated.toISOString() : rawCreated;
  const modified = rawModified instanceof Date ? rawModified.toISOString() : rawModified;
  return {
    ...rest,
    ...(created !== undefined ? { created } : {}),
    ...(modified !== undefined ? { modified } : {}),
  };
}

function _cloneRecord(record: LarTiddlerRecord): MutableLarRecord {
  return {
    tiddler: _normalizeFields(record.tiddler),
    ...(record.meta !== undefined ? { meta: { ...record.meta } } : {}),
  };
}

function _isDeleted(record: MutableLarRecord | LarTiddlerRecord): boolean {
  return record.meta?.deleted === true;
}

function _titleOf(record: MutableLarRecord | LarTiddlerRecord): string {
  return record.tiddler.title;
}

function _freezeRecord(raw: MutableLarRecord): LarTiddlerRecord {
  return Object.freeze({
    tiddler: Object.freeze({ ...raw.tiddler }),
    ...(raw.meta !== undefined ? { meta: Object.freeze({ ...raw.meta }) } : {}),
  });
}

function _tombstoneRecord(title: string): LarTiddlerRecord {
  return Object.freeze({
    tiddler: { title },
    meta: { deleted: true },
  });
}

export class AutomergeDocStore implements LarTiddlerStore {
  protected readonly handle: DocHandle<LarDoc>;
  readonly provider: MemeProvider;
  readonly bagId: string | undefined;

  constructor(handle: DocHandle<LarDoc>, bagId?: string) {
    this.handle  = handle;
    this.bagId   = bagId;
    // MemeProvider gets the tiddlers submap — keeps MemeProvider path-agnostic.
    this.provider = new MemeProvider(
      () => (handle.doc()?.tiddlers ?? {}) as Record<string, unknown>,
      () => this.bagId,
    );

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
      .filter((r) => r && !_isDeleted(r) && _titleOf(r) && !_titleOf(r).startsWith("$:/temp/"))
      .map((r) => _titleOf(r));
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const raw = this.handle.doc()?.tiddlers?.[title];
    return raw ? _freezeRecord(raw) : null;
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    const title = record.tiddler.title;
    const existing = this.handle.doc()?.tiddlers?.[title];
    if (existing && _contentEquals(existing, record)) return;

    this.handle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
      const current = tiddlers[title];
      if (current) {
        _mergeRecord(current, record);
        return;
      }
      tiddlers[title] = _cloneRecord(record);
    });
    this.provider.fireImmediate({ title, record, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}) });
  }

  async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    this.handle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
      const existing = tiddlers[title];
      if (existing) {
        if (!existing.meta) existing.meta = {};
        existing.meta.deleted = true;
      } else {
        tiddlers[title] = { tiddler: { title }, meta: { deleted: true } };
      }
    });
    this.provider.fireImmediate({ title, record: _tombstoneRecord(title), origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}) });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    return this.provider.addProjection({ onUriChanged: fn });
  }

}
