import type { IntentAudience } from "./intent-entry.js";
import { SWARM_LEI_COSIGNED_RITES, wardLeiVerb } from "./swarm-lei-rite.js";

export type IntentVerbClass = "idempotent" | "per-device" | "single-effect";
/**
 * `cosign`: the verb's answer counts only from a device other than the issuer (a ward verb whose effect leaves the device).
 * `fixes`: the arguments an intent of the verb carries from its word, each one a thing the effect would otherwise draw for
 * itself (chance, a time): fixed at the word, every answer and every re-run reads the same effect.
 * `bars`: an argument whose text names a draw of chance the effect would make for itself (by argument, the token that draws):
 * an intent naming it refuses, so every answer of one votum lands the same effect.
 */
export interface IntentVerbDeclaration {
  readonly class: IntentVerbClass; readonly fenced?: boolean; readonly cosign?: boolean; readonly fixes?: readonly string[];
  readonly bars?: Readonly<Record<string, string>>;
}
/** The ward verbs a second device of the face co-signs: a kapae lowered, the house cap, a lei of each rite whose effect leaves the device
 *  (`ward-push-lei`; a kukulu lei stays home), and the keeper's vest (`ward-keeper-vest`: the house's end of the bond leaves this keeper). */
export const WARD_COSIGN_VERBS: readonly string[] = Object.freeze(["ward-kapae-lower", "ward-house-cap", ...SWARM_LEI_COSIGNED_RITES.map(wardLeiVerb), "ward-keeper-vest"]);
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
  // A kahua proposal batch pins the device whose daemon holds the bodies; the door runs no effect for it: the operator's
  // hand answers it with a lift on the stage (`kahua-stage`).
  registry.declareIntentVerb("kahua-lift", "per-device");
  // A ward act whose effect leaves the device asks a second device of the face: one effect, the answer a distinct device's.
  for (const verb of WARD_COSIGN_VERBS) registry.declareIntentVerb(verb, { class: "single-effect", cosign: true });
  // THE DETERMINISTIC ENACTORS: each pays its votum through the door's declared effect, never through an AI. The calendar
  // reads no clock and writes nothing (the caller names the day). A cast lands one tiddler under `create`, its title drawn
  // from its time and its hexagrams, so the issuer throws its coins at the word: every answer then lands the same cast, and
  // a re-run meets the standing one.
  // The calendar's one draw of chance, its `%.` exclamation, bars from a votum (a literal `%%.` bars too: the word stays plain).
  registry.declareIntentVerb("ddate", { class: "idempotent", bars: { format: "%." } });
  registry.declareIntentVerb("oracle-cast", { class: "idempotent", fixes: ["at", "coins"] });
  // CUSTODY FACE AGAINST FACE (comms-ux-enacts landing 13): a write the island shore routes into a layer another face holds rides
  // as a votum to that face, and the holder's own actor drains it through its own door verb. Each carries its base, so a second
  // answer meets the first one's landing and converges (a noop, or a conflict that lands nothing). The drain pays one only on the
  // VOWER's proof and the vower's own grant on the bag (`shore-votum`); a proofless intent and an agent's relayed one pay nothing.
  registry.declareIntentVerb("tiddler-put", "idempotent");
  registry.declareIntentVerb("tiddler-delete", "idempotent");
  return registry;
}
/** Test fixtures receive their own registry and never change production declarations. */
export function fixtureIntentVerbs(rows: Readonly<Record<string, IntentVerbClass | IntentVerbDeclaration>>): IntentVerbRegistry {
  const registry = faceIntentVerbs();
  for (const [verb, classification] of Object.entries(rows)) registry.declareIntentVerb(verb, classification);
  return registry;
}
export type IssueRefusal = "unclassified-verb" | "single-effect-unpinned" | "cosign-needs-asks";
/** What a word whose id stands taken does next, by its verb's class: an idempotent verb takes the empty nonce alone, so another votum changes its arguments; any other verb names a fresh nonce. */
export function intentIdTakenAdvice(classification: IntentVerbDeclaration | null): string {
  return classification?.class === "idempotent"
    ? "the same word names the same votum; change the arguments to word another"
    : "the same word names the same votum; name a fresh nonce to word another";
}
/** What an intent's nonce and arguments owe its verb's class: an idempotent verb takes the empty nonce, and each fixed argument rides the word. */
export function issueArgsCheck(classification: IntentVerbDeclaration, nonce: unknown, args: unknown): "idempotent-nonce" | "args-unfixed" | "args-draw-chance" | null {
  if (classification.class === "idempotent" && nonce !== "") return "idempotent-nonce";
  const named = typeof args === "object" && args !== null && !Array.isArray(args) ? args as Record<string, unknown> : {};
  if ((classification.fixes ?? []).some((key) => named[key] === undefined || named[key] === null || named[key] === "")) return "args-unfixed";
  if (Object.entries(classification.bars ?? {}).some(([key, token]) => typeof named[key] === "string" && (named[key] as string).includes(token))) return "args-draw-chance";
  return null;
}
export function issueCheck(registry: IntentVerbRegistry, verb: string, audience: IntentAudience): { readonly ok: true; readonly classification: IntentVerbDeclaration } | { readonly ok: false; readonly refusal: IssueRefusal } {
  const classification = registry.classOfVerb(verb);
  if (!classification) return { ok: false, refusal: "unclassified-verb" };
  if (classification.class === "single-effect" && audience.mode !== "pinned" && audience.mode !== "asks") return { ok: false, refusal: "single-effect-unpinned" };
  // A cosign verb's second device speaks only through an answer, and only the asks audience reads one: a pin skips it.
  if (classification.cosign && audience.mode !== "asks") return { ok: false, refusal: "cosign-needs-asks" };
  return { ok: true, classification };
}
