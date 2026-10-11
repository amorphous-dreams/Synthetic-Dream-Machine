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
import { KeyhiveIdentitySlot } from "../src/keyhive-identity-slot.js";
import type { CapabilityProvider } from "../src/capability-provider.js";

const DOC = "automerge:doc-under-test";

/** A provider that delegates a fixed event and clears exactly one (audience, bag) pair. */
function fakeProvider(granted: { presenter: string; bagUrl: string }): CapabilityProvider {
  return {
    delegate: async () => ({ delegationId: "deleg-1", bytes: new Uint8Array([1, 2, 3]) }),
    verify:   async (a: { presenter: string; bagUrl: string }) =>
      ({ ok: a.presenter === granted.presenter && a.bagUrl === granted.bagUrl }),
  } as unknown as CapabilityProvider;
}

describe("the keyhive capability token", () => {
  const provider = fakeProvider({ presenter: "did:peer", bagUrl: DOC });

  test("carries its delegation fields and no version", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    const payload = JSON.parse(token!) as Record<string, unknown>;
    expect("v" in payload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["access", "audience", "bagUrl", "boundEpoch", "bytesHex", "delegationId", "expiresAtMs"]);
  });

  test("CONTROL: a minted token verifies for its own bag when the epoch has not rolled", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, DOC)).toBe(true);
  });

  test("CONTROL: the token refuses another bag, an unparseable body and an absent token", async () => {
    const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, "automerge:another-doc")).toBe(false);
    expect(await slot.verifyDelegation("{not json", DOC)).toBe(false);
    expect(await slot.verifyDelegation("null", DOC)).toBe(false);
    expect(await slot.verifyDelegation(null, DOC)).toBe(false);
  });

  // §2c — the clockless epoch fence. Each case below is a MUTATION of the control above: one fact changes,
  // the rest holds, and the verdict flips — proving the fence (not some other check) is what gates it.
  describe("the §2c epoch fence", () => {
    test("MUTATION: no leaseEpochOf at mint → boundEpoch null → every verify refuses, even with the SAME resolver at verify time", async () => {
      const unfenced = new KeyhiveIdentitySlot({ provider, did: "did:self" });   // no leaseEpochOf at all
      const token = await unfenced.delegateCapability(DOC, "did:peer", "read");
      const payload = JSON.parse(token!) as Record<string, unknown>;
      expect(payload["boundEpoch"]).toBeNull();
      // Even verified through a slot that COULD read the epoch, an unfenced mint never reads as fenced.
      const verifier = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => 3 });
      expect(await verifier.verifyDelegation(token, DOC)).toBe(false);
    });

    test("MUTATION: the lease epoch rolled past the mint epoch → refuse", async () => {
      let epoch = 3;
      const slot = new KeyhiveIdentitySlot({ provider, did: "did:self", leaseEpochOf: () => epoch });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      expect(await slot.verifyDelegation(token, DOC)).toBe(true);   // control: still current
      epoch = 4;                                                    // the lease rolled forward
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);  // mutation: now refuses
    });

    test("MUTATION: an unreadable current epoch at verify time (resolver throws) → refuse — incomplete view, never 'standing'", async () => {
      let shouldThrow = false;
      const slot = new KeyhiveIdentitySlot({
        provider, did: "did:self",
        leaseEpochOf: () => { if (shouldThrow) throw new Error("board unreadable"); return 3; },
      });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      expect(await slot.verifyDelegation(token, DOC)).toBe(true);    // control
      shouldThrow = true;
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);   // mutation: unreadable → refuse
    });

    test("the fence runs AFTER provider.verify — a revoked presenter reads the revocation refusal path, not a fence bypass", async () => {
      const deniedProvider = fakeProvider({ presenter: "did:someone-else", bagUrl: DOC });   // never grants did:peer
      const slot = new KeyhiveIdentitySlot({ provider: deniedProvider, did: "did:self", leaseEpochOf: () => 3 });
      const token = await slot.delegateCapability(DOC, "did:peer", "read");
      // provider.verify refuses this audience regardless of the fence being perfectly satisfied.
      expect(await slot.verifyDelegation(token, DOC)).toBe(false);
    });
  });
});
