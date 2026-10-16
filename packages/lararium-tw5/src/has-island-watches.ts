/**
 * has-island-watches — the shared drift-watch caps a TW5 VM causal island composes.
 *
 * Both the daemon and wiki islands ran `startEngineWatch` in onEa and stopped it in onHooAnu; the
 * wiki island also ran `startRecipeWatch`. These extract those into `#has` caps so a nameless
 * island stacks them like any other component — the watch is a capability, not a behavior-class
 * member. Each cap's onEa returns the watch's stop fn, which composeIsland registers as a LIFO
 * teardown.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/island-caps
 */

import { startEngineWatch } from "./engine-watch.js";
import { startRecipeWatch } from "./recipe-watch.js";
import { dispatchLarControlEvent, resendLarCamera } from "./tw5-projection.js";
import type { IslandCap } from "./island-caps.js";
import type { IslandContext } from "./island-context.js";
import { LAR_CONTROL_EVENT, LAR_RESEND, readLarControlEvent, readLarResend } from "@lararium/mesh";

/** `#has` engine-epoch drift watch — self-writes the engine-waiting alert when a new genesis
 *  merges into the live lararium doc under this running island (alert-only; reboot adopts). */
export function hasEngineWatch(): IslandCap {
  return { name: "engine-watch", onEa: (ctx) => startEngineWatch(ctx) };
}

/** `#has` recipe/composition watch — applies recipe membership + oracle moves live, no reboot. */
export function hasRecipeWatch(): IslandCap {
  return { name: "recipe-watch", onEa: (ctx) => startRecipeWatch(ctx) };
}

/**
 * `#has` wiki-projection — the OUT=coalesce render (the `onBoot` shore mounts it: node disk / browser DOM)
 * plus the camera contract's RETURN leg. ANY TW5 VM island composes this to become surfaceable — the daemon
 * inherits the SAME cap the pinned wiki carries, so "pin the daemon" and "pin any wiki" ride one path (it's all
 * the same VM under the hood). role = capability ≠ platform: the caller's onBoot supplies the disk or DOM mount;
 * the cap stays the same.
 */
export function hasProjection(onBoot?: (ctx: IslandContext) => (() => void | Promise<void>) | undefined): IslandCap {
  return {
    name: "wiki-projection",
    onEa: (ctx) => onBoot?.(ctx),
    onSignal(type: string, raw: unknown, ctx?: IslandContext): boolean {
      // A person's act, sense, write or service answer. The reader fails closed (one target, whole revisions,
      // a bounded whole value), and this cap CLAIMS the kind either way, so a refused read ends as a drop
      // rather than falling through to a cap that never expected it.
      if (type === LAR_CONTROL_EVENT) {
        const ev = readLarControlEvent(raw);
        if (ev) dispatchLarControlEvent(ev);
        return true;
      }
      // The page asks a camera to paint itself whole: a surface switched to it, or attached late.
      if (type === LAR_RESEND) {
        const msg = readLarResend(raw);
        if (msg) resendLarCamera(msg, ctx?.wikiUri);
        return true;
      }
      return false;
    },
  };
}
