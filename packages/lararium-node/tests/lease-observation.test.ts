/** lease-observation — the anchor rises only on a verified signed slot. Reds: unsigned, stranger, other group; control: the root's advance. */
import { describe, expect, it } from "vitest";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, guardianRecoveryRegistrationCard, mintFaceAnchor,
  provisionThresholdRecoveryAtFounding, signLeaseAdvance,
} from "@lararium/mesh";
import { didFromVerifyingKey } from "@lararium/mesh";
import type { PersonaKelEvent } from "@lararium/mesh";
import { raiseAnchorFromSlots } from "../src/lease-observation.js";

describe("raiseAnchorFromSlots", () => {
  it("RED: unsigned, stranger-signed and other-group slots raise nothing; CONTROL: the root's own advance raises", async () => {
    const seed = new Uint8Array(32).fill(3);
    const root = await ed25519VerifyingKeyFromSeed(seed);
    const gk = await Promise.all([1, 2, 3].map((n) => ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n + 60))));
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${root}`, recoveryThreshold: 2,
      guardians: gk.map((k, i) => guardianRecoveryRegistrationCard((["mine", "guardian-a", "guardian-b"] as const)[i]!, k, null)),
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
    const kel = [oldK, newK].map((k, seq) => ({ seq, opKeyDid: didFromVerifyingKey(k.key) }) as unknown as PersonaKelEvent);
    const anchor = mintFaceAnchor({ personaGroup: "g1", personaKelPrefix: "kel1", personaRootDid: `0x${newK.key}`, edge: {}, leaseEpoch: 2 });
    const retired = await signLeaseAdvance({ resource: "g1", epoch: 900 }, oldK);
    expect(raiseAnchorFromSlots(anchor, [retired], kel), "the retired key's advance moves nothing").toBe(anchor);
    const current = await signLeaseAdvance({ resource: "g1", epoch: 5 }, newK);
    expect(raiseAnchorFromSlots(anchor, [retired, current], kel).frontier.leaseEpoch).toBe(5);
  });
});
