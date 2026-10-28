/**
 * face-atom — the one key a vessel meets a face through.
 *
 * A vessel meets each face through that face's atom alone: the atom signs every dial, join, enrolment, sibling
 * channel and daemon proof made on that face's behalf, and the face's group secret seals to it. The atom is a
 * random Ed25519 seed. No other seed derives it: not the place seed, not the custody root, not a sibling face's
 * atom, and not the PersonaGroup id. The PersonaGroup only LABELS the atom here; it feeds no derivation, so two
 * faces holding the same seed would hold the same key, and no two honest faces ever do.
 *
 * The seed rests in the face's own custody row (D). A restore onto a fresh vessel mints a fresh atom and never
 * resurrects a dead one (`api/pono/identity-enacts-relation` #/identity-as-bond, Law 3).
 *
 * Platform-blind: rides ./crypto, ./lar-did and ./persona-group-secret alone.
 */

import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import * as ed25519 from "@noble/ed25519";
import { hex } from "./crypto.js";
import { didFromVerifyingKey, type LarDid } from "./lar-did.js";
import { groupSecretOpenerFromSeed, type GroupSecretOpener } from "./persona-group-secret.js";

/** One face's atom, as a vessel holds it. The seed stays in the closure that builds it. */
export interface FaceAtomKey {
  /** The PersonaGroup this atom stands for: a label, never a derivation input. */
  readonly personaGroup: string;
  /** The atom's raw 32-byte Ed25519 verifying key, lowercase hex. */
  readonly key:          string;
  readonly did:          LarDid;
  /** Sign bytes as the face: the 64-byte Ed25519 signature, lowercase hex. */
  sign(bytes: Uint8Array): Promise<string>;
  /** Opens what a root sealed to this atom's key and nothing else. */
  readonly opener:       GroupSecretOpener;
}

/** A fresh atom seed: 32 random bytes from the platform's CSPRNG, derived from nothing. */
export function mintFaceAtomSeed(): Uint8Array {
  return edCurve.utils.randomSecretKey();
}

/**
 * The atom a seed stands for under a PersonaGroup label. The key is a function of the seed alone: the same seed
 * under two labels yields one key, so a label never separates keys and a shared input never makes two faces' atoms.
 */
/** The atom's public key alone, from its seed: no closure keeps a copy of the seed past this call. */
export function faceAtomPublicKey(seed: Uint8Array): string {
  if (seed.length !== 32) throw new Error("face-atom: a seed is 32 bytes");
  const own = Uint8Array.from(seed);
  try { return hex(edCurve.getPublicKey(own)); } finally { own.fill(0); }
}

/** Sign one image as the atom, once: the seed's copy zeroes as the signature returns. */
export async function signAsFaceAtom(seed: Uint8Array, bytes: Uint8Array): Promise<string> {
  if (seed.length !== 32) throw new Error("face-atom: a seed is 32 bytes");
  const own = Uint8Array.from(seed);
  try { return hex(await ed25519.signAsync(bytes, own)); } finally { own.fill(0); }
}

export function faceAtomKeyFromSeed(seed: Uint8Array, personaGroup: string): FaceAtomKey {
  if (seed.length !== 32) throw new Error("face-atom: a seed is 32 bytes");
  if (personaGroup.length === 0) throw new Error("face-atom: an atom names its PersonaGroup");
  const own = Uint8Array.from(seed);
  const key = hex(edCurve.getPublicKey(own));
  return Object.freeze({
    personaGroup,
    key,
    did: didFromVerifyingKey(key),
    sign: async (bytes: Uint8Array) => hex(await ed25519.signAsync(bytes, own)),
    opener: groupSecretOpenerFromSeed(own),
  });
}
