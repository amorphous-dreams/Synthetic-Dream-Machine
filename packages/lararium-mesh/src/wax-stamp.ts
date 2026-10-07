/**
 * wax-stamp (CIV-5) — the guild's public-plane PROVENANCE keel: does a posted artifact trace to the
 * CURRENT charter, a PAST charter (authentic, just older), or a SPOOF? Provenance of the DATA, never
 * presence of a person — the public-plane DUAL of the private predicate-key (cabal-realm#the-wax-stamp).
 * The membership handshake answers presence, live + peer-to-peer; the wax-stamp answers provenance,
 * public + on the data. Orthogonal.
 *
 * The charter is a pre-rotated, hash-linked, content-addressed EPOCH CHAIN (TUF ≈ KERI): each epoch
 * names its authorizing key-set AND pre-commits a digest of the NEXT epoch's keys, and every successor
 * carries a ROLL that the revealed, pre-committed keys SIGN — so stealing today's council keys cannot forge
 * tomorrow's charter, and knowing a revealed key-set's PUBLIC keys forges no epoch at all. It lists
 * KEYS/THRESHOLDS, never a roster. A stamp attests
 * A PAST ("sealed under epoch N"), NEVER "the org endorses this now" — which is what preserves no-global-
 * now: the seal is a frozen causal fact, and present-standing reads live on the SEPARATE handshake.
 *
 * The honest wall, kept lit: "valid trace to lineage L" is a HARD crypto fact (decided here); "L is the
 * legitimate org" is HIGHER-ORDER social acceptance (NOT decided here — a fork yields two internally-valid
 * lineages). Duplicity — two signed inconsistent epochs rolling from one predecessor — IS algorithmically
 * detectable.
 *
 * Order rides the hash link alone: an epoch's place in the lineage IS its `prevEpochCid` chain, so no epoch
 * carries a sequence number.
 */

import * as ed25519 from "@noble/ed25519";
import { ed25519 as ed25519Sync } from "@noble/curves/ed25519.js";
import { sha256HexSync, hexToBytes, canonicalJson, canonicalJsonBytes } from "./crypto.js";
import { SEAL_ROLL_DOMAIN } from "./domains.js";
import type { QuorumSignature } from "./kapae-antigen.js";

/** A key-set and the quorum rule over it — the preimage `sealKeySetHash` digests. */
export interface SealKeySet {
  readonly keys:      readonly string[];
  readonly threshold: number;
}

/**
 * The signed ROLL a successor epoch carries — the KERI rotation event. Public charter material only.
 *
 *   · `keys` / `threshold` — the epoch's seated key-set, which `sealKeySetHash` binds to its `keySetHash`.
 *   · `revealed`           — the preimage of the predecessor's `nextKeyCommit`, present only when the seated
 *                            set differs from it (a SEAT CHANGE). Absent, the seated set IS the reveal.
 *   · `signatures`         — over `sealRollBytes`: at least the revealed threshold of the REVEALED keys (the
 *                            pre-committed hands, which carry the prior epoch's authority), at least the
 *                            seated threshold of the SEATED keys, and EVERY seated key the commitment did not
 *                            name (proof of possession — a seat change never seats a key nobody holds).
 *
 * The pre-commitment evidence (`revealed`) rides OUTSIDE the signed bytes, so a per-seat commitment can
 * replace the single digest without re-shaping what the hands sign.
 */
export interface SealRoll {
  readonly keys:       readonly string[];
  readonly threshold:  number;
  readonly revealed?:  SealKeySet;
  readonly signatures: readonly QuorumSignature[];
}

/** One epoch in the charter's pre-rotated, hash-linked lineage. Content-addressed by `epochCid`. */
export interface SealEpoch {
  readonly epochCid:      string;         // content-address of THIS epoch record (`sealEpochCidOf`)
  readonly keySetHash:    string;         // digest of the key-set/quorum authorized to seal UNDER this epoch
  readonly nextKeyCommit: string;         // KERI pre-rotation: digest of the NEXT epoch's authorized keys
  readonly prevEpochCid:  string | null;  // hash-link to the predecessor (null at genesis)
  readonly roll?:         SealRoll;       // the signed rotation event; every successor carries one, genesis none
}

/** A wax-stamp on posted data — inline, island-local, attests A PAST ("sealed under epoch N"). */
export interface WaxStamp {
  readonly artifactHash: string;   // the sealed artifact's content hash
  readonly epochCid:     string;   // the charter epoch this seal cites
  readonly sealedAt:     string;   // an ITC/logical BOUND-PAST (the epoch's t0..t1); never "now"
  readonly signature:    string;   // by a key in the cited epoch's key-set
}

/** current: sealed under the head epoch · past-authentic: under a prev-reachable ancestor · spoof: no trace. */
export type SealVerdict = "CURRENT" | "PAST_AUTHENTIC" | "SPOOF";

/**
 * Verify the charter chain's integrity: content-addresses + hash-links + KERI PRE-ROTATION + SIGNED ROLLS.
 * Every epoch's `epochCid` recomputes over its fields; every successor hash-links to its predecessor and
 * carries a roll that `verifySealRoll` reads lawful — the revealed keys match the predecessor's commitment
 * and SIGNED the step. A reader holding only the public keys of a revealed set therefore forges nothing.
 * Genesis carries no predecessor and no roll. Synchronous, so every roster fold reads it in place.
 */
export function verifySealLineage(chain: readonly SealEpoch[]): boolean {
  if (chain.length === 0) return false;
  const genesis = chain[0]!;
  if (genesis.prevEpochCid !== null || genesis.roll !== undefined) return false;
  if (genesis.epochCid !== sealEpochCidOf(genesis)) return false;
  for (let i = 1; i < chain.length; i++) {
    const e = chain[i]!, prev = chain[i - 1]!;
    if (e.prevEpochCid !== prev.epochCid) return false;    // hash-linked
    if (e.epochCid !== sealEpochCidOf(e)) return false;    // content-addressed
    if (verifySealRoll(prev, e) !== null) return false;    // pre-rotated AND signed by the revealed hands
  }
  return true;
}

/**
 * Classify a wax-stamp against the charter chain (HEAD = the last element). `verifySig` is injected —
 * it verifies the stamp's signature against the cited epoch's authorized key-set (Ed25519 today). A
 * broken lineage, an unknown epoch, or a failed signature all read SPOOF; a valid seal under the head
 * reads CURRENT, under an ancestor PAST_AUTHENTIC. What this does NOT decide: whether the lineage itself
 * is "the legitimate org" — that is higher-order social acceptance, never a signature.
 */
export function classifySeal(
  stamp: WaxStamp,
  chain: readonly SealEpoch[],
  verifySig: (stamp: WaxStamp, epoch: SealEpoch) => boolean,
): SealVerdict {
  if (!verifySealLineage(chain)) return "SPOOF";                        // a broken lineage attests nothing
  const idx = chain.findIndex((e) => e.epochCid === stamp.epochCid);
  if (idx < 0) return "SPOOF";                                           // cites no epoch in the lineage
  if (!verifySig(stamp, chain[idx]!)) return "SPOOF";                    // signature does not verify vs that epoch
  return idx === chain.length - 1 ? "CURRENT" : "PAST_AUTHENTIC";
}

/**
 * Detect DUPLICITY across two claimed lineages: two successors rolling from the SAME predecessor with
 * DIFFERENT CIDs. Read over two lineages that each pass `verifySealLineage`, both rolls carry the revealed
 * hands' signatures — proof-of-misbehavior (one controller signed inconsistent history). Returns the shared
 * predecessor's cid, or null. Two distinct geneses share no predecessor: they are two lineages, never one
 * controller's duplicity. This is algorithmically decidable; the LEGITIMACY of a fork is not (never
 * auto-arbitrate).
 */
export function detectDuplicity(a: readonly SealEpoch[], b: readonly SealEpoch[]): string | null {
  const byPrev = new Map<string, string>();
  for (const e of a) if (e.prevEpochCid !== null) byPrev.set(e.prevEpochCid, e.epochCid);
  for (const e of b) {
    if (e.prevEpochCid === null) continue;
    const other = byPrev.get(e.prevEpochCid);
    if (other !== undefined && other !== e.epochCid) return e.prevEpochCid;
  }
  return null;
}

// ── The minter + the Ed25519 verify (the crypto floor the classifier's injected verifySig rides) ────

/** The canonical bytes a wax-stamp signs — the artifact bound to its epoch + a bound-past (strict `|`). */
export function waxStampProofBytes(artifactHash: string, epochCid: string, sealedAt: string): Uint8Array {
  return new TextEncoder().encode(`lar-wax-stamp/v1|${artifactHash}|${epochCid}|${sealedAt}`);
}

/** A single-key key-set digest — the floor's keySetHash for an epoch with one authorized signer. A
 *  k-of-n key-set is a Merkle/sorted-hash of the members (a later cut); the classifier is agnostic. */
export function singleKeySetHash(signerKeyHex: string): string {
  return sha256HexSync(signerKeyHex);
}

// ── The pre-rotated charter-epoch CHAIN minter (KERI): seat genesis, pre-commit next, rotate on reveal ──

/**
 * The k-of-n charter key-set digest — the CURRENT authorized quorum an epoch binds in `keySetHash`, and
 * the value a predecessor pre-commits in `nextKeyCommit`. Extends `singleKeySetHash`'s single-signer floor
 * into the k-of-n cut (the flagged 'later cut'): it folds the sorted, de-duped keys AND the threshold, so
 * the digest is order-blind and a reorder or a threshold change forges no match. One-way — a reader
 * recomputes it from a PRESENTED key-set to test authorization; it recovers no key from the digest.
 */
export function sealKeySetHash(keys: readonly string[], threshold: number): string {
  const norm = [...new Set(keys.map((k) => k.toLowerCase()))].sort();
  return sha256HexSync(canonicalJson({ keys: norm, threshold }));
}

/** The authority fields an epoch's content-address binds — everything but the derived `epochCid` and the
 *  roll, whose signatures are evidence around the act, never its identity. */
export type SealEpochFields = Omit<SealEpoch, "epochCid" | "roll">;

/**
 * The content-address of a charter epoch — a hash BINDING the epoch's authority fields (its authorized
 * key-set digest, its pre-rotation commitment, its predecessor link). A single bit-flip in any bound field
 * yields a different cid, so the `epochCid` the next epoch hash-links against is tamper-evident. Genesis
 * reads `epoch0-…` — the inception marker the Nexus AID shape keys on — and every successor `epoch-…`.
 */
export function sealEpochCidOf(fields: SealEpochFields): string {
  const digest = sha256HexSync(canonicalJson({
    keySetHash: fields.keySetHash, nextKeyCommit: fields.nextKeyCommit, prevEpochCid: fields.prevEpochCid,
  }));
  return fields.prevEpochCid === null ? `epoch0-${digest}` : `epoch-${digest}`;
}

/** Seal one charter epoch from its authority fields (and, for a successor, its roll), deriving the
 *  content-address over the fields. */
export function mintCharterEpoch(fields: SealEpochFields, roll?: SealRoll): SealEpoch {
  const epoch: SealEpoch = {
    keySetHash: fields.keySetHash, nextKeyCommit: fields.nextKeyCommit, prevEpochCid: fields.prevEpochCid,
    epochCid: sealEpochCidOf(fields),
  };
  return roll ? { ...epoch, roll } : epoch;
}

/**
 * Seat the GENESIS epoch (no predecessor, no roll) from the founding key-set + a PRE-ROTATION
 * commitment to the NEXT epoch's keys. The commitment rides in from OFFLINE custody of the next key-set
 * (KERI pre-rotation), so stealing today's council keys forges no valid successor. An empty commitment
 * leaves rotation UNARMED — `rotateSealEpoch` then refuses, since nothing stands pre-committed to verify
 * a reveal against.
 */
export function genesisCharterEpoch(keys: readonly string[], threshold: number, nextKeyCommit: string): SealEpoch {
  return mintCharterEpoch({
    keySetHash:    sealKeySetHash(keys, threshold),
    nextKeyCommit,
    prevEpochCid:  null,
  });
}

/** A rotation attempt's outcome — the advanced epoch, or a fail-closed REFUSAL naming the mismatch. */
export type RotateResult =
  | { readonly ok: true;  readonly epoch: SealEpoch }
  | { readonly ok: false; readonly reason: string };

/** One hand that signs a roll — its verifying key and a signer over bytes. The module holds no key. */
export interface SealRollSigner {
  readonly signer: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string>;
}

const normKeys = (keys: readonly string[]): string[] => [...new Set(keys.map((k) => k.toLowerCase()))].sort();

/**
 * The canonical bytes a roll's hands sign: the predecessor's cid, the seated key-set and its threshold, and
 * the epoch's forward commitment (`next`). Domain-separated under `seal-roll`. `next` carries the commitment
 * VALUE whatever its shape — one digest until the re-found — so a per-seat commitment slots into the same
 * field under the same domain.
 */
export function sealRollBytes(parts: {
  readonly prevEpochCid: string; readonly keys: readonly string[]; readonly threshold: number;
  readonly nextKeyCommit: string;
}): Uint8Array {
  return canonicalJsonBytes({
    kind:         SEAL_ROLL_DOMAIN,
    prevEpochCid: parts.prevEpochCid,
    keys:         normKeys(parts.keys),
    threshold:    parts.threshold,
    next:         parts.nextKeyCommit,
  });
}

const isThreshold = (t: unknown): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1;

/**
 * Is `epoch` a lawful roll from `prev`? Null when it holds, else the named refusal. FAILS CLOSED:
 *   · `roll-unsigned`                 — no roll rides the epoch;
 *   · `roll-malformed`                — a threshold below one, or a key or signature that is not hex;
 *   · `roll-key-set-unbound`          — the roll's seated set does not hash to the epoch's `keySetHash`;
 *   · `rotation-unarmed`              — the predecessor pre-committed nothing;
 *   · `reveal-mismatch`               — the revealed set does not hash to the predecessor's commitment;
 *   · `roll-short-of-revealed-quorum` — fewer than the revealed threshold of REVEALED keys signed;
 *   · `roll-short-of-seated-quorum`   — fewer than the seated threshold of SEATED keys signed;
 *   · `seat-change-without-proof-of-possession` — a seated key the commitment never named did not sign.
 * A signature counts once per distinct key, and only over `sealRollBytes` for exactly this step.
 */
export function verifySealRoll(prev: SealEpoch, epoch: SealEpoch): string | null {
  const roll = epoch.roll;
  if (!roll || typeof roll !== "object") return "roll-unsigned";
  if (!Array.isArray(roll.keys) || !isThreshold(roll.threshold) || !Array.isArray(roll.signatures)) return "roll-malformed";
  const revealed: SealKeySet = roll.revealed ?? { keys: roll.keys, threshold: roll.threshold };
  if (!Array.isArray(revealed.keys) || !isThreshold(revealed.threshold)) return "roll-malformed";
  const hex64 = (k: unknown): k is string => typeof k === "string" && /^[0-9a-fA-F]{64}$/.test(k);
  if (!roll.keys.every(hex64) || !revealed.keys.every(hex64)) return "roll-malformed";
  if (sealKeySetHash(roll.keys, roll.threshold) !== epoch.keySetHash) return "roll-key-set-unbound";
  if (prev.nextKeyCommit.length === 0) return "rotation-unarmed";
  if (sealKeySetHash(revealed.keys, revealed.threshold) !== prev.nextKeyCommit) return "reveal-mismatch";

  const seated = new Set(normKeys(roll.keys));
  const committed = new Set(normKeys(revealed.keys));
  const bytes = sealRollBytes({
    prevEpochCid: prev.epochCid, keys: roll.keys, threshold: roll.threshold, nextKeyCommit: epoch.nextKeyCommit,
  });
  const signed = new Set<string>();
  for (const s of roll.signatures) {
    if (typeof s !== "object" || s === null || typeof s.signer !== "string" || typeof s.sig !== "string") continue;
    const signer = s.signer.toLowerCase();
    if (signed.has(signer) || !(seated.has(signer) || committed.has(signer))) continue;
    if (!/^[0-9a-f]{128}$/i.test(s.sig)) continue;
    let ok = false;
    try { ok = ed25519Sync.verify(hexToBytes(s.sig), bytes, hexToBytes(signer)); } catch { ok = false; }
    if (ok) signed.add(signer);
  }
  const count = (set: ReadonlySet<string>): number => [...set].filter((k) => signed.has(k)).length;
  if (count(committed) < revealed.threshold) return "roll-short-of-revealed-quorum";
  if (count(seated) < roll.threshold) return "roll-short-of-seated-quorum";
  for (const k of seated) {
    if (!committed.has(k) && !signed.has(k)) return "seat-change-without-proof-of-possession";
  }
  return null;
}

/**
 * Advance the chain: REVEAL the pre-committed next key-set, seat it as the new head, and have its hands SIGN
 * the roll. FAILS CLOSED: an unarmed head refuses; a reveal whose digest does not match the head's
 * `nextKeyCommit` refuses; and the signed roll must read lawful under `verifySealRoll` before it is returned
 * — a roll short of either quorum, or a seat change whose added key did not sign, refuses. The caller MUST
 * supply the FOLLOWING commitment so the new head stays pre-rotated.
 *
 * `seat.revealed` names the commitment's preimage when the seated set differs from it (a SEAT CHANGE); absent,
 * the seated set IS the reveal.
 */
export async function rotateSealEpoch(
  head:          SealEpoch,
  seat:          SealKeySet & { readonly revealed?: SealKeySet },
  nextKeyCommit: string,
  signers:       readonly SealRollSigner[],
): Promise<RotateResult> {
  if (head.nextKeyCommit.length === 0) {
    return { ok: false, reason: "rotation unarmed — the head epoch pre-committed no next key-set" };
  }
  const revealed = seat.revealed ?? seat;
  if (sealKeySetHash(revealed.keys, revealed.threshold) !== head.nextKeyCommit) {
    return { ok: false, reason: "reveal mismatch — the revealed key-set does not match the head's pre-committed digest" };
  }
  const keys = normKeys(seat.keys);
  const bytes = sealRollBytes({ prevEpochCid: head.epochCid, keys, threshold: seat.threshold, nextKeyCommit });
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer.toLowerCase(), sig: await s.sign(bytes) });
  const roll: SealRoll = seat.revealed
    ? { keys, threshold: seat.threshold, revealed: { keys: normKeys(seat.revealed.keys), threshold: seat.revealed.threshold }, signatures }
    : { keys, threshold: seat.threshold, signatures };
  const epoch = mintCharterEpoch({
    keySetHash:   sealKeySetHash(keys, seat.threshold),
    nextKeyCommit,
    prevEpochCid: head.epochCid,
  }, roll);
  const refusal = verifySealRoll(head, epoch);
  if (refusal !== null) return { ok: false, reason: `roll refused — ${refusal}` };
  return { ok: true, epoch };
}

/** Mint a wax-stamp: sign the artifact under a key authorized by the cited epoch. `sign` yields a hex
 *  Ed25519 signature over `waxStampProofBytes`; the caller supplies a key that hashes into keySetHash. */
export async function mintWaxStamp(input: {
  readonly artifactHash: string;
  readonly epoch: SealEpoch;
  readonly sealedAt: string;
  readonly sign: (bytes: Uint8Array) => Promise<string>;
}): Promise<WaxStamp> {
  const signature = await input.sign(waxStampProofBytes(input.artifactHash, input.epoch.epochCid, input.sealedAt));
  return { artifactHash: input.artifactHash, epochCid: input.epoch.epochCid, sealedAt: input.sealedAt, signature };
}

/**
 * Verify a wax-stamp's Ed25519 signature against a signer key that the cited epoch AUTHORIZES. Two gates:
 * the signer must hash into the epoch's `keySetHash` (authorized by THIS epoch), AND the signature must
 * verify over the canonical bytes. Compose this into `classifySeal`'s injected `verifySig` (pre-await it
 * per stamp, since classifySeal is synchronous). A reader needs only the PUBLIC charter + the signer key
 * carried on the stamp — never a roster.
 */
export async function verifyWaxStampSig(
  stamp: WaxStamp,
  epoch: SealEpoch,
  signerKeyHex: string,
  keyInSet: (signerKeyHex: string, keySetHash: string) => boolean = (k, h) => singleKeySetHash(k) === h,
): Promise<boolean> {
  if (!keyInSet(signerKeyHex, epoch.keySetHash)) return false;      // the signer is not authorized by this epoch
  const msg = waxStampProofBytes(stamp.artifactHash, stamp.epochCid, stamp.sealedAt);
  try { return await ed25519.verifyAsync(hexToBytes(stamp.signature), msg, hexToBytes(signerKeyHex)); }
  catch { return false; }
}
