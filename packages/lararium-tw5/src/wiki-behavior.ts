/**
 * wiki-behavior — the shared primary-wiki island behavior (isomorphic).
 *
 * Both vessels ran a wiki behavior: node's `makeWikiPrimaryBehavior` carried the
 * full surface (ACTION verb registry + wiki:place-verb dispatch + disk
 * projection), while the browser ran a stub whose onSignal returned false. This
 * holds the shared behavior ONCE: the ACTION verb registry + the full
 * wiki:place-verb dispatch. Platform side-effects (node disk projection, which
 * needs fs) compose IN via the `onBoot` capability hook — node supplies it,
 * browser supplies none. No fs, no node coupling here.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/wiki-behavior
 */

import {
  mkWikiVerbResult,
  wikiSlotUri,
  type BatchMode,
  type WikiMsg_PlaceVerb,
  type Verb,
  type ChangeOrigin,
} from "@lararium/mesh";
import type { CompositeStore } from "@lararium/mesh";
import { registerActionReactors, makeTw5Deserializer } from "./action-handler.js";
import { VerbTable } from "./verb-dispatcher.js";
import { composeIsland } from "./island-caps.js";
import { hasEngineWatch, hasRecipeWatch, hasProjection } from "./has-island-watches.js";
import type { IslandCap } from "./island-caps.js";
import type { IslandBehavior, IslandContext } from "./island-context.js";
import type { RecordPortOptions } from "./record-port-handler.js";
import { hasPortLease } from "./record-port-lease.js";
import { wikiHandBoundary } from "./island-recipe.js";

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
        tw5: makeTw5Deserializer(ctx.tw5),
        ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
        // The keyholder island's gate asked the Kahu predicate for every system bag the routed verb names.
        kahuReachClearedAtGate: true,
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
      void handler(msg.args, {
        daemon: ctx.composite,
        invocation,
        cap:   async () => ({ ok: true, reason: "worker-trust" }),
      }).then((result) => {
        if (msg.requestId) ctx.post(mkWikiVerbResult({ requestId, result }));
      }).catch((err: unknown) => {
        if (msg.requestId) ctx.post(mkWikiVerbResult({ requestId, error: String(err) }));
      });
      return true;
    },
  };

  // The nameless wiki island = a #has cap stack. Order = the original onEa order (dispatch ·
  // projection · engine-watch · recipe-watch); composeIsland's LIFO teardown reproduces the old
  // onHooAnu order (recipe · engine · projection-cleanup · registry-null) exactly. hasProjection is
  // the SHARED render cap the daemon also inherits — one VM, one surface path. Caller-supplied caps
  // fold at the tail — added capability, never a re-ordering of the base channels.
  const handBoundaryCap: IslandCap = {
    name: "wiki-hand-boundary",
    onSignal(type, _raw, ctx) {
      if (type === "lar:control-event" || type === "lar:resend" || type === "wiki:place-verb" || type.startsWith("port:")) {
        wikiHandBoundary(ctx.tw5);
      }
      return false;
    },
  };
  return composeIsland([handBoundaryCap, dispatchCap, hasPortLease(opts.recordPort), hasProjection(opts.onBoot), hasEngineWatch(), hasRecipeWatch(), ...(opts.caps ?? [])]);
}
