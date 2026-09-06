/**
 * reserve-transition — the growth rite's record: a seated quorum hands the reserve to its successor,
 * cross-signed both ways and witnessed by hands that belong to neither.
 *
 * ── WHY A RECORD AND NOT JUST A ROTATION ────────────────────────────────────────────────────────
 * The epoch chain already proves the KEY handoff (pre-rotation with a key-set reveal, `wax-stamp`).
 * What no chain can prove about itself is the INDEPENDENCE of the hands — a 2-of-3 worn by one human
 * verifies exactly like a 2-of-3 held by three. The field's answer runs through human witness records
 * (the audited key ceremony: an observer, a script, a report); this record carries that answer in a
 * checkable form: the OLD set signs the handoff, the NEW set countersigns the receipt (the TUF
 * cross-sign, both quorums over one byte-image), and WITNESSES attest the rite — where an independent
 * witness is, by definition here, a key belonging to NEITHER set. Witness marks attest, they never
 * authorize: authority rides the two quorums alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/attestation-plane
 */

import * as ed25519 from "@noble/ed25519";
import { sha256HexSync, hexToBytes, canonicalJson, canonicalJsonBytes } from "./crypto.js";
import { sealKeySetHash } from "./wax-stamp.js";
import { RESERVE_TRANSITION_DOMAIN } from "./domains.js";
import type { QuorumSignature } from "./kapae-antigen.js";

/** The authority fields the transition binds — both epochs, both key-set digests, and the rite walked. */
export interface ReserveTransitionCore {
  readonly fromEpochCid:  string;   // the epoch whose seated set signs the handoff
  readonly toEpochCid:    string;   // the epoch whose set countersigns the receipt
  readonly oldKeySetHash: string;   // sealKeySetHash of the outgoing set
  readonly newKeySetHash: string;   // sealKeySetHash of the incoming set
  readonly rite:          string;   // the lar: address of the ceremony script this transition walked
}

/** One witness mark: a key outside both sets, a note of what it observed, a signature over (bytes ‖ note). */
export interface TransitionWitness {
  readonly witness: string;   // the witness's pubkey (64-hex)
  readonly note:    string;   // what stood observed — the report line a later reader can weigh
  readonly sig:     string;   // ed25519 over reserveTransitionBytes(core) ‖ utf8(note)
}

export interface ReserveTransition extends ReserveTransitionCore {
  readonly transitionCid: string;
  readonly oldSigs:       readonly QuorumSignature[];   // ≥ old threshold, keys of the outgoing set
  readonly newSigs:       readonly QuorumSignature[];   // ≥ new threshold, keys of the incoming set
  readonly witnesses:     readonly TransitionWitness[];
}

/** The canonical bytes both quorums sign and the cid commits. */
export function reserveTransitionBytes(core: ReserveTransitionCore): Uint8Array {
  return canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, ...core });
}

/** The bytes a WITNESS signs — the transition image plus its own note, so a mark never floats free
 *  of what it claims to have seen. Exported for the ceremony verb that gathers marks hand by hand. */
export function witnessSignBytes(core: ReserveTransitionCore, note: string): Uint8Array {
  const base = reserveTransitionBytes(core);
  const noteBytes = new TextEncoder().encode(note);
  const out = new Uint8Array(base.length + noteBytes.length);
  out.set(base); out.set(noteBytes, base.length);
  return out;
}

export function reserveTransitionCidOf(core: ReserveTransitionCore): string {
  return `rtr-${sha256HexSync(canonicalJson({ domain: RESERVE_TRANSITION_DOMAIN, ...core }))}`;
}

/** A signer hand — pubkey + a sign function; the module holds no key (each hand supplies its own). */
export interface TransitionSigner {
  readonly signer: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string>;
}

/** Mint the record: both quorums sign the same byte-image; each witness signs the image plus its note. */
export async function mintReserveTransition(input: {
  readonly core:       ReserveTransitionCore;
  readonly oldSigners: readonly TransitionSigner[];
  readonly newSigners: readonly TransitionSigner[];
  readonly witnesses:  readonly (TransitionSigner & { readonly note: string })[];
}): Promise<ReserveTransition> {
  const bytes = reserveTransitionBytes(input.core);
  const sigsOf = async (hands: readonly TransitionSigner[]): Promise<QuorumSignature[]> => {
    const out: QuorumSignature[] = [];
    for (const h of hands) out.push({ signer: h.signer, sig: await h.sign(bytes) });
    return out;
  };
  const witnesses: TransitionWitness[] = [];
  for (const w of input.witnesses) {
    witnesses.push({ witness: w.signer, note: w.note, sig: await w.sign(witnessSignBytes(input.core, w.note)) });
  }
  return {
    ...input.core,
    transitionCid: reserveTransitionCidOf(input.core),
    oldSigs: await sigsOf(input.oldSigners),
    newSigs: await sigsOf(input.newSigners),
    witnesses,
  };
}

/** A signer hand built from a held seed — the CLI ceremony's one-liner; the seed never leaves the call. */
export async function transitionSignerFromSeed(seed: Uint8Array): Promise<TransitionSigner> {
  const pub = Array.from(await ed25519.getPublicKeyAsync(seed)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return {
    signer: pub,
    sign: async (bytes) => Array.from(await ed25519.signAsync(bytes, seed)).map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
}

export type TransitionVerdict =
  | { readonly ok: true; readonly independentWitnesses: number }
  | { readonly ok: false; readonly reason: string };

async function quorumHolds(
  bytes: Uint8Array, sigs: readonly QuorumSignature[], keys: readonly string[], threshold: number,
): Promise<boolean> {
  const keySet = new Set(keys.map((k) => k.toLowerCase()));
  const counted = new Set<string>();
  for (const s of sigs) {
    const signer = s.signer.toLowerCase();
    if (counted.has(signer) || !keySet.has(signer)) continue;
    let ok = false;
    try { ok = await ed25519.verifyAsync(hexToBytes(s.sig), bytes, hexToBytes(signer)); } catch { ok = false; }
    if (ok) counted.add(signer);
    if (counted.size >= threshold) return true;
  }
  return false;
}

/**
 * Verify the crossing: both key-set digests recompute, both quorums hold over one byte-image, the cid
 * recomputes. FAILS CLOSED on any half. Witness marks verify independently and NEVER gate the verdict —
 * they gate the COUNT: `independentWitnesses` tallies only valid marks whose key sits in NEITHER set,
 * because a hand attesting its own handoff reads as signature, not witness.
 */
export async function verifyReserveTransition(
  rec: ReserveTransition,
  expected: {
    readonly oldKeys: readonly string[]; readonly oldThreshold: number;
    readonly newKeys: readonly string[]; readonly newThreshold: number;
  },
): Promise<TransitionVerdict> {
  const core: ReserveTransitionCore = {
    fromEpochCid: rec.fromEpochCid, toEpochCid: rec.toEpochCid,
    oldKeySetHash: rec.oldKeySetHash, newKeySetHash: rec.newKeySetHash, rite: rec.rite,
  };
  if (rec.transitionCid !== reserveTransitionCidOf(core)) return { ok: false, reason: "cid does not recompute over the bound core" };
  if (sealKeySetHash(expected.oldKeys, expected.oldThreshold) !== rec.oldKeySetHash) return { ok: false, reason: "outgoing key-set digest mismatch" };
  if (sealKeySetHash(expected.newKeys, expected.newThreshold) !== rec.newKeySetHash) return { ok: false, reason: "incoming key-set digest mismatch" };
  const bytes = reserveTransitionBytes(core);
  if (!(await quorumHolds(bytes, rec.oldSigs, expected.oldKeys, expected.oldThreshold))) {
    return { ok: false, reason: "the outgoing quorum does not hold — the standing hands never signed the handoff" };
  }
  if (!(await quorumHolds(bytes, rec.newSigs, expected.newKeys, expected.newThreshold))) {
    return { ok: false, reason: "the incoming quorum does not hold — the receiving hands never countersigned" };
  }
  const holders = new Set([...expected.oldKeys, ...expected.newKeys].map((k) => k.toLowerCase()));
  let independent = 0;
  for (const w of rec.witnesses) {
    if (holders.has(w.witness.toLowerCase())) continue;   // a keyholder attests as a party, never a witness
    let ok = false;
    try { ok = await ed25519.verifyAsync(hexToBytes(w.sig), witnessSignBytes(core, w.note), hexToBytes(w.witness)); }
    catch { ok = false; }
    if (ok) independent++;
  }
  return { ok: true, independentWitnesses: independent };
}
