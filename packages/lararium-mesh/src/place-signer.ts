/**
 * place-signer — the scoped signer a vessel holds exactly while it stands a floor.
 *
 * The place signs the floor's allowlisted duties and nothing else: it signs no face act. A signature over any
 * domain outside `PLACE_SIGNER_DOMAINS` refuses by name, and so does a preimage that does not LEAD with the head of the domain it
 * claims. The place KEL's own events are excepted: the founding card's key signs those.
 *
 * Each domain here already signs a floor record: the place's "I carry for this Nexus" seal, its floor pin at one
 * Nexus, the served flow pointer, the raise challenge at the waking floor, and the finish a place signs when it
 * dials another place's gate (a herm pulling the carriage presents as a place, never as a face). A face presentation, a device
 * edge, a join, a sibling proof or a seat receipt names none of them, so a place signature cannot stand for one.
 *
 * Platform-blind: rides ./crypto and ./domains alone.
 */

import * as ed25519 from "@noble/ed25519";
import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import { hex, utf8Bytes } from "./crypto.js";
import { CARRIAGE_CARRIER_DOMAIN, GATE_PLACE_FINISH_DOMAIN, FLOW_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN } from "./domains.js";

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
const latin1 = (bytes: Uint8Array): string => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

/** `^D|`: the flow pointer's joined string leads with its domain. */
const joinedHead = (domain: string) => (image: Uint8Array): boolean => new RegExp(`^${escapeRegex(domain)}\\|`).test(latin1(image.subarray(0, domain.length + 1)));
/** `<u32 len(D)>D`: the gate field encoding leads with the length-prefixed name. */
const framedHead = (domain: string) => (image: Uint8Array): boolean => {
  const name = utf8Bytes(domain);
  if (image.length < 4 + name.length) return false;
  const length = new DataView(image.buffer, image.byteOffset, 4).getUint32(0, false);
  return length === name.length && name.every((byte, at) => image[4 + at] === byte);
};
/** A canonical-JSON image whose first keys, in sorted order, lead to `kind`: the head matches this exact grammar. */
const jsonHead = (domain: string, lead: string) => (image: Uint8Array): boolean =>
  new RegExp(`^\\{${lead}"kind":"${escapeRegex(domain)}"`).test(latin1(image.subarray(0, 512)));

/**
 * The floor duties the place signer serves, closed, each with the exact head its image leads with, anchored at the
 * first byte. A domain string deeper in a preimage (an address, a nonce, a title a peer chose) names nothing: the
 * signer routes and checks by this head alone. A sixth duty cannot land without its head, because the allowlist
 * below derives from this table.
 *
 *   carrier  `{"kind":"D"`  ·  floor pin `{"digest":"<hex64>","kind":"D"`  ·  pointer `D|`  ·
 *   raise `{"epoch":<canonical integer>,"kind":"D"`  ·  gate place finish `<u32 len(D)>D`
 *
 * The signer framing the domain itself (`len(D) ‖ D ‖ preimage`), so no image carries its own separation, rides `X0`.
 */
const FLOOR_HEADS: ReadonlyArray<readonly [string, (image: Uint8Array) => boolean]> = Object.freeze([
  [CARRIAGE_CARRIER_DOMAIN, jsonHead(CARRIAGE_CARRIER_DOMAIN, "")],
  [PLACE_FLOOR_PIN_DOMAIN, jsonHead(PLACE_FLOOR_PIN_DOMAIN, '"digest":"[0-9a-f]{64}",')],
  [FLOW_POINTER_DOMAIN, joinedHead(FLOW_POINTER_DOMAIN)],
  [RAISE_CHALLENGE_DOMAIN, jsonHead(RAISE_CHALLENGE_DOMAIN, '"epoch":(?:0|[1-9][0-9]*),')],
  [GATE_PLACE_FINISH_DOMAIN, framedHead(GATE_PLACE_FINISH_DOMAIN)],
]);

/** The floor duties the place signer serves, closed: the keys of the head table. */
export const PLACE_SIGNER_DOMAINS: readonly string[] = Object.freeze(FLOOR_HEADS.map(([domain]) => domain));

/** True when `image` leads with `domain`'s exact head. */
function leadsWith(domain: string, image: Uint8Array): boolean {
  const entry = FLOOR_HEADS.find(([name]) => name === domain);
  return entry !== undefined && entry[1](image);
}

/**
 * Which floor duty a carriage-side image serves, read by its head alone: a place floor pin statement, a place's
 * finish at a gate it dials, or (otherwise) the carrier record. The signer still checks the head of the duty named.
 */
export function carriageFloorDutyOf(preimage: Uint8Array): string {
  if (leadsWith(PLACE_FLOOR_PIN_DOMAIN, preimage)) return PLACE_FLOOR_PIN_DOMAIN;
  if (leadsWith(GATE_PLACE_FINISH_DOMAIN, preimage)) return GATE_PLACE_FINISH_DOMAIN;
  return CARRIAGE_CARRIER_DOMAIN;
}

export interface PlaceSigner {
  /** The place's raw 32-byte Ed25519 verifying key, lowercase hex. */
  readonly key: string;
  /** Sign a floor record. Refuses a domain off the allowlist, and a preimage that does not carry its domain. */
  signFloor(domain: string, preimage: Uint8Array): Promise<string>;
}

/** The signer a place seed stands, scoped to the floor's duties. */
export function placeSignerFromSeed(seed: Uint8Array): PlaceSigner {
  if (seed.length !== 32) throw new Error("place-signer: a seed is 32 bytes");
  const own = Uint8Array.from(seed);
  return Object.freeze({
    key: hex(edCurve.getPublicKey(own)),
    signFloor: async (domain: string, preimage: Uint8Array) => {
      if (!PLACE_SIGNER_DOMAINS.includes(domain)) throw new Error(`place-signer: ${domain} names no floor duty, so the place signs nothing under it`);
      if (!leadsWith(domain, preimage)) throw new Error(`place-signer: the preimage does not carry the domain ${domain} at its head`);
      return hex(await ed25519.signAsync(preimage, own));
    },
  });
}
