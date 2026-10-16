/**
 * daemon-vm-core — the platform-blind daemon-island vessel lifecycle.
 *
 * ONE core both vessels compose (mirror pair 2/5). Subtracts the identical
 * skeleton from open-daemon-vm.ts (node) ⇆ open-browser-daemon-vm.ts (browser):
 * composite wiring, MessageChannel sync, ea-promise + breath watchdog, the delegation
 * loop, manifest delivery, placeVerb/mountMainVerbs/dispose. The platform
 * divergence remains as a three-member host shore (spawnWorker + newSyncChannel + awaitReady);
 * the resolved daemon doc handle is passed in by the caller (the two platforms
 * resolve it with genuinely different strategies — node merge-on-late-arrival,
 * browser find-or-create — so that stays a wrapper concern, not the core's).
 *
 * Node-only capability proxies (authShore, resolveBinding) compose ON TOP via a
 * second listener on the exposed `worker` handle — they are node-ahead surface,
 * not duplication, so the core stays free of them.
 *
 * Network-adapter wiring routes through mesh (attachMessageChannelSync); the
 * core holds zero @automerge/* imports — same facade law as sovereign-kernel.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-vm-core
 */

import {
  DAEMON_BAG_ID,
  NoWorkingLayerRefusal,
  WorkingDocumentUnavailableRefusal,
  DOCUMENT_HANG_BOUND_MS,
  findOrThrow,
  CompositeStore,
  AutomergeDocStore,
  computeRecipeFingerprint,
  wikiSlotUri,
  attachMessageChannelSync,
  awaitIslandMsg,
  mkManifest,
  mkDaemonPlaceVerb,
  mkTelemetryPlaceVerb,
  mkStructurepalaceKapae,
  mkDaemonVerbResult,
  mkDaemonVerifyRequest,
  mkDaemonResolveBindingRequest,
  mkDaemonDeriveSkeletonRequest,
  mkDaemonWorldlineCompareRequest,
  mkDaemonWorldlineTrajectoryRequest,
  mkDaemonEvictResult,
  mkDaemonResidencyOpResult,
  mkTeardown,
  isIslandToVesselMsg,
  CROSSROADS_DOC_URI,
  verbArgsFromPayload,
  mkLarResend,
  readLarControlResult,
  readLarFrame,
  type LarMsg_ControlEvent,
  type LarMsg_ControlResult,
  type LarMsg_Frame,
  type IslandMsg_Event,
  type VesselWorkerHandle,
  type Repo,
  type DocHandle,
  type LarDoc,
  type WikiRecipe,
  type AuthVerifierShore,
  type IslandStorageConfig,
  type IslandMsg_Manifest,
  type IslandGrants,
  type DaemonMsg_DelegateVerb,
  type DaemonMsg_VerifyResult,
  type DaemonMsg_ResolveBindingResult,
  type DaemonMsg_DeriveSkeletonResult,
  type DaemonMsg_WorldlineCompareResult,
  type DaemonMsg_WorldlineTrajectoryResult,
  type WorldlineStubWire,
  type WorldlineEdgeTriple,
  type WorldlineEdgeClose,
  type DaemonMsg_EvictRequest,
  type DaemonMsg_ResidencyOp,
  type DaemonMsg_WikiAlert,
  type BatchMode,
  type IslandMsg_Ea,
  type IslandMsg_TeardownAck,
} from "@lararium/mesh";
import { runLocalVerb } from "./verb-local-dispatch.js";
import type { VerbTable } from "./verb-dispatcher.js";
import type { MoveSkeleton, ConstructiconAxis } from "./form-layer/index.js";

/** The in-VM query-derive result the recall verb round-trips for — the move-skeleton (FULL functor,
 *  structural plane present) + the serialized `{axes, dimension}` basis. `null` = no derivable form
 *  (→ recall fuses content-only). Structurally matches node's FormSearch deriveSkeleton return. */
export interface DaemonDeriveSkeletonResult {
  skeleton: MoveSkeleton;
  basis: { axes: readonly ConstructiconAxis[]; dimension: number };
}

/** Well 1 input the host round-trips to the worker — two handles + the edge-DAG to project from. */
export interface DaemonWorldlineCompareInput {
  a: string;
  b: string;
  opens: readonly WorldlineEdgeTriple[];
  closes?: readonly WorldlineEdgeClose[];
  root?: string;
}

/** Well 3 + Well 4 input the host round-trips to the worker — a handle's turns (form-vectors shipped). */
export interface DaemonWorldlineTrajectoryInput {
  handle: string;
  stubs: readonly WorldlineStubWire[];
  joinForm?: boolean;
  includeNull?: boolean;
  seed?: number;
  window?: number;
}

/** The in-VM trajectory read result — the worldline-ordered path (+ optional null baseline). Plain
 *  objects (the worker computed; the host relays). `unknown` to keep the core free of the mesh
 *  WorldlineTrajectory type detail — the verb shapes the response. */
export interface DaemonWorldlineTrajectoryResult {
  trajectory: unknown;
  nullBaseline?: unknown;
}

// The ea watchdog budget — a SILENCE window, not a mount deadline.
// The mounting island emits breath (sovereign-kernel:
// stage marks + a steady interval); each breath re-arms this timer, so a
// long live mount never reads dead — silence alone times out, and the
// rejection names the last breath heard (readiness reads local). A fixed
// deadline cannot bound this: a fed store's mount
// scales with stored docs and disk latency; 120s stays as the silence
// budget — tightening it reads as a later knob, never a correctness cut.
const EA_SILENCE_TIMEOUT_MS = 120_000;

// The progress-stall budget — bounds breathing-without-advancing (the
// embedded-systems timer-kick anti-pattern: an interval breath proves the
// event loop turns, not that mount advances). Fresh (phase, progress)
// evidence restarts this clock; frozen evidence spends it down even while
// breaths keep re-arming the silence window.
const EA_STALL_TIMEOUT_MS = 3 * EA_SILENCE_TIMEOUT_MS;

/** The MessagePort type, borrowed through the mesh manifest (no DOM-lib dep). */
type VesselMessagePort = IslandMsg_Manifest["syncPort"];

/** The two-member daemon-VM host shore — platform divergence as composition. */
export interface DaemonVmHost {
  spawnWorker(scriptUrl: URL): VesselWorkerHandle;
  newSyncChannel(): { mainPort: VesselMessagePort; syncPort: VesselMessagePort };
  /** Optional second crossing for the one explicitly worker-owned document. */
  newOwnedSyncChannel?: () => { mainPort: VesselMessagePort; syncPort: VesselMessagePort };
  /** Browser workers register their inbound shore before signaling ready; Node omits the handshake. */
  awaitReady?: boolean;
}

export interface DaemonVmCoreOptions {
  /** Vessel main Repo — gains the island sync leg. */
  repo:            Repo;
  /** Daemon doc handle, already resolved by the platform wrapper. */
  daemonHandle:     DocHandle<LarDoc>;
  /** The persona plane's doc handle (the PersonaGroup), resolved by the platform wrapper the same way.
   *  The ONE daemon VM tends BOTH bags — the daemon bag (sovereign) + the persona plane (veiled identity). */
  /** ABSENT on a PLACE that never grew a face — the VM tends the daemon bag alone. */
  personaHandle?:   DocHandle<LarDoc>;
  /** The mounted plane's bag id, derived from its PersonaGroup's own doc id — one name, everywhere. */
  personaBagId?:    string;
  /** One-recipe model for the daemon island. */
  recipe:          WikiRecipe;
  /** Typed structural capabilities (engine doc, daemon bag, the lares bag, catalog registry access). */
  grants:          IslandGrants;
  /** SHA-256 hex of the TW5 core blob. null = pre-CAS. */
  coreHash:        string | null;
  /** CIDs of the engine's plugin-tiddler blobs — the worker pulls them by CID from its
   *  local CAS (the breath path). Absent → the worker reads blobs off the oracle doc. */
  pluginCids?:     readonly string[];
  /** Operator authn/z material for in-worker keyhive boot (Stage 1). */
  daemonAuth?:      IslandMsg_Manifest["daemonAuth"];
  /** Storage config delivered in the manifest (node nodefs; browser omits). */
  storage?:        IslandStorageConfig;
  /** One bounded D-VR-C worker-owned document; absent, the worker owns no document and its doc syncs over the host's channel alone. */
  ownedDocument?:  { documentUrl: string; storage?: IslandStorageConfig };
  /** The daemon wiki's disk mirrors (its working layer → `<root>/wikis/daemon/`); a node host mints
   *  them, a browser passes none. Rides the manifest's `diskMirrors` so the worker's `onBoot` can
   *  mount the same projector a wiki island mounts. */
  diskMirrors?:    readonly { bagId: string; mirrorRoot: string; scope: string }[];
  /** Compiled daemon-island Worker script URL. */
  workerScriptUrl: URL;
  /** Override the ea silence budget in ms (tests). */
  eaSilenceMs?:    number;
  /** Bound on the host's ask for the daemon working binding; defaults to the document hang bound. */
  hostBindingBoundMs?: number;
  /** Override the ea progress-stall budget in ms (default 3x silence). */
  eaStallMs?:      number;
}

/** Unified placeVerb request — union of node + browser fields. */
export interface VesselPlaceVerbRequest {
  verb:         string;
  args:         Record<string, unknown>;
  requestedBy?: string;
  requestId?:   string;
  targets?:     readonly string[];
  batchMode?:   string;
  fromUri?:     string;
  listenable?:  string;
  /** The effect this attempt would produce (D1, P2.5 iter 4) — see `Verb.effectKey`. */
  effectKey?:   string;
}

/** The worker did not answer the host's ask for the daemon working binding. */
export class HostWorkingBindingRefusal extends Error {
  constructor(slot: string, cause: unknown) {
    super(`[host-working-binding] the daemon worker did not answer the binding for "${slot}" (${cause instanceof Error ? cause.message : String(cause)}); restart the vessel so the worker re-attaches its working layer.`, { cause });
    this.name = "HostWorkingBindingRefusal";
  }
}

export interface DaemonVmCore {
  daemonHandle:    DocHandle<LarDoc>;
  composite:      CompositeStore;
  /** Resolve the worker's daemon binding and mount that exact document as the host default. */
  mountHostWorkingLayer: () => Promise<void>;
  workerEa:       Promise<void>;
  mountMainVerbs: (registry: VerbTable) => void;
  placeVerb:      (opts: VesselPlaceVerbRequest) => void;
  /** FEED one captured turn to the daemon's telemetry capture cap (the nalu). Fire-and-forget.
   *  `frontier` (optional) carries the turn-DAG fork-frontier so a same-session fork derives a
   *  distinct handle; absent on a non-forked turn. */
  placeTelemetry: (turnText: string, sourceFile: string, frontier?: readonly string[], turnKey?: string, chunkIndex?: number) => void;
  /** REWIND (kapae) one turn's .structurepalace tally + salience down-weight, IN the daemon island (it owns
   *  the warm holder). Fire-and-forget — the convergence twin of the CLI-side KG valid-close. */
  placeStructurepalaceKapae: (turnKey: string, ended?: string) => void;
  /**
   * Derive a recall query's move-skeleton IN the daemon VM (the recall twin of placeTelemetry) —
   * round-trips the query string through the island's `$tw.lares.deriveQuerySkeletonVm` so the
   * markers→vector recall runs the SAME Move→Vec functor capture runs (full grammar + live basis,
   * structural plane present). Resolves `null` when the query carries no derivable move-form.
   */
  deriveSkeleton: (query: string) => Promise<DaemonDeriveSkeletonResult | null>;
  /**
   * Well 1 (the ITC LIVE-READ) — answer the concurrent-capable causal verdict between two handles IN
   * the daemon VM. Round-trips the edge-DAG (host-derived from a transcript) + the two handles through
   * the island's `$tw.lares.worldlineCompareVm`; the worker projects the registry + runs the ITC
   * tree-leq. Rejects (the worker's error) on an unknown handle — the verb wraps the helpful message.
   */
  worldlineCompare: (input: DaemonWorldlineCompareInput) => Promise<{ order: string }>;
  /**
   * Well 3 (THE CORE) + Well 4 (NULL-READY) — a handle's worldline-ordered form-vector path IN the
   * daemon VM. Round-trips the captured turns (form-vectors the host pre-fetched from the form store
   * shipped on the stubs) through `$tw.lares.worldlineTrajectoryVm`; the worker orders + joins +
   * (optionally) shuffles. Total — empty stubs resolve an empty trajectory.
   */
  worldlineTrajectory: (input: DaemonWorldlineTrajectoryInput) => Promise<DaemonWorldlineTrajectoryResult>;
  /**
   * Host-side inbound-peer verifier — proxies verify() to the island's
   * keyhive via daemon:verify-request/result. Common to both vessels.
   */
  authShore:       AuthVerifierShore;
  /**
   * Resolve (or mint+delegate) the operator's personal/draft binding pair for
   * a recipe fingerprint — runs island-side where keyhive lives. Common surface.
   */
  resolveBinding: (
    fingerprint: string,
    recipeTrace: { wikiDocId: string; libraryBagDocIds: readonly string[] },
    wikiSlug: string,
  ) => Promise<{ personalUrl: string; draftUrl: string; workingUrl: string }>;
  /**
   * GRACEFUL shutdown — post a teardown to the daemon island and AWAIT its
   * teardown:ack (the island flushes its in-flight Automerge docs + capture state
   * before acking), then terminate. Budgeted: if the worker is jammed (e.g. a
   * keyhive WASM reconverge holding the event loop) the ack never arrives, the
   * await times out, and we terminate anyway — but the vessel has already flushed
   * its own main-replica floor by then (flush-then-force, never force-before-flush).
   * Use on a signal-driven shutdown; `dispose()` stays the hard, no-flush kill.
   *
   * Returns `{acked}` — H3/M4: `false` names a CUT teardown (the ack never arrived and this
   * door terminated the worker anyway) so the caller's own shutdown line can say so honestly,
   * never claim "every teardown receipt landed" over one it cut itself.
   */
  shutdown:       (budgetMs?: number) => Promise<{ acked: boolean }>;
  dispose:        () => void;
  /** Exposed so platform wrappers compose any further capability on top. */
  worker:         VesselWorkerHandle;
  /**
   * Register the pool's eviction MECHANISM (sovereign-worker model): the daemon worker
   * owns residency POLICY and commands an evict via daemon:evict-request; main routes it
   * here to the pool (the worker holds a capability to the pool, not the pool). Set
   * AFTER the pool exists (post makePool). Absent → evict-requests fail closed.
   */
  onEvictRequest: (fn: (bagId: string) => Promise<void>) => void;
  /**
   * Register the residency-op MECHANISM: the worker commands pin/unpin/register-cold
   * (daemon:residency-op, keyhive-gated policy); main routes here to the BagStowage
   * (which stays at the resource). Set after the manager exists. Absent → fail closed.
   */
  onResidencyOp: (fn: (op: "pin" | "unpin" | "register-cold", bagId: string, reason?: string) => Promise<void>) => void;
  /**
   * Register the wiki-alert DELIVERY: the worker decided a change needs a reboot to
   * apply (daemon:wiki-alert) and names the affected wiki; main routes here to place a
   * `system-alert` verb into that wiki's live island (skip if not mounted). Set after
   * the pool exists. Fire-and-forget; absent → alerts silently dropped.
   */
  onWikiAlert: (fn: (wikiSlug: string, message: string, cause?: string, kind?: string, instance?: { key?: string; clear?: boolean }) => void) => void;
  /**
   * Camera surfacing — the daemon inherits the wiki render cap (hasProjection); once a worker entry wires
   * onBoot (mountProjection), the daemon's story camera emits `lar:frame` like any wiki island. This forwards
   * each frame, read fail-closed, to the boot's SHARED sink (the identical #projection surface a pinned wiki
   * paints), keyed on the transport id — so a summoned daemon surfaces uniformly. Set after the boot sink
   * exists; absent → frames drop (the daemon renders dormant, unshown).
   */
  onFrame: (fn: (frame: LarMsg_Frame) => void) => void;
  /**
   * The answers to a person's acts — each `lar:control-result` the daemon's camera posts (`applied`,
   * `stale-target` or a named refusal), read fail-closed. Frames never answer events; this door does.
   */
  onControlResult: (fn: (result: LarMsg_ControlResult) => void) => void;
  /**
   * The camera's RETURN leg — a person's act, sense, write or service answer, posted whole into the daemon
   * worker, where the inherited hasProjection cap reads it fail-closed and dispatches it into TW5's native
   * handler by render id. Reliable kinds answer on `onControlResult`; a sense answers in a later frame.
   */
  sendControlEvent: (ev: LarMsg_ControlEvent) => void;
  /**
   * Ask the daemon's camera to paint itself whole under a fresh mount epoch: a surface switched to it, or
   * attached late. Acts made under the old epoch answer `stale-target`.
   */
  resend: (cameraId: string) => void;
  /**
   * Verb OUT-path for the daemon's OWN surface — the twin of a pool wiki's worker.event→placeVerb
   * bridge. A DOM click in the projected daemon writes a verb-carrying summon tiddler; its reaction-router
   * fires a `tm-verse-event` that surfaces here as an IslandMsg_Event carrying {verb, uri/fromUri}. The
   * vessel wires this to placeVerb, re-entering the dispatcher's verify-then-delegate gate so the verb runs
   * on the main registry (e.g. wiki-switch). Absent → daemon-origin verbs are silently dropped.
   */
  onVerbEvent: (fn: (e: { verb: string; args: Record<string, unknown>; fromUri?: string; listenable?: string }) => void) => void;
}

/** The marker a hard `dispose` hands a teardown handshake that stands waiting. */
class DisposedMidHandshake extends Error {
  constructor() { super("the daemon VM got disposed while its teardown handshake stood waiting"); }
}

export function openDaemonVmCore(host: DaemonVmHost, opts: DaemonVmCoreOptions): DaemonVmCore {
  const { repo, daemonHandle, personaHandle, personaBagId, recipe, grants, coreHash, pluginCids, daemonAuth, storage, ownedDocument, diskMirrors, workerScriptUrl } = opts;

  // Mutable delegation config — set via mountMainVerbs(). The worker gates routed
  // verbs (verify-then-delegate); main trusts the channel, so no main-side verifier.
  let _registry: VerbTable | null = null;
  // Pool eviction mechanism — set via onEvictRequest() after the pool exists.
  let _evictHandler: ((bagId: string) => Promise<void>) | null = null;
  // Residency-op mechanism — set via onResidencyOp() after the manager exists.
  let _residencyHandler: ((op: "pin" | "unpin" | "register-cold", bagId: string, reason?: string) => Promise<void>) | null = null;
  // Wiki-alert delivery — set via onWikiAlert() after the pool exists.
  let _wikiAlertHandler: ((wikiSlug: string, message: string, cause?: string, kind?: string, instance?: { key?: string; clear?: boolean }) => void) | null = null;
  // Camera forwarding — set via onFrame() / onControlResult() after the boot sink exists.
  let _frameHandler: ((frame: LarMsg_Frame) => void) | null = null;
  let _controlResultHandler: ((result: LarMsg_ControlResult) => void) | null = null;
  // Verb OUT-path forwarding — set via onVerbEvent() after the vessel's placeVerb exists.
  /** The one teardown handshake this VM runs: the first `shutdown` (or a hard `dispose`) settles it. */
  let _down: Promise<{ acked: boolean }> | null = null;
  /** Ends a handshake that stands waiting; set while one waits, null otherwise. */
  let _cutDown: (() => void) | null = null;
  let _verbEventHandler: ((e: { verb: string; args: Record<string, unknown>; fromUri?: string; listenable?: string }) => void) | null = null;

  // ── Vessel composite (cap-event + receipt writes) ──────────────────────────
  const composite  = new CompositeStore();
  const daemonStore = new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID);
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonStore, writable: true, defaultWritable: false });
  daemonStore.markSyncComplete();
  // The PersonaGroup plane this vessel stands in, tended by the SAME VM (one VM, two bags), and
  // mounted under the name its own group derives — the id the registry, the cap ring and the admit
  // payload all use for it.
  // The persona plane layers only when a face stands; a faceless place carries the daemon bag and nothing of a person.
  if (personaHandle && personaBagId) {
    const personaStore = new AutomergeDocStore(personaHandle, personaBagId);
    composite.addLayer({ bagId: personaBagId, store: personaStore, writable: true, defaultWritable: false });
    personaStore.markSyncComplete();
  }

  // ── MessageChannel — island ↔ vessel Repo sync (wiring owned by mesh) ───────
  const { mainPort, syncPort } = host.newSyncChannel();
  const ownedPeers = new Set<string>();
  const priorShareConfig = repo.shareConfig;
  let ownedChannel: { mainPort: VesselMessagePort; syncPort: VesselMessagePort } | undefined;
  if (ownedDocument) {
    if (!host.newOwnedSyncChannel) throw new Error("D-VR-C owned document requires a dedicated crossing");
    ownedChannel = host.newOwnedSyncChannel();
    const ownedId = ownedDocument.documentUrl.startsWith("automerge:")
      ? ownedDocument.documentUrl.slice("automerge:".length) : ownedDocument.documentUrl;
    repo.shareConfig = {
      announce: async (peerId, documentId) => ownedPeers.has(peerId)
        ? documentId === ownedId : priorShareConfig.announce(peerId, documentId),
      access: async (peerId, documentId) => ownedPeers.has(peerId)
        ? documentId === ownedId : priorShareConfig.access(peerId, documentId),
    };
  }
  const detachPrimary = attachMessageChannelSync(repo, mainPort);
  const detachOwned = ownedChannel
    ? attachMessageChannelSync(repo, ownedChannel.mainPort, (peerId) => ownedPeers.add(peerId))
    : undefined;

  // ── Spawn daemon island ─────────────────────────────────────────────────────
  const worker = host.spawnWorker(workerScriptUrl);

  // ── askIsland — ONE request/reply correlation primitive ─────────────────────
  // Both vessel→island capability proxies (verify, resolveBinding) compose on
  // this single piece instead of hand-rolling a pending-map each.
  let _askSeq = 0;
  const _pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  function askIsland<T>(prefix: string, makeMsg: (requestId: string) => unknown, boundMs?: number): Promise<T> {
    const requestId = `${prefix}-${++_askSeq}`;
    return new Promise<T>((resolve, reject) => {
      // A bound names a HANG: it ends an ask no live worker will answer, and clears when the ask settles.
      const timer = boundMs === undefined ? undefined : setTimeout(() => {
        if (_pending.delete(requestId)) reject(new Error(`the island did not answer ${requestId} within ${boundMs}ms`));
      }, boundMs);
      _pending.set(requestId, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject:  (e) => { clearTimeout(timer); reject(e); },
      });
      worker.post(makeMsg(requestId));
    });
  }
  // A worker that faults or errors answers nothing further: every ask still pending ends there.
  function failPendingAsks(why: string): void {
    for (const [id, ask] of [..._pending]) { _pending.delete(id); ask.reject(new Error(why)); }
  }
  worker.listen((msg) => {
    if ((msg as { type?: string }).type === "fault") failPendingAsks(`the island faulted: ${(msg as { error?: string }).error ?? "no detail"}`);
  });
  worker.onError((err) => failPendingAsks(`the island errored: ${err instanceof Error ? err.message : String(err)}`));
  function settleAsk(requestId: string, value: unknown, error?: string): void {
    const p = _pending.get(requestId);
    if (!p) return;
    _pending.delete(requestId);
    if (error) p.reject(new Error(error));
    else p.resolve(value);
  }

  // ── workerEa — the ea-wait rides the shared hull (one-hull law, step 1) ─────
  // awaitIslandMsg carries the whole breath watchdog: re-arm on breath, stall
  // budget on frozen (phase, progress), silence alone times out, fault rejects
  // immediately. No bespoke daemon timer survives — the daemon VM and the island
  // pool now share ONE watchdog mechanism (vessel-host).
  const silenceMs = opts.eaSilenceMs ?? EA_SILENCE_TIMEOUT_MS;
  const stallMs   = opts.eaStallMs   ?? (opts.eaSilenceMs !== undefined ? 3 * opts.eaSilenceMs : EA_STALL_TIMEOUT_MS);
  const workerEa: Promise<void> = awaitIslandMsg<IslandMsg_Ea>({
    expectedType:    "ea",
    timeoutMs:       silenceMs,
    progressStallMs: stallMs,
    resetOnTypes:    ["breath"],
    rejectOnTypes:   ["fault"],
    subscribe:       (h) => worker.listen(h),
    subscribeError:  (h) => worker.onError(h),
  }).then(() => undefined);
  // Settle-safety: a dispose() mid-boot leaves the silence timer to fire after
  // the worker dies; this no-op handler keeps that late rejection from going
  // unhandled while real awaiters still receive it.
  workerEa.catch(() => {});

  // ── Delegation loop + island message routing ────────────────────────────────
  // breath/ea/fault ride the awaitIslandMsg subscription above; this listener
  // carries only the live daemon surfaces.
  worker.listen((raw: unknown) => {
    // The camera's two kinds down — the daemon inherits the render cap (the KA·BA braid): forward each
    // `lar:frame` to the boot's SHARED sink so a summoned daemon paints the same #projection surface pool wikis
    // do, and each `lar:control-result` to the answer door. Both read fail-closed; the active-surface gate keys
    // on the transport id downstream, never a payload claim.
    const frame = readLarFrame(raw);
    if (frame) { _frameHandler?.(frame); return; }
    const result = readLarControlResult(raw);
    if (result) { _controlResultHandler?.(result); return; }
    if (!isIslandToVesselMsg(raw)) return;

    if (raw.type === "event") {
      const ev = raw as IslandMsg_Event;
      // Verb OUT-path: a verb-carrying verse-event from the daemon's own surface
      // (a projected switcher click). Forward it to the vessel's placeVerb bridge.
      // The summon's structured args ride the flat wire as a `verb-args` JSON string;
      // re-parse it (#48) — not the whole flat payload smuggling {uri,verb,fromUri}.
      const verb = typeof ev.payload["verb"] === "string" ? (ev.payload["verb"] as string) : undefined;
      if (verb && _verbEventHandler) {
        const fromUri = typeof ev.payload["fromUri"] === "string" ? (ev.payload["fromUri"] as string) : undefined;
        _verbEventHandler({
          verb,
          args:      verbArgsFromPayload(ev.payload),
          ...(fromUri ? { fromUri } : {}),
          listenable: ev.listenable,
        });
      }
      return;
    }

    // Surface island FAULTS on the main console (the worker's own console doesn't bubble). The
    // Awake signal (ea) rides workerEa → the vessel's "live" phase, and breath rides the
    // awaitIslandMsg subscription — neither needs a console echo.
    if (raw.type === "fault") {
      console.error(`[daemon-island:fault] ${JSON.stringify(raw).slice(0, 240)}`);
    }

    if (raw.type === "daemon:verify-result") {
      const msg = raw as DaemonMsg_VerifyResult;
      settleAsk(msg.requestId, {
        ok: msg.ok,
        ...(msg.identifier ? { identifier: msg.identifier } : {}),
        ...(msg.reason ? { reason: msg.reason } : {}),
        ...(msg.proofVerified !== undefined ? { proofVerified: msg.proofVerified } : {}),
        // The self-slot class rides the shore's return unchanged — the gate reads it off authShore.verify.
        ...(msg.peerClass !== undefined ? { peerClass: msg.peerClass } : {}),
      });
      return;
    }

    if (raw.type === "daemon:resolve-binding-result") {
      const msg = raw as DaemonMsg_ResolveBindingResult;
      if (msg.error) settleAsk(msg.requestId, undefined, msg.error);
      else if (msg.personalUrl && msg.draftUrl && msg.workingUrl) settleAsk(msg.requestId, { personalUrl: msg.personalUrl, draftUrl: msg.draftUrl, workingUrl: msg.workingUrl });
      else settleAsk(msg.requestId, undefined, "resolve-binding-result missing urls");
      return;
    }

    if (raw.type === "daemon:derive-skeleton-result") {
      const msg = raw as DaemonMsg_DeriveSkeletonResult;
      if (msg.error) settleAsk(msg.requestId, undefined, msg.error);
      // skeleton+basis both present → the derivation; both absent → a graceful null (content-only).
      else settleAsk(
        msg.requestId,
        msg.skeleton !== undefined && msg.basis !== undefined ? { skeleton: msg.skeleton, basis: msg.basis } : null,
      );
      return;
    }

    if (raw.type === "daemon:worldline-compare-result") {
      const msg = raw as DaemonMsg_WorldlineCompareResult;
      if (msg.error) settleAsk(msg.requestId, undefined, msg.error);
      else settleAsk(msg.requestId, { order: msg.order });
      return;
    }

    if (raw.type === "daemon:worldline-trajectory-result") {
      const msg = raw as DaemonMsg_WorldlineTrajectoryResult;
      if (msg.error) settleAsk(msg.requestId, undefined, msg.error);
      else settleAsk(
        msg.requestId,
        { trajectory: msg.trajectory, ...(msg.nullBaseline !== undefined ? { nullBaseline: msg.nullBaseline } : {}) },
      );
      return;
    }

    if (raw.type === "daemon:evict-request") {
      // Sovereign-worker: the worker decided (policy, keyhive-gated); main executes the
      // mechanism (pool teardown). Route to the injected pool handler; ack regardless.
      const msg = raw as DaemonMsg_EvictRequest;
      const run = _evictHandler
        ? _evictHandler(msg.bagId)
        : Promise.reject(new Error("no evict handler bound (pool not ready)"));
      run
        .then(() => worker.post(mkDaemonEvictResult({ requestId: msg.requestId, ok: true })))
        .catch((err: unknown) => worker.post(mkDaemonEvictResult({
          requestId: msg.requestId, ok: false, error: err instanceof Error ? err.message : String(err),
        })));
      return;
    }

    if (raw.type === "daemon:residency-op") {
      // Sovereign-worker: the worker's residency verb (pin/unpin/register-cold) granted
      // policy; main executes the mechanism on the BagStowage. Ack regardless.
      const msg = raw as DaemonMsg_ResidencyOp;
      const run = _residencyHandler
        ? _residencyHandler(msg.op, msg.bagId, msg.reason)
        : Promise.reject(new Error("no residency handler bound (manager not ready)"));
      run
        .then(() => worker.post(mkDaemonResidencyOpResult({ requestId: msg.requestId, ok: true })))
        .catch((err: unknown) => worker.post(mkDaemonResidencyOpResult({
          requestId: msg.requestId, ok: false, error: err instanceof Error ? err.message : String(err),
        })));
      return;
    }

    if (raw.type === "daemon:wiki-alert") {
      // Sovereign-worker: the worker decided a change needs a reboot to apply and named
      // the affected wiki; main delivers the alert into that wiki's live island (the
      // handler skips unmounted ones). Fire-and-forget — no result back to the worker.
      const msg = raw as DaemonMsg_WikiAlert;
      _wikiAlertHandler?.(msg.wikiSlug, msg.message, msg.cause, msg.kind, { ...(msg.key ? { key: msg.key } : {}), ...(msg.clear === true ? { clear: true } : {}) });
      return;
    }

    if (raw.type === "daemon:delegate-verb") {
      const msg = raw as DaemonMsg_DelegateVerb;
      if (!_registry) {
        worker.post(mkDaemonVerbResult({
          requestId: msg.requestId,
          error: `[openDaemonVm] delegate-verb received before mountMainVerbs — verb="${msg.verb}" dropped`,
        }));
        return;
      }
      const invocationLike = {
        title:       `${DAEMON_BAG_ID}/delegate/${msg.requestId}`,
        requestId:   msg.requestId,
        action:      msg.verb,
        args:        msg.args,
        requestedBy: msg.requestedBy,
        requestedAt: new Date().toISOString(),
        targets:     msg.targets ?? [],
        batchMode:   (msg.batchMode ?? "best-effort") as BatchMode,
        status:      "pending" as const,
      };
      runLocalVerb(invocationLike, {
        daemon:   composite,
        registry: _registry,
      }).then((result) => {
        worker.post(mkDaemonVerbResult({ requestId: msg.requestId, result }));
      }).catch((err: unknown) => {
        worker.post(mkDaemonVerbResult({
          requestId: msg.requestId,
          error: err instanceof Error ? err.message : String(err),
        }));
      });
      return;
    }
  });

  // ── Deliver manifest, AFTER the worker's ready IoC ──────────────────────────────
  // The browser kernel posts mkReady only AFTER its message listener registers (late —
  // after the worker shim's keyhive base64-WASM init + chain import). Posting the manifest
  // before that delivers it to the worker's event loop while no listener exists → it's
  // DROPPED, and the kernel then waits forever (no breath, no fault). Browser hosts therefore
  // wait for ready; Node omits the handshake and posts immediately. Deferred (not awaited)
  // so the synchronous return holds — workerEa resolves once the worker boots off this manifest.
  // ISOMORPHIC crossroads plane: the daemon renders the public oracle plane on ANY vessel (node or browser). One
  // shore, both wrappers funnel through here — so splice the crossroads bag into the recipe (resolves via the oracle plane's
  // pointer, or skips gracefully when a vessel hasn't registered it) + registerBags (so keyhive can access it).
  // Writing the oracle plane's pointer rides the vessel boot (registerCrossroadsInOracle), keyed by the nexus the
  // vessel belongs to — that value differs (a node's own key vs a browser's relay key), the daemon code does not.
  const daemonRecipe: WikiRecipe = {
    ...recipe,
    libraryBags: [...(recipe.libraryBags ?? []), CROSSROADS_DOC_URI],
  };
  const daemonAuthWithCrossroads = daemonAuth
    ? { ...daemonAuth, registerBags: [...new Set([...daemonAuth.registerBags, CROSSROADS_DOC_URI])] }
    : daemonAuth;
  const manifestMsg = mkManifest(DAEMON_BAG_ID, syncPort, daemonRecipe, grants, coreHash, {
    ...(storage   ? { storage }   : {}),
    ...(daemonAuthWithCrossroads ? { daemonAuth: daemonAuthWithCrossroads } : {}),
    ...(pluginCids?.length ? { pluginCids } : {}),
    ...(diskMirrors?.length ? { diskMirrors } : {}),
    ...(ownedDocument && ownedChannel ? { ownedDocument: { ...ownedDocument, syncPort: ownedChannel.syncPort } } : {}),
  });
  const manifestGate = host.awaitReady
    ? new Promise<void>((resolve) => {
        worker.listen((raw: unknown) => {
          if (isIslandToVesselMsg(raw) && raw.type === "ready") resolve();
        });
      })
    : Promise.resolve();
  void manifestGate.then(() => {
    const transfer = ownedChannel ? [syncPort, ownedChannel.syncPort] : [syncPort];
    worker.post(manifestMsg, transfer);
  });

  const mountHostWorkingLayer = async (): Promise<void> => {
    const slot = wikiSlotUri("daemon", "working");
    if (composite.hasBag(slot)) {
      if (composite.defaultWritableBagId() !== slot) throw new NoWorkingLayerRefusal("Mounting the host working layer", "The daemon working layer stands without being the default writable; restart the vessel so it mounts as the default.");
      return;
    }
    await workerEa;
    const recipeTrace = { wikiDocId: daemonHandle.url, libraryBagDocIds: [] as readonly string[] };
    const fingerprint = await computeRecipeFingerprint(recipeTrace);
    let binding: { workingUrl: string };
    try {
      binding = await askIsland<{ workingUrl: string }>("binding", (requestId) => mkDaemonResolveBindingRequest({
        requestId, fingerprint, recipeTrace, wikiSlug: "daemon",
      }), opts.hostBindingBoundMs ?? DOCUMENT_HANG_BOUND_MS);
    } catch (cause) {
      throw new HostWorkingBindingRefusal(slot, cause);
    }
    const handle = await findOrThrow(repo, binding.workingUrl, `${slot} (the host's daemon working layer)`, { refusal: WorkingDocumentUnavailableRefusal, timeoutMs: DOCUMENT_HANG_BOUND_MS });
    const store = new AutomergeDocStore(handle, slot);
    composite.addLayer({ bagId: slot, store, writable: true, defaultWritable: true });
    store.markSyncComplete();
    if (composite.defaultWritableBagId() !== slot) throw new NoWorkingLayerRefusal("Mounting the host working layer", "The mounted daemon working layer did not become the default writable; restart the vessel.");
  };

  return {
    daemonHandle,
    composite,
    mountHostWorkingLayer,
    workerEa,
    worker,
    mountMainVerbs: (registry: VerbTable) => {
      _registry = registry;
    },
    authShore: {
      verify: (cardBytes, bagUrl, access, proof, edge) =>
        askIsland("verify", (requestId) => mkDaemonVerifyRequest({
          requestId, cardBytes, bagUrl, access,
          ...(proof ? { proof } : {}),
          ...(edge ? { edge } : {}),
        })),
    },
    resolveBinding: (fingerprint, recipeTrace, wikiSlug) =>
      askIsland("binding", (requestId) => mkDaemonResolveBindingRequest({ requestId, fingerprint, recipeTrace, wikiSlug })),
    placeVerb: (o: VesselPlaceVerbRequest) => {
      worker.post(mkDaemonPlaceVerb({
        verb:        o.verb,
        args:        o.args,
        requestedBy: o.requestedBy ?? "vessel",
        ...(o.targets?.length ? { targets: [...o.targets] } : {}),
        ...(o.batchMode       ? { batchMode: String(o.batchMode) } : {}),
        ...(o.requestId       ? { requestId: o.requestId } : {}),
        ...(o.fromUri         ? { fromUri: o.fromUri } : {}),
        ...(o.listenable      ? { listenable: o.listenable } : {}),
        ...(o.effectKey       ? { effectKey: o.effectKey } : {}),
      }));
    },
    placeTelemetry: (turnText: string, sourceFile: string, frontier?: readonly string[], turnKey?: string, chunkIndex?: number) => {
      worker.post(mkTelemetryPlaceVerb({ turnText, sourceFile, ...(frontier && frontier.length ? { frontier } : {}), ...(turnKey ? { turnKey } : {}), ...(chunkIndex !== undefined ? { chunkIndex } : {}) }));
    },
    placeStructurepalaceKapae: (turnKey: string, ended?: string) => {
      worker.post(mkStructurepalaceKapae({ turnKey, ...(ended ? { ended } : {}) }));
    },
    deriveSkeleton: (query: string) =>
      askIsland<DaemonDeriveSkeletonResult | null>("derive", (requestId) => mkDaemonDeriveSkeletonRequest({ requestId, query })),
    worldlineCompare: (input: DaemonWorldlineCompareInput) =>
      askIsland<{ order: string }>("wl-cmp", (requestId) => mkDaemonWorldlineCompareRequest({
        requestId, a: input.a, b: input.b, opens: input.opens,
        ...(input.closes !== undefined ? { closes: input.closes } : {}),
        ...(input.root   !== undefined ? { root: input.root }     : {}),
      })),
    worldlineTrajectory: (input: DaemonWorldlineTrajectoryInput) =>
      askIsland<DaemonWorldlineTrajectoryResult>("wl-traj", (requestId) => mkDaemonWorldlineTrajectoryRequest({
        requestId, handle: input.handle, stubs: input.stubs,
        ...(input.joinForm    !== undefined ? { joinForm: input.joinForm }       : {}),
        ...(input.includeNull !== undefined ? { includeNull: input.includeNull } : {}),
        ...(input.seed        !== undefined ? { seed: input.seed }               : {}),
        ...(input.window      !== undefined ? { window: input.window }           : {}),
      })),
    onEvictRequest: (fn: (bagId: string) => Promise<void>) => {
      _evictHandler = fn;
    },
    onResidencyOp: (fn: (op: "pin" | "unpin" | "register-cold", bagId: string, reason?: string) => Promise<void>) => {
      _residencyHandler = fn;
    },
    onWikiAlert: (fn: (wikiSlug: string, message: string, cause?: string, kind?: string, instance?: { key?: string; clear?: boolean }) => void) => {
      _wikiAlertHandler = fn;
    },
    onFrame: (fn: (frame: LarMsg_Frame) => void) => {
      _frameHandler = fn;
    },
    onControlResult: (fn: (result: LarMsg_ControlResult) => void) => {
      _controlResultHandler = fn;
    },
    onVerbEvent: (fn: (e: { verb: string; args: Record<string, unknown>; fromUri?: string; listenable?: string }) => void) => {
      _verbEventHandler = fn;
    },
    sendControlEvent: (ev: LarMsg_ControlEvent) => worker.post(ev),
    resend: (cameraId: string) => worker.post(mkLarResend(cameraId)),
    // A SHUTDOWN RUNS ONCE, and every later call reads its answer. A composition's teardown reaches this
    // VM by more than one road (its own dispose, then the list of what it stood). The first call runs the
    // handshake and terminates the worker; a call that sent `teardown` again would ask a terminated worker
    // and wait out its whole bound for an ack no island stands to give.
    shutdown: (budgetMs = 10_000): Promise<{ acked: boolean }> => (_down ??= (async () => {
      // Post teardown, await the island's teardown:ack (it flushes its docs +
      // capture state before acking). On timeout (jammed worker) terminate anyway.
      let acked = true;
      try {
        await awaitIslandMsg<IslandMsg_TeardownAck>({
          expectedType:   "teardown:ack",
          timeoutMs:      budgetMs,
          subscribe:      (h) => worker.listen(h),
          // A hard `dispose` while this wait stands ends it at once, through the same door a worker
          // error takes: the wait drops its bound with it, and the handshake answers unacked.
          subscribeError: (h) => {
            const off = worker.onError(h);
            _cutDown = () => h(new DisposedMidHandshake());
            return () => { off(); _cutDown = null; };
          },
          send:           () => worker.post(mkTeardown()),
        });
      } catch (err) {
        acked = false;
        if (!(err instanceof DisposedMidHandshake)) console.warn(`[daemon-vm] graceful shutdown ack failed — ${String(err)}; terminating anyway`);
      }
      detachOwned?.();
      detachPrimary();
      worker.terminate();
      return { acked };
    })()),
    dispose: () => {
      // A hard stop runs no handshake: a shutdown asked afterward reads that no island acked, and one
      // that stands waiting ends now, unacked.
      _down ??= Promise.resolve({ acked: false });
      _cutDown?.();
      detachOwned?.();
      detachPrimary();
      worker.terminate();
    },
  };
}
