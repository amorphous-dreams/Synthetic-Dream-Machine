import { describe, expect, test } from "vitest";
import { intentDelegationCite, IntentRefused } from "../src/commands/intent.js";
import { buildDelegation, buildDelegationRevoke, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, intentEntryCid, makeHandLineage, readIntentPlane, fixtureIntentVerbs } from "@lararium/mesh";
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

describe("intent delegation command guards", () => {
  test("RED: malformed causal cites refuse; CONTROL: each named cite parses", () => {
    expect(() => intentDelegationCite("roster:bad")).toThrow(/delegation-cite-malformed/);
    for (const kind of ["roster", "frontier", "control"] as const) expect(intentDelegationCite(`${kind}:${"a".repeat(64)}`)).toEqual({ [kind]: "a".repeat(64) });
    expect(IntentRefused.name).toBe("IntentRefused");
  });

  test("RED: a non-root grant refuses; CONTROL: root grant and revoke appear in the list", async () => {
    const root = await who(1), device = await who(2), agent = await who(3);
    const grant = await buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: {} }, bound: { until: { roster: "a".repeat(64) } }, nonce: "n" });
    const revoke = await buildDelegationRevoke({ group: "face", signer: root, epoch: 0, delegation: intentEntryCid(grant) });
    const wrong = await buildDelegation({ group: "face", signer: device, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: {} }, bound: { until: { roster: "a".repeat(64) } }, nonce: "other" });
    const view = readIntentPlane({ group: "face", records: [grant, revoke, wrong], verbs: fixtureIntentVerbs({ MOVE: "idempotent" }),
      face: { devices: [device.key], rosterCids: [], admittedAt: new Map(), lineage: makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])! }, standing: () => "stands" });
    expect(view.refused).toContainEqual({ refusal: "unauthorized" });
    expect(view.delegations).toEqual([{ cid: intentEntryCid(grant), agent: agent.key, prefix: "MOVE", status: "revoked", revokedBy: intentEntryCid(revoke) }]);
  });
});
