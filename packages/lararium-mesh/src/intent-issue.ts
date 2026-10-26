/** Pure issue helpers. The caller supplies every nonce and causal reference. */
import type { PersonaProjection } from "./persona-act.js";
import type { HandLineage } from "./hand-lineage.js";
import { signIntentEntry, type IntentAudience, type IntentBound, type IntentEntryKind, type SignedIntentEntry } from "./intent-entry.js";
import { issueCheck, type IntentVerbRegistry } from "./intent-verbs.js";

export type IntentSigner = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export class IntentRefusal extends Error {
  override readonly name: string;
  constructor(name: string) { super(`intent issue: ${name}`); this.name = name; }
}
type Base = { readonly group: string; readonly signer: IntentSigner; readonly refs?: readonly string[] };
const sign = (base: Base, entry: IntentEntryKind, fields: Record<string, unknown>): Promise<SignedIntentEntry> =>
  signIntentEntry({ group: base.group, entry, refs: base.refs ?? [], ...fields }, base.signer);

export async function buildIntent(input: Base & { readonly verb: string; readonly args: unknown; readonly nonce: string; readonly audience: IntentAudience; readonly bound?: IntentBound; readonly verbs: IntentVerbRegistry }): Promise<SignedIntentEntry> {
  const check = issueCheck(input.verbs, input.verb, input.audience);
  if (!check.ok) throw new IntentRefusal(check.refusal);
  if (input.audience.mode === "asks" && check.classification.class !== "single-effect") throw new IntentRefusal("asks-requires-single-effect");
  if (check.classification.class === "idempotent" && input.nonce !== "") throw new IntentRefusal("idempotent-nonce");
  return sign(input, "intent", { issuer: input.signer.key.toLowerCase(), verb: input.verb, args: input.args, nonce: input.nonce, audience: input.audience, ...(input.bound ? { bound: input.bound } : {}) });
}
export const buildAsks = (input: Base & { readonly intent: string; readonly needs: "approval" | "executor" | "capability"; readonly detail?: unknown }) =>
  sign(input, "asks", { intent: input.intent, needs: input.needs, ...(input.detail === undefined ? {} : { detail: input.detail }) });
export const buildAnswer = (input: Base & { readonly ask: string; readonly verdict: "approve" | "deny"; readonly executor?: string }) =>
  sign(input, "answer", { ask: input.ask, verdict: input.verdict, ...(input.executor ? { executor: input.executor } : {}) });
export const buildOutcome = (input: Base & { readonly cause: string; readonly result: unknown; readonly slot?: string }) =>
  sign(input, "outcome", { cause: input.cause, result: input.result, ...(input.slot ? { slot: input.slot } : {}) });
export const buildClaim = (input: Base & { readonly intent: string }) => sign(input, "claim", { intent: input.intent });
export const buildTakeover = (input: Base & { readonly claim: string }) => sign(input, "takeover", { claim: input.claim });
export const buildRelease = (input: Base & { readonly intent: string; readonly claim?: string; readonly epoch: number }) =>
  sign(input, "release", { intent: input.intent, epoch: input.epoch, ...(input.claim ? { claim: input.claim } : {}) });
export const buildSupersede = (input: Base & { readonly intent: string; readonly by?: string; readonly epoch: number }) =>
  sign(input, "supersede", { intent: input.intent, epoch: input.epoch, ...(input.by ? { by: input.by } : {}) });
export const buildCancel = (input: Base & { readonly intent: string; readonly epoch: number }) => sign(input, "cancel", { intent: input.intent, epoch: input.epoch });

/** The verified persona projection supplies admission boundaries; the caller supplies verified lineage. */
export function faceRosterForIntents(projection: PersonaProjection, lineage: HandLineage) {
  return { devices: projection.devices, rosterCids: projection.cids, admittedAt: new Map(projection.admissions.map(({ deviceKey, cid }) => [deviceKey, cid])), lineage };
}
