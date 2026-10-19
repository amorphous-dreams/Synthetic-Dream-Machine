import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import {
  CARRIAGE_CARRIER_DOMAIN, DEVICE_DELEGATION_DOMAIN, DYAD_BINDING_DOMAIN, FLEET_PROOF_DOMAIN, ORACLE_POINTER_DOMAIN,
  PLACE_FLOOR_PIN_DOMAIN, PLACE_SIGNER_DOMAINS, RAISE_CHALLENGE_DOMAIN, hexToBytes, placeSignerFromSeed, utf8Bytes,
} from "../src/index.js";

const signer = placeSignerFromSeed(new Uint8Array(32).fill(0x33));
const image = (domain: string): Uint8Array => utf8Bytes(JSON.stringify({ kind: domain, subject: "a floor record" }));

describe("the place signer", () => {
  it("signs each floor duty, and the signature verifies under the place key", async () => {
    for (const domain of [CARRIAGE_CARRIER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, ORACLE_POINTER_DOMAIN, RAISE_CHALLENGE_DOMAIN]) {
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

  it("holds a closed allowlist of exactly the four floor duties", () => {
    expect([...PLACE_SIGNER_DOMAINS].sort()).toEqual([CARRIAGE_CARRIER_DOMAIN, ORACLE_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN].sort());
    expect(Object.isFrozen(PLACE_SIGNER_DOMAINS)).toBe(true);
  });

  it("refuses a seed of the wrong length", () => {
    expect(() => placeSignerFromSeed(new Uint8Array(8))).toThrow(/32 bytes/);
  });
});
