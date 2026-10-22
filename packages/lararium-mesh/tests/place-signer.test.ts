import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import {
  CARRIAGE_CARRIER_DOMAIN, DEVICE_DELEGATION_DOMAIN, GATE_PLACE_FINISH_DOMAIN, carriageFloorDutyOf, DYAD_BINDING_DOMAIN, FLEET_PROOF_DOMAIN, FLOW_POINTER_DOMAIN,
  PLACE_FLOOR_PIN_DOMAIN, PLACE_SIGNER_DOMAINS, RAISE_CHALLENGE_DOMAIN, hexToBytes, placeFloorPinImage, placeSignerFromSeed, raiseChallengeBytes, carrierContractBytes, utf8Bytes,
} from "../src/index.js";
import { gatePlaceFinishImage } from "../src/gate-exchange.js";

const signer = placeSignerFromSeed(new Uint8Array(32).fill(0x33));
const image = (domain: string): Uint8Array => utf8Bytes(JSON.stringify({ kind: domain, subject: "a floor record" }));
const pin = { tier: "floor", nexus: "6e", route: "/oracle", transportKey: "11".repeat(32), signingKey: "22".repeat(32) } as never;
/** Each duty's REAL image, built by the code that builds it in production. */
const realImage: Record<string, Uint8Array> = {
  [CARRIAGE_CARRIER_DOMAIN]: carrierContractBytes({ nym: "ab".repeat(32), sealEpochCid: "epoch-" + "cd".repeat(32) }),
  [PLACE_FLOOR_PIN_DOMAIN]: placeFloorPinImage("33".repeat(32), pin),
  [FLOW_POINTER_DOMAIN]: utf8Bytes([FLOW_POINTER_DOMAIN, "cid", "h1,h2", "act", "p1", "44".repeat(32)].join("|")),
  [RAISE_CHALLENGE_DOMAIN]: raiseChallengeBytes({ vesselId: "v", nexus: "n", epoch: 7, nonce: "x" }),
  [GATE_PLACE_FINISH_DOMAIN]: gatePlaceFinishImage({ handshakeHash: new Uint8Array(32), bundleDigest: "00".repeat(32), presentationDigest: "11".repeat(32), audience: "aud", placeKey: "55".repeat(32) }),
};

describe("the place signer", () => {
  it("signs each floor duty, and the signature verifies under the place key", async () => {
    for (const domain of PLACE_SIGNER_DOMAINS) {
      const real = realImage[domain]!;
      const sig = hexToBytes(await signer.signFloor(domain, real));
      expect(await ed25519.verifyAsync(sig, real, hexToBytes(signer.key))).toBe(true);
    }
  });

  it("refuses by name every face act it must never sign", async () => {
    for (const domain of [DEVICE_DELEGATION_DOMAIN, FLEET_PROOF_DOMAIN, DYAD_BINDING_DOMAIN]) {
      await expect(signer.signFloor(domain, image(domain))).rejects.toThrow(/names no floor duty/);
    }
  });

  it("refuses a preimage that does not carry the domain it claims", async () => {
    await expect(signer.signFloor(PLACE_FLOOR_PIN_DOMAIN, image(FLOW_POINTER_DOMAIN))).rejects.toThrow(/does not carry the domain/);
  });

  it("RED: a floor domain embedded mid-body under a non-floor head refuses, whatever duty it names", async () => {
    for (const domain of PLACE_SIGNER_DOMAINS) {
      const embedded = utf8Bytes(`{"address":"${domain}","kind":"lar:///x/some-other-purpose"}`);
      await expect(signer.signFloor(domain, embedded)).rejects.toThrow(/does not carry the domain/);
    }
    expect(carriageFloorDutyOf(utf8Bytes(`{"title":"${PLACE_FLOOR_PIN_DOMAIN}"}`))).toBe(CARRIAGE_CARRIER_DOMAIN);
    await expect(signer.signFloor(CARRIAGE_CARRIER_DOMAIN, utf8Bytes(`{"title":"${PLACE_FLOOR_PIN_DOMAIN}"}`))).rejects.toThrow(/does not carry the domain/);
  });

  it("RED: a gate-finish image whose head names another domain refuses", async () => {
    const forged = gatePlaceFinishImage({ handshakeHash: new Uint8Array(32), bundleDigest: "00".repeat(32), presentationDigest: "11".repeat(32), audience: PLACE_FLOOR_PIN_DOMAIN, placeKey: "55".repeat(32) });
    const reframed = Uint8Array.from([...realImage[PLACE_FLOOR_PIN_DOMAIN]!]);
    await expect(signer.signFloor(GATE_PLACE_FINISH_DOMAIN, reframed)).rejects.toThrow(/does not carry the domain/);
    // the genuine finish still routes to its own duty though it embeds a floor domain in a peer-supplied field
    expect(carriageFloorDutyOf(forged)).toBe(GATE_PLACE_FINISH_DOMAIN);
    expect(carriageFloorDutyOf(realImage[PLACE_FLOOR_PIN_DOMAIN]!)).toBe(PLACE_FLOOR_PIN_DOMAIN);
  });

  it("RED: a raise challenge with a leading-zero or signed epoch refuses; the exact head signs", async () => {
    const at = (epoch: string) => utf8Bytes(`{"epoch":${epoch},"kind":"${RAISE_CHALLENGE_DOMAIN}","nexus":"n","nonce":"x","vesselId":"v"}`);
    for (const bad of ["07", "-7", "+7", "7.5", "1e3", ""]) await expect(signer.signFloor(RAISE_CHALLENGE_DOMAIN, at(bad))).rejects.toThrow(/does not carry the domain/);
    for (const good of ["0", "7", "1234567"]) await expect(signer.signFloor(RAISE_CHALLENGE_DOMAIN, at(good))).resolves.toMatch(/^[0-9a-f]+$/);
  });

  it("holds a closed allowlist of exactly the five floor duties", () => {
    expect([...PLACE_SIGNER_DOMAINS].sort()).toEqual([CARRIAGE_CARRIER_DOMAIN, GATE_PLACE_FINISH_DOMAIN, FLOW_POINTER_DOMAIN, PLACE_FLOOR_PIN_DOMAIN, RAISE_CHALLENGE_DOMAIN].sort());
    expect(Object.isFrozen(PLACE_SIGNER_DOMAINS)).toBe(true);
  });

  it("RED: a herm dialing another place's gate signs its finish, which the carriage routes to the place-finish duty", async () => {
    const finish = realImage[GATE_PLACE_FINISH_DOMAIN]!;
    expect(carriageFloorDutyOf(finish)).toBe(GATE_PLACE_FINISH_DOMAIN);
    const sig = hexToBytes(await signer.signFloor(carriageFloorDutyOf(finish), finish));
    expect(await ed25519.verifyAsync(sig, finish, hexToBytes(signer.key))).toBe(true);
  });

  it("CONTROL: a floor pin statement and a carrier record keep their own duties", () => {
    expect(carriageFloorDutyOf(realImage[PLACE_FLOOR_PIN_DOMAIN]!)).toBe(PLACE_FLOOR_PIN_DOMAIN);
    expect(carriageFloorDutyOf(realImage[CARRIAGE_CARRIER_DOMAIN]!)).toBe(CARRIAGE_CARRIER_DOMAIN);
  });

  it("CONTROL: a face's gate finish names no floor duty, so the place refuses to sign it", async () => {
    await expect(signer.signFloor(GATE_PLACE_FINISH_DOMAIN, image(FLEET_PROOF_DOMAIN))).rejects.toThrow(/does not carry the domain/);
  });

  it("refuses a seed of the wrong length", () => {
    expect(() => placeSignerFromSeed(new Uint8Array(8))).toThrow(/32 bytes/);
  });
});
