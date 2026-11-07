/**
 * wiki-switch-verb — the `wiki-switch` verb's body: activate a wiki grain on reference.
 *
 * `remount: true` marks the OPERATOR's deliberate remount (`lares wiki switch`): it forgets the grain's
 * mount-failure streak first, so the cap re-opens on a hand's act, never on elapsed time. The dispatcher's
 * automatic mount for a wiki-act carries no `remount`, so an automatic retry never clears the cap.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/wiki-activation
 */
import type { WikiActivationCap } from "@lararium/mesh";

export interface WikiSwitchDeps {
  readonly activation: WikiActivationCap;
  readonly pool: { forgetMountFailures(wikiId: string): void };
}

export async function wikiSwitchVerb(args: Record<string, unknown>, deps: WikiSwitchDeps) {
  const slug = String(args["slug"] ?? "");
  if (!slug) throw new Error("wiki-switch: `slug` required");
  if (args["remount"] === true) deps.pool.forgetMountFailures(slug);
  const active = await deps.activation.ensureActive(slug);
  return { verb: "wiki-switch", slug, active: active.ok, ...(!active.ok ? { cause: active.cause, detail: active.detail } : {}), held: [...deps.activation.held()] };
}
