import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import {
  CARRIAGE_CARRIER_DOMAIN, DEVICE_DELEGATION_DOMAIN, GATE_PLACE_FINISH_DOMAIN, carriageFloorDutyOf, DYAD_BINDING_DOMAIN, FLEET_PROOF_DOMAIN, ORACLE_POINTER_DOMAIN,
  PLACE_FLOOR_PIN_DOMAIN, PLACE_SIGNER_DOMAINS, RAISE_CHALLENGE_DOMAIN, hexToBytes, placeSignerFromSeed, utf8Bytes,
} from "../src/index.js";
import { gatePlaceFinishImage } from "../src/gate-exchange.js";

const signer = placeSignerFromSeed(new Uint8Array(32).fill(0x33));
const image = (domain: string): Uint8Array => utf8Bytes(JSON.stringify({ kind: domain, subject: "a floor record" }));

describe("the place signer", () => {
  it("signs each floor duty, and the signature verifies under the place key", async () => {
    for (const domain of [CARRIAGE_CARRIER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, ORACLE_POINTER_DOMAIN, RAISE_CHALLENGE_DOMAIN, GATE_PLACE_FINISH_DOMAIN]) {
      const sig = hexToBytes(await signer.signFloor(domain, image(domain)));
      expect(await ed25519.verifyAsync(sig, image(domain), hexToBytes(signer.key))).toBe(true);
    }
  });

  it("refuses by name every face act it must never sign", async () => {
    for (const domain of [DEVICE_DELEGATION_DOMAIN, FLEET_PROOF_DOMAIN, DYAD_BINDING_DOMAIN]) {
      await expect(signer.signFloor(domain, image(domain))).rejects.toThrow(/names no floor duty/);
    }
  });

  it("refuses a preimage that does not carry the domain it claims", async () => {
    await expect(signer.signFloor(PLACE_FLOOR_PIN_DOMAIN, image(ORACLE_POINTER_DOMAIN))).rejects.toThrow(/does not carry the domain/);
  });

  it("holds a closed allowlist of exactly the five floor duties", () => {
    expect([...PLACE_SIGNER_DOMAINS].sort()).toEqual([CARRIAGE_CARRIER_DOMAIN, GATE_PLACE_FINISH_DOMAIN, ORACLE_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN].sort());
    expect(Object.isFrozen(PLACE_SIGNER_DOMAINS)).toBe(true);
  });

  it("RED: a herm dialing another place's gate signs its finish, which the carriage routes to the place-finish duty", async () => {
    const finish = gatePlaceFinishImage({ handshakeHash: new Uint8Array(32), bundleDigest: "00".repeat(32), presentationDigest: "11".repeat(32), audience: "aud", placeKey: signer.key });
    expect(carriageFloorDutyOf(finish)).toBe(GATE_PLACE_FINISH_DOMAIN);
    const sig = hexToBytes(await signer.signFloor(carriageFloorDutyOf(finish), finish));
    expect(await ed25519.verifyAsync(sig, finish, hexToBytes(signer.key))).toBe(true);
  });

  it("CONTROL: a floor pin statement and a carrier record keep their own duties", () => {
    expect(carriageFloorDutyOf(image(PLACE_FLOOR_PIN_DOMAIN))).toBe(PLACE_FLOOR_PIN_DOMAIN);
    expect(carriageFloorDutyOf(image(CARRIAGE_CARRIER_DOMAIN))).toBe(CARRIAGE_CARRIER_DOMAIN);
  });

  it("CONTROL: a face's gate finish names no floor duty, so the place refuses to sign it", async () => {
    await expect(signer.signFloor(GATE_PLACE_FINISH_DOMAIN, image(FLEET_PROOF_DOMAIN))).rejects.toThrow(/does not carry the domain/);
  });

  it("refuses a seed of the wrong length", () => {
    expect(() => placeSignerFromSeed(new Uint8Array(8))).toThrow(/32 bytes/);
  });
});
