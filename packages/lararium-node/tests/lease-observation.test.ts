/** lease-observation — the anchor rises only on a verified signed slot. Reds: unsigned, stranger, other group; control: the root's advance. */
import { describe, expect, it } from "vitest";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, recoveryContactRegistrationCard, mintFaceAnchor,
  provisionThresholdRecoveryAtFounding, signLeaseAdvance,
} from "@lararium/mesh";
import { realKel, forgedRotation } from "../../lararium-mesh/tests/kel-fixture.js";
import { raiseAnchorFromSlots } from "../src/lease-observation.js";

describe("raiseAnchorFromSlots", () => {
  it("RED: unsigned, stranger-signed and other-group slots raise nothing; CONTROL: the root's own advance raises", async () => {
    const seed = new Uint8Array(32).fill(3);
    const root = await ed25519VerifyingKeyFromSeed(seed);
    const gk = await Promise.all([1, 2, 3].map((n) => ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n + 60))));
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${root}`, recoveryThreshold: 2,
      recoveryContacts: gk.map((k, i) => recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, k, null)),
    });
    const anchor = mintFaceAnchor({ personaGroup: "g1", personaKelPrefix: prov.inception.prefix, personaRootDid: `0x${root}`, edge: {}, leaseEpoch: 0 });
    const sign = { key: root, sign: ed25519SignerFromSeed(seed) };
    const stranger = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(9)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(9)) };
    const bad = ["50", await signLeaseAdvance({ resource: "g1", epoch: 40 }, stranger), await signLeaseAdvance({ resource: "other", epoch: 30 }, sign)];
    expect(raiseAnchorFromSlots(anchor, bad, [prov.inception])).toBe(anchor);
    const good = await signLeaseAdvance({ resource: "g1", epoch: 3 }, sign);
    expect(raiseAnchorFromSlots(anchor, [...bad, good], [prov.inception]).frontier.leaseEpoch).toBe(3);
    expect(raiseAnchorFromSlots(raiseAnchorFromSlots(anchor, [good], [prov.inception]), [], [prov.inception]).frontier.leaseEpoch, "a deleted slot lowers nothing").toBe(3);
  });

  it("RED: a key the KEL rotated past raises no lease epoch; CONTROL: the current root's advance raises", async () => {
    const mk = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
    const oldK = await mk(1), newK = await mk(2);
    const kel = (await realKel([oldK.key, newK.key])).chain;
    const anchor = mintFaceAnchor({ personaGroup: "g1", personaKelPrefix: "kel1", personaRootDid: `0x${newK.key}`, edge: {}, leaseEpoch: 2 });
    const retired = await signLeaseAdvance({ resource: "g1", epoch: 900 }, oldK);
    expect(raiseAnchorFromSlots(anchor, [retired], kel), "the retired key's advance moves nothing").toBe(anchor);
    const current = await signLeaseAdvance({ resource: "g1", epoch: 5 }, newK);
    expect(raiseAnchorFromSlots(anchor, [retired, current], kel).frontier.leaseEpoch).toBe(5);
  });

  it("RED: a rejected rotation in the chain (the heap a node ring carries) seats no lease signer; CONTROL: the real root still raises", async () => {
    const mk = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
    const root = await mk(1), attacker = await mk(9);
    const real = (await realKel([root.key])).chain;
    const heap = [...real, forgedRotation(real, attacker.key)];
    const anchor = mintFaceAnchor({ personaGroup: "g1", personaKelPrefix: "kel1", personaRootDid: `0x${root.key}`, edge: {}, leaseEpoch: 0 });
    const forged = await signLeaseAdvance({ resource: "g1", epoch: 900 }, attacker);
    const honest = await signLeaseAdvance({ resource: "g1", epoch: 3 }, root);
    expect(raiseAnchorFromSlots(anchor, [forged], heap), "the attacker's fake rotation seats nothing").toBe(anchor);
    expect(raiseAnchorFromSlots(anchor, [forged, honest], heap).frontier.leaseEpoch).toBe(3);
  });
});
