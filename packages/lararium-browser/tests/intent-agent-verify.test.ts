import { afterEach, describe, expect, test, vi } from "vitest";
import { buildAgentIntent, buildDelegation, buildDelegationRevoke, buildOutcome, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fixtureIntentVerbs, intentEntryCid, intentId, makeHandLineage, mayAct, readIntentPlane, signIntentEntry } from "@lararium/mesh";
import { decideAdmission } from "../../lararium-mesh/src/intent-admission.js";

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
afterEach(() => vi.restoreAllMocks());

describe("browser agent verification", () => {
  test("RED: changed arguments and a forged agent refuse; CONTROL: a narrow grant and unchanged entry verify", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const root = await who(1), device = await who(2), agent = await who(3), stranger = await who(4), group = "face";
    const verbs = fixtureIntentVerbs({ MOVE: "idempotent" });
    const read = { group, face: { devices: [device.key], rosterCids: [] as string[], admittedAt: new Map<string, string>(), lineage: makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])! }, standing: () => "stands" as const, verbs };
    const grant = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "grant" });
    const entry = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
    const id = intentId({ issuer: agent.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
    const decide = (raw: unknown, records: unknown[]) => decideAdmission({ group, raw, read, records });
    expect(await decide(entry, [grant])).toMatchObject({ ok: true });
    expect(mayAct(readIntentPlane({ ...read, records: [grant, entry] }), id, device.key)).toEqual({ act: true });
    expect(await decide({ ...entry, body: { ...entry.body, args: { x: 2 } } }, [grant])).toEqual({ ok: false, refusal: "entry-refused" });
    const forged = await signIntentEntry({ ...entry.body, issuer: stranger.key }, stranger);
    expect(await decide(forged, [grant])).toEqual({ ok: false, refusal: "agent-key" });
    const revoke = await buildDelegationRevoke({ group, signer: root, epoch: 0, delegation: intentEntryCid(grant) });
    const outcome = await buildOutcome({ group, signer: device, cause: id, result: "done" });
    const revoked = readIntentPlane({ ...read, records: [grant, entry, outcome, revoke] });
    expect(mayAct(revoked, id, device.key)).toEqual({ act: false, reason: "void" });
    expect(revoked.intents[0]!.voidAfterAct).toHaveLength(1);
    const waiting = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer" } } }, bound: { asOf: { frontier: "b".repeat(64) } }, nonce: "wait" });
    const pending = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(waiting), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
    expect(await decide(pending, [waiting])).toEqual({ ok: false, refusal: "unknown-frontier" });
    expect(mayAct(readIntentPlane({ ...read, records: [waiting, pending] }), id, device.key)).toEqual({ act: false, reason: "unknown-frontier" });
  });

  test("RED: a planted listener trips the source census; CONTROL: browser sources carry no relay listener", () => {
    const forbidden = /intent-relay|registerUpgrade|faceGateServer|listen\s*\(/;
    expect(forbidden.test("registerUpgrade(" )).toBe(true);
    const files = import.meta.glob("../src/**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(0);
    for (const [name, source] of Object.entries(files)) expect(forbidden.test(source), name).toBe(false);
  });
});
