/**
 * AutomergeDocStore — the one LarTiddlerStore for every vessel: the SHORE where LarDoc meaning
 * crosses into Automerge's medium.
 *
 * The store SHAPE crosses unchanged: browser, Node, and worker vessels all instantiate this
 * directly, and platform differences (IndexedDB vs fs vs memory) live in the Repo's storage/network
 * adapters — never in the store. Relay-as-vessel doctrine. The medium varies; the shape does not.
 *
 * LarDoc alignment (M24): the Automerge doc carries a `tiddlers` submap.
 *   doc.tiddlers[title] = LarTiddlerRecord
 *
 * Automerge patches arrive with path = ["tiddlers", title, fieldName]. AutomergeDocStore strips the
 * leading "tiddlers" segment before handing patches to MemeProvider so the provider stays
 * path-agnostic — the foreign medium's addressing stops at this shore and never travels inward.
 *
 * FPI-3 (synergy): same mutation/subscription API runs on every vessel.
 * Local-first Ideal 1 (fast): get/listVisible read from the in-memory doc.
 *
 * TALK-STORY SURFACING: a merge that leaves concurrent values on a record (two actors set one field,
 * or created one title, concurrently) raises `onParallelDrafts` listeners — and every registered
 * projection that reads drafts — with every concurrent value as an attributed TW5 draft
 * (`parallel-drafts.ts`), and `parallelDrafts(title)` answers them on demand. The value Automerge merged stays live; the others stay reachable; the store decides nothing.
 * A put compares content independently of ceremony metadata, merges only moved content fields, and
 * preserves metadata the writer omitted. A based put applies at its captured heads so Automerge can
 * retain concurrent values as field conflicts.
 */

import { decodeHeads, encodeHeads, type DocHandle } from "@automerge/automerge-repo";
import { hasHeads } from "@automerge/automerge";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import { MemeProvider } from "./meme-provider.js";
import type { LarDoc } from "./base-doc.js";
import { readParallelDrafts, readsParallelDrafts, type ParallelDraftsChange } from "./parallel-drafts.js";
import { headsEqual } from "./wiki-recipe.js";

type MutableLarTiddlerRecord = {
  tiddler: Record<string, unknown> & { title: string };
  meta?: Record<string, unknown> & { deleted?: boolean };
};

/** JSON with every map's keys sorted — the doc hands its maps back key-sorted, a caller's record
 *  arrives in authoring order, and the two spell one content. */
function _canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v);
}

function _storedValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function _contentValue(record: LarTiddlerRecord): unknown {
  const tiddler = Object.fromEntries(Object.entries(record.tiddler)
    .filter(([key]) => key !== "$origin-bag")
    .map(([key, value]) => [key, _storedValue(value)]));
  return { tiddler, deleted: record.meta?.deleted === true };
}

function _contentEquals(cur: LarTiddlerRecord, rec: LarTiddlerRecord): boolean {
  return _canonicalJson(_contentValue(cur)) === _canonicalJson(_contentValue(rec));
}

/** Same value in the doc's medium — a list or map compares by its JSON form. */
function _sameValue(current: unknown, next: unknown): boolean {
  if (current === next) return true;
  if (current === null || next === null || typeof current !== "object" || typeof next !== "object") return false;
  return _canonicalJson(current) === _canonicalJson(next);
}

/**
 * Merge a record into the doc's copy field by field. A field whose value did not move is left
 * unassigned: an assignment supersedes every concurrent op on that key, so re-sending the live value
 * would erase a concurrent value this writer never saw.
 */
function _mergeRecord(target: MutableLarTiddlerRecord, record: LarTiddlerRecord): void {
  const t = target.tiddler;
  for (const key of Object.keys(t)) {
    if (key !== "$origin-bag" && !(key in record.tiddler)) delete t[key];
  }
  for (const [key, raw] of Object.entries(record.tiddler)) {
    const value = _storedValue(raw);
    if (key in t && _sameValue(t[key], value)) continue;
    t[key] = value;
  }

  const nextMeta = record.meta ?? {};
  if (!target.meta) target.meta = {};
  const m = target.meta;
  for (const [key, value] of Object.entries(nextMeta)) {
    if (key !== "deleted") m[key] = value;
  }
  m.deleted = nextMeta.deleted === true;
  if (Object.keys(m).length === 0) delete target.meta;
}

function _cloneRecord(record: LarTiddlerRecord): LarTiddlerRecord {
  const { created: rawCreated, modified: rawModified, ...rest } = record.tiddler;
  const created = rawCreated instanceof Date ? rawCreated.toISOString() : rawCreated;
  const modified = rawModified instanceof Date ? rawModified.toISOString() : rawModified;
  return {
    tiddler: {
      ...rest,
      ...(created !== undefined ? { created } : {}),
      ...(modified !== undefined ? { modified } : {}),
    },
    ...(record.meta !== undefined ? { meta: { ...record.meta } } : {}),
  };
}

function _isDeleted(record: LarTiddlerRecord): boolean {
  return record.meta?.deleted === true;
}

function _titleOf(record: LarTiddlerRecord): string {
  return record.tiddler.title;
}

function _freezeRecord(raw: LarTiddlerRecord): LarTiddlerRecord {
  return Object.freeze({
    tiddler: Object.freeze({ ...raw.tiddler }),
    ...(raw.meta !== undefined ? { meta: Object.freeze({ ...raw.meta }) } : {}),
  });
}

/** Mark a title deleted inside a change — the kāpae tombstone, minted when no record stands. */
function _markDeleted(tiddlers: Record<string, MutableLarTiddlerRecord>, title: string): void {
  const existing = tiddlers[title];
  if (existing) {
    if (!existing.meta) existing.meta = {};
    existing.meta.deleted = true;
  } else {
    tiddlers[title] = { tiddler: { title }, meta: { deleted: true } };
  }
}

function _tombstoneRecord(title: string): LarTiddlerRecord {
  return Object.freeze({ tiddler: { title }, meta: { deleted: true } });
}

export class AutomergeDocStore implements LarTiddlerStore {
  protected readonly handle: DocHandle<LarDoc>;
  readonly provider: MemeProvider;
  readonly bagId: string | undefined;
  private readonly _draftListeners = new Set<(change: ParallelDraftsChange) => void>();

  constructor(handle: DocHandle<LarDoc>, bagId?: string) {
    this.handle  = handle;
    this.bagId   = bagId;
    // MemeProvider gets the tiddlers submap — keeps MemeProvider path-agnostic.
    this.provider = new MemeProvider(
      () => (handle.doc()?.tiddlers ?? {}) as Record<string, unknown>,
      () => this.bagId,
      () => this._headsForEnvelope() ?? null,
    );

    const remoteOrigin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: bagId ?? "automerge" };
    handle.on("change", ({ patches }) => {
      // Re-map ["tiddlers", title, ...] → [title, ...] before fan-out.
      // Patches that touch doc-level fields (schemaVersion, etc.) are dropped here
      // since MemeProvider only tracks tiddler-keyed URIs.
      const remapped = (patches ?? [])
        .filter((p) => Array.isArray(p.path) && p.path[0] === "tiddlers")
        .map((p) => ({ ...p, path: (p.path as unknown[]).slice(1) }));
      this.provider.handleChange(remapped, remoteOrigin);
      this._surfaceConflicts(remapped);
    });
  }

  /** Every concurrent operation value on `title`, grouped across distinct fields by writer
   *  operation identity (`parallel-drafts.ts`). Empty when the record carries no conflict. Reads only. */
  parallelDrafts(title: string): LarTiddlerRecord[] {
    return readParallelDrafts(this.handle.doc()?.tiddlers, title);
  }

  /** Listen for a change that leaves concurrent values on a record. Returns the unsubscribe. */
  onParallelDrafts(fn: (change: ParallelDraftsChange) => void): () => void {
    this._draftListeners.add(fn);
    return () => { this._draftListeners.delete(fn); };
  }

  /** A patch Automerge marks as a conflict (`action: "conflict"`, or a put carrying `conflict: true`)
   *  names a record where a concurrent value just landed — read its drafts and raise them. */
  private _surfaceConflicts(patches: ReadonlyArray<{ action?: unknown; path: unknown[]; conflict?: unknown }>): void {
    if (this._draftListeners.size === 0) return;
    const titles = new Set<string>();
    for (const p of patches) {
      if (p.action !== "conflict" && p.conflict !== true) continue;
      const title = p.path[0];
      if (typeof title === "string") titles.add(title);
    }
    for (const title of titles) {
      const drafts = this.parallelDrafts(title);
      if (drafts.length === 0) continue;
      const change: ParallelDraftsChange = { title, bag: this.bagId, drafts };
      for (const fn of this._draftListeners) fn(change);
    }
  }

  /** Register a projection. One that reads surfaced drafts (`ParallelDraftsReader`) hears this store's
   *  surfacings too, under the same unsubscribe. */
  addProjection(p: MemeProjection): () => void {
    const off = this.provider.addProjection(p);
    if (!readsParallelDrafts(p)) return off;
    const offDrafts = this.onParallelDrafts((change) => p.onParallelDrafts(change));
    return () => { off(); offDrafts(); };
  }

  markSyncComplete(): void {
    this.provider.markSyncComplete(this.bagId ?? "automerge");
  }

  /**
   * Emit every current record as an initial state envelope carrying the bag's
   * heads snapshot. Projections receive the same record and heads read together.
   */
  emitInitialReplay(): void {
    const tiddlers = this.handle.doc()?.tiddlers;
    if (!tiddlers) return;
    const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: this.bagId ?? "automerge" };
    const heads = this._headsForEnvelope();
    for (const raw of Object.values(tiddlers) as LarTiddlerRecord[]) {
      if (!raw || !raw.tiddler?.title) continue;
      const title = raw.tiddler.title;
      this.provider.fireImmediate({
        title,
        record: _freezeRecord(raw),
        origin,
        ...(this.bagId !== undefined ? { bag: this.bagId } : {}),
        ...(heads !== undefined ? { heads } : {}),
      });
    }
  }

  async listVisible(): Promise<string[]> {
    const tiddlers = this.handle.doc()?.tiddlers;
    if (!tiddlers) return [];
    return (Object.values(tiddlers) as LarTiddlerRecord[])
      .filter((r) => r?.tiddler && !_isDeleted(r) && _titleOf(r) && !_titleOf(r).startsWith("$:/temp/"))
      .map((r) => _titleOf(r));
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    const raw = this.handle.doc()?.tiddlers?.[title];
    return raw ? _freezeRecord(raw) : null;
  }

  /**
   * The standing document's record for `title` (a tombstone included) with the document's heads, read in
   * one synchronous stretch. A document that holds no entry for the title, or has not hydrated, answers
   * `{ record: null }` and reads no heads: absence costs one map lookup.
   */
  readNow(title: string): { record: LarTiddlerRecord | null; heads?: readonly string[] } {
    const raw = this.handle.doc()?.tiddlers?.[title];
    if (!raw) return { record: null };
    return { record: _freezeRecord(raw), heads: Object.freeze([...decodeHeads(this.handle.heads())]) };
  }

  /** Read one record, synchronously, as the document stood at the supplied heads. */
  getAt(title: string, heads: readonly string[]): LarTiddlerRecord | null {
    const raw = this._docAt(heads)?.tiddlers?.[title];
    return raw ? _freezeRecord(raw) : null;
  }

  /**
   * The document as it stood at `heads`. Heads equal to the document's own answer the STANDING document:
   * a view materialises the whole document at its heads, a cost that grows with the document, and the
   * Repo keeps a view only while something references it, so a reader that asks once per record would
   * rebuild it per record. A view is built for heads in the document's past, and only there. The heads
   * and the document are read in one synchronous stretch, so they name the same state.
   */
  private _docAt(heads: readonly string[]): LarDoc | undefined {
    const standing = this.handle.doc();
    if (!standing) return undefined;
    if (headsEqual(heads, decodeHeads(this.handle.heads()))) return standing;
    return this.handle.view(encodeHeads(heads as string[])).doc();
  }

  /** Synchronous current heads, in the raw hexadecimal form returned by getHeads(). */
  headsNow(): readonly string[] | null {
    if (!this.handle.doc()) return null;
    return Object.freeze([...decodeHeads(this.handle.heads())]);
  }

  /** Attach the handle's causal snapshot to its state envelope when its API exposes heads. */
  private _headsForEnvelope(): readonly string[] | undefined {
    if (!this.handle.doc()) return undefined;
    if (typeof (this.handle as DocHandle<LarDoc> & { heads?: () => string[] }).heads !== "function") return undefined;
    return this.headsNow() ?? undefined;
  }

  /**
   * Residency Model: current Automerge Heads for this bag's doc.
   * Returns null when the doc has not yet hydrated (DocHandle.doc() returns
   * undefined). Used by CompositeStore.auditPins() to detect bag-pin drift.
   */
  async getHeads(): Promise<readonly string[] | null> {
    return this.headsNow();
  }

  /** A put is a family of one: same skip-when-standing, same single change, same single fire. */
  async put(record: LarTiddlerRecord, origin: ChangeOrigin, options?: { bag?: string; base?: readonly string[] }): Promise<void> {
    return this.writeFamily([record], [], origin, options);
  }

  /**
   * Write a meme family in one Automerge change: every put merges (or creates) its record and every
   * tombstone marks its title deleted inside the same Automerge change, so a peer receives the root,
   * its new children and its orphans' tombstones together or not at all. Records whose content
   * content already stands at the selected base are skipped; when nothing moves, no change is made.
   * A stale base uses `changeAt`, preserving concurrent field values as conflicts.
   */
  async writeFamily(
    puts:       readonly LarTiddlerRecord[],
    tombstones: readonly string[],
    origin:     ChangeOrigin,
    options?:   { bag?: string; base?: readonly string[] },
  ): Promise<void> {
    const docNow = this.handle.doc();
    const requestedBase = options?.base;
    let currentHeads: readonly string[] | null = null;
    if (requestedBase !== undefined) {
      try {
        currentHeads = this.headsNow();
      } catch (error) {
        throw new Error("AutomergeDocStore.writeFamily: requested base cannot be honored because current heads are unreadable", { cause: error });
      }
    }
    if (requestedBase !== undefined) {
      if (!docNow || currentHeads === null) {
        throw new Error("AutomergeDocStore.writeFamily: requested base cannot be honored before document hydration");
      }
      if (!hasHeads(docNow, requestedBase as string[])) {
        throw new Error(`AutomergeDocStore.writeFamily: requested base contains heads outside this document history (${requestedBase.join(", ")})`);
      }
    }
    let atBase: LarDoc | undefined = docNow;
    try {
      if (docNow && requestedBase) atBase = this._docAt(requestedBase);
    } catch (error) {
      throw new Error("AutomergeDocStore.writeFamily: requested base has no readable document view", { cause: error });
    }
    if (requestedBase !== undefined && !atBase) {
      throw new Error("AutomergeDocStore.writeFamily: requested base has no readable document view");
    }
    const current = atBase?.tiddlers;
    const moved = puts.filter((r) => {
      const existing = current?.[r.tiddler.title];
      return !(existing && _contentEquals(existing, r));
    });
    const movedTombstones = tombstones.filter((title) => current?.[title]?.meta?.deleted !== true);
    if (moved.length === 0 && movedTombstones.length === 0) return;

    const based = requestedBase !== undefined && currentHeads !== null && !headsEqual(requestedBase, currentHeads);
    const change = (doc: LarDoc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarTiddlerRecord>;
      for (const record of moved) {
        const title = record.tiddler.title;
        const existing = tiddlers[title];
        if (existing) _mergeRecord(existing, record);
        else {
          const created = _cloneRecord(record) as MutableLarTiddlerRecord;
          if (based) {
            if (!created.meta) created.meta = {};
            created.meta.deleted = record.meta?.deleted === true;
          }
          tiddlers[title] = created;
        }
      }
      for (const title of movedTombstones) _markDeleted(tiddlers, title);
    };
    let madeAt: readonly string[] | undefined;
    try {
      if (based) {
        const made = this.handle.changeAt(encodeHeads(requestedBase as string[]), change);
        if (made) madeAt = Object.freeze([...decodeHeads(made)]);
      } else this.handle.change(change);
    } catch (error) {
      if (requestedBase !== undefined) {
        throw new Error("AutomergeDocStore.writeFamily: requested base could not be applied", { cause: error });
      }
      throw error;
    }
    const bag = this.bagId !== undefined ? { bag: this.bagId } : {};
    const heads = this._headsForEnvelope();
    // WHERE THIS WRITE STANDS. A plain write sits on top of everything the doc held, so its change IS
    // the doc's heads. A based write sits beside whatever landed after its base: `changeAt` names its
    // change alone. The writer's next write of these titles builds on `writtenAt`, never on the merged
    // heads, so a run of writes from one hand never stands concurrent with itself and a remote edit it
    // has not seen stays concurrent with every one of them.
    const writtenAt = madeAt ?? heads;
    const envelope = { origin, ...bag, ...(heads !== undefined ? { heads } : {}), ...(writtenAt !== undefined ? { writtenAt } : {}) };
    const tiddlersNow = this.handle.doc()?.tiddlers;
    for (const record of moved) this.provider.fireImmediate({ title: record.tiddler.title, record: tiddlersNow?.[record.tiddler.title] ? _freezeRecord(tiddlersNow[record.tiddler.title]!) : null, ...envelope });
    for (const title of movedTombstones) this.provider.fireImmediate({ title, record: tiddlersNow?.[title] ? _freezeRecord(tiddlersNow[title]!) : _tombstoneRecord(title), ...envelope });
  }

  /** A tombstone is a family of one: one change marking the title deleted, one tombstone fire. */
  async tombstone(title: string, origin: ChangeOrigin, options?: { base?: readonly string[] }): Promise<void> {
    return this.writeFamily([], [title], origin, options);
  }

  /** HARD-remove: delete the key so `get` returns null (ABSENT — falls through
   *  the cascade), never a kāpae tombstone. The MOVE/promotion source retract. */
  async remove(title: string, origin: ChangeOrigin): Promise<void> {
    this.handle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarTiddlerRecord>;
      delete tiddlers[title];
    });
    // Fire record:null — absence; the adaptor's cross-bag resolution surfaces
    // whatever lower-bag copy now resolves beneath (vs a kāpae stop).
    const heads = this._headsForEnvelope();
    this.provider.fireImmediate({ title, record: null, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}), ...(heads !== undefined ? { heads } : {}) });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    return this.provider.addProjection({ onUriChanged: fn });
  }

}
