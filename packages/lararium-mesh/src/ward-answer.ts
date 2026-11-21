/**
 * ward-answer — THE CO-SIGNER'S WARD ON THE WIRE (seat-harness#/the-swarm-slices).
 *
 * Each device holds a WARD KEY per face: a signing key that opens only inside a fresh unlock of that face's ward on that device,
 * its public half riding the device's signed admission into the face (`wardKey`, beside the blinded vessel tag). A node derives it
 * from the face's own ward key (the random key its `ward-slots.bin` tree wraps), a browser mints it at random in the face's own
 * keystore row; neither reads a vessel-wide key or a seed, so two faces of one vessel present ward keys no reader links.
 *
 * An approve of a ward ask carries the answerer's ward signature over (the answer, the ask's digest, the fleet frontier the answerer
 * read), so the co-signer's fresh unlock stands on the wire, and the frontier the outcome must cite rides the co-signer's own
 * signature, never the issuer's alone.
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJsonBytes, utf8Bytes } from "./crypto.js";
import { WARD_ANSWER_DOMAIN, WARD_KEY_POP_DOMAIN, WARD_SIGN_SEED_DOMAIN } from "./domains.js";
import { ed25519VerifyingKeyFromSeed, verifyEd25519 } from "./ed25519-door.js";
import { buildAnswer, type IntentSigner } from "./intent-issue.js";
import type { SignedIntentEntry } from "./intent-entry.js";
import type { IntentView } from "./intent-read.js";
import { WARD_COSIGN_VERBS } from "./intent-verbs.js";

/** The bytes a co-signer's ward key signs in its answer: the answer's own words, the ask's digest and the frontier it read. */
export function wardAnswerImage(parts: {
  readonly group: string; readonly ask: string; readonly detail: string; readonly verdict: "approve" | "deny"; readonly executor: string; readonly frontier: string;
}): Uint8Array {
  return canonicalJsonBytes({ domain: WARD_ANSWER_DOMAIN, group: parts.group, ask: parts.ask, detail: parts.detail, verdict: parts.verdict,
    executor: parts.executor.toLowerCase(), frontier: parts.frontier });
}

/**
 * A node's per-face ward signing seed: derived from the face's own ward key (the random key its ward tree wraps, minted per face at
 * the face's founding or join), never from a seed or a vessel-wide key. The caller zeroes it.
 */
export function wardSigningSeed(wardKey: Uint8Array): Uint8Array {
  if (wardKey.length !== 32) throw new RangeError("ward-answer: a ward key is 32 bytes");
  return hkdf(sha256, wardKey, new Uint8Array(0), utf8Bytes(WARD_SIGN_SEED_DOMAIN), 32);
}

/** The ward key's public half for a seed: what the device's admission into the face carries as `wardKey`. */
export const wardPublicKeyOf = (seed: Uint8Array): Promise<string> => ed25519VerifyingKeyFromSeed(seed);

/** A 64-hex ed25519 public key, as an admission's `wardKey` reads. */
export const isWardKey = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);

/** The bytes a device's ward key signs to prove its admission names a key that device holds: (group, device atom, ward key). */
export function wardKeyPopImage(group: string, deviceKey: string, wardKey: string): Uint8Array {
  return canonicalJsonBytes({ domain: WARD_KEY_POP_DOMAIN, group, deviceKey: deviceKey.toLowerCase(), wardKey });
}

/**
 * True where `wardPop` carries the named ward key's own signature over (group, device atom, ward key): the device holds the key its
 * admission names. A copied public half, or a pop another atom or face carried, holds nothing.
 */
export function wardKeyPopHolds(group: string, deviceKey: string, fields: { readonly wardKey?: unknown; readonly wardPop?: unknown }): boolean {
  if (!isWardKey(fields.wardKey) || typeof fields.wardPop !== "string") return false;
  try { return verifyEd25519(fields.wardPop, wardKeyPopImage(group, deviceKey, fields.wardKey), fields.wardKey); } catch { return false; }
}

/**
 * True where an approve carries the ward signature of `wardKey` (the answerer's admitted ward key) over (the answer, the ask's
 * digest, the frontier the answer names). An answer with no frontier, no signature, or no admitted ward key holds nothing.
 */
export function wardAnswerHolds(group: string, body: Readonly<Record<string, unknown>>, detail: string, wardKey: string | null): boolean {
  if (!isWardKey(wardKey)) return false;
  const { ask, verdict, executor, frontier, wardSig } = body;
  if (typeof ask !== "string" || (verdict !== "approve" && verdict !== "deny") || typeof executor !== "string" || typeof frontier !== "string" || typeof wardSig !== "string") return false;
  try { return verifyEd25519(wardSig, wardAnswerImage({ group, ask, detail, verdict, executor, frontier }), wardKey); } catch { return false; }
}

/**
 * Sign one approve of a ward ask: the atom signs the entry, and `wardSign` (this device's per-face ward key, opened inside a fresh
 * ward unlock) signs (the answer, the ask's digest, the frontier this device read). The frontier rides the answer, so the issuer's
 * outcome cites the frontier the co-signer signed, never one of its own choosing.
 */
export async function buildWardedAnswer(input: {
  readonly group: string; readonly signer: IntentSigner; readonly ask: string; readonly detail: string; readonly executor: string; readonly frontier: string;
  readonly wardSign: (bytes: Uint8Array) => Promise<string>;
}): Promise<SignedIntentEntry> {
  const wardSig = await input.wardSign(wardAnswerImage({ group: input.group, ask: input.ask, detail: input.detail, verdict: "approve", executor: input.executor, frontier: input.frontier }));
  return buildAnswer({ group: input.group, signer: input.signer, ask: input.ask, executor: input.executor, verdict: "approve", refs: [input.ask], frontier: input.frontier, wardSig });
}

/** What an answerer reads before signing, the way the edge co-sign door reads a partial: the act an ask names, taken from the
 *  fold's own verified bytes. Null where no ask under that cid stands. */
export function askShown(view: IntentView, askCid: string): AskShown | null {
  for (const state of view.intents) {
    const ask = state.asks.find((q) => q.cid === askCid);
    if (ask) return { intent: state.id, verb: state.verb, issuer: state.issuer, askedBy: ask.entry.signer, detail: ask.entry.body["detail"] ?? null, cosign: WARD_COSIGN_VERBS.includes(state.verb),
      spent: state.outcomes.some((o) => o.entry.signer === state.issuer) };
  }
  return null;
}
export interface AskShown {
  readonly intent: string; readonly verb: string; readonly issuer: string; readonly askedBy: string; readonly detail: unknown; readonly cosign: boolean; readonly spent: boolean;
}

/** The answer door's refusal, or null where it may sign. An ask this vessel cannot see (it has not synced here) takes no answer,
 *  since nothing tells the door whether it names a ward act. For a ward verb it signs only what the plane counts: an answer to an ask
 *  the issuer signed, from a device other than the issuer, an approve naming the issuer as executor, and never one to an act whose
 *  outcome already spent it (the spend stands frozen at that outcome). */
export function answerRefusal(asked: AskShown | null, signer: string, executor: string, deny: boolean): string | null {
  if (!asked) return "ward-ask-unseen: the ask has not reached this vessel; answer once it syncs";
  if (!asked.cosign) return null;
  if (asked.spent) return "ward-ask-spent: the ward act's outcome already spent its co-sign";
  if (asked.issuer === signer) return "self-answer: a ward act takes another device of the face";
  if (asked.askedBy !== asked.issuer) return "ask-signer: a ward act counts an answer only to its issuer's own ask";
  if (!deny && executor.toLowerCase() !== asked.issuer) return "executor-mismatch: a ward act's approve names its issuer as executor";
  return null;
}
