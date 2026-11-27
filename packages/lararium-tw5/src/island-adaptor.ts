/**
 * Wiki shore between CompositeStore and TW5. Tiddlers are invariants and every write replaces a tiddler
 * under a title; a draft is an ordinary tiddler carrying `draft.of`, a convention of the editing surface.
 * No storage path branches on "draft": the shore reads from `draft.of` and `draft.title` only which base a
 * save carries and which titles form one discrete act.
 *
 * INBOUND. The landed ledger records each wave's absolute result. WaveLanding meets queued waves with
 * unsent hands before the synchronous engine applier receives a change. A landed record also teaches the draft book.
 *
 * OUTBOUND, THE PER-TITLE PATH. A mark names a TITLE. The one Drain (`drain.ts`) holds every owed title and writes one at a time: what
 * leaves at the flush is the title's state in the wiki at that flush. A state
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
 * tombstoned where the ledger says it lives) or a CANCEL (the deletion stands alone). The act registers its
 * writes through the Drain and starts an idle pump inside the handler, so the target leaves in the turn of the
 * dispatch. Its removals (the draft's own tombstone, a rename's source) ride dependency edges on the target:
 * each waits until the target's durable receipt covers the act, then leaves as an ordinary owed title. The
 * draft's own tombstone rides the draft's bag at the draft's landed base and is issued only for a draft that
 * reached the store. A save builds on the draft-open base; a rename onto a standing title builds on that
 * title's landed base; the source's tombstone builds on the draft-open base. A refused write leaves its title owed.
 *
 * THE CROSS-BAG CHECK. A write whose destination bag differs from the bag its base names reads the source
 * bag at the base heads and at its current heads, immediately before the destination write is issued. An
 * unmoved source lands in the destination carrying destination-side heads only where the ledger holds
 * them. A moved source lands nothing: the hand surfaces as a parallel draft in the draft bag (persistence
 * awaited and tracked) and the source's record lands in the wiki again. Source heads never ride into the
 * destination.
 *
 * TEARDOWN. `stop()` never drops a hand: it closes the Drain, which writes every owed title (a failure answers
 * by name, never a hang), and awaits parallel-draft persistence. `awaitWikiDispatch()` lets a teardown deliver the wiki's queued `change` dispatch to the
 * bridge before the bridge unhooks.
 *
 * Schema: lar:///ha.ka.ba/lares/api/lararium/schema/island-adaptor
 */

import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { LarTiddlerStore, LarTiddlerRecord, LarTiddlerChange, ChangeOrigin, MemeProjection } from "@lararium/mesh/tiddler-store";
import type { ParallelDraftsChange, ParallelDraftsReader } from "@lararium/mesh/parallel-drafts";
import type { SlotUri } from "@lararium/mesh/wiki-recipe";
import { KAHUA_SHADOW_PREFIX, kahuaShadowOf, kahuaShadowTitle, type KahuaShadow } from "./kahua-shadow.js";
import type { IslandSeed } from "./island-seed.js";
import { KAHUA_BAG } from "@lararium/mesh/wiki-recipe";
import { toLarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { isVolatileVmUri } from "@lararium/mesh/lar-uris";
import { draftsOffLive, parallelDraftTitle } from "@lararium/mesh/parallel-drafts";
import { edgeDescendantsOf, rootAddressOf, type FamilyView } from "@lararium/mesh/family";
import { BAG_PATHS_CONFIG, routeBag, type RouteVerdict } from "./bag-cascade.js";
import type { TW5Engine } from "./tw5-vm.js";
import { ReceiptCapabilityUnavailable, type ReceiptCapability, type ReceiptHold } from "./receipt.js";
import type { LaresTw5Extension } from "./types/lares-globals.js";
import { splitBodyTiddler, quoteblockFence } from "./deserializer.js";
import { familyRefsOf, retitleSlotsInWiki, wikiFamilyView, type FamilyRenameWiki } from "./place-meme.js";
import { LandedLedger, same, sameWithStamp } from "./landed-ledger.js";
import { naluFieldsOf, naluLands } from "./nalu-form.js";
import { WaveLanding } from "./wave-landing.js";
import { Drain, macrotask, type DrainOutcome, type DrainSettling } from "./drain.js";
import {
  DRAFT_BASE_BAG, DRAFT_BASE_HEADS, contentKey, draftBaseFields, readDraftBase, withoutDraftBase,
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

/** The alert a title whose landing failed raises until a later wave lands it. */
export function landingFailedAlertTitle(title: string): string {
  return `$:/temp/lares/alert/landing-failed/${title}`;
}

/** True for a title that never persists: the volatile VM plane, alert rail, and TW5 core prompts. */
export function neverPersists(title: string): boolean {
  return isVolatileVmUri(title) || title.startsWith("$:/temp/lares/alert/") || title.startsWith("$:/temp/confirm/") || title.startsWith("$:/temp/alerts/") || title.startsWith(KAHUA_SHADOW_PREFIX);
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
export type IslandStore = LarTiddlerStore & Pick<CompositeStore, "writeFamily" | "tombstoneInBag" | "storeForBag" | "resolveLayered" | "resolveAll" | "defaultWritableBagId" | "layerIndexOf"> & Partial<Pick<CompositeStore, "unknownBeneath">>;

export class LandingDoorUnavailableError extends Error {
  override readonly name = "LandingDoorUnavailableError";
  constructor() { super("the TW5 engine must provide applyNalu for the wiki shore — boot the wiki with the nalu-engine module of this build"); }
}

/** A second shore asked for an engine's queue door while another holds it. */
export class LandingDoorOccupiedError extends Error {
  override readonly name = "LandingDoorOccupiedError";
  constructor() { super("another wiki shore holds this engine's queue door — stop that shore before a second one lands waves into the same wiki"); }
}

/** What a landing's prepare read (everything that awaited), and the `sent` it saw, for the apply to check against. */
interface PreparedLanding {
  readonly record: LarTiddlerRecord | null;
  readonly bag: string | undefined;
  readonly heads: readonly string[] | undefined;
  readonly shadow: KahuaShadow | null | undefined;
  readonly sentHas: boolean;
  readonly sentValue: unknown;
}

/** The engine's crest door bound to its engine, or a bare run where the engine's applier carries none. */
function crestDoorOf(lares: LaresTw5Extension["lares"]): <T>(run: () => T) => T {
  const door = lares?.applyNaluCrest;
  // `bind` keeps the door's generic signature (`call` would widen its return to unknown).
  return typeof door === "function" ? door.bind(lares) : (run) => run();
}

/** How an apply ended: landed (or nothing to land), a standing hand leaves first, or an own write moved since the prepare. */
type LandingVerdict = "landed" | "hand" | "stale";

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
  // The one family law's own reading of the text (`familyRefsOf`): the component calls alone.
  return new Set(familyRefsOf(rootUri, { text }).filter((ref) => ref.kind === "kahea").map((ref) => ref.to));
}

/** A component leaving with its root: whether the wiki still holds it, and the acknowledgements it had before the write. */
interface LeavingRider { readonly uri: string; readonly acks: number; readonly standing: boolean }
/** What leaves with one title: the riders its own change carries, and the members another layer takes. */
interface Leaving { readonly riders: LeavingRider[]; readonly apart: string[] }

function extractFields(tw5: TW5Engine, tiddler: unknown): Record<string, string> {
  return toTW5FieldStrings(tw5, tiddler);
}

/**
 * THE ONE NAMED TRIGGER SEAM. The Drain decides what leaves and in what state; WHEN an idle pump starts at the end of a change dispatch
 * belongs to the trigger. Unattached (production), the dispatch's end starts it. An attached trigger's `fire` drains every owed title and
 * resolves on their outcome. A discrete act, a boundary, handsRested and teardown start the pump themselves either way.
 */
export interface RecoveryTrigger {
  attach(fire: (titles?: readonly string[]) => Promise<void>): () => void;
}

/** An act's removal of one title (the draft's tombstone, a rename's source): where it lands, and the target it waits behind. */
interface ActRemoval {
  readonly bag: string;
  readonly base: readonly string[] | undefined;
  readonly target: string;
  readonly targetGeneration: number;
  /** The value the wiki held when the act took the title (null for a draft): a different value later reads as a newer hand. */
  readonly before: unknown | null;
  /** A rename's source: the wiki shows it again while its removal waits or after a refusal, and loses it with its acknowledged removal. */
  readonly source: boolean;
  /** A draft that never reached the store: its recovery copy leaves first, and the removal waits behind the target after it. */
  recovery?: LarTiddlerRecord;
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
  /** THE one drain: every owed title, one write in flight across the shore. */
  private drain: Drain = this._newDrain();
  private landing: WaveLanding | null = null;
  private engineApply: ((change: LarTiddlerChange) => void) | null = null;
  /** The queue door this shore installed at `$tw.lares.enqueueNalu`; null while it holds none. */
  private door: ((change: LarTiddlerChange) => void) | null = null;
  private readonly sent = new Map<string, unknown>();
  private readonly handBase = new Map<string, { bag: string; heads: readonly string[] }>();
  private readonly lastWriteBag = new Map<string, string>();
  private readonly recoveryWrites = new Map<string, { bag: string; fields: Record<string, unknown> | null }>();
  /** Titles this shore wrote whose wave has not landed: the store stands ahead of the ledger for them. */
  private readonly unlanded = new Set<string>();
  private readonly handed = new Map<string, unknown | null>();
  /** What the shore knows of each draft, keyed by the draft's title (see `draft-book.ts`). */
  private readonly draftBook = new Map<string, DraftEntry>();
  /** Last draft fields seen for each draft title, used when a save outruns draft persistence. */
  private readonly draftSnapshots = new Map<string, Record<string, string>>();
  /** The removals acts registered, by removed title; each rides the Drain behind its target. */
  private readonly actRemovals = new Map<string, ActRemoval>();
  /** The rest holds of the acts this change dispatch began; they rest with what the dispatch marked. */
  private readonly actHolds: Array<{ hold: ReceiptHold; members: readonly string[] }> = [];
  /**
   * THE FACE A TOOL DOOR'S HAND WORE, by title: a verb that lands a record through the wiki (`wiki.addTiddler`) names
   * its session's face here before the hand, and the drain's write of that title carries it on its origin
   * (`ChangeOrigin.face`), so the record lands under the face's actor. It stands until a write of the title is taken
   * (or the title settles with nothing to write), so a refused write retries under the same face.
   */
  private readonly handFaces = new Map<string, string | null>();
  /** Parallel-draft persistence in flight. */
  private readonly surfacings = new Set<Promise<void>>();

  private _unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tw5:   TW5Engine,
    private readonly store: IslandStore,
    readonly instanceId:    string,
  ) {}

  /**
   * Install the shore queue door before the mount's waves or any other inbound caller. One shore owns an
   * engine's door: a second shore on the same engine refuses by `LandingDoorOccupiedError`. A shore that
   * stopped installs a fresh queue and its door again.
   */
  /** The capabilities the kernel hands this adaptor: the receipt a save act waits on before its result leaves, null where no vessel issues one. */
  caps: { receipt: ReceiptCapability | null } = { receipt: null };
  /**
   * True when the vessel declared a receipt grant for this island and it stands as no view (production storage-backed islands): a durable
   * acknowledgement then refuses by name (`ReceiptCapabilityUnavailable`) while `caps.receipt` stays absent.
   */
  receiptRequired = false;

  installLandingQueue(yieldHost?: () => Promise<void>): void {
    if (this.landing) return;
    const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
    if (typeof lares?.applyNalu !== "function") throw new LandingDoorUnavailableError();
    if (lares.enqueueNalu !== undefined) throw new LandingDoorOccupiedError();
    const apply = lares.applyNalu.bind(lares);
    const landing = new WaveLanding(
      {
        landOne: (change) => this._landOne(change),
        prepare: async (change) => {
          const prepared = await this._prepareLanding(change);
          return () => this._applyLanding(change, prepared, false) === "landed";
        },
      },
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
      (landed) => { for (const hear of [...this.sliceHearers]) hear(landed); },
      // THE ENGINE'S CREST DOOR: each slice's applies land as one crest the engine names (`applyNaluCrest`). An engine whose
      // applier carries no door (a fake engine) lands the same run bare, in the same one tick.
      crestDoorOf(lares),
    );
    this.landing = landing;
    this.engineApply = apply;
    this.door = (change) => landing.enqueue(change);
    lares.enqueueNalu = this.door;
  }

  private readonly sliceHearers = new Set<(landed: number) => void>();
  /** Hear each slice the shore's queue lands (the rows it landed), until the returned unsubscribe: the kernel's breath rides it. */
  onSliceLanded(hear: (landed: number) => void): () => void {
    this.sliceHearers.add(hear);
    return () => { this.sliceHearers.delete(hear); };
  }

  /**
   * WAVE ZERO TEACHES THE BOOKS WHERE EACH SEED TITLE LIVES. Per title the seed read resolved, the ledger row names the seed's
   * bag and heads beside what the wiki holds NOW (a startup action's write over a preload included, so it reads as landed and
   * never saves), and the draft book learns the seed's record. Each layer's heads at the read stand as landed (`landedCovers`).
   * `start` then stands a row for every other synced title the wiki holds. No replay re-lands a title the wiki already holds: a
   * change after the read reaches the shore as a wave.
   */
  standFromSeed(seed: Pick<IslandSeed, "stands" | "layerHeads">): void {
    const wiki = this.tw5.$tw.wiki;
    for (const [bag, heads] of seed.layerHeads) this._noteLanded(bag, heads);
    for (const [title, stand] of seed.stands) {
      this.ledger.set(title, { tiddler: wiki.getTiddler(title) ?? null, bag: stand.bag, ...(stand.heads !== undefined ? { heads: stand.heads } : {}) });
      this._learnDraft(title, naluLands({ title, record: stand.record }) ? stand.record : null, stand.bag);
    }
  }

  /**
   * ONE ROW PER SYNCED TITLE, as TiddlyWiki's syncer stands after the boot pass (`Syncer.readTiddlerInfo` over
   * `getSyncedTiddlers`): every ordinary tiddler the wiki holds that may persist (`neverPersists` plays `$:/config/SyncFilter`)
   * and holds no row yet reads as landed with no bag, holding the wiki's value. A title no layer holds (a status title, the
   * story, a startup action's creation) stands synced, so the change TW5 raises for it after the bridge stands reads as foam
   * and sends nothing; only a later move of it saves.
   */
  private _standSyncedRows(): void {
    const wiki = this.tw5.$tw.wiki;
    for (const title of wiki.filterTiddlers("[all[tiddlers]]")) {
      if (neverPersists(title) || this.ledger.landedOf(title) !== undefined) continue;
      this.ledger.set(title, { tiddler: wiki.getTiddler(title) ?? null });
    }
  }

  /**
   * THE SEED CHECKPOINT: resolves once the mount's own waves (the slot pointers, boot-set ground, the boot's gap) have drained.
   * It orders nothing on the shore itself; the kernel awaits it (`seedDrained`) so behavior arms over a wiki the seed reached.
   */
  armSeedCheckpoint(): Promise<void> {
    this.installLandingQueue();
    return this.landing!.checkpoint();
  }

  /** The slot children a family call put, by address, until a landing wave or a different state replaces them. */
  private readonly familyPlaced = new Map<string, LarTiddlerRecord>();

  landingIdle(): Promise<void> { return this.landing?.idle() ?? Promise.resolve(); }

  /** Every hand marked before this island boundary leaves; rejects with the first refusal among them. */
  async boundary(): Promise<void> {
    const outcome = await this._drainNow();
    if (outcome.kind === "failed") throw outcome.error;
  }

  /**
   * A lifecycle REQUEST (the end of a change dispatch, the page's visibilitychange/pagehide over its port): an idle pump starts now and a
   * refused title may try again. Best effort, never the guarantee. An attached recovery trigger owns this clock instead.
   */
  requestDrain(): void { if (this._trigger === null) this.drain.kick(); }

  /** The bridge read one change dispatch whole: the drain starts, and the acts it began rest with what the dispatch marked. */
  dispatchEnded(): void {
    if (this._trigger === null) this.drain.kick({ retry: false });
    if (this.actHolds.length === 0) return;
    const holds = this.actHolds.splice(0);
    const marked = this.drain.titles();
    // A whole-drain target the Drain displaced (`superseded`: it keeps the oldest and the newest) never says the acts' writes rest: the hold
    // asks again for the generation marked by now. An empty bag list releases the receipt at once, so the hold waits on a real rest.
    void this._whenAllRested().then((outcome) => {
      // A bag the island holds no replica of (the vessel's own temp plane) names no heads: the store call that wrote it already answered.
      const receipt = this.caps.receipt;
      const held = (bag: string): boolean => receipt?.holds?.(bag) ?? true;
      for (const { hold, members } of holds) {
        const bags = [...new Set([...members, ...marked])].filter((title) => !this.drain.owes(title)).map((title) => this.lastWriteBag.get(title));
        // A member the drain still owes was refused: the act's verdict reads false and names it, never `applied`. Once every generation
        // marked by the rest's ask reads acked, a member still owed owes a LATER act's mark (the next draft under the same title, typed
        // while this rest returned): this act's own writes rest, and its verdict reads kept.
        const owed = outcome.kind === "acked" ? [] : members.filter((title) => this.drain.owes(title));
        void hold.done([...new Set(bags.filter((bag): bag is string => bag !== undefined && held(bag)))], owed.length > 0 ? { titles: owed, refused: true } : { titles: members });
      }
    });
  }

  private _trigger: RecoveryTrigger | null = null;
  private _triggerOff: (() => void) | null = null;
  /** The drain's next turn while an attached trigger holds the clock. */
  private _heldRun: (() => void) | null = null;
  /** Lifecycle drains in progress: while any runs, the drain's turns pass straight through. */
  private _firing = 0;

  /** Hand WHEN an idle drain starts at a dispatch's end to another trigger (null restores the dispatch's own start). */
  setRecoveryTrigger(trigger: RecoveryTrigger | null): void {
    this._triggerOff?.(); this._triggerOff = null;
    this._trigger = trigger;
    if (trigger) { this._triggerOff = trigger.attach(async () => { const outcome = await this._drainNow(); if (outcome.kind === "failed") throw outcome.error; }); return; }
    const held = this._heldRun; this._heldRun = null;
    if (held) this._yield(held);
  }

  private readonly _yield = macrotask();
  private _newDrain(): Drain {
    return new Drain({
      write: (title) => this._drainWrite(title),
      schedule: (run) => { if (this._trigger !== null && this._firing === 0) this._heldRun = run; else this._yield(run); },
    });
  }

  /** THE one resting loop while a boundary drain pends: every further boundary or handsRested caller joins it, none starts its own. */
  private _resting: Promise<DrainOutcome> | null = null;
  /** A caller joined the resting loop after its last ask: the loop asks once more, so that caller's marks-so-far rest before it answers. */
  private _restAgain = false;

  /**
   * Start the drain now (releasing a trigger's held turn) and await every generation marked so far. While one such wait pends, a further
   * call JOINS it: repeated production signals under a hung receipt (an act's boundary, handsRested) hold one loop, never one re-ask loop each.
   */
  private _drainNow(close = false): Promise<DrainOutcome> {
    const release = (): void => {
      const held = this._heldRun; this._heldRun = null;
      held?.();
      this.drain.kick();
    };
    if (!close && this._resting) { this._restAgain = true; release(); return this._resting; }
    this._firing++;
    release();
    if (close) return this.drain.close().finally(() => { this._firing--; });
    return (this._resting = this._restingLoop());
  }

  /** The shared loop: `_whenAllRested`, asked once more for a caller that joined after the last ask. It clears its own seat before it answers. */
  private async _restingLoop(): Promise<DrainOutcome> {
    try {
      for (;;) {
        this._restAgain = false;
        const outcome = await this._whenAllRested();
        if (outcome.kind === "acked" && this._restAgain) continue;
        return outcome;
      }
    } finally { this._firing--; this._resting = null; }
  }

  /** Every generation marked so far rests: a `superseded` whole-drain target was handed forward to a newer one and never read as rested, so ask again for the generation marked by now. */
  private async _whenAllRested(): Promise<DrainOutcome> {
    for (;;) {
      const outcome = await this.drain.whenAcked();
      if (outcome.kind !== "superseded") return outcome;
    }
  }

  /** One title's turn in the drain: an owed title keeps its own generation, an unmarked hand marks; the pump starts, the landing awaits. */
  private async _drainTitle(title: string): Promise<DrainOutcome> {
    this._firing++;
    try {
      const gen = this.drain.owes(title) ? undefined : this.drain.mark(title);
      const held = this._heldRun; this._heldRun = null;
      held?.();
      // A wave arriving after a refusal is a request: the refused hand tries again ahead of it. A wave meeting the flight asks nothing of it.
      this.drain.kick({ demand: false, only: title });
      // `superseded` hands the title forward to its newer hand, which this turn then awaits; it never reads as written.
      let outcome = await this.drain.whenSettled(title, gen);
      while (outcome.kind === "superseded" && this.drain.owes(title)) outcome = await this.drain.whenSettled(title);
      return outcome;
    } finally { this._firing--; }
  }

  /** A caller's answer for a title: resolves when its latest state rests, rejects with the refusal that holds it. */
  private _answer(title: string, gen?: number): Promise<void> {
    return this.drain.whenSettled(title, gen).then((outcome) => {
      if (outcome.kind === "failed") throw outcome.error;
      if (outcome.kind === "abandoned") throw new Error(`[island-adaptor] the shore closed before "${title}" left`);
      // `acked`: this generation rests. `superseded`: a newer hand of the title displaced it and carries its state forward; the call is
      // neither saved nor failed, and the title's saved/unsaved state reads the title's LATEST outcome (the drain's slot and its alerts),
      // never this promise.
    });
  }

  /**
   * THE DRAIN'S ONE WRITE: the title's flush SUBMITS, and its DURABLE receipt SETTLES beside the next title's write (`settled`). A
   * refusal anywhere keeps the title owed in the drain, a refused receipt raises the title's unsaved alert by name, and a rename's
   * source waiting behind this target returns to the wiki.
   */
  private async _drainWrite(title: string): Promise<DrainSettling> {
    try { await this._flushHand(title); }
    catch (error) { this._restoreSourcesOf(title); throw error; }
    const settled = this._ackDurably([title]).catch((error: unknown) => {
      this.failedAtTeardown.set(title, error);
      this._raiseUnsaved(title, this.lastWriteBag.get(title), error);
      this._restoreSourcesOf(title);
      throw error;
    });
    return { settled };
  }

  /** The projection receipt checks the snapshot handed to the store by this pass. */
  recoveryAtRest: ((bag: string, title: string, fields: Record<string, unknown> | null) => Promise<void>) | null = null;

  /** The written titles' durable receipt. Its ask leaves in this call's own turn (the capability counts it asking until it posts). */
  private _ackDurably(fired: readonly string[]): Promise<void> {
    const receipt = this.caps.receipt;
    const written = [...new Set(fired.map((title) => this.lastWriteBag.get(title)).filter((bag): bag is string => bag !== undefined))];
    if (!receipt && this.receiptRequired && written.length > 0) return Promise.reject(new ReceiptCapabilityUnavailable());
    // A bag the island holds no replica of (the vessel's own temp plane) names no heads here: the store call that wrote it already answered.
    const slots = receipt ? written.filter((bag) => receipt.holds?.(bag) ?? true) : written;
    const checks = fired.flatMap((title) => {
      const written = this.recoveryWrites.get(title);
      return written && this.recoveryAtRest ? [this.recoveryAtRest(written.bag, title, written.fields)] : [];
    });
    // Attach rejection handling immediately while the storage receipt remains in flight.
    const projection = Promise.allSettled(checks);
    const durable = receipt && slots.length > 0 ? receipt.ack(slots) : Promise.resolve();
    return durable.then(async () => {
      const outcomes = await projection;
      const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
      if (failed) throw failed.reason;
    });
  }
  /** The titles waiting for a write (owed, not in flight at their latest state, not parked behind an act's target). */
  pendingTitles(): string[] { return this.drain.pending(); }

  /**
   * Resolves once every hand the wiki raised before this call rests in the store. The wiki's own pending
   * `change` dispatch runs first, so every edit made so far has marked its title; the drain then answers for every
   * generation marked so far, and parallel-draft persistence runs to its end. A refusal among them rejects the
   * call. A test or a teardown asks this to rest every hand already marked.
   */
  async handsRested(): Promise<void> {
    await this.awaitWikiDispatch();
    const outcome = await this._drainNow();
    await Promise.allSettled([...this.surfacings]);
    if (outcome.kind === "failed") throw outcome.error;
  }

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

  /** True while a hand stands for the title: owed to the drain (a removal parked behind its target owes no hand), or sent and not yet landed. */
  holdsHand(title: string): boolean {
    return (this.drain.owes(title) && !this.drain.parked(title)) || this.sent.has(title);
  }

  /**
   * A landing in two halves (WaveLanding's `SliceLander`): `_prepareLanding` does every read that awaits (the composition's
   * answer for the title, its heads, the kahua shadow it casts); `_applyLanding` decides the hand and writes the wiki in one
   * synchronous call, so a slice of applies shares one wiki tick. Everything the hand decision reads (the drain, `sent`, the
   * ledger, the wiki's standing value, an act's removal) it reads at APPLY, so a hand typed while the slice prepared still
   * leaves ahead of the wave. A write of this shore's own that moved `sent` since the prepare declines the apply: the change
   * takes the whole road (`_landOne`), which resolves the composition afresh.
   */
  private async _prepareLanding(change: LarTiddlerChange): Promise<PreparedLanding> {
    const title = change.title;
    let heads = change.heads;
    let record = change.record;
    let bag = change.bag;
    let resolvedTop: { readonly bagId: string; readonly record: LarTiddlerRecord } | null | undefined;
    // THE WIKI SHOWS WHAT THE COMPOSITION RESOLVES: the topmost layer holding any record for the title, a
    // tombstone included (kāpae), never the emitting layer's record over a higher layer's.
    if (change.bag) {
      const resolved = await this.store.resolveLayered(title);
      resolvedTop = resolved;
      record = resolved?.record ?? null;
      bag = resolved?.bagId ?? change.bag;
      heads = resolved ? resolved.heads : this._headsOfBag(change.bag);
    }
    // A stopped shore lands nothing (the apply answers so), so it spends no shadow read either.
    const shadow = this.landing?.isStopped() ? undefined : await this._kahuaShadowFor(title, change.bag ? (resolvedTop ?? null) : undefined);
    return { record, bag, heads, shadow, sentHas: this.sent.has(title), sentValue: this.sent.get(title) };
  }

  /**
   * `landed` when the change landed (or had nothing to land); `hand` when a hand stands and must leave first; `stale` when an
   * own write moved `sent` since the prepare. Either of the last two writes nothing and takes `_landOne`.
   */
  private _applyLanding(change: LarTiddlerChange, prepared: PreparedLanding, handSettled: boolean): LandingVerdict {
    const title = change.title;
    const wiki = this.tw5.$tw.wiki;
    const envelopeHeads = change.heads;
    const { record } = prepared;
    let { bag, heads } = prepared;
    const entry = this.ledger.landedOf(title);
    if (bag === undefined) {
      bag = entry?.bag;
      if (heads === undefined) heads = entry?.heads;
    }
    const live = naluLands({ title, record });
    // The draft-base fields live in the store record; the wiki's draft never holds them.
    const applied = live ? { ...record!, tiddler: withoutDraftBase(record!.tiddler as Record<string, unknown>) } as LarTiddlerRecord : record;
    // THE NALU FORM the applier writes (`naluFieldsOf`): the value this landing would leave, compared with what stands. Wave zero
    // preloaded the seed through the same form and stood the books from it (`standFromSeed`), so no landing re-lands a preload.
    const incoming = live ? new this.tw5.$tw.Tiddler(naluFieldsOf({ title, record, ...(bag !== undefined ? { bag } : {}) })) : null;
    const standing = wiki.getTiddler(title) ?? null;
    const known = entry ? entry.tiddler : null;
    if (this.landing?.isStopped()) return "landed";
    // A marked title holds a hand even when its state has returned to the landed value: the flush decides
    // from the state at flush, and a write still in flight for it must be superseded before this wave lands.
    const marked = this.drain.owes(title) && !this.drain.parked(title);
    // A SHADOW CARRIES NO HAND. TiddlyWiki answers a plugin's shadow where the wiki holds no record of its
    // own; nobody wrote it and no wave landed it. A hand that reveals a shadow marks the title (the bridge
    // saves what the wiki shows), so an unmarked shadow meets a wave as an empty title does and the wave
    // lands over it.
    // AN ACT'S REMOVAL OWNS THE WIKI'S VIEW of its title until it leaves: a queued wave of the title's earlier write never lands it back.
    const removal = this.actRemovals.get(title);
    if (!handSettled && removal && this._removalStands(title, removal)) return "landed";
    const shadowOnly = standing !== null && typeof wiki.tiddlerExists === "function" && !wiki.tiddlerExists(title);
    const isHand = !handSettled
      && (marked || (!shadowOnly && !same(standing, known) && !(this.sent.has(title) && this.sent.get(title) === standing)));
    if (isHand) return "hand";
    // AN OWN WRITE MOVED SINCE THE PREPARE: the composition the prepare read misses it, so the wave never lands a stale answer over it.
    if (this.sent.has(title) !== prepared.sentHas || this.sent.get(title) !== prepared.sentValue) return "stale";
    const applies = !sameWithStamp(incoming, standing);
    if (applies) {
      if (!this.engineApply) throw new LandingDoorUnavailableError();
      this.engineApply({ ...change, record: applied, ...(bag !== undefined ? { bag } : {}) });
    }
    this.familyPlaced.delete(title);
    this.ledger.set(title, { tiddler: wiki.getTiddler(title) ?? null, ...(bag !== undefined ? { bag } : {}), ...(heads !== undefined ? { heads } : {}) });
    if (change.bag !== undefined && envelopeHeads !== undefined && envelopeHeads.length > 0) this._noteLanded(change.bag, envelopeHeads);
    this._learnDraft(title, live ? record : null, bag);
    this._applyKahuaShadow(title, prepared.shadow);
    this.sent.delete(title);
    this.handBase.delete(title);
    this.unlanded.delete(title);
    if (applies) this.lastWriteBag.delete(title);
    return "landed";
  }

  /** The single-change road: prepare and apply back to back, and where a hand stands, the hand leaves through the drain first. */
  private async _landOne(change: LarTiddlerChange, handSettled = false): Promise<void> {
    const title = change.title;
    const wiki = this.tw5.$tw.wiki;
    const verdict = this._applyLanding(change, await this._prepareLanding(change), handSettled);
    if (verdict === "landed") return;
    // An own write moved during the prepare: resolve afresh (the next prepare reads the moved `sent`).
    if (verdict === "stale") return this._landOne(change, handSettled);
    // The hand leaves through the drain ahead of the wave, never around the write in flight: the wave lands only once the hand's
    // own write answers, and a newer hand marked meanwhile goes first again.
    for (let pass = 0; pass < 8; pass++) {
      const outcome = await this._drainTitle(title);
      // A refused hand stays owed and carries the title's state on its next request; the wave never lands over it.
      if (outcome.kind === "failed") { if (this.drain.owes(title)) return; throw outcome.error; }
      const wrote = this.lastFlushWrote.get(title) === true;
      const latest = wiki.getTiddler(title) ?? null;
      const currentEntry = this.ledger.landedOf(title);
      const unsent = (this.drain.owes(title) && !this.drain.parked(title))
        || (!same(latest, currentEntry ? currentEntry.tiddler : null) && !(this.sent.has(title) && this.sent.get(title) === latest));
      if (wrote) {
        if (unsent) continue;
        return;
      }
      return this._landOne(change, true);
    }
  }

  /**
   * The "local draft over shared" stamp a landing of `title` owes, read at the prepare: the shadow it casts, null where none stands
   * (the stamp clears), undefined where no stamp applies (a title that never persists, a composition laying no kahua stage).
   */
  private async _kahuaShadowFor(title: string, resolved?: { readonly bagId: string; readonly record: LarTiddlerRecord } | null): Promise<KahuaShadow | null | undefined> {
    if (neverPersists(title)) return undefined;
    // A shadow stands only where the composition lays the kahua stage: a pool wiki (or any store composing no
    // `bags/kahua` layer) asks nothing per landing.
    if (typeof this.store.layerIndexOf !== "function" || this.store.layerIndexOf(KAHUA_BAG) === -1) return undefined;
    return kahuaShadowOf(this.store, title, resolved);
  }

  /**
   * Stamp or clear the "local draft over shared" record for a title the wave just landed: the temp-plane
   * stamp carries the kahua body the draft covers and exists only while a shadow stands on this device.
   */
  private _applyKahuaShadow(title: string, shadow: KahuaShadow | null | undefined): void {
    if (shadow === undefined) return;
    const wiki = this.tw5.$tw.wiki;
    const stamp = kahuaShadowTitle(title);
    if (!shadow) {
      if (wiki.getTiddler(stamp)) wiki.deleteTiddler(stamp);
      return;
    }
    this._addAlertIfChanged({ title: stamp, text: shadow.shared, "draft-bag": shadow.draftBag, "shadow-of": title });
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
   * Whether a save of `title` would land in a layer this composition mounts (at or above its working layer), asked without
   * raising anything: a probe stands no alert and writes no console line. A caller that opens engine-local state (the
   * island's own default story) asks first, so a composition with no layer for that state keeps it in the engine and
   * never owes a save it cannot make.
   */
  routesSave(title: string): boolean {
    try { return this._settle(title, this._routeBag(title), true) !== null; }
    catch (err) { if (err instanceof UnroutedSaveRefusal) return false; throw err; }
  }

  /**
   * Hold `title`'s present wiki value as landed with no bag: the engine keeps it, no store hears it, and the bridge reads the
   * notification the write raised as foam, so no save stands owed. Called in the same synchronous turn as the write, before
   * TW5 dispatches its `change`. A title a hand already holds stays with that hand.
   */
  keepInEngine(title: string): void {
    if (this.holdsHand(title)) return;
    this.ledger.set(title, { tiddler: this.tw5.$tw.wiki.getTiddler(title) ?? null });
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
  private _settle(title: string, verdict: RouteVerdict, probe = false): SlotUri | null {
    // A PROBE ASKS WHERE A SAVE WOULD LAND and raises nothing: the refusal it throws stands on no alert rail and in no console.
    const refuse = (rule: string, reference: string, why?: string): UnroutedSaveRefusal =>
      probe ? new UnroutedSaveRefusal(title, rule, reference, why) : this._refuseUnrouted(title, rule, reference, why);
    if (verdict.kind === "withheld") {
      const reference = ROUTES_BY_REFERENCE.exec(verdict.rule)?.[1];
      if (reference === undefined) return null;
      throw refuse(verdict.rule, reference);
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
      if (!probe) console.warn(
        `[island-adaptor] no cascade rule routes "${title}" (${verdict.why}) — ` +
        (fallback ? `writing to the write layer ${fallback}. ` : "and no write layer resolves. ") +
        `Add a rule to ${BAG_PATHS_CONFIG}; a save must never vanish for want of one.`,
      );
      rule = `(no rule: ${verdict.why})`;
      reference = CURRENT_WIKI_BAG;
      if (!fallback) throw refuse(rule, reference);
      uri = fallback;
    }
    const working = this.store.defaultWritableBagId();
    if (!working && reference === CURRENT_WIKI_BAG) throw refuse(rule, reference, "this wiki mounts no working layer");
    const index = this.store.layerIndexOf(uri);
    if (index < 0) throw refuse(rule, reference, `it names ${uri}, a bag this wiki does not mount`);
    if (working && index < this.store.layerIndexOf(working)) {
      throw refuse(rule, reference, `it names ${uri}, a layer beneath this wiki's working layer; a bag changes only by a residency move`);
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
  private _saveBag(title: string, probe = false): SlotUri | null {
    const routed = this._settle(title, this._routeBag(title), probe);
    if (routed === null) return null;
    const lives = this.lastWriteBag.get(title) ?? this.ledger.landedOf(title)?.bag;
    const working = this.store.defaultWritableBagId();
    if (!lives || !working || !this._holdsRecord(lives, title)) return routed;
    const livesAt = this.store.layerIndexOf(lives);
    return livesAt >= this.store.layerIndexOf(working) && livesAt > this.store.layerIndexOf(routed) ? lives as SlotUri : routed;
  }

  /**
   * Where a hand's save of `title` would land, asked as a probe: no alert stands and no console line prints. Null where the
   * cascade routes the title to no layer this composition mounts (a save of it would refuse). A writer that lands words on
   * a person's behalf (the stand-off keeper) asks first, and writes only where the save lands in the bag it means.
   */
  saveBagOf(title: string): SlotUri | null {
    try { return this._saveBag(title, true); }
    catch (err) { if (err instanceof UnroutedSaveRefusal) return null; throw err; }
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
   * A redelivery (the store's debounced re-read of a write it already fired) acknowledges nothing: it still lands as a wave.
   */
  private _noteOwnWrite(change: LarTiddlerChange): void {
    if (change.redelivery) return;
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
   * A late layer's replay and live changes share the shore queue and its host-task slices.
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
   * conflicted field live) is the live record, so it is never copied. A disk stand-off's drafts arrive by
   * another road (the keeper's own wiki writes, `@lararium/node` standoff-drafts). A surfacing ON the draft bag itself persists nothing —
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
    this._standSyncedRows();
    if (typeof this.store.addProjection === "function") {
      this._unsubscribe = this.store.addProjection(this);
    } else {
      this._unsubscribe = this.store.subscribe((change) => this.onUriChanged(change));
    }
    return () => this.stop();
  }

  /**
   * `submitted` fires once the shore will ask the vessel for no further receipt: every owed write has submitted, every removal behind a
   * target has followed its target's receipt, and every act's receipt ask has left. The kernel then sends `receipt:asks-done`.
   * Resolves with the titles that never reached durable storage (a refused write or receipt), by name; an empty list means every
   * owed title rests.
   */
  async stop(submitted?: () => void): Promise<string[]> {
    await this.landing?.stop();
    // An act whose dispatch end never reached the shore rests with the drain like any other: its receipt asks before the door shuts.
    if (this.actHolds.length > 0) this.dispatchEnded();
    // The drain closes: every owed title leaves, a title refused before the close tries once more, and a failure answers by name rather
    // than hanging. A demanded title whose receipt refuses after `receipt:asks-done` writes again but can ask nothing (the vessel has
    // closed its receipts): it ends owed and unsaved by name.
    const closing = this._drainNow(true);
    if (submitted) void this._whenSubmitted().then(submitted);
    await closing;
    await Promise.allSettled([...this.surfacings]);
    for (const [title, error] of this.failedAtTeardown) console.warn(`[island-adaptor] teardown write for "${title}" failed: ${String(error)}`);
    // A title the closed drain still holds never rested (its write or its receipt refused, or a removal behind a refused target).
    const unsaved = [...new Set([...this.failedAtTeardown.keys(), ...this.drain.titles()])].filter((title) => !neverPersists(title));
    this.failedAtTeardown.clear();
    // The door leaves with the shore that installed it, and only that one.
    const lares = (this.tw5.$tw as unknown as LaresTw5Extension).lares;
    if (lares && this.door !== null && lares.enqueueNalu === this.door) delete lares.enqueueNalu;
    this.door = null;
    this.landing = null;
    this.engineApply = null;
    // A stopped shore holds no account of the wiki: a restart stands its rows afresh from the wiki (`start`), so no stale
    // landed value reads a later change as foam.
    this.ledger.clear();
    this.landedHeads.clear();
    this.sent.clear();
    this.handBase.clear();
    this.lastWriteBag.clear();
    this.recoveryWrites.clear();
    this.unlanded.clear();
    this.draftSnapshots.clear();
    this.actRemovals.clear();
    this.actHolds.length = 0;
    // A restarted shore drains through a fresh drain.
    this.drain = this._newDrain();
    this._unsubscribe?.();
    this._unsubscribe = null;
    return unsaved;
  }

  /** The closed drain's last write has submitted and no act's receipt ask waits to leave; a receipt answer that frees new work asks again. */
  private async _whenSubmitted(): Promise<void> {
    for (;;) {
      await this.drain.whenSubmitted();
      await this.caps.receipt?.asked();
      if (this.drain.submittedNow()) return;
    }
  }

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

  /**
   * Keep the heads of the last change this shore landed for `bag`. The landing queue lands waves in the order the
   * store raised them, so the latest landing carries the latest heads; the note costs one map write per landing,
   * and the causal comparison waits for a settle word's look (`landedCovers`).
   */
  private _noteLanded(bag: string, heads: readonly string[]): void {
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
    if (source.bag === dest) {
      // A failed hand may outlive a MOVE that hard-removes its original record.
      if (!this.unlanded.has(title) && this.failedAtTeardown.has(title) && !this._holdsRecord(source.bag, title) && this._sourceMoved(title, source.bag, source.heads)) return { moved: source.bag };
      return source.heads.length > 0 ? { base: source.heads } : {};
    }
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
    this.draftSnapshots.set(title, structuredClone(fields));
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
    if (!fields || !of) { this.draftBook.delete(title); this.draftSnapshots.delete(title); return; }
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
   * The act registers its writes through the drain and starts an idle pump inside this call, so the target
   * leaves in the turn of the dispatch. The answer names the titles the act took, so the per-title loop skips them.
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
      this._act(draftTitle, entry, saves, target, rename, members);
    }
    // A discrete act starts its own writes, whoever owns the dispatch's clock.
    if (consumed.size > 0) this.drain.kick();
    return consumed;
  }

  /**
   * THE SAVE ORDER (operator ruling 2026-11-04): the target family leaves first and must be DURABLY acknowledged (the receipt capability's heads
   * ack from the vessel's storage-backed Repo); only then do the draft and a rename's source leave. Each removal rides a dependency edge
   * on the target's generation, so a refused target keeps the store copy of the draft (the recovery copy) and its removal waits for the
   * target's next acknowledged write. The act writes nothing itself: it marks.
   */
  private _act(draftTitle: string, entry: DraftEntry, saves: boolean, target: string, rename: boolean, members: readonly string[]): void {
    const wiki = this.tw5.$tw.wiki;
    const hold = this.caps.receipt?.begin();   // in the turn of the dispatch, so the act's result can wait
    if (hold) this.actHolds.push({ hold, members });
    for (const member of members) this.handed.delete(member);
    let targetGeneration = 0;
    const draftBase = entry.baseBag ? { bag: entry.baseBag, heads: entry.baseHeads } : undefined;
    const behind = (title: string): number => targetGeneration > 0 ? this.drain.markAfter(title, target, targetGeneration) : this.drain.mark(title);
    try {
      // A title that never persists (the volatile plane, the alert rail) takes no store call as a member.
      if (saves && !neverPersists(target)) {
        const dest = this._saveBag(target);
        if (dest !== null) {
          const landed = this.ledger.landedOf(target);
          const standsAtY = rename && landed?.tiddler != null && landed.bag !== undefined && landed.heads !== undefined;
          // A save builds on the draft-open base, a rename onto a standing title on that title's landed base; a retry keeps it.
          const from = standsAtY ? { bag: landed!.bag!, heads: landed!.heads! } : draftBase;
          if (from) this.handBase.set(target, from);
          targetGeneration = this.drain.mark(target);
        }
      }
      if (rename && members.includes(entry.of) && !wiki.getTiddler(entry.of) && !neverPersists(entry.of)) {
        const standing = this.ledger.landedOf(entry.of);
        const stood = (standing?.tiddler ?? null) !== null || (this.sent.has(entry.of) && this.sent.get(entry.of) !== null);
        const landedBag = stood ? this.lastWriteBag.get(entry.of) ?? standing?.bag ?? entry.baseBag : undefined;
        if (landedBag) {
          const bag = this._tombstoneBag(entry.of, landedBag);
          const base = bag === entry.baseBag ? entry.baseHeads : standing?.bag === bag ? standing.heads : undefined;
          this.actRemovals.set(entry.of, { bag, base: base && base.length > 0 ? base : undefined, target, targetGeneration, before: standing?.tiddler ?? null, source: true });
          behind(entry.of);
        }
      }
      const bag = entry.bag ?? this.ledger.landedOf(draftTitle)?.bag ?? this.handBase.get(draftTitle)?.bag;
      const snapshot = this.draftSnapshots.get(draftTitle);
      if (this._reachedStore(draftTitle) && bag) {
        const draftBag = this._tombstoneBag(draftTitle, bag);
        this.actRemovals.set(draftTitle, { bag: draftBag, base: this._handBaseFor(draftTitle, draftBag), target, targetGeneration, before: null, source: false });
        behind(draftTitle);
      } else if (!this._reachedStore(draftTitle) && snapshot && bag && targetGeneration > 0) {
        // The draft never reached the store before the save dispatch: its recovery copy leaves first, its removal behind the target after.
        const { "$origin-bag": _originBag, ...persisted } = snapshot;
        const recovery = toLarTiddlerRecord({ ...withoutDraftBase(persisted), ...draftBaseFields(entry), title: draftTitle });
        this.actRemovals.set(draftTitle, { bag, base: this._handBaseFor(draftTitle, bag), target, targetGeneration, before: null, source: false, recovery });
        this.drain.mark(draftTitle);
      } else {
        // Nothing of the draft stands in the store: the act supersedes whatever it still owed.
        this._clearUnsaved(draftTitle);
        this.drain.forget(draftTitle);
        this.draftBook.delete(draftTitle);
        this.draftSnapshots.delete(draftTitle);
      }
    } catch (error) {
      // A refused route stands on the alert rail; the member stays owed so the next request meets the same refusal by name.
      if (!(error instanceof UnroutedSaveRefusal)) console.warn(`[island-adaptor] act on "${draftTitle}" faulted: ${String(error)}`);
      if (saves && targetGeneration === 0 && !neverPersists(target)) this.drain.mark(target);
    }
  }

  /** True while an act's removal still stands for `title`: the wiki holds no newer hand of it than the value the act took. */
  private _removalStands(title: string, removal: ActRemoval): boolean {
    const current = this.tw5.$tw.wiki.getTiddler(title);
    return !current || (removal.before !== null && same(current, removal.before));
  }

  /** TW5 removed a rename's source optimistically; the wiki shows it again while its removal waits or after its refusal. */
  private _restoreSource(title: string, removal: ActRemoval): void {
    const wiki = this.tw5.$tw.wiki;
    if (!removal.source || removal.before === null || wiki.getTiddler(title)) return;
    wiki.addTiddler(removal.before as Parameters<typeof wiki.addTiddler>[0]);
  }

  /** A target's write was refused: every rename source waiting behind it returns to the wiki. */
  private _restoreSourcesOf(target: string): void {
    for (const [title, removal] of this.actRemovals) if (removal.target === target) this._restoreSource(title, removal);
  }

  /**
   * An act's removal leaves: one `writeFamily` tombstone in the removal's bag at the act's base (a draft that never reached the store
   * first leaves its recovery copy, then its removal waits behind the target). Its acknowledgement clears the source from the wiki with
   * its slot children; its refusal keeps the source in the wiki and the title owed, named on the rail under itself and its target.
   */
  private async _flushRemoval(title: string, removal: ActRemoval): Promise<void> {
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId, ...this._handFace(title) };
    const ackBefore = this.writeAcks.get(title) ?? 0;
    if (removal.recovery) {
      try { await this._issueGroup(removal.bag, this._handBaseFor(title, removal.bag), [removal.recovery], [], origin); }
      catch (error) {
        this.failedAtTeardown.set(title, error);
        this._raiseUnsaved(title, removal.bag, error);
        throw error;
      }
      delete removal.recovery;
      this.lastWriteBag.set(title, removal.bag);
      if ((this.writeAcks.get(title) ?? 0) > ackBefore) this.unlanded.add(title);
      this.lastFlushWrote.set(title, true);
      this.drain.markAfter(title, removal.target, removal.targetGeneration);
      return;
    }
    this.sent.set(title, null);
    try { await this._issueGroup(removal.bag, removal.base, [], [title], origin); }
    catch (error) {
      this.sent.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.set(title, error);
      this._raiseUnsaved(title, removal.bag, error);
      if (removal.source) {
        this._raiseUnsaved(removal.target, removal.bag, error);
        this._restoreSource(title, removal);
      }
      throw error;
    }
    const acknowledged = (this.writeAcks.get(title) ?? 0) > ackBefore;
    if (this.actRemovals.get(title) === removal) this.actRemovals.delete(title);
    this.lastFlushWrote.set(title, acknowledged);
    this.lastWriteBag.set(title, removal.bag);
    if (acknowledged) this.unlanded.add(title); else this.sent.delete(title);
    this.recoveryWrites.set(title, { bag: removal.bag, fields: null });
    this.failedAtTeardown.delete(title);
    this._clearUnsaved(title);
    this.draftBook.delete(title);
    this.draftSnapshots.delete(title);
    if (!removal.source) return;
    this._clearUnsaved(removal.target);
    const wiki = this.tw5.$tw.wiki;
    // A newer hand of the source made meanwhile stands: it leaves as its own owed title, slots and all.
    if (!this._removalStands(title, removal)) return;
    // THE SLOTS FOLLOW THEIR ROOT. The source left for its target, durably acknowledged (the save order): each
    // slot still beneath the source address re-titles under the target, its body untouched, and its source title
    // leaves as a hand's own delete. Where no target stands the slots stay as they stand: orphans,
    // kept and flagged, never dropped.
    if (wiki.getTiddler(removal.target)) retitleSlotsInWiki(wiki as unknown as FamilyRenameWiki, title, removal.target);
    if (wiki.getTiddler(title)) wiki.deleteTiddler(title);
  }

  /** One `writeFamily` call for one (bag, base); a base outside the document's history retries without it. */
  private _issueGroup(bag: string, base: readonly string[] | undefined, puts: LarTiddlerRecord[], deletes: string[], origin: ChangeOrigin, retracts: readonly string[] = []): Promise<void> {
    const named = retracts.length > 0 ? { retracts } : {};
    return this.store.writeFamily(puts, deletes, origin, { bag: bag as SlotUri, ...(base ? { base } : {}), ...named }).catch(async (error: unknown) => {
      if (!base || !(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
      console.warn(`[island-adaptor] retrying a write to ${bag} without unavailable base`);
      await this.store.writeFamily(puts, deletes, origin, { bag: bag as SlotUri, ...named });
    });
  }

  /**
   * HOW A HAND'S DELETE LEAVES (operator ruling 2026-11-20: a kāpae is needed only where a record beneath would otherwise
   * surface). Each member of the delete splits by its own layers: a member with a live record in a layer beneath `bag`
   * leaves as a tombstone that keeps that record hidden (the browser's delete of a canon tiddler stays gone); any other
   * member retracts to absent from `bag`, so no tombstone rises over nothing. A layer beneath `bag` this composition could
   * not read (a recipe slot the composer skipped, a stand-in for an unread document: `unknownBeneath`) counts as holding
   * every member, since another face's composition of the same recipe reads what it holds.
   */
  private async _leavesAs(bag: string, members: readonly string[]): Promise<{ tombstones: string[]; retracts: string[] }> {
    if (this.store.unknownBeneath?.(bag)) return { tombstones: [...members], retracts: [] };
    const at = this.store.layerIndexOf(bag);
    const tombstones: string[] = [];
    const retracts: string[] = [];
    for (const member of members) {
      const lower = (await this.store.resolveAll(member)).some((row) => this.store.layerIndexOf(row.bagId) < at);
      (lower ? tombstones : retracts).push(member);
    }
    return { tombstones, retracts };
  }

  // ---------------------------------------------------------------------------
  // The per-title flush
  // ---------------------------------------------------------------------------

  /** Whether the last finished flush of each title had its own write acknowledged. */
  private readonly lastFlushWrote = new Map<string, boolean>();

  /** True when the wiki's state for a slot child carries the persisted fields the family call put for it. */
  private _matchesPlaced(placed: LarTiddlerRecord, state: unknown): boolean {
    const { "$origin-bag": _bag, ...fields } = extractFields(this.tw5, state);
    const put = placed.tiddler as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(fields), ...Object.keys(put)]);
    for (const key of keys) {
      if (Object.hasOwn(fields, key) !== Object.hasOwn(put, key) || String(fields[key]) !== String(put[key])) return false;
    }
    return true;
  }

  /** The drain's write of one title: its state at flush leaves (an act's standing removal leaves as its tombstone). */
  private async _flushHand(title: string): Promise<void> {
    const removal = this.actRemovals.get(title);
    if (removal) {
      if (this._removalStands(title, removal)) return this._flushRemoval(title, removal);
      // A later hand supersedes the act's removal: the title's own state leaves.
      this.actRemovals.delete(title);
    }
    // ABSOLUTE STATE: what leaves is the title's state at flush. A caller that handed a value the wiki does
    // not hold (`handed`) is the one exception, and its value stands in for the wiki's.
    const state = this.handed.has(title) ? this.handed.get(title)! : this.tw5.$tw.wiki.getTiddler(title) ?? null;
    // A state equal to what the last wave landed, with nothing sent since, owes the store nothing: the hand
    // returned to the landed value inside its window. A title the store never saw and the wiki does not
    // hold raises no tombstone. A state identical to the value already sent owes nothing either.
    const landed = this.ledger.landedOf(title);
    // The ledger never answers for a title this shore wrote whose wave has not landed: there the state leaves and the store decides.
    const placed = this.familyPlaced.get(title);
    const placedByFamily = placed !== undefined && state !== null && this._matchesPlaced(placed, state);
    const settled = placedByFamily || (this.sent.has(title)
      ? this.sent.get(title) === state
      : !this.unlanded.has(title) && same(state, landed ? landed.tiddler : null));
    if (!placedByFamily) this.familyPlaced.delete(title);
    if (settled) {
      this.handFaces.delete(title);
      if (this.handed.get(title) === state) this.handed.delete(title);
      if (!this.sent.has(title)) this.handBase.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.delete(title);
      this._clearUnsaved(title);
      return;
    }
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId, ...this._handFace(title) };
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
        this.lastFlushWrote.set(title, false);
        return;
      }
      writeBag = dest;
      // The base, and the cross-bag read behind it, are settled immediately before the write is issued.
      const plan = this._basePlan(title, dest);
      this.sent.set(title, state);
      if (plan.moved !== undefined) {
        if (this.handed.get(title) === state) this.handed.delete(title);
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
        this.lastFlushWrote.set(title, false);
        return;
      }
      const bag = this._tombstoneBag(title, landedBag);
      writeBag = bag;
      this.sent.set(title, null);
      const base = this._handBaseFor(title, bag);
      // THE FAMILY LEAVES AS ONE CHANGE. A record's delete takes every component beneath it: root and slots
      // ride one `writeFamily`, so no peer ever reads a dead root over live children. A title that holds
      // no component leaves as the single tombstone it always was.
      const leaving = this._leavingWith(title, bag);
      for (const rider of leaving.riders) this.sent.set(rider.uri, null);
      const issued = this._leavesAs(bag, [title, ...leaving.riders.map((rider) => rider.uri)]).then((leaves) => leaving.riders.length > 0 || leaves.retracts.length > 0
        ? this._issueGroup(bag, base, [], leaves.tombstones, origin, leaves.retracts)
        : this.store.tombstoneInBag(bag, title, origin, base ? { base } : undefined)
          .catch(async (error: unknown) => {
            if (!(error instanceof Error) || !error.message.includes("requested base contains heads outside this document history")) throw error;
            console.warn(`[island-adaptor] retrying "${title}" without unavailable base`);
            await this.store.tombstoneInBag(bag, title, origin);
          }));
      task = issued.then(
        () => { this._settleLeaving(leaving, bag); },
        (error: unknown) => { this._returnLeaving(leaving, bag, error); throw error; },
      );
    }
    try {
      await task;
      if (writeBag && this.receiptRequired && !this.caps.receipt) throw new ReceiptCapabilityUnavailable();
      // The store took this state for `writeBag`: the title's state stands there, by this write or because
      // an equal state already stood (a noop). A noop fires no envelope, so no return wave lands over `sent`
      // and none clears `unlanded`: only an acknowledged write stands ahead of the ledger.
      const acknowledged = (this.writeAcks.get(title) ?? 0) > ackBefore;
      // The write of this hand stood: the face it wore leaves with it, and the title's next hand names its own.
      if (origin.face !== undefined && this.handFaces.get(title) === origin.face) this.handFaces.delete(title);
      this.lastFlushWrote.set(title, acknowledged);
      if (writeBag) this.lastWriteBag.set(title, writeBag);
      if (acknowledged) this.unlanded.add(title);
      else this.sent.delete(title);
      if (this.handed.get(title) === state) this.handed.delete(title);
      this.failedAtTeardown.delete(title);
      this._clearUnsaved(title);
      if (state === null && writeBag) {
        this.recoveryWrites.set(title, { bag: writeBag, fields: null });
        this.draftBook.delete(title);
      }
    } catch (error) {
      // The title stays owed in the drain, so the next change, wave or teardown tries again;
      // no timer is armed, because a timer would decide when the refusal ends.
      this.sent.delete(title);
      this.lastFlushWrote.set(title, false);
      this.failedAtTeardown.set(title, error);
      this._raiseUnsaved(title, writeBag, error);
      throw error;
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

  /**
   * NAME THE FACE THE NEXT HAND OF `title` WEARS: a tool door that lands a record through the wiki calls this before its
   * `addTiddler` (or `deleteTiddler`). `undefined` clears it, so a hand no session made rides the engine's actor.
   */
  wearNext(title: string, face: string | null | undefined): void {
    if (face === undefined) this.handFaces.delete(title);
    else this.handFaces.set(title, face);
  }

  /** The origin field naming the face the title's pending hand wore, or nothing. */
  private _handFace(title: string): { readonly face?: string | null } {
    return this.handFaces.has(title) ? { face: this.handFaces.get(title)! } : {};
  }

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

    // The wiki showing a rename's source again while its removal waits is no newer hand: the removal stays owed.
    const removal = this.actRemovals.get(title);
    if (removal && removal.before !== null && same(tiddler, removal.before)) return this._answer(title);
    if (!this.drain.owes(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    // A mark names the title; the flush reads the wiki. Only a value the wiki does not hold rides pinned.
    if ((this.tw5.$tw.wiki.getTiddler(title) ?? null) === tiddler) this.handed.delete(title);
    else this.handed.set(title, tiddler);
    return this._answer(title, this.drain.mark(title));
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
    if (!this.drain.owes(title) && !this.handBase.has(title)) {
      const entry = this.ledger.landedOf(title);
      if (entry?.bag && entry.heads) this.handBase.set(title, { bag: entry.bag, heads: entry.heads });
    }
    if (this.tw5.$tw.wiki.getTiddler(title)) this.handed.set(title, null);
    else this.handed.delete(title);
    return this._answer(title, this.drain.mark(title));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** True while the wiki holds `uri`, or the last wave landed it live. */
  private _stands(uri: string): boolean {
    return this.tw5.$tw.wiki.getTiddler(uri) !== undefined || (this.ledger.landedOf(uri)?.tiddler ?? null) !== null;
  }

  /** The wiki as the one family law reads it (`@lararium/mesh/family`); the engine's own field index answers the parent edges. */
  private _familyView(): FamilyView {
    const wiki = this.tw5.$tw.wiki;
    return wikiFamilyView(wiki as never, {
      childrenOf: (parent) => wiki.filterTiddlers(`[field:$fragment-parent[${parent}]]`) as string[],
    });
  }

  private _childUrisOf(parentUri: string): string[] {
    return [...this._familyView().childrenOf!(parentUri)];
  }

  /** True where the last wave landed `uri` beneath `top`: its landed parent edges climb to it. */
  private _landedBeneath(uri: string, top: string): boolean {
    let cur = uri;
    for (let hops = 0; hops < 64; hops++) {
      const landed = this.ledger.landedOf(cur)?.tiddler as { fields?: Record<string, unknown> } | null | undefined;
      const parent = landed?.fields?.["$fragment-parent"];
      if (typeof parent !== "string" || parent === "") return false;
      if (parent === top) return true;
      cur = parent;
    }
    return false;
  }

  /**
   * WHAT LEAVES WITH A TITLE (the one family law, `@lararium/mesh/family`): every component beneath it. A
   * component the wiki still holds (the delete named the root alone) and a component the wiki already
   * dropped and still owes the store (the meme door removed the family title by title) both ride the
   * title's own change, where the router lands their tombstone in the same bag. A component whose tombstone
   * lands in another layer leaves `apart`, on its own road: cross-bag atomicity cannot exist.
   */
  private _leavingWith(title: string, bag: string): Leaving {
    const wiki = this.tw5.$tw.wiki;
    const riders: LeavingRider[] = [];
    const apart: string[] = [];
    const routed = (uri: string): string | null => {
      try { return this._tombstoneBag(uri, this.lastWriteBag.get(uri) ?? (this.ledger.landedOf(uri)?.bag as string | undefined) ?? bag); }
      catch (error) { if (error instanceof UnroutedSaveRefusal) return null; throw error; }
    };
    for (const uri of edgeDescendantsOf(this._familyView(), title)) {
      if (neverPersists(uri) || this.sent.has(uri)) continue;
      if (routed(uri) === bag) riders.push({ uri, acks: this.writeAcks.get(uri) ?? 0, standing: true });
      else apart.push(uri);
    }
    const prefix = `${rootAddressOf(title)}#`;
    for (const uri of this.drain.titles()) {
      if (uri === title || !uri.startsWith(prefix) || this.handed.has(uri) || this.sent.has(uri) || this.actRemovals.has(uri)) continue;
      if (wiki.getTiddler(uri) || !this.ledger.landedOf(uri)?.tiddler || !this._landedBeneath(uri, title)) continue;
      if (routed(uri) === bag) riders.push({ uri, acks: this.writeAcks.get(uri) ?? 0, standing: false });
    }
    return { riders, apart };
  }

  /** The family's change landed: the wiki drops each member it still holds, and each rider reads as written. */
  private _settleLeaving(leaving: Leaving, bag: string): void {
    const wiki = this.tw5.$tw.wiki;
    for (const rider of leaving.riders) {
      this.lastWriteBag.set(rider.uri, bag);
      this.recoveryWrites.set(rider.uri, { bag, fields: null });
      if (rider.standing && wiki.getTiddler(rider.uri)) wiki.deleteTiddler(rider.uri);
      // A member the store took as a noop raises no envelope, so no return wave will clear its `sent`.
      if ((this.writeAcks.get(rider.uri) ?? 0) === rider.acks && this.sent.get(rider.uri) === null && !rider.standing) this.sent.delete(rider.uri);
    }
    // A member another layer holds leaves through its own delete: the router shadows it from where its save would land.
    for (const uri of leaving.apart) if (wiki.getTiddler(uri)) wiki.deleteTiddler(uri);
  }

  /** The family's change was refused: each rider returns to its own owed road. */
  private _returnLeaving(leaving: Leaving, bag: string, error: unknown): void {
    for (const rider of leaving.riders) {
      if (this.sent.get(rider.uri) !== null) continue;
      this.sent.delete(rider.uri);
      if (rider.standing) continue;
      this.drain.mark(rider.uri);
      this._raiseUnsaved(rider.uri, bag, error);
    }
  }

  /**
   * Write a saved tiddler to the store as its meme FAMILY: the root, the slot children its body
   * splits into (Path H auto-split), and the tombstones of the children it leaves undeclared.
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
    // The family call carries these children: a later flush of a child whose wiki state matches the record the family put owes the
    // store nothing, so a carrier placed across several change batches leaves its children once, with the root.
    for (const record of puts) if (record.tiddler.title !== title) this.familyPlaced.delete(record.tiddler.title);

    // A PLACED ROOT CARRIES ITS MARKED SLOTS. The flush reads the wiki's state, and a root the wiki already
    // holds in placed form splits into no children: its slot children stand as their own wiki tiddlers, each
    // with its own mark. They ride this family so the root and its slots still land as one change: a marked
    // child the wiki holds joins the puts, a marked child the wiki dropped joins the tombstones, and each
    // reads as sent so its own flush finds nothing left to write.
    const rode: Array<{ uri: string; value: unknown | null; acks: number }> = [];
    if (!split && title.indexOf("#") < 0 && fields["draft.of"] === undefined) {
      const wiki = this.tw5.$tw.wiki;
      const marked = (uri: string): boolean => this.drain.owes(uri) && !this.handed.has(uri);
      let beneath: Set<string> | undefined;
      // Slot children carry the root's address plus a fragment, so the marked titles alone name them.
      for (const uri of this.drain.titles()) {
        if (!uri.startsWith(`${title}#`) || !marked(uri)) continue;
        const entry = this.ledger.landedOf(uri);
        if (((entry?.bag as SlotUri | undefined) ?? targetBag) !== targetBag) continue;
        const standing = wiki.getTiddler(uri) as { fields?: Record<string, unknown> } | undefined;
        if (standing) {
          // A component at any depth rides its root's change (the one family law reads the parent edges).
          beneath ??= new Set(edgeDescendantsOf(this._familyView(), title));
          if (!beneath.has(uri)) continue;
          const { "$origin-bag": _slotOrigin, ...persistedSlot } = extractFields(this.tw5, standing);
          puts.push(toLarTiddlerRecord({ ...withoutDraftBase(persistedSlot), title: uri }));
          rode.push({ uri, value: standing, acks: this.writeAcks.get(uri) ?? 0 });
        } else if (entry?.tiddler) {
          // A dropped child is a hand's delete: it rides this family only where the router lands it in this
          // bag. Anywhere else its own flush carries it, through the same router.
          let chosen: string;
          try { chosen = this._tombstoneBag(uri, targetBag); } catch (error) { if (error instanceof UnroutedSaveRefusal) continue; throw error; }
          if (chosen !== targetBag) continue;
          if (!tombstones.includes(uri)) tombstones.push(uri);
          rode.push({ uri, value: null, acks: this.writeAcks.get(uri) ?? 0 });
        }
      }
      for (const member of rode) this.sent.set(member.uri, member.value);
    }

    try {
      await this.store.writeFamily(puts, tombstones, origin, { bag: targetBag, ...(base ? { base } : {}) });
      const written = puts.find((record) => record.tiddler.title === title);
      if (written) this.recoveryWrites.set(title, { bag: targetBag, fields: structuredClone(written.tiddler) });
      for (const { uri, slot } of strays) {
        // A refused stray already has its own absent hand; that hand owns its retry.
        if (this.drain.owes(uri) && this.handed.has(uri) && this.handed.get(uri) === null) continue;
        try { await this.store.tombstoneInBag(slot, uri, origin); }
        catch (strayError) {
          // Owed as absent: its own hand retries the tombstone though the wiki still holds the orphan at its landed value.
          this.handed.set(uri, null);
          this.failedAtTeardown.set(uri, strayError);
          this._raiseUnsaved(uri, slot, strayError);
          this.drain.mark(uri);
        }
      }
    } catch (error) {
      for (const member of rode) {
        if (this.sent.get(member.uri) !== member.value) continue;
        this.sent.delete(member.uri);
        this.drain.mark(member.uri);
        this._raiseUnsaved(member.uri, targetBag, error);
      }
      for (const record of puts) if (record.tiddler.title !== title) this.familyPlaced.delete(record.tiddler.title);
      throw error;
    }
    for (const record of puts) if (record.tiddler.title !== title) this.familyPlaced.set(record.tiddler.title, record);
    // A member the store took as a noop raises no envelope, so no return wave will clear its `sent`.
    for (const member of rode) {
      if ((this.writeAcks.get(member.uri) ?? 0) === member.acks && this.sent.get(member.uri) === member.value) this.sent.delete(member.uri);
    }
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
