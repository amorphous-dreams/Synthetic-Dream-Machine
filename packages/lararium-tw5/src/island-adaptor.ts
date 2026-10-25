/**
 * Wiki shore between CompositeStore and TW5. Tiddlers are invariants and every write replaces a tiddler
 * under a title; a draft is an ordinary tiddler carrying `draft.of`, a convention of the editing surface.
 * No storage path branches on "draft": the shore reads from `draft.of` and `draft.title` only which base a
 * save carries and which titles form one discrete act.
 *
 * INBOUND. The landed ledger records each wave's absolute result. WaveLanding meets queued waves with
 * unsent hands before the synchronous engine applier receives a change. A landed record also teaches the draft book.
 *
 * OUTBOUND, THE PER-TITLE PATH. A mark names a TITLE. HandGate paces the mark with a trailing window and a
 * non-resetting cap, and what leaves at the flush is the title's state in the wiki at that flush. A state
 * equal to the landed value with nothing sent since leaves nothing; a title the store never saw and the
 * wiki does not hold raises no tombstone; a state that differs from a write still in flight leaves after
 * it. A value handed in that the wiki does not hold (`saveTiddler` with a free-standing tiddler) is the one
 * case that rides pinned, and only while the wiki does not hold it. A placed root's marked slot children
 * ride its family, so the family lands as one change. A refused write raises
 * `$:/temp/lares/alert/unsaved/<title>`, keeps the title owed, arms no timer, and clears when a later write
 * of the title is acknowledged. A delete of a title that landed from a layer beneath the working layer
 * writes nothing there: it lands a tombstone in the working layer, which shadows the title (kāpae).
 *
 * INBOUND, THE COMPOSITION. A bagged wave lands what the composition resolves for its title: the topmost
 * layer holding any record, a tombstone included, with that layer's bag and heads; no layer holding a
 * record lands the title absent. A lower layer's record never lands over a higher layer's.
 *
 * THE DRAFT BOOK (draft-book.ts). At a draft's first write the book captures its target's base: the ledger's
 * bag and heads for a target that stands, else the bag the cascade routes the target to plus that bag's
 * heads, marked `absent`. The base persists on the draft's STORE record as `lar-draft-base-bag` and
 * `lar-draft-base-heads`, follows the draft to another device, and answers inside the dispatch that deletes
 * the draft. The wiki's draft NEVER holds the two fields: the shore strips them from what a wave applies and
 * compares, learns the base from the landed record, and adds them from the book at a hand write, so
 * TiddlyWiki never copies them and `isDraftModified` reads true only for a person's edit. A first hand write
 * of an unknown draft always captures (preferring this shore's own unlanded write's base). A title that
 * never persists (`neverPersists`: the volatile VM plane, the alert rail) takes no store call as an act
 * member; the draft's own record follows the ordinary law for its own title. An entry leaves when the draft's deletion is acknowledged, when a wave lands the draft gone,
 * or when a live title loses `draft.of`. The two fields persist on no record that lacks `draft.of`.
 *
 * DISCRETE ACTS. One `change` dispatch holding a known draft's deletion is a SAVE (the target is written),
 * a RENAME (`draft.title` names another title: that title is created or overwritten, the source is
 * tombstoned where the ledger says it lives) or a CANCEL (the deletion stands alone). The act consumes every
 * gate entry of its titles synchronously, builds each written title as its meme family through the one
 * builder the per-title flush shares, and issues its store calls inside the handler, in the turn of the
 * dispatch: one `writeFamily` per (bag, base), no await between them. The draft's own tombstone rides the
 * draft's bag at the draft's landed base and is issued only for a draft that reached the store. A save
 * builds on the draft-open base; a rename onto a standing title builds on that title's landed base; the
 * source's tombstone builds on the draft-open base. An act whose call is refused leaves its titles owed.
 *
 * THE CROSS-BAG CHECK. A write whose destination bag differs from the bag its base names reads the source
 * bag at the base heads and at its current heads, immediately before the destination write is issued. An
 * unmoved source lands in the destination carrying destination-side heads only where the ledger holds
 * them. A moved source lands nothing: the hand surfaces as a parallel draft in the draft bag (persistence
 * awaited and tracked) and the source's record lands in the wiki again. Source heads never ride into the
 * destination.
 *
 * TEARDOWN. `stop()` never drops a hand: it awaits acts and parallel-draft persistence and flushes every
 * marked title. `awaitWikiDispatch()` lets a teardown deliver the wiki's queued `change` dispatch to the
 * bridge before the bridge unhooks.
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
import { toLarTiddlerRecord, isVolatileVmUri, draftsOffLive, parallelDraftTitle } from "@lararium/mesh";
import { maskedExecAll } from "@lararium/memetic-frame";
import { BAG_PATHS_CONFIG, routeBag, type RouteVerdict } from "./bag-cascade.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { RestDoor } from "./rest-door.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import { splitBodyTiddler, quoteblockFence } from "./deserializer.js";
import { LandedLedger, same, sameWithStamp } from "./landed-ledger.js";
import { WaveLanding } from "./wave-landing.js";
import { HandGate, type ShoreTimers } from "./hand-gate.js";
import {
  DRAFT_BASE_BAG, DRAFT_BASE_HEADS, contentKey, draftBaseFields, readDraftBase, sameHeads, withoutDraftBase,
  type DraftBase, type DraftEntry,
} from "./draft-book.js";

/** The wiki's live write layer — where a save the cascade cannot route still lands. */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. */
const TW5_ALERT_TAG = "$:/tags/Alert";

/** The alert a parallel draft that could not persist raises — one per draft, holding the draft itself. */
export function parallelDraftAlertTitle(draftTitle: string): string {
  return `$:/temp/lares/alert/parallel-draft/${draftTitle}`;
}

/** The alert a hand whose store write was refused raises — one per title, cleared when a later write lands. */
export function unsavedHandAlertTitle(title: string): string {
  return `$:/temp/lares/alert/unsaved/${title}`;
}

/** The alert a title whose resident landing failed raises until a later wave lands it. */
export function landingFailedAlertTitle(title: string): string {
  return `$:/temp/lares/alert/landing-failed/${title}`;
}

/** True for a title that never persists: the volatile VM plane, alert rail, and TW5 core prompts. */
export function neverPersists(title: string): boolean {
  return isVolatileVmUri(title) || title.startsWith("$:/temp/lares/alert/") || title.startsWith("$:/temp/confirm/") || title.startsWith("$:/temp/alerts/");
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
  constructor(readonly title: string, readonly rule: string, readonly reference: string, readonly why = "that tiddler holds nothing") {
    super(`unrouted-save: "${title}" has no bag to land in — the routing rule ${rule} names its bag through ${reference}, and ${why}`);
  }
}

/**
 * The store the adaptor writes through: one that lands a family, and a tombstone, in the bag the
 * cascade NAMES. Every production wiring hands it the wiki's `CompositeStore` (`island-recipe`), and a
 * store that could only write to its own default would land a routed save in a bag no rule chose.
 */
export type IslandStore = LarTiddlerStore & Pick<CompositeStore, "writeFamily" | "tombstoneInBag" | "storeForBag" | "resolveLayered" | "defaultWritableBagId" | "layerIndexOf">;

export class LandingDoorUnavailableError extends Error {
  override readonly name = "LandingDoorUnavailableError";
  constructor() { super("the TW5 engine must provide applyNalu for the wiki shore — boot the wiki with the nalu-engine module of this build"); }
}

/** A second shore asked for an engine's queue door while another holds it. */
export class LandingDoorOccupiedError extends Error {
  override readonly name = "LandingDoorOccupiedError";
  constructor() { super("another wiki shore holds this engine's queue door — stop that shore before a second one lands waves into the same wiki"); }
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

/**
 * The child slot addresses a placed text names through its `kahea` references, rooted at `rootUri`. A
 * reference quoted inside a code fence names no child.
 */
function kaheaChildUris(rootUri: string, text: string): Set<string> {
  const uris = new Set<string>();
  if (!text.includes("<<~ kahea ahu ")) return uris;
  for (const match of maskedExecAll(text, /<<~ kahea ahu (#[^\s>]+)>>/g)) uris.add(rootUri + match[1]!);
  return uris;
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
  /**
   * The heads of each bag's document this shore has landed in the wiki, from the envelope of the last change it
   * landed (the heads AT that change, never the layer's heads when the shore looked). The settle word follows
   * the heads a gesture landed through this account (`landedCovers`).
   */
  private readonly landedHeads = new Map<string, readonly string[]>();
  private readonly gate: HandGate;
  private landing: WaveLanding | null = null;
  private engineApply: ((change: LarTiddlerChange) => void) | null = null;
  /** The queue door this shore installed at `$tw.lares.enqueueNalu`; null while it holds none. */
  private door: ((change: LarTiddlerChange) => void) | null = null;
  private readonly sent = new Map<string, unknown>();
  private readonly handBase = new Map<string, { bag: string; heads: readonly string[] }>();
  private readonly lastWriteBag = new Map<string, string>();
  /** Titles this shore wrote whose wave has not landed: the store stands ahead of the ledger for them. */
  private readonly unlanded = new Set<string>();
  private readonly handed = new Map<string, unknown | null>();
  private readonly pendingHand = new Set<string>();
  private resident = false;
  private readonly flushes = new Set<Promise<unknown>>();
  private readonly activeFlushCounts = new Map<string, number>();
  /** What the shore knows of each draft, keyed by the draft's title (see `draft-book.ts`). */
  private readonly draftBook = new Map<string, DraftEntry>();
  /** Discrete acts in flight (a save, a rename, a cancel). */
  private readonly acts = new Set<Promise<void>>();
  /** Parallel-draft persistence in flight. */
  private readonly surfacings = new Set<Promise<void>>();

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

  /**
   * Install the shore queue door before seed replay or any other inbound caller. One shore owns an
   * engine's door: a second shore on the same engine refuses by `LandingDoorOccupiedError`. A shore that
   * stopped installs a fresh queue and its door again.
   */
  /** The rest door a save act waits on before its result leaves; absent where no vessel answers one. */
  restDoor: RestDoor | null = null;

  installLandingQueue(yieldHost?: () => Promise<void>): void {
    if (this.landing) return;
    const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
    if (typeof lares?.applyNalu !== "function") throw new LandingDoorUnavailableError();
    if (lares.enqueueNalu !== undefined) throw new LandingDoorOccupiedError();
    const apply = lares.applyNalu.bind(lares);
    const landing = new WaveLanding(
      (change) => this._landOne(change),
      yieldHost,
      (title, error) => {
        console.warn(`[wave-landing] ${error.message}`);
        this._addAlertIfChanged({
          title: landingFailedAlertTitle(title),
          text: `Landing "${title}" failed. The wiki may show an older value for it until the next change arrives; the shore tries again then.`,
          tags: TW5_ALERT_TAG,
          "alert-kind": "landing-failed",
          "landing-title": title,
          error: error.message,
        });
      },
      (title) => {
        const alert = landingFailedAlertTitle(title);
        if (this.tw5.$tw.wiki.getTiddler(alert)) this.tw5.$tw.wiki.deleteTiddler(alert);
      },
    );
    this.landing = landing;
    this.engineApply = apply;
    this.door = (change) => landing.enqueue(change);
    lares.enqueueNalu = this.door;
  }

  armSeedCheckpoint(): Promise<void> {
    this.installLandingQueue();
    return this.landing!.checkpoint().then(() => { this.resident = true; });
  }

  landingIdle(): Promise<void> { return this.landing?.idle() ?? Promise.resolve(); }

  isResident(): boolean { return this.resident; }

  /** True when a wiki notification repeats the value the last wave left. */
  isFoam(title: string, value: unknown | null): boolean {
    const entry = this.ledger.landedOf(title);
    return entry ? same(entry.tiddler, value) : value === null;
  }

  /**
   * Resolves once the wiki has delivered the `change` dispatch queued by every edit made so far. A teardown
   * that unhooks the bridge awaits this first, so an edit whose notification has not yet fired still meets
   * the bridge and reaches `stop()` as a marked hand.
   */
  awaitWikiDispatch(): Promise<void> {
    return new Promise<void>((resolve) => this.tw5.$tw.utils.nextTick(resolve));
  }

  /** True while a hand stands for the title: marked for a flush, or sent and not yet landed by its wave. */
  holdsHand(title: string): boolean {
    return this.gate.has(title) || this.pendingHand.has(title) || this.sent.has(title);
  }

  private async _landOne(change: LarTiddlerChange, handSettled = false): Promise<void> {
    const title = change.title;
    const wiki = this.tw5.$tw.wiki;
    const envelopeHeads = change.heads;
    let heads = change.heads;
    let record = change.record;
    let bag = change.bag;
    // THE WIKI SHOWS WHAT THE COMPOSITION RESOLVES: the topmost layer holding any record for the title, a
    // tombstone included (kāpae), never the emitting layer's record over a higher layer's.
    if (change.bag) {
      const resolved = await this.store.resolveLayered(title);
      record = resolved?.record ?? null;
      bag = resolved?.bagId ?? change.bag;
      heads = resolved ? resolved.heads : this._headsOfBag(change.bag);
    }
    const entry = this.ledger.landedOf(title);
    if (bag === undefined) {
      bag = entry?.bag;
      if (heads === undefined) heads = entry?.heads;
    }
    const live = record !== null && !record?.meta?.deleted;
    // The draft-base fields live in the store record; the wiki's draft never holds them.
    const applied = live ? { ...record!, tiddler: withoutDraftBase(record!.tiddler as Record<string, unknown>) } as LarTiddlerRecord : record;
    const incoming = live ? new this.tw5.$tw.Tiddler({
      ...applied!.tiddler,
      title,
      ...(bag !== undefined ? { "$origin-bag": bag } : {}),
    }) : null;
    const standing = wiki.getTiddler(title) ?? null;
    const known = entry ? entry.tiddler : null;
    if (this.landing?.isStopped()) return;
    // A marked title holds a hand even when its state has returned to the landed value: the flush decides
    // from the state at flush, and a write still in flight for it must be superseded before this wave lands.
    const marked = this.gate.has(title) || this.pendingHand.has(title);
    // A SHADOW CARRIES NO HAND. TiddlyWiki answers a plugin's shadow where the wiki holds no record of its
    // own; nobody wrote it and no wave landed it. A hand that reveals a shadow marks the title (the bridge
    // saves what the wiki shows), so an unmarked shadow meets a wave as an empty title does and the wave
    // lands over it.
    const shadowOnly = standing !== null && typeof wiki.tiddlerExists === "function" && !wiki.tiddlerExists(title);
    const isHand = !handSettled && this.resident
      && (marked || (!shadowOnly && !same(standing, known) && !(this.sent.has(title) && this.sent.get(title) === standing)));
    if (isHand) {
      for (let pass = 0; pass < 8; pass++) {
        const wrote = await this._leaveNow(title);
        const latest = wiki.getTiddler(title) ?? null;
        const currentEntry = this.ledger.landedOf(title);
        const unsent = this.gate.has(title) || this.pendingHand.has(title)
          || (!same(latest, currentEntry ? currentEntry.tiddler : null) && !(this.sent.has(title) && this.sent.get(title) === latest));
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
      if (!this.engineApply) throw new LandingDoorUnavailableError();
      this.engineApply({ ...change, record: applied, ...(bag !== undefined ? { bag } : {}) });
    }
    this.ledger.set(title, { tiddler: wiki.getTiddler(title) ?? null, ...(bag !== undefined ? { bag } : {}), ...(heads !== undefined ? { heads } : {}) });
    if (change.bag !== undefined && envelopeHeads !== undefined && envelopeHeads.length > 0) this._noteLanded(change.bag, envelopeHeads);
    this._learnDraft(title, live ? record : null, bag);
    this.sent.delete(title);
    this.handBase.delete(title);
    this.unlanded.delete(title);
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
   * Act on a cascade verdict: a slot the composition mounts at or above the working layer lands there, a
   * named withholding skips (null), a gap falls to the write layer, and every other answer THROWS the named
   * refusal after raising it on the alert rail: a rule that routes through an empty pointer, a gap while
   * the write layer itself has no name, a slot the composition does not mount, a slot beneath the working
   * layer, and any route through the write-layer pointer while no working layer mounts.
   *
   * THE CASCADE AND ITS POINTERS STEER NOTHING INTO CANON. They choose among the layers a hand may write:
   * the working layer and the layers above it. The composition's own layer order answers which those are,
   * so no wiki tiddler, edited by hand or by a peer, lands a save beneath the working layer.
   */
  private _settle(title: string, verdict: RouteVerdict): SlotUri | null {
    if (verdict.kind === "withheld") {
      const reference = ROUTES_BY_REFERENCE.exec(verdict.rule)?.[1];
      if (reference === undefined) return null;
      throw this._refuseUnrouted(title, verdict.rule, reference);
    }
    let uri: string;
    let rule: string;
    let reference: string;
    if (verdict.kind === "slot") {
      uri = verdict.uri;
      rule = verdict.rule;
      reference = ROUTES_BY_REFERENCE.exec(verdict.rule)?.[1] ?? verdict.uri;
    } else {
      const fallback = this.tw5.$tw.wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") ?? "";
      console.warn(
        `[island-adaptor] no cascade rule routes "${title}" (${verdict.why}) — ` +
        (fallback ? `writing to the write layer ${fallback}. ` : "and no write layer resolves. ") +
        `Add a rule to ${BAG_PATHS_CONFIG}; a save must never vanish for want of one.`,
      );
      rule = `(no rule: ${verdict.why})`;
      reference = CURRENT_WIKI_BAG;
      if (!fallback) throw this._refuseUnrouted(title, rule, reference);
      uri = fallback;
    }
    const working = this.store.defaultWritableBagId();
    if (!working && reference === CURRENT_WIKI_BAG) throw this._refuseUnrouted(title, rule, reference, "this wiki mounts no working layer");
    const index = this.store.layerIndexOf(uri);
    if (index < 0) throw this._refuseUnrouted(title, rule, reference, `it names ${uri}, a bag this wiki does not mount`);
    if (working && index < this.store.layerIndexOf(working)) {
      throw this._refuseUnrouted(title, rule, reference, `it names ${uri}, a layer beneath this wiki's working layer; a bag changes only by a residency move`);
    }
    return uri as SlotUri;
  }

  /**
   * The slot the cascade routes `title` to when the composition mounts it at or above the working layer,
   * else null. Raises nothing: a reader that needs the refusal asks `_destination`.
   */
  private _routeAtOrAboveWorking(title: string): string | null {
    const verdict = this._routeBag(title);
    if (verdict.kind !== "slot") return null;
    const working = this.store.defaultWritableBagId();
    const index = this.store.layerIndexOf(verdict.uri);
    return working && index >= 0 && index >= this.store.layerIndexOf(working) ? verdict.uri : null;
  }

  /**
   * Whether `bag` holds a record for `title` at this instant (a tombstone counts; an absent entry does not).
   * The ledger names where a title landed; a residency move may have retracted that record since, with its
   * wave still queued, so the bag's own store answers. A store with no synchronous reader answers yes.
   */
  private _holdsRecord(bag: string, title: string): boolean {
    const reader = this._storeFor(bag) as { readNow?: (title: string) => { record: LarTiddlerRecord | null } } | null;
    return typeof reader?.readNow === "function" ? reader.readNow(title).record !== null : true;
  }

  /**
   * Where a hand's save of `title` lands. The cascade names the layer; a title that already lives in a
   * layer above that one stays where it lives, so the wiki shows the edit: a record a higher layer holds
   * (a tombstone included) shadows whatever lands beneath it. A title living beneath the working layer
   * never draws a save down: the cascade's layer takes it and shadows the lower record.
   */
  private _saveBag(title: string): SlotUri | null {
    const routed = this._destination(title);
    if (routed === null) return null;
    const lives = this.lastWriteBag.get(title) ?? this.ledger.landedOf(title)?.bag;
    const working = this.store.defaultWritableBagId();
    if (!lives || !working || !this._holdsRecord(lives, title)) return routed;
    const livesAt = this.store.layerIndexOf(lives);
    return livesAt >= this.store.layerIndexOf(working) && livesAt > this.store.layerIndexOf(routed) ? lives as SlotUri : routed;
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
  private _refuseUnrouted(title: string, rule: string, reference: string, why?: string): UnroutedSaveRefusal {
    const refusal = new UnroutedSaveRefusal(title, rule, reference, why);
    const priorWhy = this._unroutedWhy.get(reference);
    this._unroutedWhy.set(reference, refusal.why);
    if (title.startsWith(unroutedSaveAlertTitle(""))) return refusal;
    let titles = this._unrouted.get(reference);
    if (!titles) this._unrouted.set(reference, titles = new Set());
    const changedReason = priorWhy !== undefined && priorWhy !== refusal.why;
    if (titles.has(title) && !changedReason) return refusal;
    titles.add(title);
    console.warn(`[island-adaptor] ${refusal.message}`);
    this._addAlertIfChanged({
      title: unroutedSaveAlertTitle(reference),
      text: `Nothing you save here reaches a bag: the routing rule <code>${rule}</code> names its bag through ` +
        `<code>${reference}</code>, and ${this._unroutedWhy.get(reference) ?? refusal.why}. What you wrote stands in this page alone ` +
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
  private readonly _unroutedWhy = new Map<string, string>();

  /**
   * Hand a complete envelope to the shore queue; the engine applier receives changes at landing.
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
   * Landing resolves each bagged change through the composition (`resolveLayered`): the wiki shows the
   * topmost layer's record, so a tombstone in one bag never deletes a title another layer holds above it,
   * and a lower layer's record never lands over a higher layer's. Every bagged wave requires the
   * composition reader; only an unbagged wave lands its own record.
   */
  onUriChanged(change: LarTiddlerChange): void {
    this.installLandingQueue();
    this._noteOwnWrite(change);
    this._enqueue(change);
  }

  /**
   * Own writes return with the heads the next hand must build on; every envelope is a wave.
   * An own-origin envelope IS the store's acknowledgment of this shore's write, whatever the store
   * (a store with no heads names none); `writtenAt` then says where the hand's next write builds.
   */
  private _noteOwnWrite(change: LarTiddlerChange): void {
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) {
      this.writeAcks.set(change.title, (this.writeAcks.get(change.title) ?? 0) + 1);
      if (change.writtenAt && change.bag) this.handBase.set(change.title, { bag: change.bag, heads: change.writtenAt });
    }
  }

  /**
   * A changeset carries the envelopes of whole store changes (a family write, or the union of the change
   * events a provider gathered). It enters the queue as ONE grain: the queue lands it inside one slice, so
   * the wiki dispatches a root and its children together.
   */
  onChangeset(changes: readonly LarTiddlerChange[]): void {
    this.installLandingQueue();
    for (const change of changes) this._noteOwnWrite(change);
    this.landing!.enqueueFamily(changes);
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
  onParallelDrafts(change: ParallelDraftsChange): Promise<void> {
    // The answer settles once the drafts stand kept (or refused onto the alert rail): a store that
    // surfaces before it writes waits on it.
    return this._track(this.surfacings, this._persistParallelDrafts(change).then(() => undefined), true);
  }

  /** Track a task until it settles; the landing queue's seed checkpoint waits on it when asked. */
  private _track(set: Set<Promise<void>>, task: Promise<void>, seedWaits = false): Promise<void> {
    const tracked = task.catch((error: unknown) => { console.warn(`[island-adaptor] tracked task failed: ${String(error)}`); });
    set.add(tracked);
    if (seedWaits) this.landing?.track(tracked);
    void tracked.finally(() => set.delete(tracked));
    return tracked;
  }

  /**
   * Persist the drafts of a surfacing into the draft bag and answer when every one is acknowledged. A
   * draft whose write is refused falls to the standing unkept-draft alert, which holds its text.
   */
  private async _persistParallelDrafts(change: ParallelDraftsChange): Promise<LarTiddlerRecord[]> {
    const kept = draftsOffLive(change.drafts);
    const unheld: LarTiddlerRecord[] = [];
    const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: change.bag ?? "automerge" };
    for (const draft of kept) {
      let bag: SlotUri | null;
      // A draft with no bag to land in already stands refused on the alert rail; the next draft still gets its turn.
      try { bag = this._draftDestination(draft); } catch (err) { if (err instanceof UnroutedSaveRefusal) { unheld.push(draft); continue; } throw err; }
      if (bag === null || bag === change.bag) { unheld.push(draft); continue; }
      try { await this.store.writeFamily([draft], [], origin, { bag }); }
      catch (err: unknown) { this._surfaceUnkeptDraft(draft, bag, err); }
    }
    return unheld;
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
    while (this.acts.size) await Promise.allSettled([...this.acts]);
    await this.landing?.stop();
    const marked = new Set([...this.pendingHand, ...this.gate.titles()]);
    await Promise.all([...marked].map(async (title) => {
      try {
        if (this.gate.has(title)) await this.gate.flush(title);
        else if (!this.activeFlushCounts.has(title)) await this._flushHand(title);
      }
      catch (error) { this.failedAtTeardown.set(title, error); }
    }));
    while (this.flushes.size || this.acts.size || this.surfacings.size) {
      await Promise.allSettled([...this.flushes, ...this.acts, ...this.surfacings]);
    }
    for (const [title, error] of this.failedAtTeardown) console.warn(`[island-adaptor] teardown write for "${title}" failed: ${String(error)}`);
    this.failedAtTeardown.clear();
    // The door leaves with the shore that installed it, and only that one.
    const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
    if (lares && this.door !== null && lares.enqueueNalu === this.door) delete lares.enqueueNalu;
    this.door = null;
    this.landing = null;
    this.engineApply = null;
    // A stopped shore holds no account of the wiki: a restart seeds its ledger afresh and turns resident
    // again at its own seed checkpoint, so no stale landed value reads a later change as foam.
    this.resident = false;
    this.ledger.clear();
    this.landedHeads.clear();
    this.sent.clear();
    this.handBase.clear();
    this.lastWriteBag.clear();
    this.unlanded.clear();
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

  // ---------------------------------------------------------------------------
  // Bases and the cross-bag check
  // ---------------------------------------------------------------------------

  /** Keep the latest heads this shore landed for `bag`; a landing whose heads do not cover the kept ones leaves them. */
  private _noteLanded(bag: string, heads: readonly string[]): void {
    const kept = this.landedHeads.get(bag);
    if (kept !== undefined && !this._storeFor(bag)?.coversHeads?.(heads, kept)) return;
    this.landedHeads.set(bag, heads);
  }

  /**
   * True where this shore has landed, in the wiki, every change of `bag`'s document up to `named`: the heads of
   * its last landed change cover them. A store with no causal history, and a bag this shore landed nothing of,
   * answer false.
   */
  landedCovers(bag: string, named: readonly string[]): boolean {
    const have = this.landedHeads.get(bag);
    return have !== undefined && this._storeFor(bag)?.coversHeads?.(have, named) === true;
  }

  /** The store of any layer for `bag`, or null when the composite offers none (a double without layers). */
  private _storeFor(bag: string): LarTiddlerStore | null {
    return typeof this.store.storeForBag === "function" ? this.store.storeForBag(bag) : null;
  }

  /** The heads a bag's store reads now, or undefined when the store offers none. */
  private _headsOfBag(bag: string): readonly string[] | undefined {
    const source = this._storeFor(bag) as { headsNow?: () => readonly string[] | null } | null;
    return source?.headsNow?.() ?? undefined;
  }

  /**
   * Whether a title's record in `bag` differs, as content (its tiddler fields and live-versus-deleted,
   * never `meta` ceremony), between `heads` and the bag's heads now. A store offering neither read
   * answers unmoved. A base the store cannot read answers moved, so the hand surfaces rather than lands.
   */
  private _sourceMoved(title: string, bag: string, heads: readonly string[]): boolean {
    const source = this._storeFor(bag) as {
      headsNow?: () => readonly string[] | null;
      getAt?: (title: string, heads: readonly string[]) => LarTiddlerRecord | null;
    } | null;
    if (!source || typeof source.headsNow !== "function" || typeof source.getAt !== "function") return false;
    const now = source.headsNow();
    if (!now) return false;
    try { return contentKey(source.getAt(title, heads)) !== contentKey(source.getAt(title, now)); }
    catch { return true; }
  }

  /**
   * The base a write of `title` to `dest` builds on, read immediately before the write is issued.
   * `from` names where the hand's base lives. The same bag hands its heads to the write. Another bag is
   * a copy-up: the source is read at the base and now, an unmoved source lands in `dest` carrying the
   * destination-side heads only where the ledger holds destination-side knowledge of the title, and a
   * moved source answers `moved` with the write withheld. Source heads never ride into `dest`.
   */
  private _basePlan(title: string, dest: string, from?: { bag: string; heads: readonly string[] }): { base?: readonly string[]; moved?: string } {
    const entry = this.ledger.landedOf(title);
    const hand = this.handBase.get(title);
    const source = from ?? hand ?? (entry?.bag && entry.heads ? { bag: entry.bag, heads: entry.heads } : undefined);
    if (!source) return {};
    if (source.bag === dest) return source.heads.length > 0 ? { base: source.heads } : {};
    if (!this.unlanded.has(title) && this._sourceMoved(title, source.bag, source.heads)) return { moved: source.bag };
    // The destination's record NOW, whatever the ledger says: a peer's copy-up may sit in the document with
    // its wave still queued. A record there that differs, as content, from the source as the hand saw it
    // surfaces the hand; an absent or equal record lands clean.
    if (this._destinationDiffers(title, source, dest)) return { moved: dest };
    return entry?.bag === dest && entry.heads ? { base: entry.heads } : {};
  }

  private _destinationDiffers(title: string, source: { bag: string; heads: readonly string[] }, dest: string): boolean {
    const from = this._storeFor(source.bag) as { getAt?: (t: string, h: readonly string[]) => LarTiddlerRecord | null } | null;
    const to = this._storeFor(dest) as { headsNow?: () => readonly string[] | null; getAt?: (t: string, h: readonly string[]) => LarTiddlerRecord | null } | null;
    if (typeof from?.getAt !== "function" || typeof to?.getAt !== "function" || typeof to.headsNow !== "function") return false;
    const now = to.headsNow();
    if (!now) return false;
    try {
      const current = to.getAt(title, now);
      return current !== null && contentKey(from.getAt(title, source.heads)) !== contentKey(current);
    } catch { return true; }
  }

  /**
   * Where a hand's tombstone for `title` lands, given the bag the title landed from. A tombstone shadows
   * only from above (kāpae), so the composition's own layer order decides, never a wiki pointer:
   *   - the working layer is the composition's default writable;
   *   - a title that landed from the working layer or a layer above it (a draft, a personal record) is
   *     tombstoned in that layer, where the record lives, while that layer still holds a record for it;
   *   - a title that landed from any layer beneath the working layer (a canon bag, writable or read-only),
   *     from a bag the composition does not mount, or from a layer whose record a residency move has since
   *     retracted is never written there: the tombstone lands where a
   *     save of the title would (the layer the cascade names at or above the working layer: the temp slot
   *     for session state, the personal slot for a person's view state), else in the working layer.
   * A composition with no working layer refuses by the standing named road.
   */
  private _tombstoneBag(title: string, landedBag: string): string {
    const working = this.store.defaultWritableBagId();
    if (!working) throw this._refuseUnrouted(title, "(a delete shadows from the working layer)", CURRENT_WIKI_BAG, "this wiki mounts no working layer");
    const landedIndex = this.store.layerIndexOf(landedBag);
    if (landedIndex >= 0 && landedIndex >= this.store.layerIndexOf(working) && this._holdsRecord(landedBag, title)) return landedBag;
    return this._routeAtOrAboveWorking(title) ?? working;
  }

  /** Re-land the bag's current record for `title` through the landing queue. */
  private _relandFrom(title: string, bag: string): void {
    const source = this._storeFor(bag) as {
      headsNow?: () => readonly string[] | null;
      getAt?: (title: string, heads: readonly string[]) => LarTiddlerRecord | null;
    } | null;
    const heads = source?.headsNow?.() ?? undefined;
    if (heads && typeof source?.getAt === "function") {
      this._enqueue({ title, record: source.getAt(title, heads), origin: { kind: "crdt-remote", edgeIsland: bag }, bag, heads });
    }
  }

  /**
   * A hand whose source moved: the hand's value stands as a parallel draft of the title in the draft bag
   * (persistence awaited and tracked), nothing reaches the destination bag, and the source's record
   * lands in the wiki again so the wiki never disagrees with the store.
   */
  private async _surfaceHand(title: string, fields: Record<string, string>, sourceBag: string): Promise<void> {
    const { "$origin-bag": _stamp, ...bare } = withoutDraftBase(fields);
    const draft = toLarTiddlerRecord({
      ...bare,
      title: parallelDraftTitle(title, this.instanceId),
      "draft.of": title,
      "draft.title": title,
      "lar-conflict-fields": "*",
      "lar-conflict-live": "",
      "lar-conflict-actor": this.instanceId,
      "lar-conflict-ops": `cross-bag:${this.instanceId}`,
    });
    let unheld: LarTiddlerRecord[] = [draft];
    await this._track(this.surfacings, this._persistParallelDrafts({ title, bag: sourceBag, drafts: [draft] }).then((left) => { unheld = left; }));
    // A hand no draft holds stands on the alert rail before the source's record lands over it.
    for (const left of unheld) this._surfaceUnkeptDraft(left, "no draft bag" as SlotUri, new Error("the draft route names no bag for this wiki"));
    this._relandFrom(title, sourceBag);
  }

  /** A refused store write stays on the alert rail until a later write of the title is acknowledged. */
  private _raiseUnsaved(title: string, bag: string | undefined, error: unknown): void {
    if (error instanceof UnroutedSaveRefusal) return;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[island-adaptor] write of "${title}" to ${bag ?? "its bag"} refused: ${message} — it stays owed`);
    this._addAlertIfChanged({
      title: unsavedHandAlertTitle(title),
      text: `The edit of <code>${title}</code> could not be stored in <code>${bag ?? "its bag"}</code> (${message}). ` +
        `It stays owed: the next change to this title, or closing the wiki, tries again.`,
      tags: TW5_ALERT_TAG,
      "alert-kind": "unsaved-hand",
      "hand-title": title,
      bag: bag ?? "",
      error: message,
    });
  }

  private _clearUnsaved(title: string): void {
    const wiki = this.tw5.$tw.wiki;
    if (wiki.getTiddler(unsavedHandAlertTitle(title))) wiki.deleteTiddler(unsavedHandAlertTitle(title));
  }

  // ---------------------------------------------------------------------------
  // The draft book
  // ---------------------------------------------------------------------------

  /** The base a draft of `target` carries when it opens: where the target lives (or would land) and at which heads. */
  private _captureBase(target: string): DraftBase {
    const entry = this.ledger.landedOf(target);
    const own = this.unlanded.has(target) ? this.handBase.get(target) : undefined;
    if (own) return { baseBag: own.bag, baseHeads: own.heads, absent: false };
    if (entry?.tiddler != null && entry.bag) return { baseBag: entry.bag, baseHeads: entry.heads ?? [], absent: false };
    const bag = this._saveBag(target);
    if (bag === null) return { baseHeads: [], absent: true };
    return { baseBag: bag, baseHeads: this._headsOfBag(bag) ?? [], absent: true };
  }

  /**
   * A hand wrote a tiddler carrying `draft.of`: the book learns (or refreshes) the draft. The base is
   * captured once, at the draft's first write: this shore's own unlanded write of the target, else the ledger,
   * else the bag the cascade routes the target to. Fields found on a wiki tiddler are never read. The draft's
   * own route settles first and its refusal reaches the hand; a target the cascade cannot route stands on
   * the alert rail and the draft persists with no base.
   */
  private _teachDraft(title: string, fields: Record<string, string>): void {
    const of = (fields["draft.of"] ?? "").trim();
    const wanted = fields["draft.title"] ?? "";
    const known = this.draftBook.get(title);
    if (known && known.of === of) {
      if (known.title !== wanted) this.draftBook.set(title, { ...known, title: wanted });
      return;
    }
    // The draft's own route settles first: its refusal names the draft pointer. The target's follows.
    const bag = known?.bag ?? this._destination(title) ?? undefined;
    // A first hand write ALWAYS captures: fields found on a wiki tiddler are never read.
    let base: DraftBase;
    try { base = this._captureBase(of); }
    catch (error) {
      // The target's refusal already stands on the alert rail; the draft persists ordinarily with no base.
      if (!(error instanceof UnroutedSaveRefusal)) throw error;
      base = { baseHeads: [], absent: true };
    }
    this.draftBook.set(title, { of, title: wanted, ...base, ...(bag ? { bag } : {}) });
  }

  /** A landed record teaches the book its draft; a record that is gone, or lost `draft.of`, removes the entry. */
  private _learnDraft(title: string, record: LarTiddlerRecord | null, bag: string | undefined): void {
    const fields = record && !record.meta?.deleted ? record.tiddler as Record<string, unknown> : null;
    const of = fields ? String(fields["draft.of"] ?? "").trim() : "";
    if (!fields || !of) { this.draftBook.delete(title); return; }
    const known = this.draftBook.get(title);
    if (known) {
      // A foreign wave refreshes the target and title the draft names; this shore's own write never does.
      const foreign = !this.holdsHand(title);
      const next = {
        ...known,
        ...(foreign ? { of, title: String(fields["draft.title"] ?? "") } : {}),
        ...(bag ? { bag } : {}),
        ...(known.baseBag ? {} : (readDraftBase(fields) ?? {})),
      };
      this.draftBook.set(title, next);
      return;
    }
    const base = readDraftBase(fields);
    if (!base) return;
    this.draftBook.set(title, { of, title: String(fields["draft.title"] ?? ""), ...base, ...(bag ? { bag } : {}) });
  }

  /** True when the store has taken a write of `title` that no wave has landed, or a wave landed a live record. */
  private _reachedStore(title: string): boolean {
    const entry = this.ledger.landedOf(title);
    return (entry?.tiddler ?? null) !== null || this.unlanded.has(title) || (this.sent.has(title) && this.sent.get(title) !== null);
  }

  // ---------------------------------------------------------------------------
  // Discrete acts: save, rename, cancel
  // ---------------------------------------------------------------------------

  /**
   * Read one wiki `change` dispatch for discrete acts, BEFORE the per-title loop. A dispatch that holds
   * the deletion of a draft the book knows is
   *   a SAVE   when it also holds the write of the draft's target (`draft.title` equal to `draft.of`),
   *   a RENAME when it holds the write of `draft.title`, a title other than `draft.of`,
   *   a CANCEL when the deletion stands alone.
   * The act consumes every gate entry of its titles and issues its store calls inside this call, in the
   * turn of the dispatch. The answer names the titles the act took, so the per-title loop skips them.
   */
  handleChangeDispatch(changes: Readonly<Record<string, unknown>>): ReadonlySet<string> {
    const consumed = new Set<string>();
    const wiki = this.tw5.$tw.wiki;
    // ONE WRITE OF A TARGET PER DISPATCH. Two drafts of one target that leave in one dispatch name one
    // state of that target: the first draft's act carries it and every later draft's act stands as a cancel.
    const written = new Set<string>();
    for (const draftTitle of Object.keys(changes)) {
      const entry = this.draftBook.get(draftTitle);
      if (!entry || wiki.getTiddler(draftTitle) !== undefined) continue;
      const target = entry.title.trim();
      const standing = target === "" ? undefined : wiki.getTiddler(target);
      const saves = standing !== undefined && Object.hasOwn(changes, target) && !this.isFoam(target, standing) && !written.has(target);
      if (saves) written.add(target);
      const rename = saves && target !== entry.of;
      // ONE set: the titles the act takes are the titles it marks, and the per-title loop skips exactly them.
      // The source joins the act only when the wiki holds no source after the dispatch; a standing one (an
      // overridden shadow revealed by the delete) falls to the per-title loop, which writes what the wiki holds.
      const members = [draftTitle, ...(saves ? [target] : []), ...(rename && Object.hasOwn(changes, entry.of) && wiki.getTiddler(entry.of) === undefined ? [entry.of] : [])];
      for (const member of members) consumed.add(member);
      void this._track(this.acts, this._act(draftTitle, entry, saves, target, rename, members));
    }
    return consumed;
  }

  /** Runs an act with its members registered in `inFlight`, so a per-title flush of a member waits for it. */
  private _act(draftTitle: string, entry: DraftEntry, saves: boolean, target: string, rename: boolean, members: readonly string[]): Promise<void> {
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    for (const member of members) this.inFlight.set(member, done);
    const run = this._actBody(draftTitle, entry, saves, target, rename, members);
    return run.finally(() => {
      for (const member of members) if (this.inFlight.get(member) === done) this.inFlight.delete(member);
      finish();
    });
  }

  private async _actBody(draftTitle: string, entry: DraftEntry, saves: boolean, target: string, rename: boolean, members: readonly string[]): Promise<void> {
    const wiki = this.tw5.$tw.wiki;
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    const taken = this.gate.consume(members);
    for (const member of members) { this.pendingHand.add(member); this.handed.delete(member); }

    interface Group { bag: string; base: readonly string[] | undefined; puts: LarTiddlerRecord[]; deletes: string[]; titles: string[]; from?: { bag: string; heads: readonly string[] } }
    const groups: Group[] = [];
    const strays: Array<{ slot: SlotUri; uri: string }> = [];
    const sentValues = new Map<string, unknown | null>();
    const group = (bag: string, base: readonly string[] | undefined, puts: LarTiddlerRecord[], deletes: string[], titles: string[], from?: { bag: string; heads: readonly string[] }): void => {
      const found = groups.find((g) => g.bag === bag && sameHeads(g.base, base));
      if (found) { found.puts.push(...puts); found.deletes.push(...deletes); found.titles.push(...titles); if (from && !found.from) found.from = from; }
      else groups.push({ bag, base, puts, deletes, titles, ...(from ? { from } : {}) });
    };
    let surfaced: Promise<void> | null = null;
    let tombstonedSource = false;
    const draftBase = entry.baseBag ? { bag: entry.baseBag, heads: entry.baseHeads } : undefined;
    try {
      // A title that never persists (the volatile plane, the alert rail) takes no store call as a member.
      if (saves && !neverPersists(target)) {
        const value = wiki.getTiddler(target)!;
        const fields = extractFields(this.tw5, value);
        const dest = this._saveBag(target);
        if (dest !== null) {
          const landed = this.ledger.landedOf(target);
          const standsAtY = rename && landed?.tiddler != null && landed.bag !== undefined && landed.heads !== undefined;
          const from = standsAtY ? { bag: landed!.bag!, heads: landed!.heads! } : draftBase;
          // The read of the source sits immediately before the destination write is issued.
          const plan = from ? this._basePlan(target, dest, from) : {};
          sentValues.set(target, value);
          if (plan.moved !== undefined) {
            surfaced = this._surfaceHand(target, fields, plan.moved);
          } else {
            const family = this._buildFamily(target, fields, dest);
            group(dest, plan.base, family.puts, family.tombstones, [target], from);
            strays.push(...family.strays);
          }
        }
      }
      if (rename && members.includes(entry.of) && !wiki.getTiddler(entry.of) && !neverPersists(entry.of)) {
        const standing = this.ledger.landedOf(entry.of);
        const stood = (standing?.tiddler ?? null) !== null || (this.sent.has(entry.of) && this.sent.get(entry.of) !== null);
        if (stood) {
          const landedBag = this.lastWriteBag.get(entry.of) ?? standing?.bag ?? entry.baseBag;
          if (landedBag) {
            const bag = this._tombstoneBag(entry.of, landedBag);
            const base = bag === entry.baseBag ? entry.baseHeads : standing?.bag === bag ? standing.heads : undefined;
            group(bag, base && base.length > 0 ? base : undefined, [], [entry.of], [entry.of]);
            sentValues.set(entry.of, null);
            tombstonedSource = true;
          }
        }
      }
      if (this._reachedStore(draftTitle)) {
        const bag = entry.bag ?? this.ledger.landedOf(draftTitle)?.bag ?? this.handBase.get(draftTitle)?.bag;
        if (bag) {
          const draftBag = this._tombstoneBag(draftTitle, bag);
          group(draftBag, this._handBaseFor(draftTitle, draftBag), [], [draftTitle], [draftTitle]);
          sentValues.set(draftTitle, null);
        }
      } else this._clearUnsaved(draftTitle);
    } catch (error) {
      taken.settle(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    for (const [title, value] of sentValues) this.sent.set(title, value);
    const ackBefore = new Map([...sentValues.keys()].map((title) => [title, this.writeAcks.get(title) ?? 0]));
    // Every store call of the act is issued here, before the first await.
    const hold = groups.length > 0 ? this.restDoor?.begin() : undefined;   // in the turn of the dispatch, so the act's result can wait
    const issued = groups.map((g) => this._issueGroup(g.bag, g.base, g.puts, g.deletes, origin));
    const issuedStrays = strays.map(({ slot, uri }) => this.store.tombstoneInBag(slot, uri, origin));
    const settled = await Promise.allSettled([...issued, ...issuedStrays, ...(surfaced ? [surfaced] : [])]);
    let handBags: string[] = [];
    if (hold) {
      // The act's result waits on the rest door, so the hands the act's dispatch left marked on the gate (the story
      // list the navigator rewrote, for one) leave now and rest with it: a reload that follows reads the story the
      // person left, never the one from before the confirm.
      const others = this.gate.titles().filter((title) => !members.includes(title));
      await Promise.allSettled(others.map((title) => this._leaveNow(title)));
      handBags = others.map((title) => this.lastWriteBag.get(title)).filter((bag): bag is string => bag !== undefined);
    }
    hold?.done([...new Set([...groups.filter((_, index) => settled[index]!.status === "fulfilled").map((g) => g.bag), ...handBags])]);
    let fault: Error | null = null;
    const asError = (reason: unknown): Error => reason instanceof Error ? reason : new Error(String(reason));
    const refused = new Set<string>();
    groups.forEach((g, index) => {
      const outcome = settled[index]!;
      if (outcome.status === "rejected") {
        fault ??= asError(outcome.reason);
        for (const title of g.titles) {
          refused.add(title);
          this.sent.delete(title);
          this.failedAtTeardown.set(title, outcome.reason);
          // The retry builds on the act's own base, never on the ledger's current heads.
          const retryFrom = title === target ? g.from : undefined;
          if (retryFrom) this.handBase.set(title, retryFrom);
          else if (g.base) this.handBase.set(title, { bag: g.bag, heads: g.base });
          this._raiseUnsaved(title, g.bag, outcome.reason);
        }
        return;
      }
      for (const title of g.titles) {
        const acknowledged = (this.writeAcks.get(title) ?? 0) > (ackBefore.get(title) ?? 0);
        this.lastWriteBag.set(title, g.bag);
        // Only an acknowledged write stands ahead of the ledger; a noop raises no wave to clear the mark.
        if (acknowledged) this.unlanded.add(title);
        else this.sent.delete(title);
        this.pendingHand.delete(title);
        this.failedAtTeardown.delete(title);
        this._clearUnsaved(title);
      }
    });
    strays.forEach(({ slot, uri }, index) => {
      const outcome = settled[groups.length + index]!;
      if (outcome.status !== "rejected") return;
      fault ??= asError(outcome.reason);
      // Owed as absent: the retry leaves a tombstone though the wiki still holds the orphan at its landed value.
      this.pendingHand.add(uri);
      this.handed.set(uri, null);
      this.failedAtTeardown.set(uri, outcome.reason);
      this._raiseUnsaved(uri, slot, outcome.reason);
    });
    if (surfaced && settled[settled.length - 1]!.status === "rejected") fault ??= asError((settled[settled.length - 1] as PromiseRejectedResult).reason);
    if (tombstonedSource && !refused.has(entry.of)) this._removeSlotChildren(entry.of);
    for (const member of members) {
      if (!refused.has(member)) this.pendingHand.delete(member);
    }
    if (fault === null) this.draftBook.delete(draftTitle);
    taken.settle(fault ?? undefined);
  }

  /** One `writeFamily` call for one (bag, base); a base outside the document's history retries without it. */
  private _issueGroup(bag: string, base: readonly string[] | undefined, puts: LarTiddlerRecord[], deletes: string[], origin: ChangeOrigin): Promise<void> {
    return this.store.writeFamily(puts, deletes, origin, { bag: bag as SlotUri, ...(base ? { base } : {}) }).catch(async (error: unknown) => {
      if (!base || !(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
      console.warn(`[island-adaptor] retrying a write to ${bag} without unavailable base`);
      await this.store.writeFamily(puts, deletes, origin, { bag: bag as SlotUri });
    });
  }

  // ---------------------------------------------------------------------------
  // The per-title flush
  // ---------------------------------------------------------------------------

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
    // A flush queued behind a failed one still tries: the earlier write's fault belongs to its own waiters.
    const prior = this.inFlight.get(title);
    if (prior) await prior.catch(() => {});
    // ABSOLUTE STATE: what leaves is the title's state at flush. A caller that handed a value the wiki does
    // not hold (`handed`) is the one exception, and its value stands in for the wiki's.
    const state = this.handed.has(title) ? this.handed.get(title)! : this.tw5.$tw.wiki.getTiddler(title) ?? null;
    // A state equal to what the last wave landed, with nothing sent since, owes the store nothing: the hand
    // returned to the landed value inside its window. A title the store never saw and the wiki no longer
    // holds raises no tombstone. A state identical to the value already sent owes nothing either.
    const landed = this.ledger.landedOf(title);
    // The ledger answers only once the seed wave has rebuilt it (a resident shore), and never for a title
    // this shore wrote whose wave has not landed: there the state leaves and the store decides.
    const settled = this.sent.has(title)
      ? this.sent.get(title) === state
      : this.resident && !this.unlanded.has(title) && same(state, landed ? landed.tiddler : null);
    if (settled) {
      if (this.handed.get(title) === state) this.handed.delete(title);
      this.pendingHand.delete(title);
      if (!this.sent.has(title)) this.handBase.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.delete(title);
      this._clearUnsaved(title);
      return;
    }
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    const ackBefore = this.writeAcks.get(title) ?? 0;
    let writeBag: string | undefined;
    let task: Promise<void>;
    if (state !== null) {
      const fields = extractFields(this.tw5, state);
      const draft = fields["draft.of"] !== undefined ? this.draftBook.get(title) : undefined;
      if (fields["draft.of"] !== undefined) { delete fields[DRAFT_BASE_BAG]; delete fields[DRAFT_BASE_HEADS]; }
      if (draft?.baseBag) Object.assign(fields, draftBaseFields(draft));
      let dest: SlotUri | null;
      try { dest = this._saveBag(title); }
      catch (error) {
        // A refused route leaves the title owed: marked, with the refusal on the alert rail.
        this.lastFlushWrote.set(title, false);
        this.failedAtTeardown.set(title, error);
        throw error;
      }
      if (dest === null) {
        this.handed.delete(title);
        this.pendingHand.delete(title);
        this.lastFlushWrote.set(title, false);
        return;
      }
      writeBag = dest;
      // The base, and the cross-bag read behind it, are settled immediately before the write is issued.
      const plan = this._basePlan(title, dest);
      this.sent.set(title, state);
      if (plan.moved !== undefined) {
        if (this.handed.get(title) === state) this.handed.delete(title);
        this.pendingHand.delete(title);
        this.lastFlushWrote.set(title, false);
        await this._surfaceHand(title, fields, plan.moved);
        return;
      }
      const base = plan.base;
      task = this._writeMeme(title, fields, origin, dest, base).catch(async (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
        console.warn(`[island-adaptor] retrying "${title}" without unavailable base`);
        await this._writeMeme(title, fields, origin, dest);
      });
    } else {
      const entry = this.ledger.landedOf(title);
      const landedBag = this.lastWriteBag.get(title) ?? entry?.bag ?? this.handBase.get(title)?.bag ?? this._routeAtOrAboveWorking(title) ?? this.store.defaultWritableBagId();
      if (!landedBag) {
        this.handed.delete(title);
        this.pendingHand.delete(title);
        this.lastFlushWrote.set(title, false);
        return;
      }
      const bag = this._tombstoneBag(title, landedBag);
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
      // The store took this state for `writeBag`: the title's state stands there, by this write or because
      // an equal state already stood (a noop). A noop fires no envelope, so no return wave lands over `sent`
      // and none clears `unlanded`: only an acknowledged write stands ahead of the ledger.
      const acknowledged = (this.writeAcks.get(title) ?? 0) > ackBefore;
      this.lastFlushWrote.set(title, acknowledged);
      if (writeBag) this.lastWriteBag.set(title, writeBag);
      if (acknowledged) this.unlanded.add(title);
      else this.sent.delete(title);
      if (this.handed.get(title) === state) this.handed.delete(title);
      this.pendingHand.delete(title);
      this.failedAtTeardown.delete(title);
      this._clearUnsaved(title);
      if (state === null) this.draftBook.delete(title);
    } catch (error) {
      // The title stays marked (pendingHand keeps it) so the next change, wave or teardown tries again;
      // no timer is armed, because a timer would decide when the refusal ends.
      this.sent.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.set(title, error);
      this._raiseUnsaved(title, writeBag, error);
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
  // The cascade's `[prefix[lar:]…]` catch-all admits the plane by its spelling, and a live `change`
  // listener carries every wiki edit outbound. Persisting the plane would land the caller's whole payload
  // in the CRDT a second time as ONE monolithic record: a change of that size exhausts the automerge WASM
  // module's linear memory, and a terminated module projects nothing afterwards.
  //
  // So the refusal sits HERE, in the module the law names, ahead of the cascade — the cascade routes
  // among bags and stays the operator's to edit, and no edit of it may re-open this.

  saveTiddler(tiddler: unknown): Promise<void> {
    const fields = extractFields(this.tw5, tiddler);
    const title  = fields["title"] ?? "";

    // THE VOLATILE VM PLANE NEVER PERSISTS, and no cascade edit may lift that.
    if (neverPersists(title)) return Promise.resolve();

    // A draft's base is captured at its first write; a title that carries no `draft.of` is no draft.
    if (fields["draft.of"] !== undefined) {
      try { this._teachDraft(title, fields); }
      catch (error) { return Promise.reject(error); }
    } else this.draftBook.delete(title);

    if (!this.gate.has(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    this.pendingHand.add(title);
    // A mark names the title; the flush reads the wiki. Only a value the wiki does not hold rides pinned.
    if ((this.tw5.$tw.wiki.getTiddler(title) ?? null) === tiddler) this.handed.delete(title);
    else this.handed.set(title, tiddler);
    return this.gate.mark(title, () => this._flushHand(title));
  }

  saveRecord(record: LarTiddlerRecord): Promise<void> {
    return this.saveTiddler({ fields: toTW5FieldStrings(this.tw5, record.tiddler) });
  }

  deleteTiddler(title: string): Promise<void> {
    // Nothing volatile ever landed, so nothing volatile gets a tombstone (see `saveTiddler`).
    if (neverPersists(title)) return Promise.resolve();
    // A DELETE ROUTES LIKE A SAVE, and the tiddler is already gone from the wiki when this runs — so
    // a rule reading a FIELD (`draft.of`) would route its creation and drop its deletion, leaving a
    // record that resurrects on the next boot. The landed ledger answers first; a title never
    // seen this session falls back to the cascade's title read. `_tombstoneBag` then picks the bag by the
    // composition's layer order: the landed layer when it sits at or above the working layer, the working
    // layer when the title landed beneath it.
    if (!this.gate.has(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    this.pendingHand.add(title);
    if (this.tw5.$tw.wiki.getTiddler(title)) this.handed.set(title, null);
    else this.handed.delete(title);
    return this.gate.mark(title, () => this._flushHand(title));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** True while the wiki holds `uri`, or the last wave landed it live. */
  private _stands(uri: string): boolean {
    return this.tw5.$tw.wiki.getTiddler(uri) !== undefined || (this.ledger.landedOf(uri)?.tiddler ?? null) !== null;
  }

  private _childUrisOf(parentUri: string): string[] {
    return this.tw5.$tw.wiki.filterTiddlers(`[field:$fragment-parent[${parentUri}]]`) as string[];
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
   * AN ORPHAN IS SHADOWED LIKE ANY HAND DELETE. A child's tombstone routes through `_tombstoneBag`: the
   * landed layer when it sits at or above the working layer, the working layer when the child landed
   * beneath it. An orphan whose tombstone lands in the family's target bag rides the family's own
   * change; one that lands in another layer goes in its own call. A marked child the wiki dropped
   * follows the same router. No hand's tombstone is written beneath the working layer.
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
    const { puts, tombstones, strays, split } = this._buildFamily(title, fields, targetBag);

    // A PLACED ROOT CARRIES ITS MARKED SLOTS. The flush reads the wiki's state, and a root the wiki already
    // holds in placed form splits into no children: its slot children stand as their own wiki tiddlers, each
    // with its own mark. They ride this family so the root and its slots still land as one change: a marked
    // child the wiki holds joins the puts, a marked child the wiki dropped joins the tombstones, and each
    // reads as sent so its own flush finds nothing left to write.
    const rode: Array<{ uri: string; value: unknown | null; acks: number }> = [];
    if (!split && title.indexOf("#") < 0 && fields["draft.of"] === undefined) {
      const wiki = this.tw5.$tw.wiki;
      const marked = (uri: string): boolean => (this.gate.has(uri) || this.pendingHand.has(uri)) && !this.handed.has(uri);
      // Slot children carry the root's address plus a fragment, so the marked titles alone name them.
      for (const uri of this.pendingHand) {
        if (!uri.startsWith(`${title}#`) || !marked(uri)) continue;
        const entry = this.ledger.landedOf(uri);
        if (((entry?.bag as SlotUri | undefined) ?? targetBag) !== targetBag) continue;
        const standing = wiki.getTiddler(uri) as { fields?: Record<string, unknown> } | undefined;
        if (standing) {
          if (standing.fields?.["$fragment-parent"] !== title) continue;
          const { "$origin-bag": _slotOrigin, ...persistedSlot } = extractFields(this.tw5, standing);
          puts.push(toLarTiddlerRecord({ ...withoutDraftBase(persistedSlot), title: uri }));
          rode.push({ uri, value: standing, acks: this.writeAcks.get(uri) ?? 0 });
        } else if (entry?.tiddler) {
          // A dropped child is a hand's delete: it rides this family only where the router lands it in this
          // bag. Anywhere else its own flush carries it, through the same router.
          let chosen: string;
          try { chosen = this._tombstoneBag(uri, targetBag); } catch (error) { if (error instanceof UnroutedSaveRefusal) continue; throw error; }
          if (chosen !== targetBag) continue;
          tombstones.push(uri);
          rode.push({ uri, value: null, acks: this.writeAcks.get(uri) ?? 0 });
        }
      }
      for (const member of rode) this.sent.set(member.uri, member.value);
    }

    try {
      await this.store.writeFamily(puts, tombstones, origin, { bag: targetBag, ...(base ? { base } : {}) });
    } catch (error) {
      for (const member of rode) if (this.sent.get(member.uri) === member.value) this.sent.delete(member.uri);
      throw error;
    }
    // A member the store took as a noop raises no envelope, so no return wave will clear its `sent`.
    for (const member of rode) {
      if ((this.writeAcks.get(member.uri) ?? 0) === member.acks && this.sent.get(member.uri) === member.value) this.sent.delete(member.uri);
    }
    for (const { uri, slot } of strays) await this.store.tombstoneInBag(slot, uri, origin);
  }

  /**
   * Build a saved tiddler's meme FAMILY: the one transformation the flush and a discrete act share. The
   * root, the slot children its body splits into (Path H auto-split) and the tombstones of the children it
   * does not declare come back as `puts` and `tombstones`; an orphan living in another bag comes back in
   * `strays`. `$origin-bag` (the host's stamp on a wiki tiddler) and, on a record carrying no `draft.of`,
   * the two draft-base fields never persist.
   */
  private _buildFamily(
    title:  string,
    fields: Record<string, string>,
    targetBag: SlotUri,
  ): { puts: LarTiddlerRecord[]; tombstones: string[]; strays: Array<{ uri: string; slot: SlotUri }>; split: boolean } {
    const bodyText = fields["text"] ?? "";
    // A slot child saved at its own address splits under the fragment it already carries: its own
    // slots compose onto that ONE path (`#/a/z`), never a second fragment (`#/a#/z`).
    const cut = title.indexOf("#");
    const isDraft = fields["draft.of"] !== undefined;
    const { parent, children }: ReturnType<typeof splitBodyTiddler> = isDraft
      ? { parent: { ...fields, title }, children: [] }
      : cut < 0
        ? splitBodyTiddler(title, "", bodyText, fields)
        : splitBodyTiddler(title.slice(0, cut), title.slice(cut), bodyText, fields);
    // `bag` is the author's and rides through whole.
    const persist = <T extends Record<string, unknown>>(record: T, draft: boolean): T => {
      const { "$origin-bag": _stamp, ...bare } = record;
      return (draft ? bare : withoutDraftBase(bare)) as unknown as T;
    };

    const puts: LarTiddlerRecord[] = [toLarTiddlerRecord({ ...persist(parent, isDraft), title })];
    const tombstones: string[] = [];
    const strays: Array<{ uri: string; slot: SlotUri }> = [];
    if (isDraft) return { puts, tombstones, strays, split: false };

    const newChildren = new Set<string>();
    for (const child of children) {
      const childTitle = String(child["title"] ?? "");
      if (!childTitle.startsWith("lar:")) continue;
      newChildren.add(childTitle);
      puts.push(toLarTiddlerRecord({ ...persist(child, false), title: childTitle }));
    }

    // THE ORPHANS ARE THE CHILD REFERENCES THE EDIT REMOVED. A placed parent names each child slot by a
    // `kahea` reference, so the references its landed text held and its saved text does not hold name the
    // children the hand removed, the last one included: a parent that splits into no children still
    // compares. A body saved whole (its ahu blocks split here) also drops every standing child it does not
    // declare. A parent that never referenced a child compares two empty sets and tombstones nothing.
    const rootUri = cut < 0 ? title : title.slice(0, cut);
    const declared = kaheaChildUris(rootUri, String(parent["text"] ?? ""));
    const landedParent = this.ledger.landedOf(title)?.tiddler as { fields?: Record<string, unknown> } | null | undefined;
    const before = new Set<string>(kaheaChildUris(rootUri, String(landedParent?.fields?.["text"] ?? "")));
    const standing = new Set<string>(children.length > 0 ? this._childUrisOf(title) : []);
    for (const uri of standing) before.add(uri);
    const orphans: string[] = [];
    for (const uri of before) {
      if (declared.has(uri) || newChildren.has(uri) || !(standing.has(uri) || this._stands(uri))) continue;
      orphans.push(uri);
    }
    // A removed child takes its own slot children with it, at every depth.
    for (let i = 0; i < orphans.length; i++) {
      for (const nested of this._childUrisOf(orphans[i]!)) if (!newChildren.has(nested) && !orphans.includes(nested)) orphans.push(nested);
    }
    for (const uri of orphans) {
      const slot = this._tombstoneBag(uri, (this.ledger.landedOf(uri)?.bag as string | undefined) ?? targetBag) as SlotUri;
      if (slot === targetBag) tombstones.push(uri);
      else strays.push({ uri, slot });
    }
    return { puts, tombstones, strays, split: children.length > 0 };
  }
}
