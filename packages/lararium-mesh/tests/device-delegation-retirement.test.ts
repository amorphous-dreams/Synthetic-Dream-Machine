import { describe, expect, it } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { DEVICE_ATOM_COUNTERSIGN_DOMAIN } from "../src/domains.js";
import {
  buildDeviceDelegation, DEVICE_DELEGATION_DOMAIN, evaluateDeviceDelegation,
  verifyDeviceDelegation, type DeviceDelegationTiddler,
} from "../src/device-delegation.js";

describe("epoch-free signature and interim authority fence", () => {
  it("keeps a valid epoch-free signature unavailable to epoch-gated authority", async () => {
    const rootSeed = new Uint8Array(32).fill(7);
    const atomSeed = new Uint8Array(32).fill(9);
    const legacy = await buildDeviceDelegation({ personaRootSeed: rootSeed, atomSeed, hearthTrueName: "", boundEpoch: 5 });
    const { boundEpoch: _epoch, signature: _signature, atomSignature: _atomSignature, ...fields } = legacy;
    const proof = `${DEVICE_DELEGATION_DOMAIN}|${fields.personaRootDid}|${fields.deviceDid}|${fields.deviceVerifyingKey}|${fields.hearthTrueName}`;
    const signature = hex(await ed25519.signAsync(new TextEncoder().encode(proof), rootSeed));
    const atomSignature = hex(await ed25519.signAsync(new TextEncoder().encode(
      `${DEVICE_ATOM_COUNTERSIGN_DOMAIN}|${proof}|${signature}`,
    ), atomSeed));
    const edge = { ...fields, signature, atomSignature } as DeviceDelegationTiddler;

    expect(await verifyDeviceDelegation(edge, fields.personaRootDid)).toEqual({ ok: true });
    expect(await evaluateDeviceDelegation(edge, fields.personaRootDid, { expectedEpoch: 5 })).toMatchObject({
      state: "unavailable", cryptographicallyValid: true, reason: "delegation lease proof unavailable",
    });
    expect(await verifyDeviceDelegation(edge, fields.personaRootDid, { expectedEpoch: 5 })).toEqual({
      ok: false, reason: "delegation lease proof unavailable",
    });
    expect(await verifyDeviceDelegation(legacy, fields.personaRootDid, { expectedEpoch: 5 })).toEqual({ ok: true });
    expect(await verifyDeviceDelegation({ ...edge, hearthTrueName: "other" }, fields.personaRootDid)).toMatchObject({ ok: false });
    const { boundEpoch: _removed, ...stripped } = legacy;
    expect(await verifyDeviceDelegation(stripped as DeviceDelegationTiddler, fields.personaRootDid)).toMatchObject({ ok: false });
  });
});
