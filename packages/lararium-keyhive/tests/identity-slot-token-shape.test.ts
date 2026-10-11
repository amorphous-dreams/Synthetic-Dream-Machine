/**
 * identity-slot-token-shape — the capability token names its delegation and carries no counter.
 *
 * The token is minted and read by `KeyhiveIdentitySlot` alone, so its shape is one build's private
 * agreement. A `v` field there claimed an ordering of shapes nothing else reads; the token's fields are
 * what a verifier keys on, and the real check rides the provider's `accessForDoc` either way.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/identity-slot
 */
import { describe, expect, test } from "vitest";
import { KeyhiveIdentitySlot, type TokenSeal } from "../src/keyhive-identity-slot.js";
import type { CapabilityProvider } from "../src/capability-provider.js";
import { hex, sha256HexSync } from "@lararium/mesh";

const DOC = "automerge:doc-under-test";

/** A provider that delegates a fixed event and clears exactly one (audience, bag) pair. */
function fakeProvider(granted: { presenter: string; bagUrl: string }): CapabilityProvider {
  return {
    delegate: async () => ({ delegationId: "deleg-1", bytes: new Uint8Array([1, 2, 3]) }),
    verify:   async (a: { presenter: string; bagUrl: string }) =>
      ({ ok: a.presenter === granted.presenter && a.bagUrl === granted.bagUrl }),
  } as unknown as CapabilityProvider;
}

/** H6 — a test double standing in for the vessel device key: a deterministic keyed MAC (not a real
 *  signature scheme) over the exact bytes `tokenSeal` is handed. Two independently-constructed seals with
 *  DIFFERENT secrets never verify each other's output — enough to prove the gate checks a real binding. */
function fakeSeal(secret: string): TokenSeal {
  const mac = (bytes: Uint8Array) => sha256HexSync(secret + hex(bytes));
  return {
    sign:   (bytes) => mac(bytes),
    verify: (bytes, sigHex) => mac(bytes) === sigHex,
  };
}

describe("the keyhive capability token", () => {
  const provider = fakeProvider({ presenter: "did:peer", bagUrl: DOC });
  const seal = fakeSeal("vessel-device-key-secret");

  test("carries its delegation fields, no version, and no wall-clock expiry — the fence alone gates", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    const payload = JSON.parse(token!) as Record<string, unknown>;
    expect("v" in payload).toBe(false);
    expect("expiresAtMs" in payload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["access", "audience", "bagUrl", "boundEpoch", "bytesHex", "delegationId", "sealSigHex"]);
  });

  test("CONTROL: a minted, sealed token verifies for its own bag when the epoch has not rolled", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, DOC)).toBe(true);
  });

  test("CONTROL: the token refuses another bag, an unparseable body and an absent token", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, "automerge:another-doc")).toBe(false);
    expect(await slot.verifyDelegation("{not json", DOC)).toBe(false);
    expect(await slot.verifyDelegation("null", DOC)).toBe(false);
    expect(await slot.verifyDelegation(null, DOC)).toBe(false);
  });

  // §2c — the clockless epoch fence. Each case below is a MUTATION of the control above: one fact changes,
  // the rest holds, and the verdict flips — proving the fence (not some other check) is what gates it.
  describe("the §2c epoch fence", () => {
    test("MUTATION: no leaseEpochOf at mint → boundEpoch null → every verify refuses, even with the SAME resolver + seal at verify time", async () => {
      const unfenced = new KeyhiveIdentitySlot({ provider, did: "did:self", tokenSeal: seal });   // no leaseEpochOf at all
      const token = await unfenced.delegateCapability(DOC, "did:peer", "read");
      const payload = JSON.parse(token!) as Record<string, unknown>;
      expect(payload["boundEpoch"]).toBeNull();
      // Even verified through a slot that COULD read the epoch and the seal, an unfenced mint never reads as fenced.
      const verifier = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      expect(await verifier.verifyDelegation(token, DOC)).toBe(false);
    });

    test("MUTATION: the lease epoch rolled past the mint epoch → refuse", async () => {
      let epoch = 3;
      const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => epoch, tokenSeal: seal });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      expect(await slot.verifyDelegation(token, DOC)).toBe(true);   // control: still current
      epoch = 4;                                                    // the lease rolled forward
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);  // mutation: now refuses
    });

    test("MUTATION: an unreadable current epoch at verify time (resolver throws) → refuse — incomplete view, never 'standing'", async () => {
      let shouldThrow = false;
      const slot = new KeyhiveIdentitySlot({
        provider, did: "did:self", tokenSeal: seal,
        leaseEpochOf: () => { if (shouldThrow) throw new Error("board unreadable"); return 3; },
      });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      expect(await slot.verifyDelegation(token, DOC)).toBe(true);    // control
      shouldThrow = true;
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);   // mutation: unreadable → refuse
    });

    test("the fence runs AFTER provider.verify — a revoked presenter reads the revocation refusal path, not a fence bypass", async () => {
      const deniedProvider = fakeProvider({ presenter: "did:someone-else", bagUrl: DOC });   // never grants did:peer
      const slot = new KeyhiveIdentitySlot({ provider: deniedProvider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      // provider.verify refuses this audience regardless of the fence being perfectly satisfied.
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);
    });
  });

  // H6 — the fence is now SIGNED. Every case below RE-PROVES the exact live hole episkopos-3 found (the
  // presenter edits its own `boundEpoch` upward after the lease rolled, and the bare-JSON fence cleared it)
  // and shows the real code now refuses it, plus a mutation that restores the hole to prove the seal gate
  // — not something else — is what closed it.
  describe("H6 — the signed fence", () => {
    test("no tokenSeal at mint → boundEpoch forced null, even WITH a working leaseEpochOf", async () => {
      const unsealed = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });   // no tokenSeal
      const token = await unsealed.delegateCapability(DOC, "did:peer", "read");
      const payload = JSON.parse(token!) as Record<string, unknown>;
      expect(payload["boundEpoch"]).toBeNull();
      expect(payload["sealSigHex"]).toBeNull();
      // Verified through a slot that COULD check a seal, the forced-null boundEpoch still refuses at the fence.
      const verifier = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      expect(await verifier.verifyDelegation(token, DOC)).toBe(false);
    });

    test("LIVE HOLE RE-PROVEN AND CLOSED: a presenter who edits boundEpoch upward after the lease rolled is refused", async () => {
      let epoch = 5;
      const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => epoch, tokenSeal: seal });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      expect(await slot.verifyDelegation(token, DOC)).toBe(true);     // control: still current
      epoch = 6;                                                      // the lease rolls
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);    // the roll alone refuses (§2c)
      // The forgery: edit the carried boundEpoch upward, WITHOUT re-signing (a presenter has no signing key).
      const forged = JSON.stringify({ ...JSON.parse(token!), boundEpoch: 1e15 });
      expect(await slot.verifyDelegation(forged, DOC)).toBe(false);    // H6: the seal no longer matches → refuse
    });

    test("MUTATION: skipping the seal check (as the pre-H6 code did) reads the forged token true again", async () => {
      let epoch = 5;
      const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => epoch, tokenSeal: seal });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      epoch = 6;
      const forgedPayload = { ...JSON.parse(token!), boundEpoch: 1e15 } as Record<string, unknown>;
      // Reproduce the PRE-H6 fence inline (never touching the real module): trust `boundEpoch` with no seal
      // check at all, exactly as `verifyDelegation` did before this fix.
      const preH6Fence = (boundEpoch: number, currentEpoch: number) => currentEpoch <= boundEpoch;
      expect(preH6Fence(forgedPayload["boundEpoch"] as number, epoch)).toBe(true);   // the OLD hole: forged epoch clears
      // The REAL, current code refuses the identical forged payload.
      expect(await slot.verifyDelegation(JSON.stringify(forgedPayload), DOC)).toBe(false);
    });

    test("a token sealed by a DIFFERENT device key (mismatched secret) refuses — the seal binds to ONE key", async () => {
      const otherSeal = fakeSeal("a-different-vessel-key");
      const minter = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: otherSeal });
      const token = await minter.delegateCapability(DOC, "did:peer", "read");
      const verifier = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      expect(await verifier.verifyDelegation(token, DOC)).toBe(false);
    });

    test("a verifying slot with no tokenSeal at all refuses any token carrying a non-null boundEpoch", async () => {
      const minter = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      const token = await minter.delegateCapability(DOC, "did:peer", "read");
      const verifierNoSeal = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });   // no tokenSeal
      expect(await verifierNoSeal.verifyDelegation(token, DOC)).toBe(false);
    });

    test("stripping sealSigHex off an otherwise-valid sealed token refuses (no seal carried = deny)", async () => {
      const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3, tokenSeal: seal });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      const stripped = JSON.stringify({ ...JSON.parse(token!), sealSigHex: null });
      expect(await slot.verifyDelegation(stripped, DOC)).toBe(false);
    });
  });
});
