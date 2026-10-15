/**
 * carriage fixtures — the keys, rosters and acts the carriage tests build, built ONE way.
 *
 * Every builder takes its seeds explicitly. A roster is whatever seeds the caller names: the membership
 * quorum and an antigen quorum stand on different keys, and nothing here defaults one to the other.
 *
 * The two seals stay apart, exactly as the registry keeps them: `contractIn` is a member's accepts-carriage
 * token (CARRIAGE_CONTRACT_DOMAIN, signed by the operator's persona leaf), `carrierSeal` is a place's
 * carries-for seal (CARRIAGE_CARRIER_DOMAIN, signed by its vessel key).
 */
import * as ed from "@noble/ed25519";
import { hex } from "../../src/crypto.js";
import {
  signCarriageQuorum, signCarriageContract, signCarrierContract,
  type CarriageAction, type CarriageEntry, type QuorumSignature,
} from "../../src/carriage-registry.js";
import type { KahuQuorumSeats } from "../../src/kapae-antigen.js";

/** The hex-signing function a seed holds. */
export const signerOf = (seed: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed.signAsync(bytes, seed).then(hex);

/** The hex public key a seed holds. */
export const pubOf = (seed: Uint8Array): Promise<string> => ed.getPublicKeyAsync(seed).then(hex);

/** One quorum signer per seed, in the order given. */
export function kahuSigners(seeds: readonly Uint8Array[]) {
  return Promise.all(seeds.map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
}

/** A k-of-n roster over exactly the seeds named, rooted on `sealEpochCid`. */
export async function kahuRoster(seeds: readonly Uint8Array[], threshold: number, sealEpochCid: string): Promise<KahuQuorumSeats> {
  return { keys: await Promise.all(seeds.map(pubOf)), threshold, sealEpochCid };
}

/** An operator's "accepts carriage" contract-in for one charter epoch, signed by its own seed. */
export async function contractIn(seed: Uint8Array, sealEpochCid: string): Promise<QuorumSignature> {
  return signCarriageContract(await pubOf(seed), sealEpochCid, signerOf(seed));
}

/** A place's own "I carry for this Nexus" seal for one charter epoch, signed by its vessel seed. */
export async function carrierSeal(seed: Uint8Array, sealEpochCid: string): Promise<QuorumSignature> {
  return signCarrierContract(await pubOf(seed), sealEpochCid, signerOf(seed));
}

/**
 * One quorum-signed carriage act on `subject`. The subject's own seal defaults by act: an admit carries the
 * subject's contract-in, a carry the subject's carrier seal, a revoke or uncarry nothing. A `seal` given
 * explicitly rides instead.
 */
export async function carriageAct(
  subject: Uint8Array,
  action: CarriageAction,
  opts: { kahu: readonly Uint8Array[]; epoch: string; parents?: readonly string[]; seal?: QuorumSignature },
): Promise<CarriageEntry> {
  const seal = opts.seal ?? (
    action === "admit" ? await contractIn(subject, opts.epoch)
    : action === "carry" ? await carrierSeal(subject, opts.epoch)
    : undefined);
  return signCarriageQuorum(
    { nym: await pubOf(subject), action, parents: opts.parents ?? [], sealEpochCid: opts.epoch },
    await kahuSigners(opts.kahu), seal,
  );
}
