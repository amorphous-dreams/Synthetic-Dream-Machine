/**
 * seat-fixture — chairs that hold keys of their OWN, for a test that needs a quorum this vessel signs as.
 *
 * A seat holds its own key (`seat-key-store`): a sealed row on this vessel, filed under the face whose seat claim
 * stood for the chair, apart from every persona root and every leaf. The quorum doors sign with those rows, so a
 * test that seats a charter and then asks a door to act seats the keys this helper stores, never persona roots.
 *
 *   · `seatChairs(faces)` stores one seat key per face named and answers the keys, their seeds and their hands.
 *     The seeds derive from (family, face, generation), so two calls agree and a test may name a chair's key
 *     before it stores it (`chairSeed`). A store under an unlocked custody seat; the vessel's own test setup
 *     seats one, or `seatScratchCustody` does.
 *   · `hands` sign by hand, outside every door: a test that builds a roll or an act by hand signs with them, and
 *     a test that asks a door to sign leaves them alone.
 *   · `generation` names a later key for the same chair: a roll's successors, held beside the keys it retires.
 */
import { ed25519SignerFromSeed, hex, sha256BytesSync, utf8Bytes } from "@lararium/mesh";
import { storeSeatKey } from "../src/seat-key-store.js";

/** One hand that signs as a seat: its public key and a signer over bytes (lower-case hex out). */
export interface SeatHand {
  readonly signer: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string>;
}

export interface SeatedChairs {
  /** The seat keys, lower-case hex, in the order of the faces named. */
  readonly keys:  readonly string[];
  /** Each key's seed, in the same order. */
  readonly seeds: readonly Uint8Array[];
  /** Each key's hand, in the same order. */
  readonly hands: readonly SeatHand[];
}

/** The seed of face `face`'s chair key at `generation` in key family `family`: deterministic, and apart from every root. */
export function chairSeed(face: number, generation = 0, family = "chairs"): Uint8Array {
  return sha256BytesSync(utf8Bytes(`seat-fixture|${family}|${face}|${generation}`));
}

/** Store one seat key per face in `faces`, under that face, and answer the keys, their seeds and their hands. */
export async function seatChairs(faces: readonly number[], opts: { readonly generation?: number; readonly family?: string } = {}): Promise<SeatedChairs> {
  const keys: string[] = [];
  const seeds: Uint8Array[] = [];
  const hands: SeatHand[] = [];
  for (const face of faces) {
    const seed = chairSeed(face, opts.generation ?? 0, opts.family ?? "chairs");
    const key = (await storeSeatKey(face, seed)).toLowerCase();
    keys.push(key);
    seeds.push(seed);
    hands.push({ signer: key, sign: ed25519SignerFromSeed(seed) });
  }
  return { keys, seeds, hands };
}

/** The public key `chairSeed(face, generation, family)` derives, without storing anything. */
export async function chairKey(face: number, generation = 0, family = "chairs"): Promise<string> {
  const { getPublicKeyAsync } = await import("@noble/ed25519");
  return hex(await getPublicKeyAsync(chairSeed(face, generation, family)));
}
