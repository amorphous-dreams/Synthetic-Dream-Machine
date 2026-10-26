/** The place signer signs five framed floor duties under its online KEL key. */
import * as ed25519 from "@noble/ed25519";
import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import { hex, utf8Bytes } from "./crypto.js";
import { verifyEd25519 } from "./ed25519-door.js";
import { placeSignerKeyAt, type PlaceKelEvent, type PlaceKelReading } from "./vessel-kel.js";
import { CARRIAGE_CARRIER_DOMAIN, GATE_PLACE_FINISH_DOMAIN, FLOW_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN } from "./domains.js";

export const PLACE_SIGNER_DOMAINS: readonly string[] = Object.freeze([
  CARRIAGE_CARRIER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, FLOW_POINTER_DOMAIN, RAISE_CHALLENGE_DOMAIN, GATE_PLACE_FINISH_DOMAIN,
]);

/** Place one duty name at the head of the signed image. */
export function frameFloorDuty(domain: string, preimage: Uint8Array): Uint8Array {
  if (!PLACE_SIGNER_DOMAINS.includes(domain)) throw new Error(`place-signer: ${domain} names no floor duty`);
  const name = utf8Bytes(domain);
  const framed = new Uint8Array(4 + name.length + preimage.length);
  new DataView(framed.buffer).setUint32(0, name.length, false);
  framed.set(name, 4); framed.set(preimage, 4 + name.length);
  return framed;
}

/** Read only the leading frame; content deeper in the image never chooses its duty. */
export function floorDutyOf(image: Uint8Array): string | null {
  if (!(image instanceof Uint8Array) || image.length < 4) return null;
  const length = new DataView(image.buffer, image.byteOffset, 4).getUint32(0, false);
  if (length > image.length - 4) return null;
  return PLACE_SIGNER_DOMAINS.find((domain) => {
    const name = utf8Bytes(domain);
    return name.length === length && name.every((byte, at) => image[4 + at] === byte);
  }) ?? null;
}
export const carriageFloorDutyOf = floorDutyOf;

function imageMatches(domain: string, image: Uint8Array): boolean {
  if (floorDutyOf(image) !== domain) return false;
  const body = image.subarray(4 + utf8Bytes(domain).length);
  // A second duty frame at the start of the body would turn one signed image into two duties.
  return floorDutyOf(body) === null;
}

export interface PlaceSigner {
  /** The online signer key, in lowercase hex. */
  readonly key: string;
  signFloor(domain: string, image: Uint8Array): Promise<string>;
}

/** Hold the online signer seed for the current place KEL head. */
export function placeSignerFromSeed(seed: Uint8Array): PlaceSigner {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error("place-signer: a seed is 32 bytes");
  const own = Uint8Array.from(seed);
  return Object.freeze({
    key: hex(edCurve.getPublicKey(own)),
    signFloor: async (domain: string, image: Uint8Array) => {
      if (!PLACE_SIGNER_DOMAINS.includes(domain)) throw new Error(`place-signer: ${domain} names no floor duty`);
      if (!imageMatches(domain, image)) throw new Error(`place-signer: image does not carry the domain ${domain} at its head`);
      return hex(await ed25519.signAsync(image, own));
    },
  });
}

export function verifyPlaceDuty(args: { domain: string; image: Uint8Array; sig: string; signerKey: string }): boolean {
  return PLACE_SIGNER_DOMAINS.includes(args.domain) && imageMatches(args.domain, args.image) &&
    verifyEd25519(args.sig, args.image, args.signerKey);
}
export function verifyPlaceDutyAtHead(args: { kel: PlaceKelEvent | PlaceKelReading; domain: string;
  image: Uint8Array; sig: string }): boolean {
  try { return verifyPlaceDuty({ ...args, signerKey: placeSignerKeyAt(args.kel) }); }
  catch { return false; }
}
