import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import {
  CARRIAGE_CARRIER_DOMAIN, DEVICE_DELEGATION_DOMAIN, GATE_PLACE_FINISH_DOMAIN, FLOW_POINTER_DOMAIN,
  PLACE_FLOOR_PIN_DOMAIN, PLACE_SIGNER_DOMAINS, RAISE_CHALLENGE_DOMAIN, buildFlowPointer, carrierContractBytes,
  floorDutyOf, flowPointerSigningImage, frameFloorDuty, hex, mintPlaceInception, mintPlaceRotation, placeFloorPinImage,
  placeSignerFromSeed, raiseChallengeBytes, utf8Bytes, verifyPlaceDuty, verifyPlaceDutyAtHead,
} from "../src/index.js";
import { gatePlaceFinishImage } from "../src/gate-exchange.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const key = (n: number) => hex(ed25519.getPublicKey(seed(n)));
const signer = placeSignerFromSeed(seed(1));
const pin = { tier: "floor", nexus: "6e", route: "/flow", transportKey: "11".repeat(32), signingKey: "22".repeat(32) } as never;
const images: Record<string, Uint8Array> = {
  [CARRIAGE_CARRIER_DOMAIN]: carrierContractBytes({ nym: key(1), sealEpochCid: "epoch" }),
  [PLACE_FLOOR_PIN_DOMAIN]: placeFloorPinImage(key(1), pin),
  [RAISE_CHALLENGE_DOMAIN]: raiseChallengeBytes({ vesselId: "v", nexus: "n", epoch: 7, nonce: "x" }),
  [GATE_PLACE_FINISH_DOMAIN]: gatePlaceFinishImage({ handshakeHash: new Uint8Array(32), bundleDigest: "00".repeat(32), presentationDigest: "11".repeat(32), audience: "aud", placeKey: key(1) }),
};

describe("framed floor duties", () => {
  it("signs and verifies all five maker images", async () => {
    const pointer = await buildFlowPointer({ snapshot: { cid: "aa".repeat(32), heads: [], bytes: new Uint8Array() }, parents: [], signer: placeSignerFromSeed(seed(1)) });
    const made = { ...images, [FLOW_POINTER_DOMAIN]: flowPointerSigningImage(pointer) };
    const head = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) }).event;
    for (const domain of PLACE_SIGNER_DOMAINS) {
      const image = made[domain]!;
      expect(floorDutyOf(image)).toBe(domain);
      const sig = await signer.signFloor(domain, image);
      expect(verifyPlaceDuty({ domain, image, sig, signerKey: signer.key })).toBe(true);
      expect(verifyPlaceDutyAtHead({ kel: head, domain, image, sig })).toBe(true);
      const faceSig = await placeSignerFromSeed(seed(9)).signFloor(domain, image);
      expect(verifyPlaceDutyAtHead({ kel: head, domain, image, sig: faceSig })).toBe(false);
    }
  });
  it("refuses a sixth duty, old unframed image, nested frame and cross-duty replay", async () => {
    const image = images[CARRIAGE_CARRIER_DOMAIN]!;
    const sig = await signer.signFloor(CARRIAGE_CARRIER_DOMAIN, image);
    await expect(signer.signFloor(DEVICE_DELEGATION_DOMAIN, image)).rejects.toThrow(/names no floor duty/);
    expect(verifyPlaceDuty({ domain: DEVICE_DELEGATION_DOMAIN, image, sig, signerKey: signer.key })).toBe(false);
    const old = utf8Bytes(JSON.stringify({ kind: CARRIAGE_CARRIER_DOMAIN, nym: key(1) }));
    await expect(signer.signFloor(CARRIAGE_CARRIER_DOMAIN, old)).rejects.toThrow();
    expect(verifyPlaceDuty({ domain: CARRIAGE_CARRIER_DOMAIN, image: old, sig, signerKey: signer.key })).toBe(false);
    const nested = frameFloorDuty(CARRIAGE_CARRIER_DOMAIN, images[PLACE_FLOOR_PIN_DOMAIN]!);
    await expect(signer.signFloor(CARRIAGE_CARRIER_DOMAIN, nested)).rejects.toThrow();
    expect(verifyPlaceDuty({ domain: CARRIAGE_CARRIER_DOMAIN, image: nested, sig, signerKey: signer.key })).toBe(false);
    expect(verifyPlaceDuty({ domain: PLACE_FLOOR_PIN_DOMAIN, image, sig, signerKey: signer.key })).toBe(false);
  });
  it("uses the KEL head signer and rejects the old key after rotation", async () => {
    const start = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
    const next = mintPlaceRotation({ chain: [start.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
    const image = images[CARRIAGE_CARRIER_DOMAIN]!;
    const oldSig = await signer.signFloor(CARRIAGE_CARRIER_DOMAIN, image);
    expect(verifyPlaceDutyAtHead({ kel: start.event, domain: CARRIAGE_CARRIER_DOMAIN, image, sig: oldSig })).toBe(true);
    expect(verifyPlaceDutyAtHead({ kel: next, domain: CARRIAGE_CARRIER_DOMAIN, image, sig: oldSig })).toBe(false);
    const newSig = await placeSignerFromSeed(seed(3)).signFloor(CARRIAGE_CARRIER_DOMAIN, image);
    expect(verifyPlaceDutyAtHead({ kel: next, domain: CARRIAGE_CARRIER_DOMAIN, image, sig: newSig })).toBe(true);
  });
});
