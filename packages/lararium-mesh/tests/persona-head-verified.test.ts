/**
 * persona-head-verified.test — no reader takes a persona's head off a rotation it did not verify.
 *
 * A persona rotation carries its own proof: the revealed guardian roster hashes to the predecessor's rolling
 * commitment, and a threshold of those guardians signed the event. `verifyPersonaKel` reads structure alone and
 * a junk rotation passes it, so `headOpKey` verifies every step's authority on EVERY read: no option selects a
 * head off structure.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  headOpKey, mintPersonaInception, personaEventCidOf, verifyPersonaKel, verifyPersonaKelFull, type PersonaKelEvent,
} from "../src/persona-kel.js";
import { attestAndRotate } from "../src/recovery-keel-core.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const key = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seed(n)));
const signer = (n: number) => async (b: Uint8Array): Promise<string> => hex(await ed.signAsync(b, seed(n)));

describe("a persona head rests on verified steps alone", () => {
  test("★ a stranger's unsigned rotation reads structurally whole and seats no head ★", async () => {
    const guardian = await key(2), founding = `0x${await key(1)}`, stranger = `0x${await key(66)}`;
    const inception = mintPersonaInception(founding, sealKeySetHash([guardian], 1));
    // The stranger learned the guardian roster (public keys) and reveals it, with no signature at all.
    const core = {
      seq: 1, prefix: inception.prefix, opKeyDid: stranger, recoverySetHash: inception.recoverySetHash,
      nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: inception.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: inception.enrolmentDigest,
    };
    const forged = { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [guardian], recoveryThreshold: 1, rotationSigs: [] } as PersonaKelEvent;
    expect(verifyPersonaKel([inception, forged])).toBe(true);                                   // KNOWN POSITIVE: structure passes
    expect((await verifyPersonaKelFull([inception, forged])).ok).toBe(false);
    expect(await headOpKey([inception, forged])).toBeNull();
    expect(await headOpKey([inception, forged], { acceptProvisional: true })).toBeNull();
  });

  test("CONTROL: the inception's key heads its own log, and a guardian-signed rotation moves the head", async () => {
    const guardian = await key(2), founding = `0x${await key(1)}`, fresh = `0x${await key(3)}`;
    const inception = mintPersonaInception(founding, sealKeySetHash([guardian], 1));
    expect(await headOpKey([inception])).toBe(founding);
    const rotated = await attestAndRotate({
      head: inception, freshOpKeyDid: fresh, guardianRecoveryKeys: [guardian], recoveryThreshold: 1,
      guardianSigners: [{ signer: guardian, sign: signer(2) }],
    });
    if (!rotated.ok) throw new Error(rotated.reason);
    expect(await headOpKey([inception, rotated.event])).toBe(fresh);
  });
});
