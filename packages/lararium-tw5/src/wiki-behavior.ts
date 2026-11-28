/**
 * Both vessels compose the same primary-wiki ACTION registry and verb dispatch.
 * The vessel owns durable request decisions; each island asks through its work capability.
 * Platform effects compose through onBoot and carry their own teardown.
 */

import { inCallScope, takeCallTouches } from "@lararium/mesh/call-touches";
import { mkWikiVerbResult, type WikiMsg_PlaceVerb, type WikiMsg_VerbResult } from "@lararium/mesh/island-protocol";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type BatchMode, type Verb, WIKI_OUTCOME_URI_PREFIX, VERB_RESULT_KEY, concludeVerb, verdictRowOf, verbInputDigest, releasedBodyOf } from "@lararium/mesh/verb-tiddler";
import { makeAnswerRing } from "@lararium/mesh/answer-ring";
import { type ChangeOrigin } from "@lararium/mesh/tiddler-store";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { registerActionReactors, makeTw5Deserializer } from "./action-handler.js";
import { VerbTable } from "./verb-dispatcher.js";
import { composeIsland } from "./island-caps.js";
import { hasEngineWatch, hasHandBoundary, hasRecipeWatch, hasProjection } from "./has-island-watches.js";
import type { IslandCap } from "./island-caps.js";
import type { IslandBehavior, IslandContext } from "./island-context.js";
import { workStoreOf } from "./island-context.js";
import type { RecordPortOptions } from "./record-port-handler.js";
import { hasPortLease } from "./record-port-lease.js";
import { hasRenderedTiddlers } from "./rendered-tiddler.js";

/** The reboot-pending alert tiddler title. Tagged `$:/tags/Alert` so TW5's NATIVE
 *  alert area renders it (no custom banner needed). Stable title = one coalesced
 *  alert, not a pile. Volatile (temp) → self-clearing on reboot, which is exactly
 *  what applies the pending change; the operator may also dismiss it (TW5's close
 *  button deletes the tiddler). */
export const REBOOT_ALERT_TITLE = "$:/temp/lares/alert/reboot-pending";

/**
 * The title an alert stands at. A kind holds ONE coalescing alert; a KEY names one instance of a kind
 * (a projection standoff), which stands at its own title so two instances show two alerts.
 */
export function systemAlertTitle(kind: string, key?: string): string {
  if (kind === "reboot-pending") return REBOOT_ALERT_TITLE;
  return key ? `$:/temp/lares/alert/${kind}/${key}` : `$:/temp/lares/alert/${kind}`;
}

/**
 * Place, or clear, an alert in a wiki's OWN temp layer (volatile; gone at reboot). `clear` removes the
 * keyed alert: the condition it named stands resolved.
 */
export async function placeSystemAlert(
  composite: Pick<CompositeStore, "put" | "tombstoneInBag">,
  wikiSlug: string,
  args: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const message = typeof args["message"] === "string" ? args["message"] : "A change requires a reboot to apply.";
  const cause   = typeof args["cause"]   === "string" ? args["cause"]   : "";
  const kind    = typeof args["kind"] === "string" && args["kind"] ? args["kind"] : "reboot-pending";
  const key     = typeof args["key"] === "string" && /^[0-9a-f]{8,64}$/.test(args["key"]) ? args["key"] : undefined;
  const title   = systemAlertTitle(kind, key);
  const bag     = wikiSlotUri(wikiSlug, "temp");
  const origin: ChangeOrigin = { kind: "lares-verb", requestId: `alert-${Date.now()}` };
  if (args["clear"] === true) {
    if (key === undefined) return { cleared: false, title };
    await composite.tombstoneInBag(bag, title, origin);
    return { cleared: true, title };
  }
  await composite.put(
    {
      tiddler: {
        title,
        text:        message,
        tags:        TW5_ALERT_TAG,   // surfaces in TW5's native alert area
        "alert-kind": kind,
        cause,
        ts:          new Date().toISOString(),
      },
    },
    origin,
    { bag },
  );
  return { seeded: true, title };
}
/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. */
const TW5_ALERT_TAG = "$:/tags/Alert";

export interface WikiBehaviorOptions {
  recordPort?: RecordPortOptions;
  /**
   * Platform side-effects to start on ea (e.g. node disk projection). Returns a
   * cleanup run on demote, or undefined for none. Browser supplies nothing —
   * the disk projector is a node-held capability (fs), composed in, not forked.
   */
  onBoot?: (ctx: IslandContext) => (() => void | Promise<void>) | undefined;
  /**
   * Further #has caps the worker composes onto the wiki island's stack (e.g. the
   * `hasWikiSensorium` perceiver). They fold AFTER the base caps, so the dispatch and
   * projection channels keep signal precedence; teardown mirrors (LIFO).
   */
  caps?: readonly IslandCap[];
}

/** The isomorphic primary-wiki island behavior. */
export function makeWikiBehavior(opts: WikiBehaviorOptions = {}): IslandBehavior {
  let _registry: VerbTable | null = null;
  const answers = makeAnswerRing();
  const inFlight = new Map<string, { digest: Promise<string>; task: Promise<WikiMsg_VerbResult> }>();

  // #has wiki-dispatch — the ACTION verb registry + the wiki:place-verb channel (the synapse).
  const dispatchCap: IslandCap = {
    name: "wiki-dispatch",
    onEa(ctx: IslandContext) {
      // Residency Model ACTION verb family — ADD / COPY / MOVE / CLEAR / DROP /
      // LOAD reactors wrapping each bag mutation in withEffectRecord (audit).
      const registry = new VerbTable();
      // Native TW5 filetype deserialization for LOAD — resolved lazily through the
      // island's live $tw at action time (post-boot), so LOAD lands every legal TW5
      // filetype via TW5's own registry. The memetic carriers stay on their own path.
      // resolveByCid rides in from the IslandContext (the kernel's host CAS shore) so a
      // handle-only carrier (a `textCid`, no inline `text`) resolves island-side — without
      // it a skinny body throws "no resolveByCid" and never lands. Absent on a memory-storage
      // island (no CAS dir); the ingest path faults loud there rather than fabricating a body.
      registerActionReactors(registry, {
        composite: ctx.composite,
        diskMirrors: ctx.diskMirrors ?? [],
        tw5: makeTw5Deserializer(ctx.tw5),
        ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
        // The keyholder island's gate asked the Kahu predicate for every system bag the routed verb names.
        kahuReachClearedAtGate: true,
        // A wave's render warnings stand as alerts in this wiki's OWN temp; a clear touches only an alert that stands.
        alert: async (alert) => {
          if (alert.clear && (await ctx.composite.getLive(systemAlertTitle(alert.kind, alert.key))) === null) return;
          await placeSystemAlert(ctx.composite, ctx.recipe.wikiSlug, { message: alert.message, cause: "ingest", kind: alert.kind, key: alert.key, ...(alert.clear ? { clear: true } : {}) });
        },
      });
      // system-alert — the daemon worker (via main → pool.placeWikiVerb) delivers a
      // reboot-pending notice; the island writes it into its OWN temp (volatile,
      // self-clearing on reboot). The daemon never reaches into this composite directly.
      registry.register("system-alert", (args) => placeSystemAlert(ctx.composite, ctx.recipe.wikiSlug, args));
      _registry = registry;
      return () => {
        _registry = null;
      };
    },

    onSignal(type: string, raw: unknown, ctx: IslandContext): boolean {
      if (type === "wiki:request-drain") { ctx.requestDrain?.(); return true; }
      if (type !== "wiki:place-verb") return false;
      if (!_registry) return false;
      const msg = raw as WikiMsg_PlaceVerb;
      const requestId = msg.requestId ?? crypto.randomUUID();
      const handler = _registry.get(msg.verb);
      if (!handler) {
        if (msg.requestId) ctx.post(mkWikiVerbResult({ requestId, error: `no handler for "${msg.verb}"` }));
        return true;
      }
      const invocation: Verb = {
        requestId,
        title:       `lar:///ha.ka.ba/bags/wiki/verbs/${requestId}`,
        action:      msg.verb,
        args:        msg.args,
        targets:     msg.targets ?? [],
        batchMode:   (msg.batchMode as BatchMode) ?? "single",
        status:      "pending",
        requestedBy: msg.requestedBy,
        requestedAt: new Date().toISOString(),
      };
      const title = `${WIKI_OUTCOME_URI_PREFIX}${ctx.recipe.wikiSlug}/${requestId}`;
      const input = verbInputDigest({ verb: msg.verb, args: { args: msg.args, targets: msg.targets ?? [], batchMode: invocation.batchMode } });
      const held = inFlight.get(title);
      let task = held?.task;
      if (!task) {
        task = (async (): Promise<WikiMsg_VerbResult> => {
          const work = workStoreOf(ctx);
          const origin: ChangeOrigin = { kind: "lares-verb", requestId };
          const digest = await input;
          const prior = await work.getLive(title);
          if (prior) {
            const fields = prior.tiddler;
            if (fields["input-digest"] !== digest) throw new Error(`request-input-changed: ${requestId}; inspect the recorded act before choosing a fresh request id`);
            if (fields["status"] === "running") throw new Error(`request-interrupted: ${requestId}; inspect what the act left before choosing a fresh request id`);
            if (fields["status"] === "error") return mkWikiVerbResult({ requestId, error: String(fields["error-message"] ?? "the recorded act failed; inspect its result"), touched: {} });
            const held = answers.get(requestId);
            const results = held ? JSON.parse(String(held.tiddler["results"])) as Record<string, { output?: Record<string, unknown> }> : null;
            return mkWikiVerbResult({ requestId, result: results?.[VERB_RESULT_KEY]?.output ?? { completed: true, ...releasedBodyOf(fields) }, touched: {} });
          }
          await work.put({ tiddler: { title, "request-id": requestId, verb: msg.verb, status: "running", "input-digest": digest } }, origin);
          let result: Record<string, unknown> | undefined;
          let error: string | undefined;
          try {
            result = await inCallScope(requestId, () => handler(msg.args, {
              daemon: ctx.composite, invocation, cap: async () => ({ ok: true, reason: "worker-trust" }),
            }));
          } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
          const touched = takeCallTouches(requestId) ?? {};
          const answer = concludeVerb({ requestId, verb: msg.verb, status: error === undefined ? "done" : "error", inputDigest: digest, cause: invocation.title, batchMode: invocation.batchMode,
            results: { [VERB_RESULT_KEY]: { ok: error === undefined, ...(result !== undefined && { output: result }) } },
            ...(error !== undefined && { errorMessage: error }), touched });
          const row = verdictRowOf(answer);
          await work.put({ ...row, tiddler: { ...row.tiddler, title } }, origin);
          answers.put(answer);
          return mkWikiVerbResult({ requestId, ...(error !== undefined ? { error } : { result: result ?? {} }), touched });
        })().finally(() => { inFlight.delete(title); });
        inFlight.set(title, { digest: input, task });
      }
      void task.then(async (answer) => {
        if (held && await held.digest !== await input) throw new Error(`request-input-changed: ${requestId}; inspect the recorded act before choosing a fresh request id`);
        if (msg.requestId) ctx.post(answer);
      }).catch((cause: unknown) => {
        if (msg.requestId) ctx.post(mkWikiVerbResult({ requestId, error: cause instanceof Error ? cause.message : String(cause), touched: {} }));
      });
      return true;
    },
  };

  // The nameless wiki island = a #has cap stack. Order: dispatch ·
  // projection · engine-watch · recipe-watch; composeIsland's LIFO teardown runs
  // recipe · engine · projection-cleanup · registry-null. hasProjection is
  // the SHARED render cap the daemon also inherits — one VM, one surface path. Caller-supplied caps
  // fold at the tail — added capability, never a re-ordering of the base channels.
  return composeIsland([hasHandBoundary(), dispatchCap, hasPortLease(opts.recordPort), hasProjection(opts.onBoot), hasEngineWatch(), hasRecipeWatch(), hasRenderedTiddlers(), ...(opts.caps ?? [])]);
}
