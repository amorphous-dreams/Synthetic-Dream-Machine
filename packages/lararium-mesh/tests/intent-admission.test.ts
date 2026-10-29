import { afterEach, describe, expect, test, vi } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { buildAgentIntent, buildDelegation, buildDelegationRevoke, buildIntent, buildOutcome } from "../src/intent-issue.js";
import { intentEntryCid, intentId, signIntentEntry, writeIntentEntry } from "../src/intent-entry.js";
import { mayAct, readIntentPlane } from "../src/intent-read.js";
import { fixtureIntentVerbs } from "../src/intent-verbs.js";
import { decideAdmission, intentAdmissionCid, intentAdmissionKey, intentAdmissionRecordsOfGroup, localIntentHeads, readIntentAdmission, signIntentAdmission, writeIntentAdmission, INTENT_ADMISSION_PREFIX } from "../src/intent-admission.js";
import type { LarDoc } from "../src/base-doc.js";

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const fixture = async () => {
  const device = await who(1), root = await who(2), agent = await who(3), relay = await who(4), other = await who(5);
  const group = "face", verbs = fixtureIntentVerbs({ MOVE: "idempotent", OTHER: "idempotent" });
  const face = { devices: [device.key], rosterCids: [] as string[], admittedAt: new Map<string, string>(), lineage: makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])! };
  const read = { group, face, standing: () => "stands" as const, verbs };
  const grant = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "grant" });
  const call = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
  const id = intentId({ issuer: agent.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
  const decide = (raw: unknown, records: readonly unknown[] = [grant], options = read) => decideAdmission({ group, raw, records, read: options });
  const receipt = (entry = intentEntryCid(call)) => signIntentAdmission({ group, entry, delegation: intentEntryCid(grant), heads: [] }, relay);
  return { device, root, agent, relay, other, group, verbs, face, read, grant, call, id, decide, receipt };
};
afterEach(() => vi.restoreAllMocks());

describe("intent admissions", () => {
  test("RED: forged, foreign-domain and wrong-group receipts refuse; CONTROL: genuine receipt round trips and lists", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const f = await fixture(), receipt = await f.receipt(), cid = intentAdmissionCid(receipt);
    expect(readIntentAdmission(receipt, { group: f.group })).toEqual({ ok: true, admission: receipt, cid });
    const doc = { tiddlers: {} } as LarDoc;
    writeIntentAdmission(doc, receipt);
    expect(intentAdmissionKey(f.group, cid)).toBe(`${INTENT_ADMISSION_PREFIX}${encodeURIComponent(f.group)}/${cid}`);
    expect(intentAdmissionRecordsOfGroup(doc, f.group)).toEqual([receipt]);
    const forged = { ...receipt, sig: (receipt.sig[0] === "0" ? "1" : "0") + receipt.sig.slice(1) };
    const wrongGroup = await signIntentAdmission({ group: "other", entry: intentEntryCid(f.call), delegation: intentEntryCid(f.grant), heads: [] }, f.relay);
    const foreign = { ...receipt, body: { ...receipt.body, kind: "foreign" } };
    const view = readIntentPlane({ ...f.read, records: [f.grant, f.call], admissions: [receipt, forged, wrongGroup, foreign] });
    expect(view.intents[0]!.admissions).toEqual([{ cid, relay: f.relay.key }]);
    expect(view.refusedAdmissions.map((r) => r.refusal).sort()).toEqual(["domain", "group", "signature"]);
  });

  test("RED: submission failures map to closed refusal names; CONTROL: unchanged entry admits and replay marks duplicate", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const f = await fixture(), cid = intentEntryCid(f.call);
    expect(await f.decide(f.call)).toMatchObject({ ok: true, cid, delegation: intentEntryCid(f.grant), duplicate: false });
    expect(await f.decide(f.call, [f.grant, f.call])).toMatchObject({ ok: true, duplicate: true });
    const altered = { ...f.call, body: { ...f.call.body, args: { x: 2 } } };
    expect(await f.decide(altered)).toEqual({ ok: false, refusal: "entry-refused" });
    expect(await f.decide({})).toEqual({ ok: false, refusal: "malformed" });
    expect(await f.decide({ ...f.call, body: { ...f.call.body, kind: "foreign" } })).toEqual({ ok: false, refusal: "malformed" });
    expect(await f.decide({ ...f.call, body: { ...f.call.body, group: "other" } })).toEqual({ ok: false, refusal: "group" });
    const atom = await buildIntent({ group: f.group, signer: f.device, verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
    const outcome = await buildOutcome({ group: f.group, signer: f.device, cause: f.id, result: "done" });
    for (const raw of [atom, outcome]) expect(await f.decide(raw)).toEqual({ ok: false, refusal: "entry-refused" });
    expect(await f.decide(f.call, [])).toEqual({ ok: false, refusal: "delegation-unknown" });
    const wrongKey = await signIntentEntry({ ...f.call.body, issuer: f.other.key }, f.other);
    const wide = await signIntentEntry({ ...f.call.body, verb: "OTHER" }, f.agent);
    const args = await signIntentEntry({ ...f.call.body, args: { x: 2 } }, f.agent);
    for (const [raw, refusal] of [[wrongKey, "agent-key"], [wide, "verb-outside-prefix"], [args, "args-outside-policy"]] as const) expect(await f.decide(raw)).toEqual({ ok: false, refusal });
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    expect(await f.decide(f.call, [f.grant, revoke])).toEqual({ ok: false, refusal: "delegation-revoked" });
    expect(await f.decide(f.call, [f.grant], { ...f.read, face: { ...f.face, rosterCids: ["a".repeat(64)] } })).toEqual({ ok: false, refusal: "delegation-closed" });
    const waiting = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer" } } }, bound: { asOf: { frontier: "b".repeat(64) } }, nonce: "wait" });
    const waitingCall = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(waiting), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
    expect(await f.decide(waitingCall, [waiting])).toEqual({ ok: false, refusal: "unknown-frontier" });
  });

  test("RED: receipts cannot confer authority or change a fold; CONTROL: the genuine invocation acts with or without provenance", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const f = await fixture(), receipt = await f.receipt();
    const plain = readIntentPlane({ ...f.read, records: [f.grant, f.call] });
    const withReceipt = readIntentPlane({ ...f.read, records: [f.grant, f.call], admissions: [receipt] });
    const strip = (view: typeof withReceipt) => ({ ...view, holdsCapability: undefined, refusedAdmissions: [], intents: view.intents.map(({ admissions: _admissions, ...state }) => state) });
    expect(strip(withReceipt)).toEqual(strip(plain));
    expect(mayAct(plain, f.id, f.device.key)).toEqual({ act: true });
    expect(mayAct(withReceipt, f.id, f.device.key)).toEqual({ act: true });
    const absent = readIntentPlane({ ...f.read, records: [f.grant], admissions: [receipt] });
    expect(absent.intents).toHaveLength(0);
    const revoke = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
    const revoked = readIntentPlane({ ...f.read, records: [f.grant, f.call, revoke], admissions: [receipt] });
    expect(revoked.intents[0]!.admissions).toHaveLength(1);
    expect(mayAct(revoked, f.id, f.device.key)).toEqual({ act: false, reason: "void" });
    const wide = await signIntentEntry({ ...f.call.body, verb: "OTHER" }, f.agent), wideReceipt = await f.receipt(intentEntryCid(wide));
    const denied = readIntentPlane({ ...f.read, records: [f.grant, wide], admissions: [wideReceipt] });
    expect(denied.intents).toHaveLength(0);
    expect(denied.refused).toContainEqual({ refusal: "verb-outside-prefix" });
  });

  test("RED: referenced entries leave the local frontier; CONTROL: unrelated readable entries remain heads", async () => {
    const f = await fixture(), doc = { tiddlers: {} } as LarDoc;
    writeIntentEntry(doc, f.grant); writeIntentEntry(doc, f.call);
    expect(localIntentHeads([f.grant, f.call, {}, f.call])).toEqual([intentEntryCid(f.call)]);
    const outcome = await buildOutcome({ group: f.group, signer: f.device, cause: f.id, result: "done" });
    expect(localIntentHeads([f.grant, f.call, outcome])).toEqual([intentEntryCid(f.call), intentEntryCid(outcome)].sort());
  });
});


test.each(["revoked", "closed", "awaiting"] as const)("RED: coincident invocation IDs cannot mask %s grant or its replay; CONTROL: live replay duplicates", async (condition) => {
  const f = await fixture();
  const make = async (nonce: string, bad: boolean) => {
    const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: bad && condition === "awaiting" ? { asOf: { frontier: "b".repeat(64) } } : { until: { roster: bad && condition === "closed" ? "c".repeat(64) : "a".repeat(64) } }, nonce });
    const call = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
    return { grant, call };
  };
  const live = await make("live", false);
  let bad = await make("bad", true);
  for (let i = 0; intentEntryCid(live.call) >= intentEntryCid(bad.call) && i < 100; i++) bad = await make(`bad-${i}`, true);
  expect(intentEntryCid(live.call) < intentEntryCid(bad.call)).toBe(true);
  const revoke = condition === "revoked" ? [await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(bad.grant) })] : [];
  const read = condition === "closed" ? { ...f.read, face: { ...f.face, rosterCids: ["c".repeat(64)] } } : f.read;
  const records = [live.grant, bad.grant, live.call, ...revoke];
  const refusal = condition === "revoked" ? "delegation-revoked" : condition === "closed" ? "delegation-closed" : "unknown-frontier";
  expect(await f.decide(bad.call, records, read)).toEqual({ ok: false, refusal });
  expect(await f.decide(bad.call, [...records, bad.call], read)).toEqual({ ok: false, refusal });
  expect(await f.decide(live.call, records, read)).toMatchObject({ ok: true, duplicate: true });
});
