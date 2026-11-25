/**
 * keeper-cosign — THE VEST'S CO-SIGN, CARRIED: a face of two devices co-signs the keeper's handoff before the commit rests, and the
 * commit carries the spent co-sign so the keeper can read it offline (the keeper opens no document, so it never reads the plane).
 *
 * THE ACT. `ward-keeper-vest` names one keeper commit: its head binds the successor closure D′, the chain head the commit links to
 * (`prev`, null at the founding link), the commit's own nonce and the face's device roster as the vessel read it, so a co-sign
 * answers one commit on one roster and no other. The vessel runs the
 * act through the ward co-sign gate (`wardCosignGate`) with no effect of its own: the gate issues the intent and its ask, a second
 * device of the face approves in its own ward dialog, and the gate signs the outcome that spends it, citing the answer and the
 * frontier that answer names. A spent co-sign never re-spends: a second run reads the spent proof back, and the keeper's commit
 * binds the nonce into its tessera, so one proof rides one commit (a second commit under that nonce refuses, it finds the first).
 *
 * THE PROOF (`KeeperCosign`), one per committed face: the face's ordinal and group, the device atoms its signed admission fold held
 * as the vessel read it (bound into the act's digest), and (on two devices or more) the three signed entries the spend stands on: the issuer's ask (detail = the
 * act's digest), the second device's approve (its atom's signature, and its ward signature over the answer, the digest and the
 * frontier, under the ward key its admission carries) and the issuer's outcome (citing that answer and that frontier).
 *
 * WHAT IT PROVES, AND NO MORE (blind read F2): the roster and the co-signer's ward key ride INSIDE the proof, named by the vessel, and
 * the entries verify under their own signers alone (no admission chain authorizes them). So the proof shows an approve signed by
 * ANOTHER atom of the roster this vessel named, under the ward key it named for that atom: an honest vessel's second device, or an
 * atom a compromised vessel minted itself. It proves second-device consent only as far as the vessel's own roster holds; anchoring
 * the co-signer in the face's admission chain offline stays a course row.
 *
 * `keeperCosignRefusal` reads it offline: every entry verifies under its signer; the ask names the act's intent and digest; the
 * answer comes from a DIFFERENT atom of the carried roster than the issuer, approves with the issuer as executor, and carries its ward
 * signature; the outcome spends exactly that answer at exactly its frontier. Pure: no clock, no document, no network.
 * Meme: lar:///ha.ka.ba/kahua/memory/research/keeper-tessera#/vesting
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { KEEPER_VEST_COSIGN_DOMAIN } from "./domains.js";
import { intentEntryCid, intentId, readIntentEntry, type SignedIntentEntry } from "./intent-entry.js";
import type { IntentView } from "./intent-read.js";
import { wardAnswerHolds, isWardKey } from "./ward-answer.js";
import { cosignDigest, type WardCosignAct } from "./ward-cosign.js";
import { wardCosignGate, wardCosignIntentId, type WardCosignPort } from "./ward-cosign-gate.js";

export const KEEPER_VEST_VERB = "ward-keeper-vest" as const;
/** The name the act binds in the digest's `wiki` slot: the keeper's own chain, never a wiki of the face. */
export const KEEPER_VEST_WIKI = "pulama-keeper" as const;
/** A keeper commit's nonce, as a co-signed commit carries it: 32 random bytes in hex. */
export const KEEPER_NONCE = /^[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** The commit a co-sign binds: the successor closure, the chain head it links to, and its nonce. */
export interface KeeperVestTerms { readonly next: string; readonly prev: string | null; readonly nonce: string }

/** A face's roster as the act binds it: lowercase atoms, each once, sorted. */
export const keeperRoster = (devices: readonly string[]): string[] => [...new Set(devices.map((d) => d.toLowerCase()))].sort();

/**
 * The ward act one keeper commit names, on one face's roster. THE ROSTER RIDES THE DIGEST: the issuer's ask and the co-signer's ward
 * signature both cover the device set the vessel read, so the roster the keeper reads is the one both atoms signed over (and the
 * vessel named; see the header for what that proves).
 */
export function keeperVestAct(terms: KeeperVestTerms, devices: readonly string[]): WardCosignAct {
  return { verb: KEEPER_VEST_VERB, wiki: KEEPER_VEST_WIKI, head: sha256HexBytesSync(canonicalJsonBytes({ domain: KEEPER_VEST_COSIGN_DOMAIN, next: terms.next, prev: terms.prev, nonce: terms.nonce, devices: keeperRoster(devices) })) };
}

/** The spent co-sign's three signed entries and the co-signer's ward key as its admission carries it. */
export interface KeeperCosignProof { readonly wardKey: string; readonly ask: SignedIntentEntry; readonly answer: SignedIntentEntry; readonly outcome: SignedIntentEntry }
/** One committed face's co-sign: its roster as the vessel read it, and the spend (null where the face holds one device). */
export interface KeeperCosign { readonly ordinal: number; readonly group: string; readonly devices: readonly string[]; readonly proof: KeeperCosignProof | null }

export type KeeperCosignReason =
  | "malformed" | "roster-malformed" | "proof-absent" | "proof-unowed" | "entry-unsigned" | "issuer-not-in-face" | "digest-mismatch"
  | "same-device" | "cosigner-not-in-face" | "not-approved" | "executor-mismatch" | "unwarded" | "outcome-mismatch";

const record = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Why a carried co-sign does not answer this commit, or null where it does. Offline: it reads nothing but its arguments. */
export function keeperCosignRefusal(raw: unknown, terms: KeeperVestTerms): KeeperCosignReason | null {
  if (!record(raw) || !Number.isSafeInteger(raw["ordinal"]) || typeof raw["group"] !== "string" || raw["group"].length === 0 || !Array.isArray(raw["devices"])) return "malformed";
  const group = raw["group"], devices = raw["devices"] as unknown[];
  if (!devices.every((d) => typeof d === "string" && HEX64.test(d)) || new Set(devices).size !== devices.length || devices.length === 0) return "roster-malformed";
  const roster = new Set(devices as string[]);
  const proof = raw["proof"];
  if (roster.size < 2) return proof === null || proof === undefined ? null : "proof-unowed";
  if (!record(proof)) return "proof-absent";
  if (!isWardKey(proof["wardKey"])) return "malformed";
  const read = (x: unknown) => { const r = readIntentEntry(x, { group, authorize: () => true }); return r.ok ? r : null; };
  const ask = read(proof["ask"]), answer = read(proof["answer"]), outcome = read(proof["outcome"]);
  if (!ask || !answer || !outcome) return "entry-unsigned";
  if (ask.entry.body.entry !== "asks" || answer.entry.body.entry !== "answer" || outcome.entry.body.entry !== "outcome") return "malformed";
  const issuer = ask.entry.signer.toLowerCase();
  if (!roster.has(issuer)) return "issuer-not-in-face";
  const act = keeperVestAct(terms, devices as string[]);
  const digest = cosignDigest({ act: act.verb, face: group, wiki: act.wiki, head: act.head });
  const id = intentId({ issuer, verb: act.verb, args: { wiki: act.wiki, head: act.head }, nonce: digest });
  if (ask.entry.body["intent"] !== id || ask.entry.body["detail"] !== digest) return "digest-mismatch";
  const cosigner = answer.entry.signer.toLowerCase();
  if (answer.entry.body["ask"] !== ask.cid) return "digest-mismatch";
  if (cosigner === issuer) return "same-device";
  if (!roster.has(cosigner)) return "cosigner-not-in-face";
  if (answer.entry.body["verdict"] !== "approve") return "not-approved";
  if (String(answer.entry.body["executor"] ?? "").toLowerCase() !== issuer) return "executor-mismatch";
  if (!wardAnswerHolds(group, answer.entry.body, digest, proof["wardKey"] as string)) return "unwarded";
  const result = outcome.entry.body["result"];
  if (outcome.entry.signer.toLowerCase() !== issuer || outcome.entry.body["cause"] !== id || !record(result) || result["act"] !== act.verb
    || result["digest"] !== digest || result["answer"] !== answer.cid || result["frontier"] !== answer.entry.body["frontier"]) return "outcome-mismatch";
  return null;
}

/** The spent co-sign of one act as the face's plane holds it, or null where no issuer outcome spends it yet. */
export function keeperCosignProofOf(view: IntentView, port: Pick<WardCosignPort, "group" | "requester" | "wardKey">, terms: KeeperVestTerms, devices: readonly string[]): KeeperCosignProof | null {
  const { id, digest } = wardCosignIntentId(port, keeperVestAct(terms, devices));
  const issuer = port.requester.key.toLowerCase();
  const state = view.intents.find((s) => s.id === id);
  if (!state) return null;
  for (const o of state.outcomes) {
    const result = o.entry.body["result"];
    if (o.entry.signer !== issuer || !record(result) || result["digest"] !== digest) continue;
    const answer = state.answers.find((a) => a.cid === result["answer"]);
    const ask = answer ? state.asks.find((q) => q.cid === answer.entry.body["ask"]) : undefined;
    const wardKey = answer ? port.wardKey(answer.entry.signer) : null;
    if (answer && ask && wardKey !== null) return { wardKey, ask: ask.entry, answer: answer.entry, outcome: o.entry };
  }
  return null;
}

/**
 * THE VESSEL'S SIDE: run one keeper commit's co-sign through the gate and hand back what the commit carries. A face of one device
 * carries its roster and no proof; a face of two carries the spent co-sign, read back where it spent already (it never re-spends).
 * The gate's own refusals pass through unchanged (`ward-awaiting-cosign: <ask cid>` while the second device has not answered).
 */
export async function keeperCosignGate(port: WardCosignPort, at: KeeperVestTerms & { readonly ordinal: number }): Promise<KeeperCosign> {
  const terms = { next: at.next, prev: at.prev, nonce: at.nonce };
  // The roster reads ONCE, at the reach: the act's digest binds it, so the proof and the roster it carries agree by construction.
  const devices = keeperRoster(port.devices());
  const carried = (proof: KeeperCosignProof | null): KeeperCosign => {
    const cosign = { ordinal: at.ordinal, group: port.group, devices, proof };
    const refused = keeperCosignRefusal(cosign, terms);
    if (refused !== null) throw new Error(`keeper-cosign-${refused}: the co-sign this vessel read for the keeper commit would refuse at the keeper`);
    return cosign;
  };
  const spent = (): KeeperCosignProof | null => { const view = port.view(); return view ? keeperCosignProofOf(view, port, terms, devices) : null; };
  const before = spent();
  if (before) return carried(before);
  await wardCosignGate(port, keeperVestAct(terms, devices), async () => undefined);
  return carried(devices.length < 2 ? null : spent());
}

/** A proof's entries by cid, for a reader that wants to name what it carries. */
export const keeperCosignCids = (proof: KeeperCosignProof): { readonly ask: string; readonly answer: string; readonly outcome: string } =>
  ({ ask: intentEntryCid(proof.ask), answer: intentEntryCid(proof.answer), outcome: intentEntryCid(proof.outcome) });
