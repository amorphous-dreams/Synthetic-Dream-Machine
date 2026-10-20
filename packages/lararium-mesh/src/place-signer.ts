/**
 * place-signer — the scoped signer a vessel holds exactly while it stands a floor.
 *
 * The place signs the floor's allowlisted duties and nothing else: it signs no face act. A signature over any
 * domain outside `PLACE_SIGNER_DOMAINS` refuses by name, and so does a preimage that does not carry the domain it
 * claims. The place KEL's own events are excepted: the founding card's key signs those.
 *
 * Each domain here already signs a floor record: the place's "I carry for this Nexus" seal, its floor pin at one
 * Nexus, the served oracle pointer, the raise challenge at the waking floor, and the finish a place signs when it
 * dials another place's gate (a herm pulling the carriage presents as a place, never as a face). A face presentation, a device
 * edge, a join, a sibling proof or a seat receipt names none of them, so a place signature cannot stand for one.
 *
 * Platform-blind: rides ./crypto and ./domains alone.
 */

import * as ed25519 from "@noble/ed25519";
import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import { hex, utf8Bytes } from "./crypto.js";
import { CARRIAGE_CARRIER_DOMAIN, GATE_PLACE_FINISH_DOMAIN, ORACLE_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN } from "./domains.js";

/** The floor duties the place signer serves, closed. */
export const PLACE_SIGNER_DOMAINS: readonly string[] = Object.freeze([
  CARRIAGE_CARRIER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, ORACLE_POINTER_DOMAIN, RAISE_CHALLENGE_DOMAIN, GATE_PLACE_FINISH_DOMAIN,
]);

/**
 * Which floor duty a carriage-side image serves: a place floor pin statement, a place's finish at a gate it dials, or
 * (otherwise) the carrier record. The signer still checks the image carries the domain this names.
 */
export function carriageFloorDutyOf(preimage: Uint8Array): string {
  if (contains(preimage, utf8Bytes(PLACE_FLOOR_PIN_DOMAIN))) return PLACE_FLOOR_PIN_DOMAIN;
  if (contains(preimage, utf8Bytes(GATE_PLACE_FINISH_DOMAIN))) return GATE_PLACE_FINISH_DOMAIN;
  return CARRIAGE_CARRIER_DOMAIN;
}

export interface PlaceSigner {
  /** The place's raw 32-byte Ed25519 verifying key, lowercase hex. */
  readonly key: string;
  /** Sign a floor record. Refuses a domain off the allowlist, and a preimage that does not carry its domain. */
  signFloor(domain: string, preimage: Uint8Array): Promise<string>;
}

const contains = (haystack: Uint8Array, needle: Uint8Array): boolean => {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

/** The signer a place seed stands, scoped to the floor's duties. */
export function placeSignerFromSeed(seed: Uint8Array): PlaceSigner {
  if (seed.length !== 32) throw new Error("place-signer: a seed is 32 bytes");
  const own = Uint8Array.from(seed);
  return Object.freeze({
    key: hex(edCurve.getPublicKey(own)),
    signFloor: async (domain: string, preimage: Uint8Array) => {
      if (!PLACE_SIGNER_DOMAINS.includes(domain)) throw new Error(`place-signer: ${domain} names no floor duty, so the place signs nothing under it`);
      if (!contains(preimage, utf8Bytes(domain))) throw new Error(`place-signer: the preimage does not carry the domain ${domain} it claims`);
      return hex(await ed25519.signAsync(preimage, own));
    },
  });
}
