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

import { assertStorableTitle } from "./title-law.js";
import { decodeHeads, encodeHeads, type DocHandle } from "@automerge/automerge-repo";
import { decodeChange, getChangesSince, hasHeads } from "@automerge/automerge";
import type { LarTiddlerRecord, LarTiddlerStore, LarTiddlerChange, ChangeOrigin, LarRemoveOptions } from "./tiddler-store.js";
import { holdsOnly } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import { MemeProvider } from "./meme-provider.js";
import type { LarDoc } from "./base-doc.js";
import { parallelDraftTitle, readParallelDrafts, readsParallelDrafts, type ParallelDraftsChange } from "./parallel-drafts.js";
import { headsEqual } from "./wiki-recipe.js";
import { plainField, plainRecord, plainValue, storedDeleted, type StoredLarRecord } from "./stored-value.js";
import { storedRecord, storedValue } from "./stored-record.js";

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

/** A hand's value as content compares it: a Date reads as its ISO form, an immutable scalar as its string. */
function _contentOf(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : plainValue(value);
}

function _contentValue(record: StoredLarRecord): unknown {
  const raw = record as { tiddler: Record<string, unknown>; meta?: { deleted?: unknown } };
  const tiddler = Object.fromEntries(Object.entries(raw.tiddler)
    .filter(([key]) => key !== "$origin-bag")
    .map(([key, value]) => [key, _contentOf(value)]));
  return { tiddler, deleted: raw.meta?.deleted === true };
}

function _contentEquals(cur: StoredLarRecord, rec: LarTiddlerRecord): boolean {
  return _canonicalJson(_contentValue(cur)) === _canonicalJson(_contentValue(rec));
}

/** Same value in the doc's medium: the stored side unwraps first, a list or map compares by its JSON form. */
function _sameValue(stored: unknown, next: unknown): boolean {
  const current = _contentOf(stored);
  const wanted = _contentOf(next);
  if (current === wanted) return true;
  if (current === null || wanted === null || typeof current !== "object" || typeof wanted !== "object") return false;
  return _canonicalJson(current) === _canonicalJson(wanted);
}

/**
 * Merge a record into the doc's copy field by field. A field whose value did not move is left
 * unassigned: an assignment supersedes every concurrent op on that key, so re-sending the live value
 * would erase a concurrent value this writer never saw. Every assigned string rests as an immutable
 * scalar (`stored-value.ts`).
 */
function _mergeRecord(target: MutableLarTiddlerRecord, record: LarTiddlerRecord): void {
  const t = target.tiddler;
  for (const key of Object.keys(t)) {
    if (key !== "$origin-bag" && !(key in record.tiddler)) delete t[key];
  }
  for (const [key, raw] of Object.entries(record.tiddler)) {
    if (key in t && _sameValue(t[key], raw)) continue;
    t[key] = storedValue(raw);
  }

  const nextMeta = record.meta ?? {};
  if (!target.meta) target.meta = {};
  const m = target.meta;
  for (const [key, value] of Object.entries(nextMeta)) {
    if (key === "deleted" || value === undefined) continue;
    if (key in m && _sameValue(m[key], value)) continue;
    m[key] = storedValue(value);
  }
  const deleted = nextMeta.deleted === true;
  if (m.deleted !== deleted) m.deleted = deleted;
  if (Object.keys(m).length === 0) delete target.meta;
}

/** A stored record as every reader past this shore holds it: frozen, every value unwrapped. */
const _freezeRecord = plainRecord;

/** Mark a title deleted inside a change — the kāpae tombstone, minted when no record stands. */
function _markDeleted(tiddlers: Record<string, MutableLarTiddlerRecord>, title: string): void {
  const existing = tiddlers[title];
  if (existing) {
    if (!existing.meta) existing.meta = {};
    existing.meta.deleted = true;
  } else {
    tiddlers[title] = storedRecord({ tiddler: { title }, meta: { deleted: true } }) as unknown as MutableLarTiddlerRecord;
  }
}

function _tombstoneRecord(title: string): LarTiddlerRecord {
  return Object.freeze({ tiddler: { title }, meta: { deleted: true } });
}

export class AutomergeDocStore implements LarTiddlerStore {
  readonly notifiesSynchronously = true;
  protected readonly handle: DocHandle<LarDoc>;
  readonly provider: MemeProvider;
  readonly bagId: string | undefined;
  private readonly _draftListeners = new Set<(change: ParallelDraftsChange) => void | Promise<void>>();

  constructor(handle: DocHandle<LarDoc>, bagId?: string) {
    this.handle  = handle;
    this.bagId   = bagId;
    // MemeProvider gets the tiddlers submap — keeps MemeProvider path-agnostic.
    this.provider = new MemeProvider(
      (title) => { const raw = handle.doc()?.tiddlers?.[title]; return raw ? plainRecord(raw) : null; },
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
  onParallelDrafts(fn: (change: ParallelDraftsChange) => void | Promise<void>): () => void {
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
      for (const fn of this._draftListeners) void fn(change);
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
    for (const raw of Object.values(tiddlers)) {
      if (!raw) continue;
      const record = _freezeRecord(raw);
      const title = record.tiddler.title;
      if (!title) continue;
      this.provider.fireImmediate({
        title,
        record,
        origin,
        ...(this.bagId !== undefined ? { bag: this.bagId } : {}),
        ...(heads !== undefined ? { heads } : {}),
      });
    }
  }

  async listVisible(): Promise<string[]> {
    const tiddlers = this.handle.doc()?.tiddlers;
    if (!tiddlers) return [];
    const titles: string[] = [];
    for (const raw of Object.values(tiddlers)) {
      if (!raw || storedDeleted(raw)) continue;
      const title = plainField(raw, "title");
      if (typeof title === "string" && title && !title.startsWith("$:/temp/")) titles.push(title);
    }
    return titles;
  }

  /** The titles this bag holds as tombstones: what a residency move that carries a tombstone reads. */
  listTombstoned(): string[] {
    const tiddlers = this.handle.doc()?.tiddlers;
    if (!tiddlers) return [];
    return Object.entries(tiddlers).filter(([, r]) => r && storedDeleted(r)).map(([title]) => title);
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

  /**
   * True where the document, read as of the heads `have`, holds every head in `named`: the named changes sit in
   * the causal past of `have`. A reader that landed this document's state at `have` (the wiki's landed ledger)
   * asks whether it landed the changes `named` too. A heads list this document never saw, or a document that
   * has not hydrated, answers false.
   */
  coversHeads(have: readonly string[], named: readonly string[]): boolean {
    try {
      const standing = this.handle.doc();
      // Both lists name changes this document holds; `have` covers `named` where no named change lies beyond
      // `have` (the changes since `have` are exactly the ones outside its causal past).
      if (!standing || !hasHeads(standing, have as string[]) || !hasHeads(standing, named as string[])) return false;
      const beyond = new Set(getChangesSince(standing, have as string[]).map((change) => decodeChange(change).hash));
      return named.every((head) => !beyond.has(head));
    } catch { return false; }
  }

  /** True where the document holds every head in `named`: those changes reached this replica. */
  holdsHeads(named: readonly string[]): boolean {
    try {
      const standing = this.handle.doc();
      return !!standing && hasHeads(standing, named as string[]);
    } catch { return false; }
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
    // THE TITLE DOOR. Every durable title passes this write: a put, a family, a tombstone (a tombstone
    // against an absent title MINTS the key). A session-form URI never stands as one, so the whole family
    // refuses by name before any byte moves (`title-law.ts`).
    for (const record of puts) assertStorableTitle(record.tiddler.title);
    for (const title of tombstones) assertStorableTitle(title);
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
    const movedTombstones = tombstones.filter((title) => !storedDeleted(current?.[title]));
    if (moved.length === 0 && movedTombstones.length === 0) return;

    const based = requestedBase !== undefined && currentHeads !== null && !headsEqual(requestedBase, currentHeads);
    // A REMOVAL COUNTS AS A CHANGE. A based write removes, at its base, each field the hand's record no
    // longer carries. Automerge keeps a concurrent SET of that field and records no conflict, so the
    // removal would vanish without a word: note what this write removes, and after the change read which
    // of those fields still stand.
    const removing = new Map<string, { record: LarTiddlerRecord; fields: string[] }>();
    if (based) {
      for (const record of moved) {
        const atBaseRecord = current?.[record.tiddler.title] as { tiddler?: Record<string, unknown> } | undefined;
        if (!atBaseRecord?.tiddler || record.meta?.deleted === true) continue;
        const fields = Object.keys(atBaseRecord.tiddler).filter((key) => key !== "$origin-bag" && !(key in record.tiddler));
        if (fields.length > 0) removing.set(record.tiddler.title, { record, fields });
      }
    }
    // SURFACE FIRST, THEN WRITE. Where the standing document already holds a later value for a field this
    // write removes, the removal will not stand. The hand's record surfaces as a draft, and its readers
    // settle, BEFORE the change lands: a vessel that stops between the two keeps the draft, which holds
    // the hand's whole record. The read after the change stays as the second net.
    const surfaced = new Map<string, Set<string>>();
    for (const [title, { record, fields }] of removing) {
      const base = current?.[title] as { tiddler: Record<string, unknown> } | undefined;
      const now = docNow?.tiddlers?.[title] as { tiddler?: Record<string, unknown> } | undefined;
      if (!base || !now?.tiddler || storedDeleted(docNow?.tiddlers?.[title])) continue;
      const met = fields.filter((field) => field in now.tiddler! && !_sameValue(now.tiddler![field], base.tiddler[field]));
      if (met.length === 0) continue;
      surfaced.set(title, new Set(met));
      await this._surfaceRemoval(title, record, met, origin, requestedBase);
    }
    const change = (doc: LarDoc) => {
      const tiddlers = doc.tiddlers as unknown as Record<string, MutableLarTiddlerRecord>;
      for (const record of moved) {
        const title = record.tiddler.title;
        const existing = tiddlers[title];
        if (existing) _mergeRecord(existing, record);
        else {
          // A based create states its liveness, so a concurrent delete of the title reads as a conflict.
          const meta = based ? { ...(record.meta ?? {}), deleted: record.meta?.deleted === true } : record.meta;
          tiddlers[title] = storedRecord({ tiddler: record.tiddler, ...(meta !== undefined ? { meta } : {}) }) as unknown as MutableLarTiddlerRecord;
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
    // THE FAMILY FIRES AS ONE GRAIN: every envelope of this change reaches a shore together, so its landing
    // queue never hands a turn to the host between a root and its children.
    const tiddlersNow = this.handle.doc()?.tiddlers;
    const fired: LarTiddlerChange[] = [];
    for (const record of moved) fired.push({ title: record.tiddler.title, record: tiddlersNow?.[record.tiddler.title] ? _freezeRecord(tiddlersNow[record.tiddler.title]!) : null, ...envelope });
    for (const title of movedTombstones) fired.push({ title, record: tiddlersNow?.[title] ? _freezeRecord(tiddlersNow[title]!) : _tombstoneRecord(title), ...envelope });
    this.provider.fireFamily(fired);
    for (const [title, { record, fields }] of removing) {
      const standing = tiddlersNow?.[title];
      if (!standing || storedDeleted(standing)) continue;
      const kept = fields.filter((field) => plainField(standing, field) !== undefined && !surfaced.get(title)?.has(field));
      if (kept.length > 0) await this._surfaceRemoval(title, record, kept, origin, madeAt);
    }
  }

  /**
   * A hand removed fields a concurrent writer set. The merged record keeps the concurrent values (the
   * store decides nothing); the hand's record, WITHOUT those fields, surfaces as one attributed draft in
   * the parallel-draft shape, so a reader keeps it beside the live record until a person settles it. The
   * answer settles once every reader has settled.
   * `lar-conflict-removed` names the fields the hand removed; none of them reads live.
   */
  private async _surfaceRemoval(title: string, record: LarTiddlerRecord, fields: readonly string[], origin: ChangeOrigin, madeAt: readonly string[] | undefined): Promise<void> {
    if (this._draftListeners.size === 0) return;
    const by = origin.kind === "tw-local" ? origin.instanceId : origin.kind;
    const modifier = (record.tiddler as Record<string, unknown>)["modifier"];
    const who = typeof modifier === "string" && modifier !== "" ? modifier : by;
    const draft: LarTiddlerRecord = Object.freeze({
      tiddler: Object.freeze({
        ...(plainValue(record.tiddler) as Record<string, unknown>),
        title: parallelDraftTitle(title, who),
        "draft.of": title,
        "draft.title": title,
        "lar-conflict-actor": by,
        "lar-conflict-ops": (madeAt ?? []).join(" "),
        "lar-conflict-fields": fields.join(" "),
        "lar-conflict-live": "",
        "lar-conflict-removed": fields.join(" "),
      }),
    });
    const change: ParallelDraftsChange = { title, bag: this.bagId, drafts: [draft] };
    // A reader's own failure stays its own (it raises its unkept-draft alert); the write goes on.
    await Promise.all([...this._draftListeners].map(async (fn) => {
      try { await fn(change); } catch (error) { console.warn(`[AutomergeDocStore] a parallel-drafts reader failed for "${title}": ${String(error)}`); }
    }));
  }

  /** A tombstone is a family of one: one change marking the title deleted, one tombstone fire. */
  async tombstone(title: string, origin: ChangeOrigin, options?: { base?: readonly string[] }): Promise<void> {
    return this.writeFamily([], [title], origin, options);
  }

  /** HARD-remove: delete the key so `get` returns null (ABSENT — falls through
   *  the cascade), never a kāpae tombstone. The MOVE/promotion source retract. */
  async remove(title: string, origin: ChangeOrigin, options?: LarRemoveOptions): Promise<void> {
    let removed = true;
    this.handle.change((doc) => {
      const tiddlers = doc.tiddlers as unknown as Record<string, MutableLarTiddlerRecord>;
      // THE TEST AND THE REMOVAL SHARE ONE CHANGE: no write lands between them.
      // A title holding a concurrent value the live one hides (a parallel draft, field or whole record) stays: removing
      // it would retract that value unlanded. It leaves at the pass after a write settles it.
      if (options?.only && (!holdsOnly(tiddlers[title] as unknown as LarTiddlerRecord | undefined, options.only)
        || this.parallelDrafts(title).length > 0)) { removed = false; return; }
      delete tiddlers[title];
    });
    if (!removed) return;
    // Fire record:null — absence; the adaptor's cross-bag resolution surfaces
    // whatever lower-bag copy now resolves beneath (vs a kāpae stop).
    const heads = this._headsForEnvelope();
    this.provider.fireImmediate({ title, record: null, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}), ...(heads !== undefined ? { heads } : {}) });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    return this.provider.addProjection({ onUriChanged: fn });
  }

}
