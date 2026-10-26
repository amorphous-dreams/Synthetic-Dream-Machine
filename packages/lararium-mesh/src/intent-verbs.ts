import type { IntentAudience } from "./intent-entry.js";

export type IntentVerbClass = "idempotent" | "per-device" | "single-effect";
export interface IntentVerbDeclaration { readonly class: IntentVerbClass; readonly fenced?: boolean }
export interface IntentVerbRegistry {
  declareIntentVerb(verb: string, classification: IntentVerbClass | IntentVerbDeclaration): void;
  classOfVerb(verb: string): IntentVerbDeclaration | null;
}
export function intentVerbRegistry(): IntentVerbRegistry {
  const table = new Map<string, IntentVerbDeclaration>();
  return {
    declareIntentVerb(verb, classification) { table.set(verb, typeof classification === "string" ? { class: classification } : { ...classification }); },
    classOfVerb(verb) { return table.get(verb) ?? null; },
  };
}
/** A fresh table per caller keeps fixture declarations isolated. */
export function faceIntentVerbs(): IntentVerbRegistry {
  const registry = intentVerbRegistry();
  for (const [verb, classification] of [["face-join", "single-effect"]] as const) registry.declareIntentVerb(verb, classification);
  // Carrier-group MOVE follows the residency action's whole-group law; a replay
  // after its first receipt finds no source group to move and cannot move twice.
  registry.declareIntentVerb("MOVE", "idempotent");
  return registry;
}
/** Test fixtures receive their own registry and never change production declarations. */
export function fixtureIntentVerbs(rows: Readonly<Record<string, IntentVerbClass | IntentVerbDeclaration>>): IntentVerbRegistry {
  const registry = faceIntentVerbs();
  for (const [verb, classification] of Object.entries(rows)) registry.declareIntentVerb(verb, classification);
  return registry;
}
export type IssueRefusal = "unclassified-verb" | "single-effect-unpinned";
export function issueCheck(registry: IntentVerbRegistry, verb: string, audience: IntentAudience): { readonly ok: true; readonly classification: IntentVerbDeclaration } | { readonly ok: false; readonly refusal: IssueRefusal } {
  const classification = registry.classOfVerb(verb);
  if (!classification) return { ok: false, refusal: "unclassified-verb" };
  if (classification.class === "single-effect" && audience.mode !== "pinned" && audience.mode !== "asks") return { ok: false, refusal: "single-effect-unpinned" };
  return { ok: true, classification };
}
