/**
 * Wiki shore between CompositeStore and TW5. The landed ledger records each wave's absolute result;
 * WaveLanding meets queued waves with unsent hands before using the packed engine as a synchronous
 * applier. HandGate paces absolute per-title writes and carries the ledger heads as their base.
 *
 * Schema: lar:///ha.ka.ba/lares/api/lararium/schema/island-adaptor
 */

import type {
  CompositeStore,
  LarTiddlerStore,
  LarTiddlerRecord,
  LarTiddlerChange,
  ChangeOrigin,
  MemeProjection,
  ParallelDraftsChange,
  ParallelDraftsReader,
  SlotUri,
} from "@lararium/mesh";
import { toLarTiddlerRecord, isVolatileVmUri, draftsOffLive } from "@lararium/mesh";
import { BAG_PATHS_CONFIG, routeBag, type RouteVerdict } from "./bag-cascade.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import { splitBodyTiddler, quoteblockFence } from "./deserializer.js";
import { LandedLedger, same, sameWithStamp } from "./landed-ledger.js";
import { WaveLanding } from "./wave-landing.js";
import { HandGate, type ShoreTimers } from "./hand-gate.js";

/** The wiki's live write layer — where a save the cascade cannot route still lands. */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. */
const TW5_ALERT_TAG = "$:/tags/Alert";

/** The alert a parallel draft that could not persist raises — one per draft, holding the draft itself. */
export function parallelDraftAlertTitle(draftTitle: string): string {
  return `$:/temp/lares/alert/parallel-draft/${draftTitle}`;
}

/**
 * A rule whose last step names its slot through a text reference: `…then{<title>}]`. The cascade walk
 * hands back the same empty answer for `then[]` and for a `then{pointer}` over a pointer that holds
 * nothing, and they mean opposite things: the first withholds by decision, the second chose a slot this
 * wiki cannot name. The rule's own spelling tells them apart.
 */
const ROUTES_BY_REFERENCE = /then\{([^}]+)\}\]\s*$/;

/** The alert a save with no bag to land in raises — one per slot pointer that holds nothing. */
export function unroutedSaveAlertTitle(reference: string): string {
  return `$:/temp/lares/alert/unrouted-save/${reference}`;
}

/**
 * A SAVE WITH NO BAG TO LAND IN. The cascade chose to route the title and the slot it routes to has no
 * name in this wiki: the pointer the rule dereferences (`reference`) holds nothing. The write stops, and
 * the refusal carries everything a person needs to read it: the title, the rule and the pointer.
 */
export class UnroutedSaveRefusal extends Error {
  override readonly name = "UnroutedSaveRefusal";
  constructor(readonly title: string, readonly rule: string, readonly reference: string) {
    super(`unrouted-save: "${title}" has no bag to land in — the routing rule ${rule} names its bag through ${reference}, and that tiddler holds nothing`);
  }
}

/**
 * The store the adaptor writes through: one that lands a family, and a tombstone, in the bag the
 * cascade NAMES. Every production wiring hands it the wiki's `CompositeStore` (`island-recipe`), and a
 * store that could only write to its own default would land a routed save in a bag no rule chose.
 */
export type IslandStore = LarTiddlerStore & Pick<CompositeStore, "writeFamily" | "tombstoneInBag" | "storeForBag">;

export class LandingDoorUnavailableError extends Error {
  override readonly name = "LandingDoorUnavailableError";
  constructor() { super("the TW5 engine must provide enqueueNalu and flushNalu for the wiki shore"); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTW5FieldStrings(
  tw5: TW5Engine,
  tiddler: unknown,
): Record<string, string> {
  const candidate = tiddler as { getFieldStrings?: () => Record<string, string>; fields?: Record<string, unknown> } | null;
  if (candidate?.getFieldStrings) return candidate.getFieldStrings();

  const Tiddler = tw5.$tw.Tiddler;
  if (candidate?.fields && typeof candidate.fields === "object") {
    return new Tiddler(candidate.fields).getFieldStrings();
  }
  if (tiddler && typeof tiddler === "object") {
    return new Tiddler(tiddler as Record<string, unknown>).getFieldStrings();
  }
  return {};
}

function extractFields(tw5: TW5Engine, tiddler: unknown): Record<string, string> {
  return toTW5FieldStrings(tw5, tiddler);
}

// ---------------------------------------------------------------------------
// IslandAdaptor
// ---------------------------------------------------------------------------

export class IslandAdaptor implements MemeProjection, ParallelDraftsReader {
  readonly name = "lararium-island";
  readonly ledger = new LandedLedger();
  private readonly gate: HandGate;
  private landing: WaveLanding | null = null;
  private engineEnqueue: ((change: LarTiddlerChange) => void) | null = null;
  private restoreDoor: (() => void) | null = null;
  private readonly sent = new Map<string, unknown>();
  private readonly handBase = new Map<string, { bag: string; heads: readonly string[] }>();
  private readonly lastWriteBag = new Map<string, string>();
  private readonly handed = new Map<string, unknown | null>();
  private readonly pendingHand = new Set<string>();
  private resident = false;
  private readonly flushes = new Set<Promise<unknown>>();
  private readonly activeFlushCounts = new Map<string, number>();
  private readonly resolvers = new Set<Promise<void>>();

  private _unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tw5:   TW5Engine,
    private readonly store: IslandStore,
    readonly instanceId:    string,
    timers?: ShoreTimers,
  ) {
    const timerPort = timers && typeof timers.setTimer === "function" && typeof timers.clearTimer === "function" ? timers : undefined;
    this.gate = new HandGate(timerPort);
  }

  /** Install the shore drain before seed replay or any other engine-door caller. */
  installLandingQueue(yieldHost?: () => Promise<void>): void {
    if (this.landing) return;
    const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
    if (!lares?.enqueueNalu || !lares.flushNalu) throw new LandingDoorUnavailableError();
    const engineDoor = lares.enqueueNalu;
    const enqueue = engineDoor.bind(lares);
    this.landing = new WaveLanding((change) => this._landOne(change), yieldHost);
    this.engineEnqueue = enqueue;
    lares.enqueueNalu = (change) => this.landing?.enqueue(change);
    this.restoreDoor = () => { lares.enqueueNalu = engineDoor; };
  }

  armSeedCheckpoint(): Promise<void> {
    this.installLandingQueue();
    return this.landing!.checkpoint().then(() => { this.resident = true; });
  }

  isResident(): boolean { return this.resident; }

  /** True when a wiki notification repeats the value the last wave left. */
  isFoam(title: string, value: unknown | null): boolean {
    const entry = this.ledger.landedOf(title);
    return entry ? same(entry.tiddler, value) : value === null;
  }

  wasSent(title: string, value: unknown): boolean { return this.sent.get(title) === value; }

  private async _landOne(change: LarTiddlerChange, handSettled = false): Promise<void> {
    const title = change.title;
    const wiki = this.tw5.$tw.wiki;
    const src = change.bag && typeof this.store.storeForBag === "function" ? this.store.storeForBag(change.bag) as {
      headsNow?: () => readonly string[];
      getAt?: (title: string, heads: readonly string[]) => LarTiddlerRecord | null;
    } | null : null;
    let heads = change.heads;
    let record = change.record;
    let bag = change.bag;
    if (src && typeof src.headsNow === "function" && typeof src.getAt === "function") {
      const currentHeads = src.headsNow();
      if (currentHeads !== null) {
        heads = currentHeads;
        record = src.getAt(title, currentHeads);
      }
    }
    const entry = this.ledger.landedOf(title);
    if (bag === undefined) {
      bag = entry?.bag;
      if (heads === undefined) heads = entry?.heads;
    }
    const live = record !== null && !record?.meta?.deleted;
    const incoming = live ? new this.tw5.$tw.Tiddler({
      ...record!.tiddler,
      title,
      ...(bag !== undefined ? { "$origin-bag": bag } : {}),
    }) : null;
    const standing = wiki.getTiddler(title) ?? null;
    const known = entry ? entry.tiddler : null;
    if (this.landing?.isStopped()) return;
    const isHand = !handSettled && this.resident && !same(standing, known) && !(this.sent.has(title) && this.sent.get(title) === standing);
    if (isHand) {
      for (let pass = 0; pass < 8; pass++) {
        const wrote = await this._leaveNow(title);
        const latest = wiki.getTiddler(title) ?? null;
        const currentEntry = this.ledger.landedOf(title);
        const unsent = !same(latest, currentEntry ? currentEntry.tiddler : null) && !(this.sent.has(title) && this.sent.get(title) === latest);
        if (wrote) {
          if (unsent) continue;
          return;
        }
        return this._landOne(change, true);
      }
      return;
    }
    const applies = !sameWithStamp(incoming, standing);
    if (applies) {
      const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
      const original = this.engineEnqueue;
      if (original && lares?.flushNalu) {
        original({ ...change, record, ...(bag !== undefined ? { bag } : {}) });
        lares.flushNalu(1);
      }
    }
    this.ledger.set(title, { tiddler: wiki.getTiddler(title) ?? null, ...(bag !== undefined ? { bag } : {}), ...(heads !== undefined ? { heads } : {}) });
    this.sent.delete(title);
    this.handBase.delete(title);
    if (applies) this.lastWriteBag.delete(title);
  }

  /**
   * Walk the in-wiki bag-path cascade (`bag-cascade.routeBag`) over this engine's wiki.
   *
   * ── THE CASCADE ROUTES; IT DOES NOT DECIDE WHETHER TO WRITE ───────────────────────────────────
   * Everything a hand edits and saves — memes, `.tid`s, and every other TW5 filetype — travels
   * through the CRDT and round-trips. The cascade answers WHICH slot; the only thing that may
   * withhold a write is a rule that NAMES what it withholds. A gap, or a rule routing through a pointer
   * that holds nothing, read as a withholding drops the write in silence — the promise resolves, the
   * wiki shows the edit, nothing persists, and the tiddler is gone on the next boot — so `_destination`
   * tells each apart.
   */
  private _routeBag(title: string): RouteVerdict {
    return routeBag(this.tw5.$tw.wiki, title);
  }

  /**
   * Resolve a write's destination, and say so out loud when the cascade cannot.
   *
   * A GAP IS A BUG IN THE CASCADE, never a property of the tiddler, so it MUST NOT pass as a quiet
   * no-op. The write still lands — at the write layer, which is where an unrouted save belongs — and
   * the console carries the title that had no rule, because the alternative is an operator losing
   * work and having nothing to read.
   */
  private _destination(title: string): SlotUri | null {
    return this._settle(title, this._routeBag(title));
  }

  /**
   * Act on a cascade verdict: a slot lands there, a named withholding skips (null), a gap falls to the
   * write layer, and a route with no bag behind it THROWS the named refusal after raising it on the
   * alert rail — a rule that routes through an empty pointer, or a gap while the write layer itself
   * has no name.
   */
  private _settle(title: string, verdict: RouteVerdict): SlotUri | null {
    if (verdict.kind === "slot") return verdict.uri;
    if (verdict.kind === "withheld") {
      const reference = ROUTES_BY_REFERENCE.exec(verdict.rule)?.[1];
      if (reference === undefined) return null;
      throw this._refuseUnrouted(title, verdict.rule, reference);
    }
    const fallback = this.tw5.$tw.wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
    console.warn(
      `[island-adaptor] no cascade rule routes "${title}" (${verdict.why}) — ` +
      (fallback ? `writing to the write layer ${fallback}. ` : "and no write layer resolves. ") +
      `Add a rule to ${BAG_PATHS_CONFIG}; a save must never vanish for want of one.`,
    );
    if (!fallback) throw this._refuseUnrouted(title, `(no rule: ${verdict.why})`, CURRENT_WIKI_BAG);
    return fallback as SlotUri;
  }

  /**
   * RAISE THE REFUSAL WHERE A PERSON READS IT, and hand it back for the caller to throw.
   *
   * One alert per pointer that holds nothing, on TiddlyWiki's own alert rail (the page template renders
   * `$:/tags/Alert`): it names the pointer, the rule, and every title refused under it this session, so
   * a burst of saves reads as one statement rather than a wall. The wiki keeps each title exactly as
   * the person wrote it — the alert says those words stand in this page alone.
   *
   * The alert lives under `$:/temp/`, whose own pointer may hold nothing too; its save then refuses
   * quietly, since an alert about an alert would recurse without end and the rail already shows it.
   */
  private _refuseUnrouted(title: string, rule: string, reference: string): UnroutedSaveRefusal {
    const refusal = new UnroutedSaveRefusal(title, rule, reference);
    if (title.startsWith(unroutedSaveAlertTitle(""))) return refusal;
    let titles = this._unrouted.get(reference);
    if (!titles) this._unrouted.set(reference, titles = new Set());
    if (titles.has(title)) return refusal;
    titles.add(title);
    console.warn(`[island-adaptor] ${refusal.message}`);
    this._addAlertIfChanged({
      title: unroutedSaveAlertTitle(reference),
      text: `Nothing you save here reaches a bag: the routing rule <code>${rule}</code> names its bag through ` +
        `<code>${reference}</code>, and that tiddler holds nothing. What you wrote stands in this page alone ` +
        `and leaves with it — ${titles.size === 1 ? "this title" : `these ${titles.size} titles`}:\n\n` +
        [...titles].map((t) => `* <$text text=${JSON.stringify(t)}/>`).join("\n"),
      tags: TW5_ALERT_TAG,
      "alert-kind": "unrouted-save",
      reference,
      rule,
    });
    return refusal;
  }

  /** The titles refused under each empty pointer this session — the alert's own list. */
  private readonly _unrouted = new Map<string, Set<string>>();

  /**
   * Hand a complete envelope to the shore queue. The engine door is preserved as the synchronous applier.
   */
  private _enqueue(change: LarTiddlerChange): void {
    this.installLandingQueue();
    this.landing!.enqueue(change);
  }

  // ---------------------------------------------------------------------------
  // MemeProjection — inbound CRDT→wiki via the shore landing queue
  // ---------------------------------------------------------------------------

  /**
   * Forward each complete change envelope to the shore queue. The queue compares standing values
   * with landed state and meets pending hands before the packed engine applies a slice.
   * Cross-bag tombstones resolve before enqueue: a tombstone in one bag must
   * not delete the tiddler if another recipe layer still holds a live copy.
   */
  onUriChanged(change: LarTiddlerChange): void {
    this.installLandingQueue();
    // Own writes return with the heads the next hand must build on; every envelope is a wave.
    // An own-origin envelope IS the store's acknowledgment of this shore's write, whatever the store
    // (a store with no heads names none); `writtenAt` then says where the hand's next write builds.
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) {
      this.writeAcks.set(change.title, (this.writeAcks.get(change.title) ?? 0) + 1);
      if (change.writtenAt && change.bag) this.handBase.set(change.title, { bag: change.bag, heads: change.writtenAt });
    }

    if (change.record === null || change.record.meta?.deleted) {
      const store = this.store as { resolveTopmost?: (t: string) => Promise<{ bagId: string; record: LarTiddlerRecord } | null> };
      if (typeof store.resolveTopmost === "function") {
        const resolver = this._resolveCrossBagTombstone(change, store.resolveTopmost.bind(store)).catch((error: unknown) => {
          console.error(`[island-adaptor] cross-bag tombstone resolver for "${change.title}" failed: ${String(error)}`);
          this._enqueue(change);
        });
        this.resolvers.add(resolver);
        this.landing!.track(resolver);
        void resolver.finally(() => this.resolvers.delete(resolver)).catch(() => {});
        return;
      }
    }
    this._enqueue(change);
  }

  /** Forward each complete bulk envelope through the per-change bag resolution path. */
  onChangeset(changes: readonly LarTiddlerChange[]): void {
    for (const change of changes) this.onUriChanged(change);
  }

  /**
   * onSyncComplete is observability-only under the unified-nalu model.
   * Initial replay and live changes share the shore queue and its host-task slices.
   */
  onSyncComplete(_islandId = "automerge"): void {
    // intentionally empty
  }

  // ---------------------------------------------------------------------------
  // ParallelDraftsReader — a surfaced parallel draft persists (operator ruling)
  // ---------------------------------------------------------------------------

  /**
   * A merge on a bag this wiki READS left concurrent values on one record, and its doc store raised
   * them as attributed TW5 drafts (`parallel-drafts.ts`). Automerge drops a conflict from
   * `getConflicts` on the next write to that property, so a draft nobody keeps dies there. This wiki
   * keeps every draft that carries a value the live record does not: it lands in the bag the cascade
   * routes a `draft.of` tiddler to — THIS wiki's draft bag (`[is[draft]…]` → `current-wiki-draft` →
   * `wikis/<slug>/draft`) — through the one write path, and arrives back here as an inbound change, so
   * the wiki shows it (a quiet badge on the target, `parallel-drafts-badge.tid`) until a human
   * discards it; its deletion uses the landed ledger's bag and heads.
   *
   * Nothing here decides: the live value stays the CRDT's merge, and the winner's own draft (every
   * conflicted field live) is the live record, so it is never copied. A parallel draft never fuses
   * with the projector's disk-conflict surface. A surfacing ON the draft bag itself persists nothing —
   * a draft of a draft is two edit buffers racing, and copying it would mint drafts of drafts.
   */
  onParallelDrafts(change: ParallelDraftsChange): void {
    const kept = draftsOffLive(change.drafts);
    if (kept.length === 0) return;
    const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: change.bag ?? "automerge" };
    for (const draft of kept) {
      let bag: SlotUri | null;
      // A draft with no bag to land in already stands refused on the alert rail; the next draft still gets its turn.
      try { bag = this._draftDestination(draft); } catch (err) { if (err instanceof UnroutedSaveRefusal) continue; throw err; }
      if (bag === null || bag === change.bag) continue;
      this.store.writeFamily([draft], [], origin, { bag }).catch((err: unknown) => {
        this._surfaceUnkeptDraft(draft, bag, err);
      });
    }
  }

  /**
   * The bag the cascade routes THIS draft to. The draft is not in the wiki yet, so the cascade reads
   * its fields through a view that answers the draft under its own title — the same rule a saved
   * draft rides, read once, never a second spelling of it. The verdict settles as a save's does: a
   * named withholding is a lawful quiet skip, a gap falls to the write layer and says so, and a route
   * with no bag behind it throws the named refusal.
   */
  private _draftDestination(draft: LarTiddlerRecord): SlotUri | null {
    const wiki = this.tw5.$tw.wiki;
    const title = draft.tiddler.title;
    const tiddler = new this.tw5.$tw.Tiddler(draft.tiddler as Record<string, unknown>);
    const verdict = routeBag({
      getTiddler: (t: string) => (t === title ? tiddler : wiki.getTiddler(t)),
      getTiddlerText: (t: string, fallback?: string) => wiki.getTiddlerText?.(t, fallback),
      filterTiddlers: (filter: string, widget?: unknown, source?: unknown) => wiki.filterTiddlers(filter, widget as never, source as never),
    }, title);
    return this._settle(title, verdict);
  }

  /**
   * A DRAFT THAT COULD NOT PERSIST SURFACES WHOLE. Automerge drops the conflict from `getConflicts` on
   * the next write to the property, so once the persist fails this alert is the only surviving copy of
   * the draft: it embeds the draft's text (fenced, so its sigils stay inert), the bag the write aimed
   * at, and the error, on the wiki's alert rail. `$:/temp/…` never persists — it holds the draft for
   * the operator to keep, and nothing here decides.
   */
  private _surfaceUnkeptDraft(draft: LarTiddlerRecord, bag: SlotUri, err: unknown): void {
    const title = draft.tiddler.title;
    const error = err instanceof Error ? err.message : String(err);
    const draftOf = String(draft.tiddler["draft.of"] ?? title);
    const text = typeof draft.tiddler.text === "string" ? draft.tiddler.text : "";
    console.warn(`[island-adaptor] a parallel draft of "${draftOf}" could not persist in ${bag}: ${error} — held on the alert rail`);
    this._addAlertIfChanged({
      title: parallelDraftAlertTitle(title),
      text: `A parallel draft of [[${draftOf}]] could not persist in ${bag} (${error}). ` +
        `This alert holds the only surviving copy of its text:\n\n${quoteblockFence(text)}`,
      tags: TW5_ALERT_TAG,
      "alert-kind": "parallel-draft",
      "draft-title": title,
      "draft-of": draftOf,
      "draft-text": text,
      bag,
      error,
    });
  }

  /** Alert rail writes are idempotent at their source; temp records never enter the CRDT road. */
  private _addAlertIfChanged(fields: Record<string, unknown>): void {
    const title = String(fields.title ?? "");
    const current = this.tw5.$tw.wiki.getTiddler(title) ?? null;
    const next = new this.tw5.$tw.Tiddler(fields);
    if (same(current, next)) return;
    this.tw5.$tw.wiki.addTiddler(next);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): () => void {
    if (typeof this.store.addProjection === "function") {
      this._unsubscribe = this.store.addProjection(this);
    } else {
      this._unsubscribe = this.store.subscribe((change) => this.onUriChanged(change));
    }
    return () => this.stop();
  }

  async stop(): Promise<void> {
    while (this.resolvers.size) await Promise.allSettled([...this.resolvers]);
    await this.landing?.stop();
    const marked = new Set([...this.pendingHand, ...this.gate.titles()]);
    await Promise.all([...marked].map(async (title) => {
      try {
        if (this.gate.has(title)) await this.gate.flush(title);
        else if (!this.activeFlushCounts.has(title)) await this._flushHand(title);
      }
      catch (error) { this.failedAtTeardown.set(title, error); }
    }));
    while (this.flushes.size) await Promise.allSettled([...this.flushes]);
    for (const [title, error] of this.failedAtTeardown) console.warn(`[island-adaptor] teardown write for "${title}" failed: ${String(error)}`);
    this.failedAtTeardown.clear();
    this.restoreDoor?.();
    this.restoreDoor = null;
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly failedAtTeardown = new Map<string, unknown>();
  private readonly writeAcks = new Map<string, number>();

  private _handBaseFor(title: string, bag: string): readonly string[] | undefined {
    const hand = this.handBase.get(title);
    if (hand?.bag === bag) return hand.heads;
    const entry = this.ledger.landedOf(title);
    return entry?.bag === bag ? entry.heads : undefined;
  }

  /**
   * The hand at `title` leaves at once, skipping the gate's timers. Answers whether THIS flush's own
   * write was acknowledged by the store: writes of one title never overlap, and a flush queued behind
   * this one cannot finish before this await resumes, so the title's last finished flush is this one.
   */
  private async _leaveNow(title: string): Promise<boolean> {
    if (this.gate.has(title)) await this.gate.flush(title);
    else await this._flushHand(title);
    return this.lastFlushWrote.get(title) === true;
  }

  /** Whether the last finished flush of each title had its own write acknowledged. */
  private readonly lastFlushWrote = new Map<string, boolean>();

  private _flushHand(title: string): Promise<void> {
    this.activeFlushCounts.set(title, (this.activeFlushCounts.get(title) ?? 0) + 1);
    const task = this._flushHandImpl(title);
    this.flushes.add(task);
    void task.finally(() => {
      this.flushes.delete(task);
      const remaining = (this.activeFlushCounts.get(title) ?? 1) - 1;
      if (remaining === 0) this.activeFlushCounts.delete(title);
      else this.activeFlushCounts.set(title, remaining);
    }).catch(() => {});
    return task;
  }

  private async _flushHandImpl(title: string): Promise<void> {
    const prior = this.inFlight.get(title);
    if (prior) await prior;
    const state = this.handed.has(title) ? this.handed.get(title)! : this.tw5.$tw.wiki.getTiddler(title) ?? null;
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    const ackBefore = this.writeAcks.get(title) ?? 0;
    let writeBag: string | undefined;
    let task: Promise<void>;
    if (state !== null) {
      const fields = extractFields(this.tw5, state);
      const dest = this._destination(title);
      if (dest === null) {
        this.handed.delete(title);
        this.pendingHand.delete(title);
        this.lastFlushWrote.set(title, false);
        return;
      }
      writeBag = dest;
      this.sent.set(title, state);
      const base = this._handBaseFor(title, dest);
      task = this._writeMeme(title, fields, origin, dest, base).catch(async (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
        console.warn(`[island-adaptor] retrying "${title}" without unavailable base`);
        await this._writeMeme(title, fields, origin, dest);
      });
    } else {
      const entry = this.ledger.landedOf(title);
      const bag = this.lastWriteBag.get(title) ?? entry?.bag ?? this.handBase.get(title)?.bag ?? this._destination(title);
      if (!bag) {
        this.handed.delete(title);
        this.pendingHand.delete(title);
        this.lastFlushWrote.set(title, false);
        return;
      }
      writeBag = bag;
      this.sent.set(title, null);
      const base = this._handBaseFor(title, bag);
      task = this.store.tombstoneInBag(bag, title, origin, base ? { base } : undefined)
        .catch(async (error: unknown) => {
          if (!(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
          console.warn(`[island-adaptor] retrying "${title}" without unavailable base`);
          await this.store.tombstoneInBag(bag, title, origin);
        }).then(() => { this._removeSlotChildren(title); });
    }
    this.inFlight.set(title, task);
    try {
      await task;
      // The store took this state for `writeBag`: the title's state stands there, written just now or
      // equal to what stood (a noop). A noop fires no envelope, so no return wave will land over `sent`.
      const acknowledged = (this.writeAcks.get(title) ?? 0) > ackBefore;
      this.lastFlushWrote.set(title, acknowledged);
      if (writeBag) this.lastWriteBag.set(title, writeBag);
      if (!acknowledged) this.sent.delete(title);
      if (this.handed.get(title) === state) this.handed.delete(title);
      this.pendingHand.delete(title);
      this.failedAtTeardown.delete(title);
    } catch (error) {
      this.sent.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.set(title, error);
      throw error;
    } finally {
      if (this.inFlight.get(title) === task) this.inFlight.delete(title);
    }
  }

  // ---------------------------------------------------------------------------
  // Outbound TW5→CRDT
  // ---------------------------------------------------------------------------
  //
  // ── THE VOLATILE VM PLANE NEVER LEAVES THE WIKI ───────────────────────────────────────────────
  // `lar:///lararium.local.vm/…` is each daemon VM's own scratch (lar-uris: "never persisted through
  // IslandAdaptor, never synced via Automerge"; verb-dispatcher: durable meaning begins at the
  // OUTCOME, never the invocation). A verb invocation carries the CALLER'S WHOLE PAYLOAD, so
  // `act LOAD` over the corpus writes ~7 MB of carriers into one scratch tiddler.
  //
  // The law lived only in prose. The bag-paths cascade's `[prefix[lar:]…]` catch-all admitted the
  // plane, and once a live `change` listener carried wiki edits outbound, the whole corpus landed in
  // the CRDT a SECOND time as ONE monolithic record. Applying that change exhausted the automerge
  // WASM module's 4 GiB linear memory (`rust_oom` → `Module terminated`), and a terminated module
  // projects nothing ever again: the disk mirror held ZERO files while the caller waited out its
  // whole budget. MEASURED: 160 carriers → 1.7 GB RSS and a settled mirror; 381 → 4.9 GB and death.
  //
  // So the refusal sits HERE, in the module the law names, ahead of the cascade — the cascade routes
  // among bags and stays the operator's to edit, and no edit of it may re-open this.

  saveTiddler(tiddler: unknown): Promise<void> {
    const fields = extractFields(this.tw5, tiddler);
    const title  = fields["title"] ?? "";

    // THE VOLATILE VM PLANE NEVER PERSISTS, and no cascade edit may lift that.
    if (isVolatileVmUri(title)) return Promise.resolve();
    if (title.startsWith("$:/temp/lares/alert/")) return Promise.resolve();

    if (!this.gate.has(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    this.pendingHand.add(title);
    this.handed.set(title, tiddler);
    return this.gate.mark(title, () => this._flushHand(title));
  }

  saveRecord(record: LarTiddlerRecord): Promise<void> {
    return this.saveTiddler({ fields: toTW5FieldStrings(this.tw5, record.tiddler) });
  }

  deleteTiddler(title: string): Promise<void> {
    // Nothing volatile ever landed, so nothing volatile gets a tombstone (see `saveTiddler`).
    if (isVolatileVmUri(title)) return Promise.resolve();
    if (title.startsWith("$:/temp/lares/alert/")) return Promise.resolve();
    // A DELETE ROUTES LIKE A SAVE, and the tiddler is already gone from the wiki when this runs — so
    // a rule reading a FIELD (`draft.of`) would route its creation and drop its deletion, leaving a
    // record that resurrects on the next boot. The landed ledger answers first; a title never
    // seen this session falls back to the cascade's title read. The tombstone lands in THAT bag — a
    // bagless tombstone falls into the composite's default writable, a bag the cascade never named.
    if (!this.gate.has(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    this.pendingHand.add(title);
    this.handed.set(title, null);
    return this.gate.mark(title, () => this._flushHand(title));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _childUrisOf(parentUri: string): string[] {
    return this.tw5.$tw.wiki.filterTiddlers(`[field:$fragment-parent[${parentUri}]]`) as string[];
  }

  /**
   * Cross-bag tombstone resolution — async path.
   * Stays in TS because it needs to read across CompositeStore layers via getLive.
   * Either enqueues the tombstone (no live copy elsewhere) or enqueues the live
   * record from another bag (one of the other layers still holds it).
   */
  private async _resolveCrossBagTombstone(
    change:        LarTiddlerChange,
    resolveTopmost: (t: string) => Promise<{ bagId: string; record: LarTiddlerRecord } | null>,
  ): Promise<void> {
    const survivor = await resolveTopmost(change.title);
    if (survivor) {
      // Stamp the SURVIVOR's bag — the layer holding the carrier — never change.bag
      // (the layer that emitted the tombstone). On a cross-bag MOVE the record retracts from the
      // source and surfaces in a lower bag; tagging it with the source's bag left
      // the projector targeting the stale source mirror (byte-identical → silent
      // hash-skip) and never publishing the destination. resolveTopmost carries
      // the origin-bag the read path needs (residency-model anti-pattern #4).
      this._enqueue({ title: change.title, record: survivor.record, origin: change.origin, bag: survivor.bagId });
    } else {
      this._enqueue(change);
    }
  }

  /** Remove ahu-slot child tiddlers from TW5 during outbound delete. */
  private _removeSlotChildren(parentUri: string): void {
    const children = this.tw5.$tw.wiki.filterTiddlers(`[field:$fragment-parent[${parentUri}]]`);
    for (const t of children) this.tw5.$tw.wiki.deleteTiddler(t);
  }

  /**
   * Write a saved tiddler to the store as its meme FAMILY: the root, the slot children its body
   * splits into (Path H auto-split), and the tombstones of the children it no longer declares.
   *
   * ONE CHANGE. Root and children route to the ONE bag the cascade names, so they share one doc, and
   * the family lands through `writeFamily` as a single atomic change — no peer ever sees a root
   * pointing at a tombstoned child.
   *
   * AN ORPHAN DIES WHERE IT LIVES. A child's tombstone routes like a delete: the landed ledger
   * first (a child that arrived from another bag is tombstoned there, in its own change), the root's
   * bag otherwise. A bagless tombstone would land in the composite's default writable and leave the
   * orphan standing in the doc peers read.
   *
   * A DRAFT NEVER SPLITS. A tiddler carrying `draft.of` (the draft switch, recipe-layer-model) is an
   * edit buffer over its target: its body persists whole, ahu blocks and all. Splitting it would
   * rewrite its text to `kahea` refs while its children — titled under the draft, never `lar:` — land
   * nowhere, and routing them by `draft.of` would overwrite the target's live slots before the draft
   * is ever kept. The split happens when TW5 saves the draft back under its target's title.
   */
  private async _writeMeme(
    title:  string,
    fields: Record<string, string>,
    origin: ChangeOrigin,
    targetBag: SlotUri,
    base?: readonly string[],
  ): Promise<void> {
    const bodyText = fields["text"] ?? "";
    // A slot child saved at its own address splits under the fragment it already carries: its own
    // slots compose onto that ONE path (`#/a/z`), never a second fragment (`#/a#/z`).
    const cut = title.indexOf("#");
    const { parent, children }: ReturnType<typeof splitBodyTiddler> = fields["draft.of"] !== undefined
      ? { parent: { ...fields, title }, children: [] }
      : cut < 0
        ? splitBodyTiddler(title, "", bodyText, fields)
        : splitBodyTiddler(title.slice(0, cut), title.slice(cut), bodyText, fields);
    // `$origin-bag` is the host's stamp on the wiki tiddler (nalu-engine), never a persisted field;
    // `bag` is the author's and rides through whole.
    const { "$origin-bag": _origin, ...withoutHostBag } = parent;
    const persistedParent = withoutHostBag;

    const puts: LarTiddlerRecord[] = [toLarTiddlerRecord({ ...persistedParent, title })];
    const familyTombstones: string[] = [];
    const strayTombstones: Array<{ uri: string; slot: SlotUri }> = [];

    if (children.length > 0) {
      const existingChildren = new Set<string>(this._childUrisOf(title));
      const newChildren      = new Set<string>();

      for (const child of children) {
        const childTitle = String(child["title"] ?? "");
        if (!childTitle.startsWith("lar:")) continue;
        newChildren.add(childTitle);
        const { "$origin-bag": _childOrigin, ...persistedChild } = child;
        puts.push(toLarTiddlerRecord({ ...persistedChild, title: childTitle }));
      }

      for (const uri of existingChildren) {
        if (newChildren.has(uri)) continue;
        const slot: SlotUri = (this.ledger.landedOf(uri)?.bag as SlotUri | undefined) ?? targetBag;
        if (slot === targetBag) familyTombstones.push(uri);
        else strayTombstones.push({ uri, slot });
      }
    }

    await this.store.writeFamily(puts, familyTombstones, origin, { bag: targetBag, ...(base ? { base } : {}) });
    for (const { uri, slot } of strayTombstones) await this.store.tombstoneInBag(slot, uri, origin);

  }
}
