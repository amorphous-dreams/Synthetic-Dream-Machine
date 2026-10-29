/** Pure issue helpers. The caller supplies every nonce and causal reference. */
import type { PersonaProjection } from "./persona-act.js";
import type { HandLineage } from "./hand-lineage.js";
import { intentEntryCid, signIntentEntry, type IntentAudience, type IntentBound, type IntentEntryKind, type SignedIntentEntry } from "./intent-entry.js";
import { argsWithinPolicy, validDelegateBody, verbInPrefix, type DelegationBound, type DelegationPolicy } from "./intent-delegation.js";
import { INTENT_DELEGATION_DOMAIN } from "./domains.js";
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
export const delegationCid = intentEntryCid;
export async function buildDelegation(input: Base & { readonly epoch: number; readonly agent: string; readonly prefix: string; readonly policy: DelegationPolicy; readonly bound: DelegationBound; readonly nonce: string; readonly verbs?: IntentVerbRegistry }): Promise<SignedIntentEntry> {
  const body = { kind: INTENT_DELEGATION_DOMAIN, group: input.group, entry: "delegate", refs: [], epoch: input.epoch, agent: input.agent, prefix: input.prefix, policy: input.policy, bound: input.bound, nonce: input.nonce };
  if (!validDelegateBody(body)) throw new IntentRefusal("delegation-shape");
  return sign(input, "delegate", { epoch: input.epoch, agent: input.agent, prefix: input.prefix, policy: input.policy, bound: input.bound, nonce: input.nonce });
}
export async function buildDelegationRevoke(input: Base & { readonly epoch: number; readonly delegation: string }): Promise<SignedIntentEntry> {
  if (!/^[0-9a-f]{64}$/.test(input.delegation) || !Number.isSafeInteger(input.epoch) || input.epoch < 0) throw new IntentRefusal("delegation-shape");
  return sign({ ...input, refs: [input.delegation] }, "delegate-revoke", { epoch: input.epoch, delegation: input.delegation });
}
export async function buildAgentIntent(input: Base & { readonly delegation: string; readonly verb: string; readonly args: unknown; readonly nonce: string; readonly audience: IntentAudience; readonly bound?: IntentBound; readonly verbs: IntentVerbRegistry; readonly within?: SignedIntentEntry }): Promise<SignedIntentEntry> {
  if (!/^[0-9a-f]{64}$/.test(input.signer.key)) throw new IntentRefusal("agent-key-shape");
  if (!/^[0-9a-f]{64}$/.test(input.delegation)) throw new IntentRefusal("delegation-shape");
  if (input.within) {
    const b = input.within.body;
    if (intentEntryCid(input.within) !== input.delegation || b.group !== input.group || b.agent !== input.signer.key.toLowerCase() || !validDelegateBody(b as unknown as Record<string, unknown>) ||
      !verbInPrefix(b.prefix as string, input.verb) || !argsWithinPolicy(b.policy as DelegationPolicy, input.args)) throw new IntentRefusal("delegation-shape");
  }
  const check = issueCheck(input.verbs, input.verb, input.audience);
  if (!check.ok) throw new IntentRefusal(check.refusal);
  if (input.audience.mode === "asks" && check.classification.class !== "single-effect") throw new IntentRefusal("asks-requires-single-effect");
  if (check.classification.class === "idempotent" && input.nonce !== "") throw new IntentRefusal("idempotent-nonce");
  return sign({ ...input, refs: [input.delegation] }, "intent", { issuer: input.signer.key.toLowerCase(), delegation: input.delegation, verb: input.verb, args: input.args, nonce: input.nonce, audience: input.audience, ...(input.bound ? { bound: input.bound } : {}) });
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
