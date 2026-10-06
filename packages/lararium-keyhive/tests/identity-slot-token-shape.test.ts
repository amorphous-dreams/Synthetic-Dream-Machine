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
  const slot = new KeyhiveIdentitySlot({ provider: fakeProvider({ presenter: "did:peer", bagUrl: DOC }), did: "did:self" });

  test("carries its delegation fields and no version", async () => {
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    const payload = JSON.parse(token!) as Record<string, unknown>;
    expect("v" in payload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["access", "audience", "bagUrl", "bytesHex", "delegationId", "expiresAtMs"]);
  });

  test("CONTROL: a minted token verifies for its own bag", async () => {
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, DOC)).toBe(true);
  });

  test("CONTROL: the token refuses another bag, an unparseable body and an absent token", async () => {
    const token = await slot.delegateCapability(DOC, "did:peer", "read");
    expect(await slot.verifyDelegation(token, "automerge:another-doc")).toBe(false);
    expect(await slot.verifyDelegation("{not json", DOC)).toBe(false);
    expect(await slot.verifyDelegation("null", DOC)).toBe(false);
    expect(await slot.verifyDelegation(null, DOC)).toBe(false);
  });
});
