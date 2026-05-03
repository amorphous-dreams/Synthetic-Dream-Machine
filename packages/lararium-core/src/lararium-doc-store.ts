/**
 * LarariumDocStore — read-only LarTiddlerStore adapter over LarariumDoc.tiddlers.
 *
 * The LarariumIsland doc carries system tiddlers (grammar meme, widget memes)
 * in its `tiddlers` map alongside binary blobs for the TW5 engine bundle.
 * This adapter exposes those tiddlers as the "system" bag in the CompositeStore.
 *
 * Read-only: no put() or tombstone() — system bag is engine-authored only.
 * Writes must go through the node server's `seedGrammarTiddler` path.
 */

import type { DocHandle }              from "@automerge/automerge-repo";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { LarariumDoc }            from "./lararium-doc.js";
import type { MutableLarRecord }       from "./meme-store-doc.js";

export class LarariumDocStore implements LarTiddlerStore {
  readonly bagId = "system";
  private readonly listeners: Set<(c: LarTiddlerChange) => void> = new Set();

  constructor(private readonly handle: DocHandle<LarariumDoc>) {
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
    throw new Error("LarariumDocStore: system bag is read-only");
  }

  async tombstone(_title: string, _origin: ChangeOrigin): Promise<void> {
    throw new Error("LarariumDocStore: system bag is read-only");
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private _freeze(raw: MutableLarRecord): LarTiddlerRecord {
    return Object.freeze({
      title:  raw.title,
      fields: Object.freeze({ ...raw.fields }),
      bag:    "system",
      ...(raw.text        !== undefined && { text:        raw.text }),
      ...(raw.deleted     !== undefined && { deleted:     raw.deleted }),
      ...(raw.sourceUri   !== undefined && { sourceUri:   raw.sourceUri }),
      ...(raw.contentHash !== undefined && { contentHash: raw.contentHash }),
      ...(raw.revision    !== undefined && { revision:    raw.revision }),
      ...(raw.authority   !== undefined && { authority:   raw.authority }),
    }) as LarTiddlerRecord;
  }
}
