/**
 * LarDiskProjector — bag-aware unidirectional projection: store → disk.
 *
 * Co-projection model: the operator's mind
 * originates; the disk carrier and the CRDT record-set both PROJECT that
 * origin, each in its native grain — disk holds whole markdown memes, the
 * doc holds tid-sized records, the VM decomposes for transclusion. Merge
 * authority routes through the CRDT alone; this projector renders the disk
 * co-projection and never INGESTS from disk — that direction belongs to the
 * ingest path (file watcher → store.put). It does READ disk, for one purpose
 * only: the Confluence gate below needs to know what the operator's hands left
 * there before it is allowed to write over it. A read that decides whether to
 * write is not an ingest — no disk byte ever reaches a record through here.
 *
 * Bag-aware: each writable bag may opt into a filesystem mirror via
 * BagMirrorConfig. Bags without a mirror config never write to disk. The two
 * projection surfaces split by bag role (see api/lararium/disk-projection):
 *   - wiki content (@<slug>)      → `wikis/{slug}/...`   (projection / output)
 *   - seed/canon bags (lares/lararium/sdm) → `bags/NAME/...` (seed / canon)
 * State/runtime bags (personal/draft/temp/daemon) carry no ordinary mirror; a recovery-class grant projects a draft
 * bag under `recovery/`, and a consented user temp layer under `temp/` (internal volatile state barred by namespace).
 * A residency MOVE (the canon ACTION verb)
 * that relocates a tiddler between bags has the disk side effect of a file move
 * between surfaces; the git diff IS the operator's signature on the change.
 *
 * Projection law (Fontany-Fuller-Zelenka):
 *   Disk projection RENDERS, never string-copies. The ONE render shore
 *   (`carrierFileFn`, the VM's `exportCarrierFile`) hands back the carrier's own
 *   filetype: a memetic carrier recomposes to `.mem` (expandMemeRefs over its
 *   group), any other TW5 filetype rides the file-info cascade to its native
 *   file (+ a `.meta` sidecar where the type needs one). The VM registry decides
 *   type + extension + bytes; the projector only sites at `<uri-path><ext>`.
 *
 * Siting precedence (every title, not only the `lar:` family): a `$:/config/FileSystemPaths` RULE,
 * else the LOCI law for a `lar:///w.w.w/…` name, else TW5's FLATTENED default — the file a stock
 * folder wiki would write for a title that owns no uri-path (`My Notes`, `$:/config/Foo`). Only the
 * flattened branch can collide, so only it walks `uniquifyBase`'s free-or-mine uniquifier.
 *
 * Group routing (carrier-whole at rest, disk-projection#projection-routing):
 *   memetic-wikitext records form a FAMILY keyed by the carrier root, read by the one
 *   family law (`@lararium/mesh/family`). A child change climbs its parent edges to the
 *   root; the gate queues each root once across bags; reconcile renders the ROOT — one
 *   carrier, one file. A fragment URI never owns a disk path of its own.
 *
 * THE ORPHAN FOLDER (disk-projection#/the-orphan-folder): a slot record whose parent chain reaches no
 *   standing record stays live in the store and the wiki, and nothing renders it inside a carrier. Each
 *   projects as a plain `.tid` under `<root-stem>.orphans/<slot>.tid`, in the mirror of the bag it rests
 *   in, and the wiki raises `$:/temp/lares/alert/meme-orphan/<root>`. A root that returns takes its slots
 *   back: the folder's files leave and the flag clears. The flag lives in `$:/temp` and re-derives at boot.
 *
 * Echo suppression ranks (Confluence): the CONTENT-HASH gates carry the law —
 * ingest drops disk-hash == synced-hash; projection skips byte-identical
 * writes. The `writing` Set survives beneath them as a latency
 * optimization only (skip re-statting our own in-flight writes); no
 * correctness rests on it.
 *
 * THE CONFLUENCE, PROJECTING LEG (`projection-gate.decideProjection`): every flush the
 * byte-identity skip does not answer meets the three-way gate — the records' render, the
 * merge base, and what stands on disk — before a single byte is written. `project`
 * writes; `noop` stands down silently (the ingest leg owns that state); `conflict`
 * stands down LOUDLY on the ward-alert rail (`onConflict`). Both legs of the round trip
 * reconcile and neither overwrites (the operator's ruling: conflict-surfacing in BOTH
 * legs). The gate decides and never writes; this file owns every I/O and every alert.
 *
 * A PERSON ANSWERS A STANDOFF BY ITS KEY (`takeRecords`): the answer admits one write of the
 * records' render over the very states the key names, and no other.
 *
 * AN UNLINK READS THE FILE FIRST (`judgeHome`). The projector removes a file only where its bytes
 * equal the disk side of the base that stands at that path, or say what the records render. A file
 * that fails the proof stays where a hand left it, and the carrier stands off under a key that names
 * the paths. One judge serves every unlink: a carrier's earlier siting, a sibling at an earlier
 * extension, a mirror the carrier left, and the file of a carrier the records dropped.
 *
 * A FILE ANSWERS ONLY TO THE DOCUMENT ITS BASE NAMES (`otherDocument`). Several documents may serve one bag id over
 * one mirror root: each face of a vessel mounts its own workbench document for an unshared wiki. Every base this
 * projector pins names the document it read (`documentOf`). A base that names another document reads as no base of
 * this one: the judge leaves its file standing and raises nothing, its row stays in the tree, and a carrier this
 * document also holds writes nothing over it and stands off by name.
 *
 * A BASE VOUCHES ONLY FOR RECORDS THAT STILL HOLD ITS HISTORY (`pastRecords`). Every base this projector pins names the
 * heads its document stood at (`lineageOf`). A document that reads back WITHOUT those heads lost the write the agreement
 * saw: a save that never rested before the vessel went down, a restored snapshot, a blank document standing in for one
 * that failed to load. Its render (or its silence) says nothing newer than the file, so nothing writes over the file and
 * nothing unlinks it: the carrier stands off, and the alert names the door that lands the file's words back.
 *
 * COMPOSABLE FILES (each tracked by sync-heleuma through its code-meme under lar:///ha.ka.ba/lararium/mesh/): this class
 * holds the shared state and composes the modules under `./disk-projector/`, each a function over that state (`core.ts`).
 *   options.ts      the construction ports            entries.ts    shared shapes, keys, path readers
 *   start.ts        subscribe, mount scans, stop       reconcile.ts  the per-root reconcile and its residency bar
 *   flush.ts        render, site, write, sweep         confluence.ts the projecting leg's three-way gate
 *   siting.ts       paths, rules, the uniquifier       write.ts      atomic write, disk reads, the render text
 *   bases.ts        documents, lineage, pins           homes.ts      the one judge every unlink asks
 *   standoffs.ts    the standoff machine               pending.ts    pending removals and the disk look
 *   removals.ts     a person's remove/restore answer   dropped.ts    a dropped carrier's unlink and kāpae shadow
 *   orphans.ts      the orphan folder                  untracked.ts  files a checkout never tracked
 *   recovery.ts     recovery at rest, pinned agreement settle-word.ts the settle word
 *   watches.ts      settle wakes, reconcile watches    disk-files.ts, orphan-files.ts  pure disk readers
 */

import { isFaceScopedBag } from "@lararium/mesh/persona-scope";
import type { TW5Engine } from "@lararium/tw5";
import { SyncedTree } from "./synced-tree.js";
import type { LarDiskProjectorOptions } from "./disk-projector/options.js";
import type { ProjectorCore } from "./disk-projector/core.js";
import type { StandingStandoff } from "./disk-projector/entries.js";
import * as wiring from "./disk-projector/start.js";
import * as recovery from "./disk-projector/recovery.js";
import * as standoffs from "./disk-projector/standoffs.js";
import * as reconciling from "./disk-projector/reconcile.js";
import * as pending from "./disk-projector/pending.js";
import * as removals from "./disk-projector/removals.js";
import * as settleWord from "./disk-projector/settle-word.js";
import * as watches from "./disk-projector/watches.js";
import * as untracked from "./disk-projector/untracked.js";
import * as writes from "./disk-projector/write.js";
import * as flushing from "./disk-projector/flush.js";

export type { LarDiskProjectorOptions } from "./disk-projector/options.js";
export type { StandoffSides, StandingStandoff } from "./disk-projector/entries.js";
export { UNTRACKED_CARRIER_ALERT_PREFIX, untrackedCarrierAlertTitle, PROJECTION_FILE_MODE } from "./disk-projector/entries.js";
export { orphanRecordFile, orphanRelPath } from "./disk-projector/orphan-files.js";
export { carrierDiskFiles, projectedFileTitle } from "./disk-projector/disk-files.js";

/** The projector as the shape its modules read: the very instance, its shared state named (`core.ts`). */
const core = (projector: LarDiskProjector): ProjectorCore => projector as unknown as ProjectorCore;

/**
 * The composer. It holds the state every module reads and moves (protected: the modules reach it through `core`, and no
 * caller outside reads it), and each public method hands that state to the module that does the work.
 */
export class LarDiskProjector {
  /**
   * THE STAND-OFF KEEPER the island wires beside this projector (`standoff-drafts.ts`): the shore verb reads a carrier's
   * drafts through it and a person's `keep-both` marks them kept. Null where no keeper stands (a bare projector).
   */
  standoffKeeper: import("./standoff-drafts.js").StandoffKeeper | null = null;

  /** The ingest door's watch over this projector's stand-offs, while it runs. */
  protected unwatchStandoffs: ProjectorCore["unwatchStandoffs"] = null;

  /**
   * URIs currently being written to disk.
   * File watcher MUST check writing.has(uri) before ingesting — skip own writes.
   */
  readonly writing = new Set<string>();

  /** Reconcile queue keyed by carrier-root URI. Born in start(). */
  protected gate: ProjectorCore["gate"] = null;
  protected _firstFlushDone = false;
  protected recoveryScan: Promise<void> = Promise.resolve();

  protected _tw5: TW5Engine | null = null;

  /**
   * Where each carrier LAST sited, per mirror (`bagId\nuri` → extension-less mirror-relative base).
   * The stock filesystem adaptor keeps the same memory as `$tw.boot.files`: a delete runs after
   * the tiddler has gone, so the path a `$:/config/FileSystemPaths` rule named cannot be
   * recomputed — the last siting answers, and a title never flushed this session falls back to
   * the address siting rule. A rule that moves a carrier unlinks its previous files (`cleanupTiddlerFiles`).
   */
  protected readonly sited = new Map<string, string>();

  protected readonly mirrors: ProjectorCore["mirrors"];
  protected readonly recoveryStore: ProjectorCore["recoveryStore"];
  protected readonly recoveryFileFn: ProjectorCore["recoveryFileFn"];
  protected readonly recordFileFn: ProjectorCore["recordFileFn"];
  protected readonly topRecordFn: ProjectorCore["topRecordFn"];
  protected readonly carrierFileFn: ProjectorCore["carrierFileFn"];
  protected readonly resolveByCid: ProjectorCore["resolveByCid"];
  protected readonly bagsHolding: ProjectorCore["bagsHolding"];
  protected readonly layerIndexOf: ProjectorCore["layerIndexOf"];
  protected readonly viewHolds: ProjectorCore["viewHolds"];
  protected readonly farSideClosed: ProjectorCore["farSideClosed"];
  protected readonly docHolds: ProjectorCore["docHolds"];
  protected readonly onRefusal: ProjectorCore["onRefusal"];
  protected readonly onConflict: ProjectorCore["onConflict"];
  protected readonly onConflictResolved: ProjectorCore["onConflictResolved"];
  /**
   * The standoff each (bag, carrier) stands in right now, by key. Memory only: a fresh boot enters anew.
   * `sides` names a standoff between the disk and the records at the carrier's own path; `home` names a
   * file at a path the carrier left (or of a carrier the records dropped) that holds bytes no agreement covers.
   */
  protected readonly standoffs: ProjectorCore["standoffs"] = new Map();
  /**
   * THE STANDOFFS ONE READING LEFT, by (bag, carrier), each with the reconcile count it left at. A reading that finds the
   * disk and the records agreed (or the carrier projecting elsewhere) proves the standoff ended only once a LATER reading
   * of the same carrier says so too: that reading resolves it. A reading that finds the very same standoff again re-seats
   * it with no word, so a carrier that flickers between two readings raises nothing and clears nothing.
   */
  protected readonly leaving: ProjectorCore["leaving"] = new Map();
  /**
   * THE LAST STANDOFF SURFACED for each (bag, carrier), by its key. The key folds the file's bytes, the records' render and
   * the base they stand against, so a standoff that returns under the key it surfaced under names states nobody moved:
   * it re-seats as a standing row and speaks no second time. A standoff surfaces again only under a new key.
   */
  protected readonly surfaced = new Map<string, string>();
  /** How many reconciles this projector has begun: a leave remembers the count it left at. */
  protected readings = 0;
  /** The standoff a person answered for each (bag, carrier), by the key they named. Read once, by the reconcile the answer starts. */
  protected readonly answered = new Map<string, string>();
  /**
   * The records' render each `sides` standoff weighed, by (bag, carrier), beside the key it folded into. A text carrier
   * with no sidecar alone: `lares shore take-disk` reads it (`standoffRender`) to merge the file and the records slot by
   * slot against the base's words. Memory only, and it leaves with its standoff.
   */
  protected readonly standoffRenders: ProjectorCore["standoffRenders"] = new Map();
  /** Every carrier whose file vanished from the path its base names, by (bag, carrier). Memory only: a boot's mount scan finds each anew. */
  protected readonly pending: ProjectorCore["pending"] = new Map();
  /** The pending removals a person answered `restore` for. Read once, by the reconcile the answer starts. */
  protected readonly restoreAsked = new Set<string>();
  /** The pending-removal set surfaced for each bag, by its key. */
  protected readonly pendingSurfaced = new Map<string, string>();
  /** True while a pending set moved and its surfacing waits for the reconcile queue to drain. */
  protected pendingMoved = false;
  protected readonly onPendingRemoval: ProjectorCore["onPendingRemoval"];
  protected readonly onPendingRemovalResolved: ProjectorCore["onPendingRemovalResolved"];
  protected readonly removeCarrier: ProjectorCore["removeCarrier"];
  protected readonly layersBeneath: ProjectorCore["layersBeneath"];
  protected readonly canonicalizeFn: ProjectorCore["canonicalizeFn"];
  protected readonly canonicalizeNativeFn: ProjectorCore["canonicalizeNativeFn"];
  protected readonly readinessMap: ProjectorCore["readinessMap"];
  protected readonly debugJson: boolean;
  protected readonly syncedTree: SyncedTree;
  protected readonly baseFromGit: ProjectorCore["baseFromGit"];
  protected readonly untrackedAt: ProjectorCore["untrackedAt"];
  protected readonly documentOf: ProjectorCore["documentOf"];
  protected readonly lineageOf: ProjectorCore["lineageOf"];
  protected readonly journal: ProjectorCore["journal"];
  protected readonly onBagProjected: ProjectorCore["onBagProjected"];
  protected readonly projectedBags = new Set<string>();

  /** Roots whose slot records left, or stand with a broken chain, since their last orphan pass. */
  protected readonly orphanSuspects = new Set<string>();

  /**
   * A MEASURE, NEVER A DECISION. Counts what stands between the last wiki change event and the first file
   * write after it: the elapsed time and the `bagsHolding` lookups made in that window. A window of a
   * second or longer prints one diagnostic line; nothing reads these numbers to pace, order or drop work.
   */
  protected readonly measure: ProjectorCore["measure"] = { changeEvents: 0, lastChangeAt: -1, holdsSinceChange: 0, wroteSinceChange: true, writes: 0 };

  /** Settle waits for the next wake: a change event, or the projector stopping. */
  protected settleWakes: Set<() => void> = new Set();
  /** Each settle wait's inbox: the carrier roots changes named since its last look (`all` after a stop). */
  protected settleInboxes: ProjectorCore["settleInboxes"] = new Set();
  /** True once `stop` began: a settle wait ends, naming what never settled. */
  protected stopping = false;
  /** The watches on each carrier's next reconcile: a settle word reads whether the reconcile it marked ran or threw. */
  protected reconcileWatches: ProjectorCore["reconcileWatches"] = new Map();
  /** The carrier roots whose latest reconcile threw: each file stands as its failure left it, until a reconcile lands. */
  protected readonly failedRoots = new Set<string>();

  constructor(opts: LarDiskProjectorOptions) {
    this.mirrors      = opts.mirrors.filter((mirror) => !isFaceScopedBag(mirror.bagId));
    this.carrierFileFn = opts.carrierFileFn;
    this.recoveryStore = opts.recoveryStore;
    this.documentOf = opts.documentOf;
    this.lineageOf = opts.lineageOf;
    this.recoveryFileFn = opts.recoveryFileFn;
    this.recordFileFn = opts.recordFileFn;
    this.topRecordFn = opts.topRecordFn;
    this.resolveByCid = opts.resolveByCid;
    this.bagsHolding  = opts.bagsHolding;
    this.layerIndexOf = opts.layerIndexOf;
    this.viewHolds = opts.viewHolds;
    this.farSideClosed = opts.farSideClosed;
    this.docHolds = opts.docHolds;
    this.onRefusal    = opts.onRefusal;
    this.onConflict   = opts.onConflict;
    this.onConflictResolved = opts.onConflictResolved;
    this.onPendingRemoval = opts.onPendingRemoval;
    this.onPendingRemovalResolved = opts.onPendingRemovalResolved;
    this.removeCarrier = opts.removeCarrier;
    this.layersBeneath = opts.layersBeneath;
    this.canonicalizeFn = opts.canonicalizeFn;
    this.canonicalizeNativeFn = opts.canonicalizeNativeFn;
    this.readinessMap = opts.readinessMap;
    this.debugJson    = opts.debugJson ?? false;
    this.syncedTree   = opts.syncedTree ?? new SyncedTree(null);
    this.baseFromGit  = opts.baseFromGit;
    this.untrackedAt  = opts.untrackedAt;
    this.journal      = opts.journal;
    this.onBagProjected = opts.onBagProjected;
    for (const entry of this.journal?.since() ?? []) {
      if (entry.kind === "bag-projected" && "bagId" in entry.data) this.projectedBags.add(entry.data.bagId);
    }
  }

  /** Subscribe to TW5 wiki change events and begin projecting (`start.ts`). Returns an async unsubscribe that completes the running reconcile. */
  start(tw5: TW5Engine): () => Promise<void> {
    return wiring.start(core(this), tw5);
  }

  /** Confirm the captured recovery record against the actual bytes at its granted mirror (`recovery.ts`). */
  recoveryAtRest(bagId: string, title: string, written: Record<string, unknown> | null): Promise<void> {
    return recovery.recoveryAtRest(core(this), bagId, title, written);
  }

  /** Resolve when no reconcile runs and no root waits in the queue, and every pending-removal set that moved has surfaced.
   *  The settle lands too each Synced base pin whose heads now rest sealed (`SyncedTree.settle`). */
  async idle(): Promise<void> {
    await this.recoveryScan;
    await (this.gate?.idle() ?? Promise.resolve());
    pending._surfacePending(core(this));
    await this.syncedTree.settle();
  }

  /** Every Synced base pin this projector's tree holds pending in memory, waiting on its seal, with why it waits. */
  pendingPins(): ReturnType<SyncedTree["pendingPins"]> {
    return this.syncedTree.pendingPins();
  }

  /** How many of the waves' bases met a pin of this projector's tree that still waits (`SyncedTree.waitingBases`). */
  waitingBases(): number {
    return this.syncedTree.waitingBases;
  }

  /** Whether an ordinary mirror of this projector holds the bag: this island projects its records. */
  projects(bagId: string): boolean {
    return this.mirrors.some((m) => m.bagId === bagId && m.mirrorClass !== "recovery");
  }

  /** THE ISLAND PINS ONLY AN AGREEMENT IT READS ITSELF (the shore's `base` act; `recovery.ts` names each answer). */
  pinAgreement(bagId: string, uri: string, file: string, from?: string): Promise<"unprojected" | "outside-mirror" | "unread" | "differs" | "waiting" | "kept" | "recorded"> {
    return recovery.pinAgreement(core(this), bagId, uri, file, from);
  }

  /** Ask the rest again for every pin that waits, and land each whose heads now rest (`SyncedTree.settle`). */
  settlePins(): Promise<number> {
    return this.syncedTree.settle();
  }

  stop(): Promise<void> {
    return wiring.stop(core(this));
  }

  /** Every standoff this projector stands in right now, with the key a person answers by (`standoffs.ts`). */
  standing(): StandingStandoff[] {
    return standoffs.standing(core(this));
  }

  /** A PERSON TAKES THE RECORDS' SIDE of one standoff, named by its key (`standoffs.ts`). */
  takeRecords(bagId: string, uri: string, standoff: string): Promise<{ readonly took: boolean; readonly why?: string }> {
    return standoffs.takeRecords(core(this), bagId, uri, standoff);
  }

  /** THE RECORDS' SIDE OF ONE STANDOFF, AS IT WAS WEIGHED (`standoffs.ts`). */
  standoffRender(bagId: string, uri: string, standoff: string): { readonly text: string; readonly records: string } | null {
    return standoffs.standoffRender(core(this), bagId, uri, standoff);
  }

  /** The per-root reconcile (`reconcile.ts`). An instance method, so every internal call reaches an instance's own. */
  protected reconcile(rootUri: string): Promise<void> {
    return reconciling.reconcile(core(this), rootUri);
  }

  /** Every carrier that stands pending right now: its bag, its address and the path its file left. */
  pendingRemovals(): Array<{ readonly bagId: string; readonly uri: string; readonly path: string }> {
    return pending.pendingRemovals(core(this));
  }

  /** LOOK AT THE DISK NOW: reconcile the named carrier roots (every mirrored root when none get named), then drain (`pending.ts`). */
  sense(uris?: readonly string[]): Promise<void> {
    return pending.sense(core(this), uris);
  }

  /** THE CARRIERS WHOSE FILE LEFT WITH NO ONE WATCHING, named for `sense` (`pending.ts`). */
  vanished(): string[] {
    return pending.vanished(core(this));
  }

  /** The layers beneath `bagId` that hold a live record of `uri`, or none (`removals.ts`). */
  beneathOf(bagId: string, uri: string): Promise<readonly string[]> {
    return removals.beneathOf(core(this), bagId, uri);
  }

  /** A PERSON ANSWERS PENDING REMOVALS in one bag: `restore` or `remove` (`removals.ts`). */
  answerRemovals(
    act: "remove" | "restore", bagId: string,
    sel: { readonly uris?: readonly string[]; readonly all?: boolean; readonly count?: number; readonly kapae?: boolean },
  ): Promise<
    | { readonly ok: true; readonly done: readonly string[]; readonly left: readonly string[]; readonly unshadowed: ReadonlyArray<{ readonly uri: string; readonly bag: string }>; readonly raised: ReadonlyArray<{ readonly uri: string; readonly beneath: readonly string[] }> }
    | { readonly ok: false; readonly refusal: "not-pending" | "pending-count-moved" | "no-delete-door" | "no-wiki-view" | "answer-names-nothing" | "remove-raises-kapae" | "remove-bag-unmounted"; readonly why: string; readonly count?: number; readonly raising?: ReadonlyArray<{ readonly uri: string; readonly beneath: readonly string[] }> }
  > {
    return removals.answerRemovals(core(this), act, bagId, sel);
  }

  /** Write bytes atomically and durably (`write.ts`). An instance method, so every internal write reaches an instance's own. */
  protected atomicWrite(candidate: string, body: string | Buffer): void {
    writes.atomicWrite(core(this), candidate, body);
  }

  /** THE SETTLE WORD: answers once the projection the named records cause has run (`settle-word.ts` names the six readings). */
  settled(bagId: string, carriers: ReadonlyArray<{ readonly uri: string; readonly records: string; readonly heads?: readonly string[] }>): Promise<
    | { readonly mirrored: false }
    | {
        readonly mirrored: true; readonly settled: readonly string[]; readonly elsewhere: readonly string[];
        readonly superseded: readonly string[]; readonly stopped: readonly string[]; readonly failed: readonly string[];
        readonly closed: readonly string[];
      }
  > {
    return settleWord.settled(core(this), bagId, carriers);
  }

  /** THE FILES EACH MIRROR'S CHECKOUT NEVER TRACKED, read and never moved (`untracked.ts`). */
  untrackedCarriers(): { readonly files: ReadonlyArray<{ readonly path: string; readonly bagId: string }>; readonly unread: ReadonlyArray<{ readonly root: string; readonly why: string }> } {
    return untracked.untrackedCarriers(core(this));
  }

  /** How many files this projector has written since it stood (a measure; `shoreFlush` reads its rise across one flush). */
  fileWrites(): number { return this.measure.writes; }

  /** Mark each carrier whose latest reconcile threw for one more reconcile (a flush's retry); answers how many it marked. */
  retryFailed(): number {
    if (!this.gate || this.stopping) return 0;
    for (const rootUri of this.failedRoots) this.gate.mark(rootUri);
    return this.failedRoots.size;
  }

  /** WHAT THE PROJECTOR HAS NOT SETTLED, read and never moved (`watches.ts`). */
  unsettled(): { readonly pending: ReadonlyArray<{ readonly uri: string; readonly bagId: string | null }>; readonly failed: ReadonlyArray<{ readonly uri: string; readonly bagId: string | null }> } {
    return watches.unsettled(core(this));
  }

  /** Render, site and write one carrier into one bag's mirror (`flush.ts`). An instance method, so every internal flush reaches an instance's own. */
  protected flush(bagId: string, tiddlerUri: string, recoveryFields?: Record<string, unknown>, ownRecord = false): Promise<void> {
    return flushing.flush(core(this), bagId, tiddlerUri, recoveryFields, ownRecord);
  }
}
