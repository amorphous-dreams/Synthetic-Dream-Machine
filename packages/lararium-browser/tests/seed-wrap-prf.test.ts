/**
 * seed-wrap-prf.test — PRF WRAPS THE SEED AT REST, BESIDE THE CLEARTEXT FINDING, OPT-IN (basket-one #/the-phone-seat,
 * ruled 2026-09-11: "PRF wraps beside and never mints, a synced passkey counts as a cloud").
 *
 * A fake `PublicKeyCredential` host with a fixed PRF output: wrap → unwrap round-trips the seed; a different PRF
 * output refuses, named; the wrap record NAMES the credential's key class (`cloud-synced` for a synced passkey).
 * CONTROL: a host without PRF → `detectPrf` reads `{ available: false, why }` and NOTHING wraps — the floor,
 * never a throw. The cleartext path stays untouched (its own witnesses stand in browser-persona-vault.test.ts).
 */
import { describe, test, expect } from "vitest";
import {
  detectPrf, wrapSeed, unwrapSeed, SeedWrapRefused, SEED_WRAP_HKDF_INFO,
  type PrfHost, type SeedWrapRecord,
} from "../src/seed-wrap-prf.js";
import { PERSONA_ADMIT_SEAL_INFO, KEYRING_ENVELOPE_SEAL_INFO } from "@lararium/mesh";

const SEED   = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
const PRF_A  = new Uint8Array(32).fill(0xa5);
const PRF_B  = new Uint8Array(32).fill(0x5a);
const CRED   = "cred-" + "ab".repeat(8);

/** A host whose platform authenticator offers PRF and whose passkey syncs through the vendor. */
const prfHost: PrfHost = {
  isSecureContext: true,
  PublicKeyCredential: {
    getClientCapabilities: async () => ({ "extension:prf": true, "userVerifyingPlatformAuthenticator": true }),
  },
};

describe("the PRF wrap — round-trip under one PRF output, refusal under another", () => {
  test("detectPrf reads available on a host whose client capabilities carry extension:prf", async () => {
    const d = await detectPrf(prfHost);
    expect(d.available).toBe(true);
  });

  test("wrap → unwrap round-trips the seed byte-for-byte; the record names its key class and its HKDF info", async () => {
    const rec = await wrapSeed(SEED, PRF_A, { credentialId: CRED, keyClass: "cloud-synced" });
    expect(rec.keyClass).toBe("cloud-synced");
    expect(rec.credentialId).toBe(CRED);
    expect(rec.info).toBe(SEED_WRAP_HKDF_INFO);
    // The ciphertext never carries the seed in the clear.
    expect(rec.ct).not.toContain(Array.from(SEED.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(""));
    const back = await unwrapSeed(rec, PRF_A);
    expect(Array.from(back)).toEqual(Array.from(SEED));
  });

  test("a different PRF output refuses, named — never a wrong seed", async () => {
    const rec = await wrapSeed(SEED, PRF_A, { credentialId: CRED, keyClass: "cloud-synced" });
    await expect(unwrapSeed(rec, PRF_B)).rejects.toThrow(SeedWrapRefused);
  });

  test("a tampered record refuses (the AEAD tag covers the ciphertext)", async () => {
    const rec = await wrapSeed(SEED, PRF_A, { credentialId: CRED, keyClass: "cloud-synced" });
    const flipped: SeedWrapRecord = { ...rec, ct: (rec.ct[0] === "0" ? "1" : "0") + rec.ct.slice(1) };
    expect(flipped.ct).not.toBe(rec.ct);
    await expect(unwrapSeed(flipped, PRF_A)).rejects.toThrow(SeedWrapRefused);
  });

  test("the HKDF info is its OWN separated string — never an existing seal's", () => {
    expect(SEED_WRAP_HKDF_INFO).not.toBe(PERSONA_ADMIT_SEAL_INFO);
    expect(SEED_WRAP_HKDF_INFO).not.toBe(KEYRING_ENVELOPE_SEAL_INFO);
    expect(SEED_WRAP_HKDF_INFO).toMatch(/seed-wrap-prf/);
  });

  test("a PRF output of the wrong length refuses at the wrap door", async () => {
    await expect(wrapSeed(SEED, new Uint8Array(16), { credentialId: CRED, keyClass: "cloud-synced" })).rejects.toThrow(SeedWrapRefused);
  });
});

describe("CONTROL — no PRF on the host: the floor, never a throw; nothing wraps", () => {
  test("no PublicKeyCredential at all → { available: false, why }", async () => {
    const d = await detectPrf({ isSecureContext: true });
    expect(d.available).toBe(false);
    expect(d.why).toMatch(/PublicKeyCredential/);
  });
  test("capabilities that omit extension:prf → { available: false, why }", async () => {
    const d = await detectPrf({ isSecureContext: true, PublicKeyCredential: { getClientCapabilities: async () => ({}) } });
    expect(d.available).toBe(false);
    expect(d.why).toMatch(/prf/i);
  });
  test("an insecure context → { available: false, why }, even where the API stands", async () => {
    const d = await detectPrf({ ...prfHost, isSecureContext: false });
    expect(d.available).toBe(false);
    expect(d.why).toMatch(/secure context/);
  });
  test("a capabilities call that throws reads as the floor, never a throw", async () => {
    const d = await detectPrf({ isSecureContext: true, PublicKeyCredential: { getClientCapabilities: async () => { throw new Error("nope"); } } });
    expect(d.available).toBe(false);
  });
});
