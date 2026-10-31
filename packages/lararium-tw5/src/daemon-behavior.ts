/**
 * daemon-behavior — isomorphic daemon island behavior for all platforms.
 *
 * makeDaemonBehavior() returns an IslandBehavior that:
 *   - Starts a VerbDispatcher subscribed to TW5 wiki change events (local path)
 *     and to the daemon CompositeStore (remote/signal path).
 *   - Routes wiki-scope verbs to the vessel via DaemonMsg_DelegateVerb /
 *     DaemonMsg_VerbResult, holding Promise resolvers in a pending delegation map.
 *   - Handles daemon:place-verb from the vessel (main-thread → island).
 *   - Handles daemon:verb-result from the vessel (island delegation round-trip).
 *
 * Runs identically in Node worker_threads and browser Web Workers.
 *
 * Island Sovereignty Law §9 applies: this behavior always runs inside a Worker.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-behavior
 */

import { makeDelegationBook } from "./delegation-book.js";
import {
  mkDaemonResolveBindingResult,
  mkDaemonGateVerbResult,
  mkDaemonDeriveSkeletonResult,
  mkDaemonWorldlineCompareResult,
  mkDaemonWorldlineTrajectoryResult,
  type DaemonMsg_PlaceVerb,
  type DaemonMsg_VerbResult,
  type DaemonMsg_FaceLit,
  type DaemonMsg_FaceDrop,
  type DaemonMsg_ResolveBindingRequest,
  type DaemonMsg_GateVerbRequest,
  type DaemonMsg_DeriveSkeletonRequest,
  type DaemonMsg_WorldlineCompareRequest,
  type DaemonMsg_WorldlineTrajectoryRequest,
  type BatchMode,
  type Verb,
  type CapabilityVerifier,
  type CaptureEngine,
  type CapturePost,
  LARES_VERB_ARGS_WIRE_FIELD,
} from "@lararium/mesh";
import { placeVerb } from "./verb-vm.js";
import { composeIsland } from "./island-caps.js";
import { hasEngineWatch, hasProjection } from "./has-island-watches.js";
import { hasCapture } from "./capture/has-capture.js";
import { VerbDispatcher, VerbTable } from "./verb-dispatcher.js";
import type { IslandCap } from "./island-caps.js";
import type { IslandContext, IslandBehavior } from "./island-context.js";
import type { RunnableHulls } from "@lararium/mesh";
import { seedDaemonProtocol } from "./daemon-protocol-seed.js";
import { canonicalJson, wikiSlotUri, VERB_URI_PREFIX } from "@lararium/mesh";

const WRITE_LAYER_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/**
 * Resolves once the wiki reads the working slot as its write-layer pointer. A working layer that
 * stands as the composite's default writable re-seeds that pointer through the shore's landing queue;
 * a hand write routed before the pointer lands refuses as unrouted. The wait rides the wiki's own change
 * event, never a timer. Without a standing working default there is nothing to wait for.
 */
function writeLayerPointerStands(ctx: IslandContext): Promise<void> {
  const working = wikiSlotUri(ctx.recipe.wikiSlug, "working");
  if (ctx.composite.defaultWritableBagId() !== working) return Promise.resolve();
  if (!ctx.composite.hasWritableBag(wikiSlotUri(ctx.recipe.wikiSlug, "temp"))) return Promise.resolve();
  const wiki = ctx.tw5.$tw.wiki as unknown as {
    getTiddlerText(title: string, fallback?: string): string | undefined;
    addEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
    removeEventListener(type: string, listener: (changes: Record<string, unknown>) => void): void;
  };
  if (wiki.getTiddlerText(WRITE_LAYER_POINTER, "") === working) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const onChange = (changes: Record<string, unknown>): void => {
      if (!(WRITE_LAYER_POINTER in changes) || wiki.getTiddlerText(WRITE_LAYER_POINTER, "") !== working) return;
      wiki.removeEventListener("change", onChange);
      resolve();
    };
    wiki.addEventListener("change", onChange);
  });
}

export interface DaemonBehaviorOptions {
  /** A ready verifier (e.g. tests, or a host-provided one). */
  verifier?: CapabilityVerifier;
  onHostMessage?: (msg: DaemonMsg_FaceLit | DaemonMsg_FaceDrop, ctx: IslandContext) => Promise<void>;
  /**
   * Projection mount shore — the daemon INHERITS the wiki's render cap (hasProjection). When the worker
   * entry supplies onBoot (mountProjection), the daemon becomes a surfaceable wiki like any other: the user
   * pins it to render, the same path any wiki takes (it's the same TW5 VM under the hood). Absent → the cap
   * stays inert (the daemon runs headless, its historical resting state). role = capability ≠ platform.
   */
  onBoot?: (ctx: IslandContext) => (() => void) | undefined;
  /**
   * Async verifier source resolved in `onEa` with the live IslandContext —
   * the isomorphic-vessel Stage-1 hook. Platform worker entries pass a factory
   * that calls `bootDaemonKeyhive` over `ctx.composite` (keeping keyhive out of
   * @lararium/tw5). Takes precedence over `verifier`. A throw here (gate failure)
   * propagates out of `onEa` → the island kernel posts `fault`, so the vessel
   * never goes live with an unauthorized identity.
   */
  verifierFactory?: (ctx: IslandContext) => Promise<CapabilityVerifier>;
  /**
   * Who a verb presents as, resolved once per invocation for every cap check; absent: its `requestedBy`. `local` reads
   * true for a verb that arrived over the vessel's own presence channel (`daemon:place-verb`), false for one a synced
   * summons carried: the channel decides authority, never the unsigned `requestedBy` claim.
   */
  presenterOf?: (invocation: Verb, local: boolean) => string;
  /**
   * Resolve (or mint+delegate) the personal/draft binding pair island-side —
   * the mint needs keyhive + the island Repo. The platform entry supplies this
   * closing over the booted keyhive; it calls `resolveOrMintBinding` with
   * `ctx.repo` + `ctx.composite`. Opaque so tw5 stays keyhive-free.
   */
  resolveBinding?: (
    ctx: IslandContext,
    fingerprint: string,
    recipeTrace: { wikiDocId: string; libraryBagDocIds: readonly string[] },
    wikiSlug: string,
  ) => Promise<{ personalUrl: string; draftUrl: string; workingUrl: string }>;
  /**
   * Sovereign-worker data-plane: register the residency / wiki / where / resolve
   * reactors into the worker's VerbDispatcher, in-worker, over the IslandContext.
   * Called in `onEa` before dispatch starts; the reactors inherit verify-then-delegate.
   * The platform entry supplies it (closing over the reactor factories); pool-touching
   * reactors command main via `ctx.post` (daemon:evict-request). Absent → no data-plane.
   */
  wireWorkerVerbs?: (registry: VerbTable, ctx: IslandContext) => void;
  /**
   * The telemetry capture SINK (node: makeNodeCaptureEngine wired to the palace). Every daemon
   * ALWAYS carries the capture cap (idempotent — tending the bound operator's session-capture is a
   * daemon duty); this shore, when wired, makes it LIVE. Absent → the cap stays inert (sink not
   * wired, a valid resting state). The two-loop config (servo + derive) lives inside the engine the
   * vessel builds. role = capability ≠ platform — tw5 never imports the node sink.
   */
  makeCaptureEngine?: (post: CapturePost, ctx: IslandContext) => CaptureEngine;
  /** the capture cap's server tick (ms); default 50. */
  captureTickMs?: number;
  /**
   * The vessel's runnable hulls — when present, makeDaemonBehavior runs the ONE cap-gated protocol seed
   * ({@link seedDaemonProtocol}) in `onEa`, so neither boot entry re-seeds (the isomorphic seed lift). A
   * ts-only vessel (browser) passes HULLS_TS_ONLY → crystal alone; a full node vessel passes HULLS_FULL →
   * all three flows. ABSENT → no seed (a non-operator makeDaemonBehavior caller keeps its old behavior).
   */
  runnableHulls?: RunnableHulls;
  /** Seed the read-only face pane only when this vessel wears a face. */
  faceIntents?: boolean;
}

export function makeDaemonBehavior(opts: DaemonBehaviorOptions = {}): IslandBehavior {
  let _dispatcher: VerbDispatcher | null = null;
  /** The requests that came in over the vessel's own presence channel or a surface leg, while each one stands. */
  const localAsks = makeLocalAskBook();

  // The asks to main wait here until main answers; `post` binds with the island's context at its first ea.
  let _post: IslandContext["post"] = () => {};
  const delegations = makeDelegationBook((msg) => _post(msg));

  // The daemon island is a nameless cap stack: #has engine-watch + #has daemon-dispatch (the
  // VerbDispatcher + the daemon:* signal family). The dispatch cap below holds what once was the
  // whole behavior, minus the engine-watch (now its own shared cap).
  const dispatchCap: IslandCap = {
    name: "daemon-dispatch",
    async onEa(ctx: IslandContext) {
      const { tw5, composite, post } = ctx;
      _post = post;
      // Resolve the verifier: the async factory (bootDaemonKeyhive over the daemon
      // composite, then the working-layer attach) wins; else a ready verifier; else none (delegated-verb path).
      const verifier = opts.verifierFactory ? await opts.verifierFactory(ctx) : opts.verifier;
      // No writer fires before the working layer stands: the wiki reads the re-seeded write-layer pointer first.
      await writeLayerPointerStands(ctx);
      // The ONE cap-gated daemon protocol seed (the isomorphic seed lift): Ui+Persona+Circle+Flow, once,
      // on the hook BOTH boots reach — so neither entry re-seeds. Gated on `runnableHulls` (absent → skip,
      // preserving old behavior for non-operator callers). Idempotent (each seed setTiddler-overwrites).
      if (opts.runnableHulls) seedDaemonProtocol(tw5, opts.runnableHulls, opts.faceIntents === true);
      const registry = new VerbTable();
      // Sovereign-worker: the data-plane reactors register HERE, in-worker, over the
      // IslandContext (ctx.composite/ctx.repo) — so they ride the dispatcher's
      // verify-then-delegate gate FOR FREE (a gate a main-thread jobRegistry
      // lacks). Pool-touching reactors command main via ctx.post (daemon:evict-request).
      opts.wireWorkerVerbs?.(registry, ctx);
      _dispatcher = new VerbDispatcher({
        daemonVm:  tw5,
        daemon:    composite,
        registry,
        routeFn:  (invocation, signal) => delegations.route(invocation, signal),
        ...(verifier ? { verifier } : {}),
        ...(opts.presenterOf ? { presenterOf: (inv: Verb) => opts.presenterOf!(inv, localAsks.has(inv)) } : {}),
        localOf: (inv: Verb) => localAsks.has(inv),
      });
      _dispatcher.start();
      // A local id serves its own invocation alone: it retires once the verb concludes and its tiddler leaves the VM.
      const onVerbsChange = (changes: Record<string, { deleted?: boolean }>) => localAsks.onWikiChange(changes);
      tw5.$tw.wiki.addEventListener("change", onVerbsChange);
      // The daemon's OWN verb OUT-path (the twin of the pool island-kernel's wiring):
      // a projected switcher click writes a verb-carrying summon tiddler, whose
      // reaction-router fires a tm-verse-event. Forward it to main as an IslandMsg_Event
      // — main's daemon-vm listener routes it to placeVerb (verify-then-delegate → the
      // main registry, e.g. wiki-switch). Without this, daemon-origin verbs never leave
      // the worker (projection frames reach main, but verse-events had no bridge).
      const cancelVerse = tw5.onVerseEvent({
        handleVerseEvent: (uri: string, listenable: string, verb?: string, fromUri?: string, args?: Record<string, unknown>, origin?: "surface" | "content") => {
          // The reaction-router already gates on the `lares-dispatch` marker, so ONLY a
          // genuine summon reaches here (the verb machinery's own invocation/outcome
          // writes never carry the marker → router-inert, the marker alone gating this
          // bridge, no URI-prefix allowlist). The structured args ride
          // the GP-2-flat island wire as ONE `verb-args` JSON string; main re-parses.
          post({
            type:           "event",
            wikiUri:        ctx.wikiUri,
            listenable,
            payload: {
              uri,
              origin: origin ?? "content",
              ...(verb    !== undefined ? { verb }    : {}),
              ...(fromUri !== undefined ? { fromUri } : {}),
              ...(args    !== undefined ? { [LARES_VERB_ARGS_WIRE_FIELD]: JSON.stringify(args) } : {}),
            },
          });
        },
      });
      return () => {
        cancelVerse();
        _dispatcher?.stop();
        _dispatcher = null;
      };
    },

    onSignal(type: string, raw: unknown, ctx: IslandContext): boolean {
      const { tw5, post } = ctx;
      if (type === "daemon:face-lit" || type === "daemon:face-drop") {
        const msg = raw as DaemonMsg_FaceLit | DaemonMsg_FaceDrop;
        const atomKey = msg.type === "daemon:face-lit" ? msg.entry.atom.key : msg.atomKey;
        const op = msg.type === "daemon:face-lit" ? "lit" : "dropped";
        void Promise.resolve().then(() => {
          if (!opts.onHostMessage) throw new Error("face handler unavailable");
          return opts.onHostMessage(msg, ctx);
        }).then(
          () => post({ type: "daemon:face-settled", atomKey, op, ok: true }),
          (error) => post({ type: "daemon:face-settled", atomKey, op, ok: false, reason: error instanceof Error ? error.message : String(error) }),
        );
        return true;
      }
      if (type === "daemon:place-verb") {
        const msg = raw as DaemonMsg_PlaceVerb;
        if (tw5) {
          const placed = placeVerb(tw5, {
            verb:        msg.verb,
            args:        msg.args,
            requestedBy: msg.requestedBy,
            ...(msg.targets   ? { targets:    msg.targets              } : {}),
            ...(msg.batchMode ? { batchMode:  msg.batchMode as BatchMode } : {}),
            ...(msg.requestId ? { requestId:  msg.requestId             } : {}),
            ...(msg.fromUri   ? { fromUri:    msg.fromUri               } : {}),
            ...(msg.listenable? { listenable: msg.listenable            } : {}),
            ...(msg.effectKey ? { effectKey:  msg.effectKey             } : {}),
            ...(msg.face      ? { face:       msg.face                  } : {}),
          });
          if (placedAskIsLocal(msg)) localAsks.add({ requestId: placed, action: msg.verb, args: msg.args, requestedBy: msg.requestedBy });
        }
        return true;
      }

      if (type === "daemon:verb-result") {
        const msg = raw as DaemonMsg_VerbResult;
        delegations.answer(msg.requestId, { ...(msg.error ? { error: msg.error } : {}), ...(msg.result ? { result: msg.result } : {}) });
        void post;
        return true;
      }

      if (type === "daemon:derive-skeleton-request") {
        // The recall twin of the telemetry capture: derive the query's move-skeleton IN this island's
        // TW5 VM, against the full self-hosted grammar + the LIVE grammar-cache basis — the SAME
        // Move→Vec functor capture runs. The in-VM fn lives on $tw.lares (query-derive-vm startup);
        // we reach it across ctx.tw5.$tw, identical to the capture annotate path. One runtime, no
        // node-side fallback. Plugin absent / parse fault → a graceful null (→ recall fuses content-only).
        const msg = raw as DaemonMsg_DeriveSkeletonRequest;
        try {
          const $tw = (tw5 as { $tw?: { lares?: { deriveQuerySkeletonVm?: (q: string) => { skeleton: unknown; basis: unknown } | null } } } | undefined)?.$tw;
          const fn = $tw?.lares?.deriveQuerySkeletonVm;
          if (!fn) {
            console.warn("[daemon-behavior] $tw.lares.deriveQuerySkeletonVm absent (plugin not loaded) — recall degrades to content-only (drop-honesty)");
            post(mkDaemonDeriveSkeletonResult({ requestId: msg.requestId }));
          } else {
            const d = fn(msg.query);
            post(mkDaemonDeriveSkeletonResult(
              d ? { requestId: msg.requestId, skeleton: d.skeleton, basis: d.basis } : { requestId: msg.requestId },
            ));
          }
        } catch (err) {
          post(mkDaemonDeriveSkeletonResult({ requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }));
        }
        return true;
      }

      if (type === "daemon:worldline-compare-request") {
        // Well 1, the ITC LIVE-READ — homed in THIS island VM (the cap-stack lifts whole, no
        // coordinator carve-out). The in-VM fn projects the registry from the carried edge-DAG +
        // answers the causal verdict; an unknown handle throws → a graceful `error` across the wire.
        const msg = raw as DaemonMsg_WorldlineCompareRequest;
        try {
          const $tw = (tw5 as { $tw?: { lares?: { worldlineCompareVm?: (i: { a: string; b: string; opens: unknown; closes?: unknown; root?: string }) => { order: string } } } } | undefined)?.$tw;
          const fn = $tw?.lares?.worldlineCompareVm;
          if (!fn) {
            console.warn("[daemon-behavior] $tw.lares.worldlineCompareVm absent (plugin not loaded) — worldline-compare unavailable");
            post(mkDaemonWorldlineCompareResult({ requestId: msg.requestId, error: "worldlineCompareVm absent (plugin not loaded)" }));
          } else {
            const r = fn({
              a: msg.a, b: msg.b, opens: msg.opens,
              ...(msg.closes !== undefined ? { closes: msg.closes } : {}),
              ...(msg.root   !== undefined ? { root: msg.root }     : {}),
            });
            post(mkDaemonWorldlineCompareResult({ requestId: msg.requestId, order: r.order }));
          }
        } catch (err) {
          post(mkDaemonWorldlineCompareResult({ requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }));
        }
        return true;
      }

      if (type === "daemon:worldline-trajectory-request") {
        // Well 3 (THE CORE) + Well 4 (NULL-READY) — homed in THIS island VM. The in-VM fn orders the
        // handle's turns, joins the form-vectors the host shipped, and optionally rides the null
        // shuffle. Total (empty stubs → empty trajectory); a fault degrades to an `error`.
        const msg = raw as DaemonMsg_WorldlineTrajectoryRequest;
        try {
          const $tw = (tw5 as { $tw?: { lares?: { worldlineTrajectoryVm?: (i: { handle: string; stubs: unknown; joinForm?: boolean; includeNull?: boolean; seed?: number; window?: number }) => { trajectory: unknown; nullBaseline?: unknown } } } } | undefined)?.$tw;
          const fn = $tw?.lares?.worldlineTrajectoryVm;
          if (!fn) {
            console.warn("[daemon-behavior] $tw.lares.worldlineTrajectoryVm absent (plugin not loaded) — worldline-trajectory unavailable");
            post(mkDaemonWorldlineTrajectoryResult({ requestId: msg.requestId, error: "worldlineTrajectoryVm absent (plugin not loaded)" }));
          } else {
            const r = fn({
              handle: msg.handle, stubs: msg.stubs,
              ...(msg.joinForm    !== undefined ? { joinForm: msg.joinForm }       : {}),
              ...(msg.includeNull !== undefined ? { includeNull: msg.includeNull } : {}),
              ...(msg.seed        !== undefined ? { seed: msg.seed }               : {}),
              ...(msg.window      !== undefined ? { window: msg.window }           : {}),
            });
            post(mkDaemonWorldlineTrajectoryResult({
              requestId: msg.requestId,
              trajectory: r.trajectory,
              ...(r.nullBaseline !== undefined ? { nullBaseline: r.nullBaseline } : {}),
            }));
          }
        } catch (err) {
          post(mkDaemonWorldlineTrajectoryResult({ requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) }));
        }
        return true;
      }

      if (type === "daemon:gate-verb-request") {
        // A SESSION'S FACE ROW MEETS THE ROUTED CLEARANCE ALONE: local, as the presenter the session door verified (read
        // through this island's presenter mapping), never placed and never dispatched, so no outcome follows; main runs
        // the row once it clears. The clearance takes its locality as given, so no ask the island holds lends it.
        const msg = raw as DaemonMsg_GateVerbRequest;
        const dispatcher = _dispatcher;
        if (!dispatcher) {
          post(mkDaemonGateVerbResult({ requestId: msg.requestId, error: "the daemon's dispatcher does not stand yet" }));
          return true;
        }
        // The invocation never rests and never dispatches, so it carries no clock.
        const invocation = {
          title: `${VERB_URI_PREFIX}${msg.requestId}`, requestId: msg.requestId, action: msg.verb, args: msg.args,
          requestedBy: msg.requestedBy, requestedAt: "", targets: [], batchMode: "best-effort" as const, status: "pending" as const,
        } as Verb;
        const presenter = opts.presenterOf ? opts.presenterOf(invocation, true) : msg.requestedBy;
        dispatcher.clearRouted(invocation, { local: true, presenter }).then(
          () => post(mkDaemonGateVerbResult({ requestId: msg.requestId })),
          (err: unknown) => post(mkDaemonGateVerbResult({ requestId: msg.requestId, error: err instanceof Error ? err.message : String(err) })),
        );
        return true;
      }

      if (type === "daemon:resolve-binding-request") {
        const msg = raw as DaemonMsg_ResolveBindingRequest;
        if (!opts.resolveBinding) {
          post(mkDaemonResolveBindingResult({ requestId: msg.requestId, error: "no resolveBinding configured" }));
        } else {
          opts.resolveBinding(ctx, msg.fingerprint, msg.recipeTrace, msg.wikiSlug)
            .then((r) => post(mkDaemonResolveBindingResult({
              requestId: msg.requestId, personalUrl: r.personalUrl, draftUrl: r.draftUrl, workingUrl: r.workingUrl,
            })))
            .catch((err: unknown) => post(mkDaemonResolveBindingResult({
              requestId: msg.requestId, error: err instanceof Error ? err.message : String(err),
            })));
        }
        return true;
      }

      return false;
    },
  };

  // The daemon's #has stack: dispatch (AUTHORITY plane) + engine-watch + the IDEMPOTENT capture
  // cap (FLOW plane — the bound operator's session-capture duty). dispatch onEa runs first (LIFO
  // teardown stops it last); the capture cap tears down first (final flush, then dispose). The
  // capture cap stays a DISTINCT #has unit — it never gates authz; the master cut holds at the cap
  // shore, not the worker. Inert when no sink is wired (makeCaptureEngine absent) — every daemon
  // carries the cap; whether it breathes depends on a wired sink + feed.
  return composeIsland([
    dispatchCap,
    // Inherit the wiki's render cap — inert until a worker entry wires onBoot (mountProjection), at which
    // point the daemon surfaces like any pinned wiki (same VM, same path).
    hasProjection(opts.onBoot),
    hasEngineWatch(),
    hasCapture({
      ...(opts.makeCaptureEngine ? { makeEngine: opts.makeCaptureEngine } : {}),
      ...(opts.captureTickMs !== undefined ? { tickMs: opts.captureTickMs } : {}),
    }),
  ]);
}

/** One placed ask, as the local book reads it: its id and the act it names. */
export interface LocalAsk { readonly requestId: string; readonly action: string; readonly args: unknown; readonly requestedBy: string }

/**
 * THE LOCAL ASKS, each the exact invocation the vessel's channel or a surface leg placed, standing only while it does
 * (Sol's reads): an id lends locality only to the act placed under it (its verb, its args, its claim), and retires once
 * its verb tiddler leaves the VM, so a summons reusing or overwriting an id reads as the synced claim it is. Kept to a
 * bound; an evicted id reads non-local, which refuses rather than lends.
 */
export function makeLocalAskBook(bound = 4096): {
  add(ask: LocalAsk): void;
  has(ask: LocalAsk): boolean;
  onWikiChange(changes: Record<string, { deleted?: boolean }>): void;
} {
  const acts = new Map<string, string>();
  const actOf = (ask: LocalAsk): string => canonicalJson([ask.action, JSON.parse(JSON.stringify(ask.args ?? {})), ask.requestedBy]);
  return {
    add: (ask) => { acts.delete(ask.requestId); acts.set(ask.requestId, actOf(ask)); if (acts.size > bound) acts.delete(acts.keys().next().value as string); },
    has: (ask) => acts.get(ask.requestId) === actOf(ask),
    onWikiChange: (changes) => {
      for (const [title, change] of Object.entries(changes)) {
        if (change?.deleted && title.startsWith(VERB_URI_PREFIX)) acts.delete(title.slice(VERB_URI_PREFIX.length));
      }
    },
  };
}

export function placedAskIsLocal(msg: Pick<DaemonMsg_PlaceVerb, "origin">): boolean { return msg.origin === "channel" || msg.origin === "surface"; }
