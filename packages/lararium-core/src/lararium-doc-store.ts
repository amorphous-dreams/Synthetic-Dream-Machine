/**
 * LarariumDocStore — read-only LarTiddlerStore adapter over a doc's `.tiddlers` map.
 *
 * Generic over any Automerge doc that carries a `tiddlers?` field at its root
 * (LarariumDoc, CatalogDoc).  Pass a `bagId` to the constructor to set the
 * Pass the owning doc's lar: URI as `bagId` — bag ID = doc URI (one doc = one bag).
 * Defaults to LARARIUM_DOC_URI for backward-compat.
 *
 * Read-only: no put() or tombstone() — these bags are authority-authored only.
 */

import type { DocHandle }              from "@automerge/automerge-repo";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MutableLarRecord }       from "./meme-store-doc.js";
import { LARARIUM_DOC_URI }            from "./lararium-doc.js";

type DocWithTiddlers = { readonly tiddlers?: Record<string, Readonly<MutableLarRecord>> };

export class LarariumDocStore<T extends DocWithTiddlers = DocWithTiddlers> implements LarTiddlerStore {
  readonly bagId: string;
  private readonly listeners: Set<(c: LarTiddlerChange) => void> = new Set();

  constructor(private readonly handle: DocHandle<T>, bagId = LARARIUM_DOC_URI) {
    this.bagId = bagId;
    handle.on("change", () => {
      const tiddlers = handle.doc()?.tiddlers ?? {};
      const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "automerge" };
      this.listeners.forEach((fn) => {
        for (const raw of Object.values(tiddlers)) {
          const record = this._freeze(raw as MutableLarRecord);
          if (record) fn({ title: record.title, record, origin });
        }
      });
    });
  }

  async listVisible(): Promise<string[]> {
    const tiddlers = this.handle.doc()?.tiddlers ?? {};
    return Object.values(tiddlers)
      .filter((r) => r && !(r as MutableLarRecord).deleted)
      .map((r) => (r as MutableLarRecord).title)
      .filter(Boolean);
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const raw = this.handle.doc()?.tiddlers?.[title];
    return raw ? this._freeze(raw as MutableLarRecord) : null;
  }

  async put(_record: LarTiddlerRecord, _origin: ChangeOrigin): Promise<void> {
    throw new Error(`LarariumDocStore(${this.bagId}): bag is read-only`);
  }

  async tombstone(_title: string, _origin: ChangeOrigin): Promise<void> {
    throw new Error(`LarariumDocStore(${this.bagId}): bag is read-only`);
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private _freeze(raw: MutableLarRecord): LarTiddlerRecord {
    return Object.freeze({
      title:  raw.title,
      fields: Object.freeze({ ...raw.fields }),
      bag:    this.bagId,
      ...(raw.text        !== undefined && { text:        raw.text }),
      ...(raw.deleted     !== undefined && { deleted:     raw.deleted }),
      ...(raw.sourceUri   !== undefined && { sourceUri:   raw.sourceUri }),
      ...(raw.contentHash !== undefined && { contentHash: raw.contentHash }),
      ...(raw.revision    !== undefined && { revision:    raw.revision }),
      ...(raw.authority   !== undefined && { authority:   raw.authority }),
    }) as LarTiddlerRecord;
  }
}
