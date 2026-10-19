/**
 * engine-watch — island-side engine-epoch drift detection (isomorphic).
 *
 * The island booted an engine it witnessed (ctx.engine — sha256 the kernel
 * computed over the eval'd core bytes). The lararium doc keeps syncing after
 * boot; when another genesis merges in (reconcileIslandFromGenesis on a vessel
 * carrying a different artifact), the blobs[ENGINE_CORE_ID] entry moves under the
 * running island. This watch observes that move and writes an "engine waiting"
 * alert into the island's OWN temp — alert-only, never auto-reboot: the
 * update arrives as an offer; the operator holds the reboot capability, and
 * reboot re-verifies the new engine from genesis the same way the first booted.
 *
 * Hazard handling (engine-epoch design):
 *   - identity  — an engine IS its hash. A core blob whose sha256 differs from the
 *                 booted one reads "a different engine waits", naming both hashes;
 *                 the watch orders no two engines, since neither a version string
 *                 nor a CID carries a release order. The blob descriptor's version
 *                 rides the text as a display label alone.
 *   - ethics    — "waiting" framing (Service-Worker vocabulary): readiness, not
 *                 coercion. No enforcement lives here.
 *   - authority — deliberately ABSENT (held open until the wiki-mesh lives):
 *                 this watch trusts the lararium doc's write-capability story.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/engine-watch
 */

import {
  BAG_IDS,
  ENGINE_CORE_ID,
  wikiSlotUri,
  type ChangeOrigin,
  type DocHandle,
  type LarDoc,
} from "@lararium/mesh";
import type { IslandContext } from "./island-context.js";

/** The engine-waiting alert tiddler title. Stable title = one coalesced alert;
 *  volatile (temp) → self-clearing on the reboot that adopts the epoch. */
export const ENGINE_WAITING_ALERT_TITLE = "$:/temp/lares/alert/engine-waiting";
/** TW5's built-in alert tag — tiddlers carrying it surface in the alerts area. */
const TW5_ALERT_TAG = "$:/tags/Alert";

/** A hash's short form for the alert text; the tiddler fields carry it whole. */
const short = (sha: string): string => sha.slice(0, 12);

/** The display label a version string reads as, or nothing where the descriptor names none. */
const label = (version: string): string => (version ? ` (labelled ${version})` : "");

/**
 * startEngineWatch — subscribe to the island's lararium-doc handle; on any change
 * whose core-blob sha256 differs from the booted engine, write the waiting
 * alert. Returns a cleanup (unsubscribe) for onHooAnu, or undefined when the
 * island carries no lararium slot (e.g. bare test recipes).
 */
export function startEngineWatch(ctx: IslandContext): (() => void) | undefined {
  const handle = ctx.handles.get(BAG_IDS.oracle) as DocHandle<LarDoc> | undefined;
  if (!handle) return undefined;

  let lastAlertedSha: string | null = null;

  const check = (): void => {
    const entry = handle.doc()?.blobs?.[ENGINE_CORE_ID];
    if (!entry?.sha256) return;
    if (entry.sha256 === ctx.engine.sha256) { lastAlertedSha = null; return; }   // the booted engine: a later move alerts afresh
    if (entry.sha256 === lastAlertedSha) return;             // already alerted this engine
    // The sha guard advances SYNCHRONOUSLY (coalesces repeat change-events for this engine to
    // one put), and a FAILED write never stays swallowed: the engine-waiting notice is an
    // operator-critical alert. A put rejection rolls the guard back to `prevAlerted` while the
    // guard still names this engine, so the NEXT change retries, and surfaces the failure LOUD.
    // A later engine's guard stands through an earlier engine's late failure.
    const prevAlerted = lastAlertedSha;
    const alerting = entry.sha256;
    lastAlertedSha = alerting;

    const incoming = String(entry.version ?? "");
    const message =
      `A different engine waits: ${short(entry.sha256)}${label(incoming)} — reboot to verify and adopt it, ` +
      `or verify its source first (running ${short(ctx.engine.sha256)}${label(ctx.engine.version)}).`;

    // One alert per waiting engine, so its hash names the request.
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: `engine-watch-${entry.sha256}` };
    void ctx.composite.put(
      {
        tiddler: {
          title:           ENGINE_WAITING_ALERT_TITLE,
          text:            message,
          tags:            TW5_ALERT_TAG,
          "alert-kind":    "engine-waiting",
          "waiting-sha256":  entry.sha256,
          "booted-sha256":   ctx.engine.sha256,
        },
      },
      origin,
      { bag: wikiSlotUri(ctx.recipe.wikiSlug, "temp") },
    ).catch((err: unknown) => {
      // The alert write FAILED: the guard rolls back (when it still names this engine) so the
      // next change retries, and the drop surfaces LOUD.
      if (lastAlertedSha === alerting) lastAlertedSha = prevAlerted;
      console.warn(
        `[engine-watch] FAILED to write the engine-waiting alert for ${short(entry.sha256)}${label(incoming)} ` +
        `(sha ${entry.sha256}); rolled back — will retry on the next oracle-doc change: ${String(err)}`,
      );
    });
  };

  const onChange = (): void => check();
  handle.on("change", onChange);
  check();   // the doc may already carry a waiting epoch at ea (offline boot, late mount)
  return () => handle.off("change", onChange);
}
