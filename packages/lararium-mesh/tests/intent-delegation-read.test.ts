import { describe, expect, test, vi } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { buildAgentIntent, buildDelegation, buildDelegationRevoke, buildIntent, buildOutcome } from "../src/intent-issue.js";
import { intentEntryCid, intentId, signIntentEntry, type SignedIntentEntry } from "../src/intent-entry.js";
import { mayAct, readIntentPlane } from "../src/intent-read.js";
import { fixtureIntentVerbs } from "../src/intent-verbs.js";
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const policy = { kind: "closed-args" as const, args: { x: { type: "integer" as const, oneOf: [1] } } };
const permutations = <T>(xs: readonly T[]): T[][] => xs.length ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest])) : [[]];
const fixture = async () => {
  const device = await who(1), root = await who(2), agent = await who(3), other = await who(4);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const face = { devices: [device.key], rosterCids: [] as string[], admittedAt: new Map<string, string>(), lineage };
  const verbs = fixtureIntentVerbs({ MOVE: "idempotent", "MOVE/child": "per-device", OTHER: "per-device" });
  const grant = (signer = root, agentKey = agent.key, bound = { until: { roster: "a".repeat(64) } }) => buildDelegation({ group: "face", signer, epoch: 0, agent: agentKey, prefix: "MOVE", policy, bound, nonce: agentKey });
  const call = (delegation: SignedIntentEntry, signer = agent) => buildAgentIntent({ group: "face", signer, delegation: intentEntryCid(delegation), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
  const id = intentId({ issuer: agent.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
  const fold = (records: SignedIntentEntry[], opts: { rosterCids?: string[]; heldFrontiers?: ReadonlySet<string>; lineage?: typeof lineage } = {}) => readIntentPlane({ group: "face", records, verbs, face: { ...face, ...opts }, heldFrontiers: opts.heldFrontiers, standing: () => "stands" });
  return { device, root, agent, other, lineage, verbs, grant, call, id, fold };
};

describe("agent delegation fold", () => {
  test("RED: wrong epoch, device grant, forged key, missing grant and widened invocation refuse; CONTROL: narrow agent and atom intents act", async () => {
    const f = await fixture(), grant = await f.grant(), call = await f.call(grant);
    const positive = f.fold([grant, call]);
    expect(positive.intents[0]!.agent).toEqual({ delegation: intentEntryCid(grant), status: "live" });
    expect(mayAct(positive, f.id, f.device.key)).toEqual({ act: true });
    const wrongEpoch = await signIntentEntry({ ...grant.body, epoch: 1 } as Parameters<typeof signIntentEntry>[0], f.root);
    const deviceGrant = await f.grant(f.device);
    expect(f.fold([wrongEpoch, deviceGrant]).refused.filter((r) => r.refusal === "unauthorized")).toHaveLength(2);
    const forged = await f.call(grant, f.other);
    expect(f.fold([grant, forged]).refused).toContainEqual({ refusal: "agent-key" });
    const claimedIssuer = await signIntentEntry({ ...call.body, issuer: f.other.key } as Parameters<typeof signIntentEntry>[0], f.agent);
    expect(f.fold([grant, claimedIssuer]).refused).toContainEqual({ refusal: "agent-key" });
    expect(f.fold([call]).refused).toContainEqual({ refusal: "delegation-unknown" });
    const wide = await signIntentEntry({ ...call.body, verb: "OTHER" } as Parameters<typeof signIntentEntry>[0], f.agent);
    expect(f.fold([grant, wide]).refused).toContainEqual({ refusal: "verb-outside-prefix" });
    const changed = await signIntentEntry({ ...call.body, args: { x: 2 } } as Parameters<typeof signIntentEntry>[0], f.agent);
    expect(f.fold([grant, changed]).refused).toContainEqual({ refusal: "args-outside-policy" });
    const atom = await buildIntent({ group: "face", signer: f.device, verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
    const atomId = intentId({ issuer: f.device.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
    expect(mayAct(f.fold([atom]), atomId, f.device.key)).toEqual({ act: true });
  });

  test("RED: revoke first and concurrent effect converge in every merge order; CONTROL: another delegation stays live", async () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    try {
      const f = await fixture(), grant = await f.grant(), call = await f.call(grant), revoke = await buildDelegationRevoke({ group: "face", signer: f.root, epoch: 0, delegation: intentEntryCid(grant) });
      const views = permutations([revoke, grant, call]).map((order) => f.fold(order));
      expect(views).toHaveLength(6);
      for (const view of views) {
        expect(view.intents[0]!.agent?.status).toBe("revoked");
        expect(mayAct(view, f.id, f.device.key)).toEqual({ act: false, reason: "void" });
        expect(view.delegations[0]!.revokedBy).toBe(intentEntryCid(revoke));
      }
      const outcome = await buildOutcome({ group: "face", signer: f.device, cause: f.id, result: "done" });
      for (const order of [[call, grant, outcome, revoke], [revoke, outcome, grant, call]]) {
        const state = f.fold(order).intents[0]!;
        expect(state.voidAfterAct).toHaveLength(1);
        expect(state.voidCause).toBe("delegation-revoked");
      }
      const otherGrant = await f.grant(f.root, f.other.key), otherCall = await f.call(otherGrant, f.other);
      expect(f.fold([grant, call, revoke, otherGrant, otherCall]).delegations.find((d) => d.cid === intentEntryCid(otherGrant))?.status).toBe("live");
      expect(f.fold([grant, call, revoke, otherGrant, otherCall]).intents.some((s) => s.agent?.status === "live")).toBe(true);
    } finally { clock.mockRestore(); }
  });

  test("RED: unknown asOf waits, held until closes, former root cannot revoke later grant; CONTROL: held cites open", async () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    try {
      const f = await fixture(), cite = "b".repeat(64);
      const grant = await f.grant(f.root, f.agent.key, { asOf: { roster: cite } } as never), call = await f.call(grant);
      expect(mayAct(f.fold([grant, call]), f.id, f.device.key)).toEqual({ act: false, reason: "unknown-frontier" });
      expect(mayAct(f.fold([grant, call], { rosterCids: [cite] }), f.id, f.device.key)).toEqual({ act: true });
      const frontierGrant = await f.grant(f.root, f.agent.key, { asOf: { frontier: cite } } as never), frontierCall = await f.call(frontierGrant);
      expect(mayAct(f.fold([frontierGrant, frontierCall]), f.id, f.device.key)).toEqual({ act: false, reason: "unknown-frontier" });
      expect(mayAct(f.fold([frontierGrant, frontierCall], { heldFrontiers: new Set([cite]) }), f.id, f.device.key)).toEqual({ act: true });
      const control = await buildDelegationRevoke({ group: "face", signer: f.root, epoch: 0, delegation: "c".repeat(64) });
      const controlGrant = await f.grant(f.root, f.agent.key, { asOf: { control: intentEntryCid(control) } } as never), controlCall = await f.call(controlGrant);
      expect(mayAct(f.fold([controlGrant, controlCall]), f.id, f.device.key)).toEqual({ act: false, reason: "unknown-frontier" });
      expect(mayAct(f.fold([controlGrant, controlCall, control]), f.id, f.device.key)).toEqual({ act: true });
      const until = await f.grant(f.root, f.agent.key, { until: { roster: cite } }), untilCall = await f.call(until);
      expect(f.fold([until, untilCall], { rosterCids: [cite] }).intents[0]!.voidCause).toBe("delegation-closed");
      const next = await who(5), lineage = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }, { epoch: 1, signers: [next.key], threshold: 1 }])!;
      const laterGrant = await buildDelegation({ group: "face", signer: next, epoch: 1, agent: f.agent.key, prefix: "MOVE", policy, bound: { until: { roster: cite } }, nonce: "later" });
      const oldRevoke = await buildDelegationRevoke({ group: "face", signer: f.root, epoch: 0, delegation: intentEntryCid(laterGrant) });
      const laterCall = await f.call(laterGrant);
      expect(f.fold([laterGrant, laterCall, oldRevoke], { lineage }).delegations.find((d) => d.cid === intentEntryCid(laterGrant))?.status).toBe("live");
    } finally { clock.mockRestore(); }
  });

  test("RED: a retired root epoch's delegation lapses once the lineage rolls past it; CONTROL: the current epoch's delegation stays live", async () => {
    const f = await fixture(), next = await who(5);
    const rolled = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }, { epoch: 1, signers: [next.key], threshold: 1 }])!;
    const bound = { until: { roster: "a".repeat(64) } };
    const stolen = await f.grant(f.root), stolenCall = await f.call(stolen);
    const current = await buildDelegation({ group: "face", signer: next, epoch: 1, agent: f.agent.key, prefix: "MOVE", policy, bound, nonce: "current" }), currentCall = await f.call(current);
    const before = f.fold([stolen, stolenCall]);
    expect(before.delegations.find((d) => d.cid === intentEntryCid(stolen))?.status).toBe("live");
    const after = f.fold([stolen, stolenCall], { lineage: rolled });
    expect(after.delegations.find((d) => d.cid === intentEntryCid(stolen))?.status).toBe("lapsed");
    expect(after.intents[0]!.voidCause).toBe("delegation-lapsed");
    expect(mayAct(after, f.id, f.device.key)).toEqual({ act: false, reason: "void" });
    const renewed = f.fold([current, currentCall], { lineage: rolled });
    expect(renewed.delegations[0]!.status).toBe("live");
    expect(mayAct(renewed, f.id, f.device.key)).toEqual({ act: true });
  });

  test("RED: the status precedence holds (revoked over lapsed, closed over awaiting) and an unheld until stays open; CONTROL: each status reads alone", async () => {
    const f = await fixture(), next = await who(5), cite = "d".repeat(64), other = "e".repeat(64);
    const rolled = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }, { epoch: 1, signers: [next.key], threshold: 1 }])!;
    const status = (records: SignedIntentEntry[], opts: Parameters<typeof f.fold>[1] = {}) => f.fold(records, opts).delegations.map((d) => d.status);
    const lapsedOnly = await f.grant(f.root, f.agent.key, { until: { roster: cite } });
    expect(status([lapsedOnly], { lineage: rolled })).toEqual(["lapsed"]);
    const revokeLapsed = await buildDelegationRevoke({ group: "face", signer: f.root, epoch: 0, delegation: intentEntryCid(lapsedOnly) });
    expect(status([lapsedOnly, revokeLapsed], { lineage: rolled })).toEqual(["revoked"]);
    const both = await buildDelegation({ group: "face", signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy, bound: { asOf: { roster: other }, until: { roster: cite } }, nonce: "both" });
    expect(status([both], { rosterCids: [cite] })).toEqual(["closed"]);
    expect(status([both], { rosterCids: [other] })).toEqual(["live"]);
    expect(status([both], { rosterCids: [] })).toEqual(["awaiting"]);
    const call = await f.call(both);
    expect(mayAct(f.fold([both, call], { rosterCids: [other] }), f.id, f.device.key)).toEqual({ act: true });
    expect(mayAct(f.fold([both, call], { rosterCids: [] }), f.id, f.device.key)).toEqual({ act: false, reason: "unknown-frontier" });
  });

  test("RED: a retired root's revoke of a retired grant leaves the grant void either way; CONTROL: the refused list reads the same in every arrival order", async () => {
    const f = await fixture(), next = await who(5);
    const rolled = makeHandLineage([{ epoch: 0, signers: [f.root.key], threshold: 1 }, { epoch: 1, signers: [next.key], threshold: 1 }])!;
    const grant = await f.grant(), call = await f.call(grant);
    const revoke = await buildDelegationRevoke({ group: "face", signer: f.root, epoch: 0, delegation: intentEntryCid(grant) });
    const bad = await f.call(grant, f.other), stray = await buildDelegationRevoke({ group: "face", signer: f.other, epoch: 0, delegation: intentEntryCid(grant) });
    const states = new Set<string>(), views = new Set<string>();
    for (const order of permutations([grant, call, revoke, bad])) {
      const view = f.fold([...order, stray], { lineage: rolled });
      states.add(`${view.intents[0]!.voidCause}`);
      views.add(JSON.stringify([view.refused, view.delegations, view.intents.map((i) => i.id)]));
    }
    expect([...states]).toEqual(["delegation-revoked"]);
    expect(views.size).toBe(1);
    expect(f.fold([grant, call, bad, stray], { lineage: rolled }).refused.length).toBeGreaterThan(0);
  });
});
