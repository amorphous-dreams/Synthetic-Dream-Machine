/**
 * NodeMemeStore — LarTiddlerStore adapter over a Node.js Automerge DocHandle.
 *
 * Server-side mirror of AutomergeMemeStore (lararium-app).
 * Used to wire LarDiskProjector (and future server-side subscribers) to a
 * corpus or room DocHandle without pulling the browser package into Node.
 */

import type { DocHandle } from "@automerge/automerge-repo";
import type {
  LarTiddlerRecord,
  LarTiddlerStore,
  LarTiddlerChange,
  ChangeOrigin,
  MemeStoreDoc,
  MutableLarRecord,
  MemeProjection,
  PromotionReceipt,
} from "@lararium/core";
import { MemeProvider, abilityImplies } from "@lararium/core";

export class NodeMemeStore implements LarTiddlerStore {
  private readonly handle: DocHandle<MemeStoreDoc>;
  readonly provider:       MemeProvider;
  readonly bagId?:         string | undefined;

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

  /**
   * Draft promotion ceremony stub.
   *
   * Validates the actor holds "promote" ability, then writes the draft record
   * into this store and returns a PromotionReceipt.
   *
   * Full implementation: resolve beforeHeads/afterHeads from the Automerge
   * DocHandle, fire projection invalidations, and record the receipt in the
   * room/corpus doc for audit.  Those steps land in subsequent loops.
   */
  async promoteDraft(
    draft: LarTiddlerRecord,
    actor: PromotionReceipt["actor"],
    targetBag: string,
    invalidatesProjections: readonly string[] = [],
  ): Promise<PromotionReceipt> {
    const actorAbility = "authority" in actor ? (actor as { authority?: string }).authority : undefined;
    if (!abilityImplies((actorAbility ?? "read") as Parameters<typeof abilityImplies>[0], "promote")) {
      throw new Error(`promoteDraft: actor lacks "promote" ability`);
    }

    await this.put(draft, { kind: "canon-hydrate", receipt: "promotion-ceremony" });

    const receipt: PromotionReceipt = {
      sourceDraftId:          draft.title,
      targetId:               draft.title,
      targetBag,
      beforeHeads:            [],
      afterHeads:             [],
      actor,
      promotedAt:             new Date().toISOString(),
      invalidatesProjections,
    };
    return receipt;
  }

  private _freeze(raw: MutableLarRecord): LarTiddlerRecord {
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
