/**
 * THE STATE THE PROJECTOR'S MODULES SHARE. `LarDiskProjector` holds every field named here, and each module function
 * takes the projector as this one shape (`core`), so the modules read and move the very state the instance holds. The
 * instance methods named at the foot stay on the instance: a module calls them through `core`, so a caller that reseats
 * one on an instance (a test's write counter, a stub reconcile) still answers every internal call.
 * Heleuma ha: see lararium/mesh/disk-projector-core.
 */

import type { KeyedReconcileGate } from "@lararium/mesh/projection-nalu";
import type { ReadinessMap } from "@lararium/mesh/readiness";
import type { VesselJournal } from "@lararium/mesh/vessel-journal";
import type { TW5Engine, CarrierFile } from "@lararium/tw5";
import type { BagMirrorConfig } from "../bag-paths.js";
import type { SyncedTree } from "../synced-tree.js";
import type { BaseFromGit } from "../pool-head.js";
import type { CarrierTracking } from "../checkout-carriers.js";
import type { LarDiskProjectorOptions } from "./options.js";
import type { SettleInbox, ReconcileWatch, StandoffEntry, StandingStandoff } from "./entries.js";

export interface ProjectorCore {
  // ── wiring ──
  unwatchStandoffs: (() => void) | null;
  readonly writing: Set<string>;
  gate: KeyedReconcileGate<string> | null;
  _firstFlushDone: boolean;
  recoveryScan: Promise<void>;
  _tw5: TW5Engine | null;
  readonly sited: Map<string, string>;
  readonly measure: { changeEvents: number; lastChangeAt: number; holdsSinceChange: number; wroteSinceChange: boolean; writes: number };
  stopping: boolean;
  readonly orphanSuspects: Set<string>;
  readonly projectedBags: Set<string>;

  // ── ports (construction options) ──
  readonly mirrors: readonly BagMirrorConfig[];
  readonly recoveryStore: LarDiskProjectorOptions["recoveryStore"];
  readonly recoveryFileFn: LarDiskProjectorOptions["recoveryFileFn"];
  readonly recordFileFn: LarDiskProjectorOptions["recordFileFn"];
  readonly topRecordFn: LarDiskProjectorOptions["topRecordFn"];
  readonly carrierFileFn: (tiddlerUri: string) => Promise<CarrierFile | null>;
  readonly resolveByCid: ((cid: string) => Promise<Uint8Array | null>) | undefined;
  readonly bagsHolding: ((tiddlerUri: string) => Promise<readonly string[]>) | undefined;
  readonly layerIndexOf: ((bagId: string) => number) | undefined;
  readonly viewHolds: ((bagId: string, uri: string, heads: readonly string[]) => boolean) | undefined;
  readonly farSideClosed: ((bagId: string) => { readonly promise: Promise<void>; readonly cancel: () => void }) | undefined;
  readonly docHolds: ((bagId: string, heads: readonly string[]) => boolean) | undefined;
  readonly onRefusal: ((info: { bagId: string; uri: string; reason: string }) => void) | undefined;
  readonly onConflict: ((info: { bagId: string; uri: string; reason: string; standoff: string }) => void) | undefined;
  readonly onConflictResolved: ((info: { bagId: string; uri: string; standoff: string }) => void) | undefined;
  readonly onPendingRemoval: LarDiskProjectorOptions["onPendingRemoval"];
  readonly onPendingRemovalResolved: LarDiskProjectorOptions["onPendingRemovalResolved"];
  readonly removeCarrier: LarDiskProjectorOptions["removeCarrier"];
  readonly layersBeneath: LarDiskProjectorOptions["layersBeneath"];
  readonly canonicalizeFn: ((uri: string, diskText: string) => string | null) | undefined;
  readonly canonicalizeNativeFn:
    | ((uri: string, ext: string, diskBody: string, diskMeta: string | undefined) => { readonly body: string; readonly metaBody?: string } | null)
    | undefined;
  readonly readinessMap: ReadinessMap | undefined;
  readonly debugJson: boolean;
  readonly syncedTree: SyncedTree;
  readonly baseFromGit: BaseFromGit | undefined;
  readonly untrackedAt: CarrierTracking | undefined;
  readonly documentOf: LarDiskProjectorOptions["documentOf"];
  readonly lineageOf: LarDiskProjectorOptions["lineageOf"];
  readonly journal: VesselJournal | undefined;
  readonly onBagProjected: ((info: { bagId: string; path: string }) => void) | undefined;

  // ── the standoff machine ──
  readonly standoffs: Map<string, StandoffEntry>;
  readonly leaving: Map<string, { readonly bagId: string; readonly uri: string; readonly entry: StandoffEntry; readonly at: number }>;
  readonly surfaced: Map<string, string>;
  readings: number;
  readonly answered: Map<string, string>;
  readonly standoffRenders: Map<string, { readonly standoff: string; readonly text: string }>;

  // ── pending removals ──
  readonly pending: Map<string, { readonly bagId: string; readonly uri: string; readonly path: string }>;
  readonly restoreAsked: Set<string>;
  readonly pendingSurfaced: Map<string, string>;
  pendingMoved: boolean;

  // ── settle words and reconcile watches ──
  readonly settleWakes: Set<() => void>;
  readonly settleInboxes: Set<SettleInbox>;
  readonly reconcileWatches: Map<string, Set<ReconcileWatch>>;
  readonly failedRoots: Set<string>;

  // ── instance methods the modules call through the instance ──
  flush(bagId: string, tiddlerUri: string, recoveryFields?: Record<string, unknown>, ownRecord?: boolean): Promise<void>;
  reconcile(rootUri: string): Promise<void>;
  atomicWrite(candidate: string, body: string | Buffer): void;
  idle(): Promise<void>;
  sense(uris?: readonly string[]): Promise<void>;
  standing(): StandingStandoff[];
  stop(): Promise<void>;
  projects(bagId: string): boolean;
  pendingRemovals(): Array<{ readonly bagId: string; readonly uri: string; readonly path: string }>;
}
