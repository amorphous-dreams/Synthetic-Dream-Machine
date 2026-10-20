/**
 * verb-dispatcher — daemon-VM verb dispatcher for the lararium causal island.
 *
 * Subscription model (dual-path):
 *
 *   LOCAL path  — in-process callers use placeVerb(wiki, opts) to write a
 *                 volatile invocation tiddler at lararium.local.vm/verbs/<id>
 *                 directly to the daemon TW5 wiki. The dispatcher watches wiki
 *                 change events and picks these up immediately.
 *
 *   REMOTE path — external vessels write a verb-summons tiddler at
 *                 bags/daemon/summons/<id> to the Automerge doc. IslandAdaptor flows
 *                 it into the TW5 wiki. The dispatcher's Automerge subscriber
 *                 sees the summons, calls placeVerb() to create the volatile
 *                 invocation, then tombstones the summons tiddler.
 *                 The summons carries edge transport, not durable coordination state.
 *
 * Outcome flow: handler result → concludeVerb → daemon composite store
 *   → IslandAdaptor.saveTiddler → bags/daemon/outcomes/<id> in Automerge → syncs.
 *   Durable shared meaning begins at the outcome, not at the summons.
 *
 * Daemon-only law: ONLY the daemon VM runs a VerbDispatcher. Pinned wiki and
 *   warm/cold wikis are content surfaces — they do not dispatch.
 *
 * Federation model: every lararium vessel runs its own daemon VM + VerbDispatcher.
 *   Invocations are vessel-local scratch. Outcomes sync to all vessels via Automerge.
 *   Vessels coordinate through shared outcome space, not shared invocation queues.
 *
 * Reaction Engine note (UEFN / kumu):
 *   When the Verse-inspired ReactionEngine matures, this dispatcher pattern
 *   federates across causal-island bounds. VerbReactor signatures are pure
 *   (args, context) → result — already ReactionEngine-compatible.
 *
 * Architecture laws:
 *   - TW5 vm primacy: handlers may invoke vm action-widgets.
 *   - Web3 law: no HTTP/RPC control plane. Coordination is TW5 wiki events + CRDT sync.
 *   - Capability hooks: ctx.cap is bound per-invocation to requestedBy DID.
 *
 * Isomorphic: no Node or browser platform APIs. Runs in any sovereign Worker.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/verb-dispatcher
 */

import {
  type Verb,
  type CompositeStore,
  type CapabilityVerifier,
  type VerbTargetResult,
  type LarTiddlerChange,
  parseVerb,
  VERB_URI_PREFIX,
  OUTCOME_URI_PREFIX,
  SUMMONS_URI_PREFIX,
  verbInputDigest,
} from "@lararium/mesh";
import { dispatchVerb, placeVerb, copyEffectOutcome, writeOutcome, removeVerb, EFFECT_URI_PREFIX } from "./verb-vm.js";
import type { TW5Engine } from "./tw5-vm.js";
import { heedSummons } from "./verb-summons.js";
import type { SummonsRequest } from "./verb-summons.js";
import { runLocalVerb, deriveRoutedCap } from "./verb-local-dispatch.js";

export interface VerbContext {
  readonly daemon: CompositeStore;
  readonly invocation: Verb;
  readonly signal?: AbortSignal;
  readonly cap:   (access: import("@lararium/mesh").CapabilityAccess, bagUrl: string) => Promise<import("@lararium/mesh").CapabilityVerifyResult>;
}

export type VerbReactor = (
  args:    Readonly<Record<string, unknown>>,
  context: VerbContext,
) => Promise<Record<string, unknown>>;

/**
 * What a verb tells the SURFACES about itself — the metadata a projection needs, held beside the handler
 * rather than in a second list somewhere.
 *
 * A surface that keeps its own catalogue drifts from the plane it claims to expose, and drift of that kind
 * never announces itself: it shows up as a verb an agent can reach and a human cannot, or the reverse. So a
 * verb declares its surfaces HERE, once, and every projection reads that declaration.
 */
export interface VerbSpec {
  /** One line, shown by whichever surface renders it. */
  readonly summary: string;
  /**
   * Which projections MAY expose this verb. Held open-ended on purpose — a CLI and an agent surface are the
   * two standing today, and a wiki face or a remote face costs a string rather than a redesign.
   */
  readonly surfaces: readonly string[];
  /**
   * TRUE when performing this verb HOLDS A KEY.
   *
   * An agent surface may COMPOSE such an act into a presentable artifact and MUST NEVER execute it: the
   * signing hand stays the human's. The pattern already runs twice in this house — `nexus accept-carriage`
   * mints a token a human carries to a kahu, and a seal roll opens only on a card a live human reads in.
   * Marking it here turns that convention into something a projection can enforce.
   */
  readonly signs?: boolean;
}

/** The surfaces standing today. A projection names its own; nothing here forbids a third. */
export const VERB_SURFACE = { cli: "cli", agent: "agent" } as const;

/** What any table's entry must tell a projection about itself. */
export interface SurfaceDeclared {
  readonly surfaces?: readonly string[];
  readonly signs?:    boolean;
}

/**
 * PROJECT any declaring table onto one surface — the four decisions, held in ONE place.
 *
 * Two tables stand (the CLI's commands run in-process at a terminal; the daemon's verbs route through the
 * VM into a vessel) and they must not merge — but the RULES for reading them must, or the two projections
 * drift on exactly the questions that matter: what an undeclared entry defaults to, whether a key-holding
 * act may execute, and what order a face renders in. Written twice, those answers diverge silently.
 *
 *   · an entry declaring nothing reaches `cli` alone — nothing reaches an agent until a hand declares it
 *   · `executableOnly` drops key-holding acts, so an agent face cannot reach one by accident
 *   · the result sorts by name, so a consuming face renders without re-deriving an order
 */
export function projectOntoSurface<T>(
  items: readonly T[],
  read: (item: T) => (SurfaceDeclared & { readonly name: string }) | undefined,
  surface: string,
  executableOnly = false,
): readonly T[] {
  return items
    .map((item) => ({ item, d: read(item) }))
    .filter((e): e is { item: T; d: SurfaceDeclared & { name: string } } => e.d !== undefined)
    .filter((e) => (e.d.surfaces ?? [VERB_SURFACE.cli]).includes(surface))
    .filter((e) => !(executableOnly && e.d.signs === true))
    .sort((a, b) => a.d.name.localeCompare(b.d.name))
    .map((e) => e.item);
}

export class VerbTable {
  private readonly handlers = new Map<string, VerbReactor>();
  private readonly specs    = new Map<string, VerbSpec>();

  /**
   * Register a verb, optionally declaring what the surfaces should know about it.
   *
   * The spec stays OPTIONAL so a verb may exist without reaching any surface — an internally-routed act is
   * a legitimate thing, and forcing every one of them to declare a summary would invite meaningless ones.
   * An undeclared verb simply projects nowhere, which reads as the honest default: a surface exposes what
   * asked to be exposed, never everything it can see.
   */
  register(verbName: string, handler: VerbReactor, spec?: VerbSpec): void {
    if (this.handlers.has(verbName)) {
      throw new Error(`[verb-dispatcher] duplicate handler for "${verbName}"`);
    }
    this.handlers.set(verbName, handler);
    if (spec) this.specs.set(verbName, spec);
  }

  get(verbName: string): VerbReactor | undefined { return this.handlers.get(verbName); }
  has(verbName: string): boolean { return this.handlers.has(verbName); }
  list(): readonly string[] { return [...this.handlers.keys()].sort(); }

  /** What a verb declared, or undefined when it declared nothing. */
  spec(verbName: string): VerbSpec | undefined { return this.specs.get(verbName); }

  /**
   * PROJECT the plane onto one surface — the verbs that declared it, in a stable order.
   *
   * This reads over what the vessel actually COMPOSED. A verb whose provider cap never composed never
   * registered, so it cannot project — capability-degradation reaching the surface for free, with no
   * per-vessel allowlist to maintain and none to fall out of date. A Herm exposes less than a hearth
   * because it composed less, and nobody wrote that down anywhere.
   */
  project(surface: string, executableOnly = false): readonly { readonly verb: string; readonly spec: VerbSpec }[] {
    const rows = this.list().map((verb) => ({ verb, spec: this.specs.get(verb) }));
    return projectOntoSurface(rows, (r) => r.spec ? { ...r.spec, name: r.verb } : undefined, surface, executableOnly)
      .filter((r): r is { verb: string; spec: VerbSpec } => r.spec !== undefined);
  }

  /**
   * The verbs a surface may EXECUTE, as against merely compose. Identical to `project` except that
   * key-holding acts drop out — so an agent surface built from this cannot reach a signing verb even by
   * accident, and reaching one takes a deliberate call to `project` plus a deliberate compose-only path.
   */
  projectExecutable(surface: string): readonly { readonly verb: string; readonly spec: VerbSpec }[] {
    return this.project(surface, true);
  }
}

export interface VerbDispatcherOptions {
  readonly daemonVm:   TW5Engine;
  readonly daemon:    CompositeStore;
  readonly registry:  VerbTable;
  readonly verifier?: CapabilityVerifier;
  /** Who a verb presents as. Absent: the invocation's own `requestedBy`. The one place every cap check resolves it. */
  readonly presenterOf?: (invocation: Verb) => string;
  /** True for a verb the vessel's own presence channel took; the verifier reads it as `channel: "local"`. */
  readonly localOf?: (invocation: Verb) => boolean;
  readonly routeFn?:  (invocation: Verb) => Promise<Record<string, unknown>>;
}

export class VerbDispatcher {
  private unsubWiki:      (() => void) | null = null;
  private unsubAutomerge: (() => void) | null = null;
  private readonly inFlight = new Set<string>();
  private readonly inFlightAbort = new Map<string, AbortController>();
  private readonly seenSummons = new Set<string>();
  /**
   * Effect dedup (D1, P2.5 iter 4) — one chained promise per effectKey. A second attempt
   * under a NEW requestId with the SAME effectKey finds this entry and chains onto it
   * (awaits the first, THEN re-reads the effect index) rather than racing it — see
   * `dispatchWithEffectDedup` below. Cleared once the chain it names has settled.
   */
  private readonly inFlightEffect = new Map<string, Promise<void>>();

  constructor(private readonly opts: VerbDispatcherOptions) {}

  /** Settles when the startup scan of persisted summons has heeded every pending record. */
  startupScan: Promise<void> = Promise.resolve();

  private async scanSummons(): Promise<void> {
    const titles = (await this.opts.daemon.listVisible()).filter((title) => title.startsWith(SUMMONS_URI_PREFIX));
    for (const title of titles) {
      if (!this.unsubAutomerge) return;
      const top = await this.opts.daemon.resolveTopmost(title);
      if (!top) continue;
      await this.receiveSummons({
        title,
        record: top.record,
        origin: { kind: "crdt-remote", edgeIsland: "startup-replay" },
        bag: top.bagId,
      });
    }
  }

  private receiveSummons(change: LarTiddlerChange): Promise<void> {
    return heedSummons(change, {
      daemon: this.opts.daemon,
      isInFlight: (requestId) => this.inFlight.has(requestId),
      seenRequestIds: this.seenSummons,
      placeVerb: (invocation) => { this.placeVerb(invocation); },
    });
  }

  /** Run the invocation's handler — local registry first, else the verify-then-delegate
   *  route to main, else a "no handler" refusal. Shared by the plain-dispatch path and
   *  the effect-dedup "run fresh" path (both end up calling exactly this). */
  private async runHandler(invocation: Verb, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (this.opts.registry.has(invocation.action)) {
      return runLocalVerb(invocation, {
        daemon:   this.opts.daemon,
        registry: this.opts.registry,
        ...(signal ? { signal } : {}),
        ...(this.opts.verifier ? { verifier: this.opts.verifier } : {}),
        ...(this.opts.presenterOf ? { presenterOf: this.opts.presenterOf } : {}),
        ...(this.opts.localOf ? { localOf: this.opts.localOf } : {}),
      });
    }
    if (this.opts.routeFn) {
      // Verify-then-delegate: the keyholder worker gates the cap BEFORE
      // routing to main; main then trusts the worker→main channel as the
      // capability (project_verification_placement). Enforced only when a
      // real verifier exists; a pre-sovereign/test island (no verifier)
      // routes as before.
      if (this.opts.verifier) {
        const { access, bagUrl } = deriveRoutedCap(invocation);
        const proof = await this.opts.verifier.verify({ presenter: this.opts.presenterOf?.(invocation) ?? invocation.requestedBy, bagUrl, access,
          ...(this.opts.localOf?.(invocation) ? { channel: "local" as const } : {}) });
        if (!proof.ok) {
          throw new Error(`[verb-dispatcher] capability denied for routed verb "${invocation.action}" (bag=${bagUrl}, access=${access}): ${proof.reason ?? "no grant"}`);
        }
      }
      return this.opts.routeFn(invocation);
    }
    throw new Error(`no handler registered for "${invocation.action}"`);
  }

  /**
   * Effect dedup (D1, P2.5 iter 4) — before running, read `<daemon bag>/effects/<effectKey>`.
   * A prior `done` attempt under a DIFFERENT requestId with a MATCHING input digest answers
   * this attempt with a copy of that result (`effect-of: priorRequestId`) and never runs the
   * handler. A changed-digest reuse of the same effectKey string skips the shortcut (logged by
   * name) and runs fresh — the effectKey names an EFFECT, not merely a string, and two requests
   * that hashed differently never shared one. An `error` prior indexes nothing (writeOutcome's
   * own law), so this function never even observes one.
   *
   * Concurrent same-effectKey attempts are serialized through `inFlightEffect`: each call chains
   * onto whatever promise the map already holds for this effectKey (so it AWAITS the one ahead
   * of it before doing its own read), then replaces the map entry with its own promise before
   * returning — so a third concurrent attempt chains onto THIS one in turn.
   */
  private dispatchWithEffectDedup(invocation: Verb, signal?: AbortSignal): Promise<void> {
    const effectKey = invocation.effectKey as string;
    const ahead = this.inFlightEffect.get(effectKey);
    const chained = (ahead ?? Promise.resolve()).catch(() => {}).then(() => this.resolveEffect(invocation, effectKey, signal));
    this.inFlightEffect.set(effectKey, chained);
    return chained.finally(() => {
      if (this.inFlightEffect.get(effectKey) === chained) this.inFlightEffect.delete(effectKey);
    });
  }

  private async resolveEffect(invocation: Verb, effectKey: string, signal?: AbortSignal): Promise<void> {
    const inputDigest = await verbInputDigest({
      verb: invocation.action, args: invocation.args, requestedBy: invocation.requestedBy, effectKey,
    });

    const priorFact = await this.opts.daemon.getLive(EFFECT_URI_PREFIX + effectKey);
    const priorRequestId = priorFact ? String(priorFact.tiddler["request-id"] ?? "") : "";
    if (priorRequestId) {
      const priorOutcome = await this.opts.daemon.getLive(OUTCOME_URI_PREFIX + priorRequestId);
      if (!priorOutcome) {
        // The effect index still names a prior requestId, but that attempt's own outcome
        // is GONE (evicted by the CAS sweep's retention window) — the dedup shortcut has
        // nothing to copy from, and a fresh-run fallthrough would silently re-perform an
        // effect whose prior record a caller can no longer check. Conclude THIS attempt
        // as refused; never run the handler.
        console.log(`[verb-dispatcher] effect "${effectKey}" indexes prior request "${priorRequestId}" whose outcome is evicted — refusing (retention-gap), handler not run`);
        await writeOutcome(this.opts.daemon, {
          invocation, status: "error",
          errorMessage: `effect "${effectKey}" indexes a prior outcome ("${priorRequestId}") that is no longer retained`,
          refusal: "retention-gap",
        });
        removeVerb(this.opts.daemonVm, invocation.title);
        return;
      }
      const priorDigest = String(priorOutcome.tiddler["input-digest"] ?? "");
      if (priorDigest === inputDigest) {
        const priorResults = JSON.parse(String(priorOutcome.tiddler["results"] ?? "{}")) as Record<string, VerbTargetResult>;
        await copyEffectOutcome(this.opts.daemonVm, this.opts.daemon, invocation, {
          priorRequestId, priorResults, inputDigest,
        });
        return;
      }
      console.log(`[verb-dispatcher] effect "${effectKey}" reused with a changed digest (request=${invocation.requestId}, prior=${priorRequestId}) — running fresh, no dedup`);
    }

    await dispatchVerb(this.opts.daemonVm, this.opts.daemon, invocation, () => this.runHandler(invocation, signal));
  }

  start(): void {
    if (this.unsubWiki) return;

    const wiki = this.opts.daemonVm.$tw.wiki;
    const onWikiChange = (changedTiddlers: Record<string, { deleted?: boolean }>) => {
      for (const title of Object.keys(changedTiddlers)) {
        if (!title.startsWith(VERB_URI_PREFIX)) continue;
        if (changedTiddlers[title]?.deleted) {
          const requestId = title.slice(VERB_URI_PREFIX.length);
          this.inFlightAbort.get(requestId)?.abort();
          continue;
        }
        const tw5Tiddler = wiki.getTiddler(title) as { fields: Record<string, unknown> } | undefined;
        if (!tw5Tiddler) continue;
        const invocation = parseVerb(tw5Tiddler.fields);
        if (!invocation || invocation.status !== "pending" || this.inFlight.has(invocation.requestId)) continue;
        const abort = new AbortController();
        this.inFlight.add(invocation.requestId);
        this.inFlightAbort.set(invocation.requestId, abort);
        void this.opts.daemon.getLive(OUTCOME_URI_PREFIX + invocation.requestId).then(async (prior) => {
          // Durable idempotency — the CRDT is the dedup store: a verb whose
          // outcome already landed has already taken effect, so skip re-execution
          // (exactly-once EFFECT, not delivery). See project_asymmetric_peer_handoff.
          if (prior) {
            // Redelivery check: this requestId already has a landed outcome, which stamped
            // its own input digest. A REDELIVERED invocation carrying the SAME requestId but
            // DIFFERENT content never matches it — never a legitimate re-send, so it's worth
            // naming (by requestId + verb) even though the outcome, once landed, is never
            // re-derived either way.
            const priorDigest = prior.tiddler["input-digest"];
            if (typeof priorDigest === "string") {
              const redeliveredDigest = await verbInputDigest({
                verb: invocation.action, args: invocation.args, requestedBy: invocation.requestedBy,
                ...(invocation.effectKey !== undefined && { effectKey: invocation.effectKey }),
              });
              if (redeliveredDigest !== priorDigest) {
                console.warn(`[verb-dispatcher] requestId "${invocation.requestId}" (verb "${invocation.action}") redelivered with a changed input digest against its already-landed outcome — skipping re-execution, not re-deriving`);
              }
            }
            return undefined;
          }
          // Effect dedup (D1): a distinct requestId naming the SAME effect skips the
          // handler entirely when a prior done attempt's digest matches; see above.
          if (invocation.effectKey) return this.dispatchWithEffectDedup(invocation, abort.signal);
          return dispatchVerb(this.opts.daemonVm, this.opts.daemon, invocation, () => this.runHandler(invocation, abort.signal));
        }).catch((err) => {
          console.error("[verb-dispatcher] verb dispatch crashed:", err);
        }).finally(() => {
          this.inFlight.delete(invocation.requestId);
          this.inFlightAbort.delete(invocation.requestId);
        });
      }
    };
    wiki.addEventListener("change", onWikiChange);
    this.unsubWiki = () => wiki.removeEventListener("change", onWikiChange);

    this.unsubAutomerge = this.opts.daemon.subscribe((change) => {
      this.receiveSummons(change).catch((err) => {
        console.error("[verb-dispatcher] summons relay crashed:", err);
      });
    });

    // Startup scan: persisted pending summons are heeded once. The request-id set shared with live
    // delivery keeps a record that also arrives as a change from firing twice.
    this.startupScan = this.scanSummons().catch((err) => {
      console.error("[verb-dispatcher] summons startup scan crashed:", err);
    });

    console.log(`[verb-dispatcher] live — handlers: ${this.opts.registry.list().join(", ") || "(none)"}`);
  }

  stop(): void {
    this.unsubWiki?.(); this.unsubWiki = null;
    this.unsubAutomerge?.(); this.unsubAutomerge = null;
    // The set outlives a heeded summons on purpose (a replica may re-deliver the pending record after our
    // tombstone landed), so it is released with the dispatcher.
    this.seenSummons.clear();
  }

  placeVerb(opts: SummonsRequest): string {
    return placeVerb(this.opts.daemonVm, opts);
  }
}
