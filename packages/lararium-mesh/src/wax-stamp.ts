/**
 * wax-stamp (CIV-5) — the guild's public-plane PROVENANCE keel: does a posted artifact trace to the
 * CURRENT charter, a PAST charter (authentic, just older), or a SPOOF? Provenance of the DATA, never
 * presence of a person — the public-plane DUAL of the private predicate-key (cabal-realm#the-wax-stamp).
 * The membership handshake answers presence, live + peer-to-peer; the wax-stamp answers provenance,
 * public + on the data. Orthogonal.
 *
 * The charter is a hash-linked, content-addressed EPOCH CHAIN: each epoch names its authorizing key-set
 * AND commits one digest per seat's COLD successor key. Every successor reveals its seated cold keys and
 * carries a ROLL signed by the revealed quorum, the seated quorum, and each added seat. It lists
 * KEYS/THRESHOLDS, never a roster. A stamp attests a PAST ("sealed under epoch N"), never present standing.
 *
 * The honest wall, kept lit: "valid trace to lineage L" is a HARD crypto fact (decided here); "L is the
 * legitimate org" is HIGHER-ORDER social acceptance (NOT decided here — a fork yields two internally-valid
 * lineages). Duplicity — two signed inconsistent epochs rolling from one predecessor — IS algorithmically
 * detectable.
 *
 * Order rides the hash link alone: an epoch's place in the lineage IS its `prevEpochCid` chain, so no epoch
 * carries a sequence number.
 */
import { sha256HexSync, canonicalJson, canonicalJsonBytes } from "./crypto.js";
import { CHARTER_SEAT_ROLL_DOMAIN } from "./domains.js";
import { seatNextDigest } from "./cold-key-card.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import { acceptEd25519Key, verifyEd25519, type Ed25519KeyRefusal } from "./ed25519-door.js";

/** A key-set and the quorum rule over it — the preimage `sealKeySetHash` digests. */
export interface SealKeySet { readonly keys: readonly string[]; readonly threshold: number }
/** The forward commitment an epoch carries: one digest per seated key, and the count a roll must reveal. */
export interface SealNext { readonly digests: readonly string[]; readonly threshold: number }
export const UNARMED: SealNext = Object.freeze({ digests: Object.freeze([]), threshold: 0 });
/** The signed ROLL reveals the successor's seats and carries signatures over exactly that transition. */
export interface SealRoll { readonly keys: readonly string[]; readonly threshold: number; readonly signatures: readonly QuorumSignature[] }
/** One epoch binds its seated quorum, positional cold-key commitments and predecessor link. */
export interface SealEpoch {
  readonly epochCid: string;
  readonly keySetHash: string;
  readonly nextKeyDigests: readonly string[];
  readonly nextThreshold: number;
  readonly prevEpochCid: string | null;
  readonly roll?: SealRoll;
}
/** A wax-stamp on posted data — inline, island-local, attests a PAST. */
export interface WaxStamp { readonly artifactHash: string; readonly epochCid: string; readonly sealedAt: string; readonly signature: string }
export type SealVerdict = "CURRENT" | "PAST_AUTHENTIC" | "SPOOF";

const normKeys = (keys: readonly string[]): string[] => [...new Set(keys.map(k => k.toLowerCase()))].sort();
const isThreshold = (t: unknown): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1;
const isHex64 = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/i.test(v);
const isLowerDigest = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const validNext = (n: SealNext, seats: number, threshold: number): boolean => Array.isArray(n?.digests) &&
  (n.digests.length === 0 ? n.threshold === 0 : n.digests.length === seats && n.digests.every(isLowerDigest) && new Set(n.digests).size === seats && n.threshold === threshold);

/** A wax-stamp on posted data — inline, island-local, attests A PAST ("sealed under epoch N"). */
export function sealKeySetHash(keys: readonly string[], threshold: number): string {
  return sha256HexSync(canonicalJson({ keys: normKeys(keys), threshold }));
}
export type SealEpochFields = Omit<SealEpoch, "epochCid" | "roll">;
/**
 * A Nexus AID: `nexus-` and 64 lower hex. ONE CONSTRUCTOR MINTS IT, `sealEpochCidOf` on a genesis: the content
 * address of the charter's first epoch, so every holder derives it alike from public material, it names no vessel,
 * and no roll moves it (a roll appends; the genesis stays first).
 */
export const NEXUS_AID_PATTERN = /^nexus-[0-9a-f]{64}$/;
/**
 * The content-address binds the positional commitments exactly as supplied. A genesis (no `prevEpochCid`) takes the
 * `nexus-` prefix, and its address names the Nexus; every later epoch takes `epoch-`.
 */
export function sealEpochCidOf(fields: SealEpochFields): string {
  const digest = sha256HexSync(canonicalJson({ keySetHash: fields.keySetHash, nextKeyDigests: fields.nextKeyDigests,
    nextThreshold: fields.nextThreshold, prevEpochCid: fields.prevEpochCid }));
  return fields.prevEpochCid === null ? `nexus-${digest}` : `epoch-${digest}`;
}
/** Seal one charter epoch from its authority fields and optional signed roll. */
export function mintCharterEpoch(fields: SealEpochFields, roll?: SealRoll): SealEpoch {
  const epoch: SealEpoch = { ...fields, nextKeyDigests: [...fields.nextKeyDigests], epochCid: sealEpochCidOf(fields) };
  return roll ? { ...epoch, roll } : epoch;
}
/** Seat a genesis; its optional cold successors match the distinct seated keys positionally. */
export function genesisCharterEpoch(keys: readonly string[], threshold: number, next: SealNext = UNARMED): SealEpoch {
  const weak = weakSeatOf(keys);
  if (weak) throw new Error(`charter-seats-a-weak-key — a founding seat refuses (${weak.refusal}): ${weak.key}`);
  const distinct = normKeys(keys);
  if (!isThreshold(threshold) || threshold > distinct.length || !validNext(next, distinct.length, threshold)) throw new Error("roll-malformed");
  return mintCharterEpoch({ keySetHash: sealKeySetHash(keys, threshold), nextKeyDigests: [...next.digests],
    nextThreshold: next.threshold, prevEpochCid: null });
}
export type RotateResult = { readonly ok: true; readonly epoch: SealEpoch } | { readonly ok: false; readonly code: string; readonly reason: string };
export interface SealRollSigner { readonly signer: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** The first key that the Ed25519 door refuses. */
export function weakSeatOf(keys: readonly unknown[]): { readonly key: string; readonly refusal: Ed25519KeyRefusal } | null {
  for (const k of keys) {
    const read = acceptEd25519Key(typeof k === "string" ? k.toLowerCase() : k);
    if (!read.ok) return { key: typeof k === "string" ? k : String(typeof k), refusal: read.refusal };
  }
  return null;
}
/** The six canonical fields a roll's hands sign. */
export function sealRollBytes(parts: { readonly prevEpochCid: string; readonly keys: readonly string[]; readonly threshold: number;
  readonly nextKeyDigests: readonly string[]; readonly nextThreshold: number }): Uint8Array {
  return canonicalJsonBytes({ kind: CHARTER_SEAT_ROLL_DOMAIN, prevEpochCid: parts.prevEpochCid, keys: normKeys(parts.keys),
    threshold: parts.threshold, nextKeyDigests: parts.nextKeyDigests, nextThreshold: parts.nextThreshold });
}

/** Verify one transition in refusal order; history carries every earlier spent digest and seated key. */
export function verifySealRoll(prev: SealEpoch, epoch: SealEpoch, earlier: readonly SealEpoch[] = []): string | null {
  const roll = epoch.roll;
  if (!roll || typeof roll !== "object") return "roll-unsigned";
  if (!Array.isArray(roll.keys) || !Array.isArray(roll.signatures) || !isThreshold(roll.threshold) ||
      !roll.keys.every(isHex64) || !Array.isArray(epoch.nextKeyDigests) || !isThresholdSignatureArray(roll.signatures)) return "roll-malformed";
  const keys = normKeys(roll.keys);
  if (roll.threshold > keys.length) return "roll-malformed";
  if (weakSeatOf(keys)) return "roll-holds-a-weak-key";
  if (sealKeySetHash(keys, roll.threshold) !== epoch.keySetHash) return "roll-key-set-unbound";
  if (!Array.isArray(prev.nextKeyDigests) || prev.nextKeyDigests.length === 0) return "rotation-unarmed";
  // EVERY ROLL RE-ARMS EVERY SEAT IT SEATS: a successor left unarmed would stall the chain at the head it opens.
  if (epoch.nextKeyDigests.length === 0 || !validNext({ digests: epoch.nextKeyDigests, threshold: epoch.nextThreshold }, keys.length, roll.threshold)) return "roll-unarmed-successor";
  const history = [prev, ...earlier];
  const spent = new Set(history.flatMap(e => e.nextKeyDigests).map(d => d.toLowerCase()));
  if (epoch.nextKeyDigests.some(d => spent.has(d.toLowerCase()))) return "roll-respends-a-digest";
  const priorKeys = new Set(history.flatMap(e => e.roll?.keys ?? []).map(k => k.toLowerCase()));
  if (keys.some(k => priorKeys.has(k))) return "roll-reuses-a-seated-key";
  const revealed = new Set(keys.filter(k => prev.nextKeyDigests.includes(seatNextDigest(k))));
  const added = keys.filter(k => !revealed.has(k));
  const bytes = sealRollBytes({ prevEpochCid: prev.epochCid, keys, threshold: roll.threshold,
    nextKeyDigests: epoch.nextKeyDigests, nextThreshold: epoch.nextThreshold });
  const signed = new Set<string>();
  for (const s of roll.signatures) {
    const signer = s.signer.toLowerCase();
    if (!keys.includes(signer) || signed.has(signer)) continue;
    try { if (verifyEd25519(s.sig, bytes, signer)) signed.add(signer); } catch { /* A malformed signature does not count. */ }
  }
  if ([...revealed].filter(k => signed.has(k)).length < prev.nextThreshold) return "roll-short-of-revealed-quorum";
  if ([...keys].filter(k => signed.has(k)).length < roll.threshold) return "roll-short-of-seated-quorum";
  if (added.some(k => !signed.has(k))) return "seat-change-without-proof-of-possession";
  return null;
}
function isThresholdSignatureArray(signatures: readonly QuorumSignature[]): boolean {
  return signatures.every(s => s !== null && typeof s === "object" && typeof s.signer === "string" && isHex64(s.signer.toLowerCase()) &&
    typeof s.sig === "string" && /^[0-9a-f]{128}$/i.test(s.sig));
}
/** Verify the complete hash-linked lineage, passing all earlier epochs to each transition. */
export function verifySealLineage(chain: readonly SealEpoch[]): boolean {
  if (!chain.length) return false;
  const genesis = chain[0]!;
  if (genesis.prevEpochCid !== null || genesis.roll !== undefined || genesis.epochCid !== sealEpochCidOf(genesis)) return false;
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!, prev = chain[i - 1]!;
    if (e.prevEpochCid !== prev.epochCid || e.epochCid !== sealEpochCidOf(e) || verifySealRoll(prev, e, chain.slice(0, i - 1)) !== null) return false;
  }
  return true;
}
/** Advance a chain by revealing the head's positional cold keys and re-arming each seat. */
export async function rotateSealEpoch(head: SealEpoch, seat: SealKeySet, next: SealNext,
  signers: readonly SealRollSigner[], earlier: readonly SealEpoch[] = []): Promise<RotateResult> {
  if (!head.nextKeyDigests.length) return { ok: false, code: "rotation-unarmed", reason: "rotation unarmed" };
  const keys = normKeys(seat.keys);
  const bytes = sealRollBytes({ prevEpochCid: head.epochCid, keys, threshold: seat.threshold,
    nextKeyDigests: next.digests, nextThreshold: next.threshold });
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
  const epoch = mintCharterEpoch({ keySetHash: sealKeySetHash(keys, seat.threshold), nextKeyDigests: [...next.digests],
    nextThreshold: next.threshold, prevEpochCid: head.epochCid }, { keys, threshold: seat.threshold, signatures });
  const code = verifySealRoll(head, epoch, earlier);
  return code ? { ok: false, code, reason: `roll refused — ${code}` } : { ok: true, epoch };
}

/** Classify a wax-stamp against a verified chain. */
export function classifySeal(stamp: WaxStamp, chain: readonly SealEpoch[], verifySig: (stamp: WaxStamp, epoch: SealEpoch) => boolean): SealVerdict {
  if (!verifySealLineage(chain)) return "SPOOF";
  const idx = chain.findIndex(e => e.epochCid === stamp.epochCid);
  if (idx < 0 || !verifySig(stamp, chain[idx]!)) return "SPOOF";
  return idx === chain.length - 1 ? "CURRENT" : "PAST_AUTHENTIC";
}
/** Detect two distinct signed successors of a shared predecessor. */
export function detectDuplicity(a: readonly SealEpoch[], b: readonly SealEpoch[]): string | null {
  const byPrev = new Map<string, string>();
  for (const e of a) if (e.prevEpochCid !== null) byPrev.set(e.prevEpochCid, e.epochCid);
  for (const e of b) if (e.prevEpochCid !== null && byPrev.has(e.prevEpochCid) && byPrev.get(e.prevEpochCid) !== e.epochCid) return e.prevEpochCid;
  return null;
}
/** A wax-stamp's canonical signed bytes. */
export function waxStampProofBytes(artifactHash: string, epochCid: string, sealedAt: string): Uint8Array {
  return new TextEncoder().encode(`lar-wax-stamp/v1|${artifactHash}|${epochCid}|${sealedAt}`);
}
/** A single-key digest retained for the stamp verifier's one-seat floor. */
export function singleKeySetHash(signerKeyHex: string): string { return sha256HexSync(signerKeyHex); }
/** Mint a stamp under an authorized epoch. */
export async function mintWaxStamp(input: { readonly artifactHash: string; readonly epoch: SealEpoch; readonly sealedAt: string;
  readonly sign: (bytes: Uint8Array) => Promise<string> }): Promise<WaxStamp> {
  const signature = await input.sign(waxStampProofBytes(input.artifactHash, input.epoch.epochCid, input.sealedAt));
  return { artifactHash: input.artifactHash, epochCid: input.epoch.epochCid, sealedAt: input.sealedAt, signature };
}
/** Verify a stamp against an authorized signing key. */
export async function verifyWaxStampSig(stamp: WaxStamp, epoch: SealEpoch, signerKeyHex: string,
  keyInSet: (signerKeyHex: string, keySetHash: string) => boolean = (k, h) => singleKeySetHash(k) === h): Promise<boolean> {
  if (!keyInSet(signerKeyHex, epoch.keySetHash)) return false;
  try { return verifyEd25519(stamp.signature, waxStampProofBytes(stamp.artifactHash, stamp.epochCid, stamp.sealedAt), signerKeyHex); }
  catch { return false; }
}
