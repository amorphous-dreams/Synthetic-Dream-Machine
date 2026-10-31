import { afterEach, describe, expect, test, vi } from "vitest";
import { signIntentEntry, actCid, buildAgentIntent, buildDelegation, buildDelegationRevoke, deriveSelfRecoveryKey, sealKeySetHash, hexToBytes, mintPersonaRotation, personaRotationSigningBytes, buildIntent, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fixtureIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, intentId, mayAct, readFace, mintPersonaInception, signPersonaAct, writeIntentEntry, type DocHandle, type LarDoc } from "@lararium/mesh";
import { intentAdmissionCid, intentAdmissionRecordsOfGroup, writeIntentAdmission } from "../../lararium-mesh/src/intent-admission.js";
import { admitAgentEntry, makeFaceIntentDoor, makeFaceIntentReader, witnessedStandings } from "../src/face-intent-door.js";

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc;
  const change = vi.fn((edit: (draft: LarDoc) => void) => edit(doc));
  return { doc, change, handle: { doc: () => doc, change, on: () => {}, off: () => {} } as unknown as DocHandle<LarDoc> };
};
const fixture = async () => {
  const root = await who(9), d1 = await who(1), d2 = await who(2), agent = await who(3), relay = await who(4), relay2 = await who(5), group = "face-a";
  const recovery = await deriveSelfRecoveryKey(new Uint8Array(32).fill(9));
  const inception = mintPersonaInception(`0x${root.key}`, sealKeySetHash([recovery.verifyingKey], 1)), log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
  for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }], ["admission", { deviceKey: d1.key }], ["admission", { deviceKey: d2.key }]] as const) {
    const head = log.at(-1);
    log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
  }
  const shared = plane(), verbs = fixtureIntentVerbs({ MOVE: "idempotent" });
  const ports = { group, plane: shared.handle, personaRecords: () => log, kelChain: () => [inception], standing: () => "stands" as const, verbs };
  const grant = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "grant" });
  const entry = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
  const id = intentId({ issuer: agent.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
  return { root, d1, d2, agent, relay, relay2, group, shared, ports, grant, entry, id, verbs, log, inception, recovery };
};
afterEach(() => vi.restoreAllMocks());

describe("face intent admission", () => {
  test("RED: substitution and missing delegation refuse without writes; CONTROL: the same entry admits once its chain arrives", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const f = await fixture();
    expect(await admitAgentEntry(f.ports, f.entry, f.relay)).toEqual({ status: "refused", refusal: "delegation-unknown" });
    expect(f.shared.change).not.toHaveBeenCalled();
    f.shared.handle.change((d) => writeIntentEntry(d, f.grant));
    const changed = { ...f.entry, body: { ...f.entry.body, args: { x: 2 } } };
    expect(await admitAgentEntry(f.ports, changed, f.relay)).toEqual({ status: "refused", refusal: "entry-refused" });
    expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
    const records = intentEntryRecordsOfGroup(f.shared.doc, f.group);
    const stored = records.find((r) => (r as typeof f.entry).body.entry === "intent") as typeof f.entry;
    expect(stored).toEqual(f.entry);
    expect(intentEntryCid(stored)).toBe(intentEntryCid(f.entry));
  });

  test("RED: concurrent replay cannot append twice; CONTROL: another relay adds only its own receipt", async () => {
    const f = await fixture(); f.shared.handle.change((d) => writeIntentEntry(d, f.grant)); f.shared.change.mockClear();
    const [a, b] = await Promise.all([admitAgentEntry(f.ports, f.entry, f.relay), admitAgentEntry(f.ports, f.entry, f.relay)]);
    expect([a.status, b.status].sort()).toEqual(["admitted", "duplicate"]);
    if (a.status === "refused" || b.status === "refused") throw Error("admission refused");
    expect(intentAdmissionCid(a.receipt as Parameters<typeof intentAdmissionCid>[0])).toBe(intentAdmissionCid(b.receipt as Parameters<typeof intentAdmissionCid>[0]));
    expect(f.shared.change).toHaveBeenCalledTimes(1);
    expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(2);
    expect(intentAdmissionRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(1);
    expect((await admitAgentEntry(f.ports, f.entry, f.relay2)).status).toBe("duplicate");
    expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(2);
    expect(intentAdmissionRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(2);
  });

  test("RED: failed change and another face leave their planes unchanged; CONTROL: the addressed face admits", async () => {
    const f = await fixture(); f.shared.handle.change((d) => writeIntentEntry(d, f.grant));
    const before = JSON.stringify(f.shared.doc);
    f.shared.change.mockImplementationOnce(() => { throw Error("append fault"); });
    expect(await admitAgentEntry(f.ports, f.entry, f.relay)).toEqual({ status: "refused", refusal: "fault" });
    expect(JSON.stringify(f.shared.doc)).toBe(before);
    const other = plane();
    expect(await admitAgentEntry({ ...f.ports, group: "face-b", plane: other.handle }, f.entry, f.relay)).toEqual({ status: "refused", refusal: "group" });
    expect(other.change).not.toHaveBeenCalled();
    expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
  });

  test("RED: a second pass cannot repeat an agent effect; CONTROL: a device intent also executes once", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw Error("clock"); });
    const f = await fixture(); f.shared.handle.change((d) => writeIntentEntry(d, f.grant));
    expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
    const reader = makeFaceIntentReader(f.ports), read = await reader.read();
    expect(mayAct(read.view, f.id, f.d2.key)).toEqual({ act: true });
    const effect = vi.fn(async (_args: unknown, _ctx: { intentId: string; intent: unknown; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => ({ result: "done" }));
    const door = makeFaceIntentDoor({ ...f.ports, atom: f.d2, effects: new Map([["MOVE", effect]]), log: () => {} });
    await door.heed(); await door.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(effect.mock.calls[0]![1]).toMatchObject({ agent: { key: f.agent.key, delegation: intentEntryCid(f.grant) } });
    expect(intentEntryRecordsOfGroup(f.shared.doc, f.group).filter((r) => (r as typeof f.entry).body.entry === "outcome")).toHaveLength(1);
    const device = await buildIntent({ group: f.group, signer: f.d1, verb: "MOVE", args: { x: 2 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
    f.shared.handle.change((d) => writeIntentEntry(d, device));
    await door.heed(); await door.heed();
    expect(effect).toHaveBeenCalledTimes(2);
    expect(effect.mock.calls[1]![1]).toMatchObject({ agent: null });
  });
});


test("RED: foreign verifiedFace cannot override the supplied chain; CONTROL: the genuine reading admits", async () => {
  const f = await fixture(), foreignRoot = await who(19);
  const foreign = mintPersonaInception(`0x${foreignRoot.key}`, "recovery");
  const foreignReading = readFace([foreign]);
  if (!foreignReading) throw Error("foreign face");
  const log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
  for (const [act, fields] of [["founding", { personaKelPrefix: foreign.prefix, rootCommitment: "root" }], ["admission", { deviceKey: f.d1.key }]] as const) {
    const head = log.at(-1);
    log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group: f.group, act, epoch: 0, fields }, foreignRoot));
  }
  const grant = await buildDelegation({ group: f.group, signer: foreignRoot, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "foreign" });
  const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  f.shared.handle.change(d => writeIntentEntry(d, grant)); f.shared.change.mockClear();
  const ports = { ...f.ports, personaRecords: () => log, verifiedFace: foreignReading };
  expect((await admitAgentEntry(ports, entry, f.relay)).status).toBe("refused");
  expect(f.shared.change).not.toHaveBeenCalled();
  const effectPlane = plane();
  effectPlane.handle.change(d => { writeIntentEntry(d, grant); writeIntentEntry(d, entry); });
  const effect = vi.fn(async () => ({}));
  let genuine = false;
  const effectPorts = { ...ports, personaRecords: () => genuine ? f.log : log, plane: effectPlane.handle, atom: f.d1, effects: new Map([["MOVE", effect]]), log: () => {} };
  const door = makeFaceIntentDoor(effectPorts);
  await door.heed();
  expect(effect).not.toHaveBeenCalled();
  const genuineEntry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  effectPlane.handle.change(d => { writeIntentEntry(d, f.grant); writeIntentEntry(d, genuineEntry); });
  genuine = true;
  await door.heed();
  expect(effect).toHaveBeenCalledTimes(1);
  f.shared.handle.change(d => writeIntentEntry(d, f.grant));
  expect((await admitAgentEntry({ ...f.ports, verifiedFace: readFace(f.ports.kelChain())! }, f.entry, f.relay)).status).toBe("admitted");
});

test("RED: uppercase outer signer refuses without mutation; CONTROL: canonical entry stores unchanged", async () => {
  const f = await fixture(); f.shared.handle.change(d => writeIntentEntry(d, f.grant)); f.shared.change.mockClear();
  expect(await admitAgentEntry(f.ports, { ...f.entry, signer: f.entry.signer.toUpperCase() }, f.relay)).toEqual({ status: "refused", refusal: "entry-refused" });
  expect(f.shared.change).not.toHaveBeenCalled();
  expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
  expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toContainEqual(f.entry);
});

test.each([false, true])("RED: signing-gap merge rechecks entry and own receipt (own=%s); CONTROL: no merge admits", async (own) => {
  const f = await fixture(); f.shared.handle.change(d => writeIntentEntry(d, f.grant));
  const otherPlane = plane(); otherPlane.handle.change(d => writeIntentEntry(d, f.grant));
  const prior = await admitAgentEntry({ ...f.ports, plane: otherPlane.handle }, f.entry, own ? f.relay : f.relay2);
  if (prior.status === "refused") throw Error("fixture refused");
  let resume!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { resume = r; }), entered = new Promise<void>(r => { started = r; });
  const pending = admitAgentEntry(f.ports, f.entry, { ...f.relay, sign: async bytes => { started(); await gate; return f.relay.sign(bytes); } });
  await entered;
  f.shared.handle.change(d => { writeIntentEntry(d, f.entry); writeIntentAdmission(d, prior.receipt as Parameters<typeof writeIntentAdmission>[1]); });
  f.shared.change.mockClear(); resume();
  const result = await pending;
  expect(result.status).toBe("duplicate");
  expect(f.shared.change).toHaveBeenCalledTimes(own ? 0 : 1);
  expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(2);
  expect(intentAdmissionRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(own ? 1 : 2);
  if (own && result.status !== "refused") expect(result.receipt).toEqual(prior.receipt);
  const control = plane(); control.handle.change(d => writeIntentEntry(d, f.grant));
  expect((await admitAgentEntry({ ...f.ports, plane: control.handle }, f.entry, f.relay)).status).toBe("admitted");
});


test.each(["roster", "rotation"] as const)("RED: signing gap refreshes %s authority; CONTROL: unchanged authority admits", async kind => {
  const f = await fixture();
  const head = f.log.at(-1)!;
  const closing = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: f.group, act: "admission", epoch: 0, fields: { deviceKey: (await who(8)).key } }, f.root);
  const grant = kind === "roster" ? await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: actCid(closing.body) } }, nonce: "closing" }) : f.grant;
  const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  const freshKey = `0x${(await who(10)).key}`;
  const sig = await ed25519SignerFromSeed(hexToBytes(f.recovery.signingKey))(personaRotationSigningBytes(f.inception, freshKey));
  const rotation = await mintPersonaRotation({ head: f.inception, freshOpKeyDid: freshKey, recoveryRoster: [f.recovery.verifyingKey], recoveryThreshold: 1, rotationSigs: [{ signer: f.recovery.verifyingKey, sig }] });
  if (!rotation.ok) throw Error(rotation.reason);
  f.shared.handle.change(d => writeIntentEntry(d, grant)); f.shared.change.mockClear();
  let merged = false, resume!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { resume = r; }), entered = new Promise<void>(r => { started = r; });
  const ports = { ...f.ports, personaRecords: () => merged && kind === "roster" ? [...f.log, closing] : f.log,
    kelChain: () => merged && kind === "rotation" ? [f.inception, rotation.event] : [f.inception] };
  const pending = admitAgentEntry(ports, entry, { ...f.relay, sign: async bytes => { started(); await gate; return f.relay.sign(bytes); } });
  await entered; merged = true; resume();
  expect(await pending).toEqual({ status: "refused", refusal: kind === "roster" ? "delegation-closed" : "entry-refused" });
  expect(f.shared.change).not.toHaveBeenCalled();
  expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(1);
  expect(intentAdmissionRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(0);
  const control = plane(); control.handle.change(d => writeIntentEntry(d, grant));
  expect((await admitAgentEntry({ ...f.ports, plane: control.handle }, entry, f.relay)).status).toBe("admitted");
});

test.each([true, false])("RED: merged own receipt rechecks revocation (revoke=%s); CONTROL: no revoke returns prior receipt", async revoke => {
  const f = await fixture(); f.shared.handle.change(d => writeIntentEntry(d, f.grant));
  const other = plane(); other.handle.change(d => writeIntentEntry(d, f.grant));
  const prior = await admitAgentEntry({ ...f.ports, plane: other.handle }, f.entry, f.relay);
  if (prior.status !== "admitted") throw Error("fixture refused");
  const revocation = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(f.grant) });
  let resume!: () => void, started!: () => void;
  const gate = new Promise<void>(r => { resume = r; }), entered = new Promise<void>(r => { started = r; });
  const pending = admitAgentEntry(f.ports, f.entry, { ...f.relay, sign: async bytes => { started(); await gate; return f.relay.sign(bytes); } });
  await entered;
  f.shared.handle.change(d => { writeIntentEntry(d, f.entry); writeIntentAdmission(d, prior.receipt as Parameters<typeof writeIntentAdmission>[1]); if (revoke) writeIntentEntry(d, revocation); });
  f.shared.change.mockClear(); resume();
  const result = await pending;
  if (revoke) expect(result).toEqual({ status: "refused", refusal: "delegation-revoked" });
  else expect(result).toEqual({ status: "duplicate", receipt: prior.receipt });
  expect(f.shared.change).not.toHaveBeenCalled();
  expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(revoke ? 3 : 2);
  expect(intentAdmissionRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(1);
});

test("RED: a roster act learned while the final read awaits standing still refuses; CONTROL: the same bytes admit when no act arrives", async () => {
  const f = await fixture();
  const head = f.log.at(-1)!;
  const closing = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: f.group, act: "admission", epoch: 0, fields: { deviceKey: (await who(8)).key } }, f.root);
  const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: actCid(closing.body) } }, nonce: "closing-late" });
  const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  const run = async (arrives: boolean) => {
    const shared = plane(); shared.handle.change(d => writeIntentEntry(d, grant)); shared.change.mockClear();
    let signed = false, merged = false;
    const ports = { ...f.ports, plane: shared.handle, personaRecords: () => merged ? [...f.log, closing] : f.log,
      ...witnessedStandings(async () => { if (signed && arrives) merged = true; return "stands" as const; }, () => "v") };
    const result = await admitAgentEntry(ports, entry, { ...f.relay, sign: async bytes => { const out = await f.relay.sign(bytes); signed = true; return out; } });
    return { result, shared };
  };
  const late = await run(true);
  expect(late.result).toEqual({ status: "refused", refusal: "delegation-closed" });
  expect(late.shared.change).not.toHaveBeenCalled();
  expect(intentAdmissionRecordsOfGroup(late.shared.doc, f.group)).toHaveLength(0);
  expect((await run(false)).result.status).toBe("admitted");
});

test("RED: the relay ring flips off during the final standing read, so no receipt and no append; CONTROL: the ring stays on and the entry admits", async () => {
  const f = await fixture();
  const run = async (flips: boolean) => {
    const shared = plane(); shared.handle.change(d => writeIntentEntry(d, f.grant)); shared.change.mockClear();
    let signed = false, ringOn = true;
    const ports = { ...f.ports, plane: shared.handle, relayAdmits: async () => ringOn, ...witnessedStandings(async () => { if (signed && flips) ringOn = false; return "stands" as const; }, () => "v") };
    const result = await admitAgentEntry(ports, f.entry, { ...f.relay, sign: async bytes => { const out = await f.relay.sign(bytes); signed = true; return out; } });
    return { result, shared };
  };
  const off = await run(true);
  expect(off.result).toEqual({ status: "refused", refusal: "face-off" });
  expect(off.shared.change).not.toHaveBeenCalled();
  expect(intentAdmissionRecordsOfGroup(off.shared.doc, f.group)).toHaveLength(0);
  expect(intentEntryRecordsOfGroup(off.shared.doc, f.group)).toHaveLength(1);
  expect((await run(false)).result.status).toBe("admitted");
});

test("RED: a valid rotation merged while the final read awaits standing re-reads the chain and refuses; CONTROL: no rotation admits", async () => {
  const f = await fixture();
  const freshKey = `0x${(await who(10)).key}`;
  const sig = await ed25519SignerFromSeed(hexToBytes(f.recovery.signingKey))(personaRotationSigningBytes(f.inception, freshKey));
  const rotation = await mintPersonaRotation({ head: f.inception, freshOpKeyDid: freshKey, recoveryRoster: [f.recovery.verifyingKey], recoveryThreshold: 1, rotationSigs: [{ signer: f.recovery.verifyingKey, sig }] });
  if (!rotation.ok) throw Error(rotation.reason);
  const run = async (arrives: boolean) => {
    const shared = plane(); shared.handle.change(d => writeIntentEntry(d, f.grant)); shared.change.mockClear();
    let signed = false, merged = false;
    const ports = { ...f.ports, plane: shared.handle, kelChain: () => merged ? [f.inception, rotation.event] : [f.inception],
      ...witnessedStandings(async () => { if (signed && arrives) merged = true; return "stands" as const; }, () => "v") };
    const result = await admitAgentEntry(ports, f.entry, { ...f.relay, sign: async bytes => { const out = await f.relay.sign(bytes); signed = true; return out; } });
    return { result, shared };
  };
  const late = await run(true);
  expect(late.result).toEqual({ status: "refused", refusal: "entry-refused" });
  expect(late.shared.change).not.toHaveBeenCalled();
  expect(intentAdmissionRecordsOfGroup(late.shared.doc, f.group)).toHaveLength(0);
  expect((await run(false)).result.status).toBe("admitted");
});

test("RED: a revocation merged by an earlier effect stops the later effect of the heed loop; CONTROL: no revocation runs both once", async () => {
  const f = await fixture();
  const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1, 2] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "loop" });
  const revocation = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(grant) });
  const intents = await Promise.all([1, 2].map(x => buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x }, nonce: "", audience: { mode: "every" }, verbs: f.verbs })));
  const run = async (revokes: boolean) => {
    const shared = plane(); shared.handle.change(d => { writeIntentEntry(d, grant); for (const i of intents) writeIntentEntry(d, i); });
    const effect = vi.fn(async () => { if (revokes) shared.handle.change(d => writeIntentEntry(d, revocation)); return {}; });
    const door = makeFaceIntentDoor({ ...f.ports, plane: shared.handle, atom: f.d2, effects: new Map([["MOVE", effect]]), log: () => {} });
    await door.heed();
    return effect;
  };
  expect(await run(true)).toHaveBeenCalledTimes(1);
  expect(await run(false)).toHaveBeenCalledTimes(2);
});

test("RED: a second body under an admitted intent id refuses id-collision and appends nothing; CONTROL: the same body answers duplicate", async () => {
  const f = await fixture(); f.shared.handle.change(d => writeIntentEntry(d, f.grant));
  expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
  const rival = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "class", capability: "x" }, verbs: f.verbs });
  expect(intentId(rival.body as unknown as Parameters<typeof intentId>[0])).toBe(f.id);
  f.shared.change.mockClear();
  expect(await admitAgentEntry(f.ports, rival, f.relay)).toEqual({ status: "refused", refusal: "id-collision" });
  expect(f.shared.change).not.toHaveBeenCalled();
  expect(intentEntryRecordsOfGroup(f.shared.doc, f.group)).toHaveLength(2);
  expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("duplicate");
});

test("RED: a roster act appended while the ring answers still refuses the closed delegation; CONTROL: no act admits", async () => {
  const f = await fixture();
  const head = f.log.at(-1)!;
  const closing = await signPersonaAct({ seq: head.body.seq, cid: actCid(head.body) }, { group: f.group, act: "admission", epoch: 0, fields: { deviceKey: (await who(8)).key } }, f.root);
  const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: actCid(closing.body) } }, nonce: "ring-gap" });
  const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  const run = async (arrives: boolean) => {
    const shared = plane(); shared.handle.change(d => writeIntentEntry(d, grant)); shared.change.mockClear();
    let merged = false;
    const ports = { ...f.ports, plane: shared.handle, personaRecords: () => merged ? [...f.log, closing] : f.log, relayAdmits: async () => { if (arrives) merged = true; return true; } };
    return { result: await admitAgentEntry(ports, entry, f.relay), shared };
  };
  const late = await run(true);
  expect(late.result).toEqual({ status: "refused", refusal: "delegation-closed" });
  expect(late.shared.change).not.toHaveBeenCalled();
  expect((await run(false)).result.status).toBe("admitted");
});

test("RED: a planted copy under the issuer's id that the fold refuses poisons nothing; CONTROL: a real rival signed by the issuer collides", async () => {
  const f = await fixture(); f.shared.handle.change(d => writeIntentEntry(d, f.grant));
  const planted = await signIntentEntry({ group: f.group, entry: "intent", refs: [intentEntryCid(f.grant)], issuer: f.agent.key, verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "class", capability: "x" }, delegation: intentEntryCid(f.grant) } as Parameters<typeof signIntentEntry>[0], f.d1);
  expect(intentId(planted.body as unknown as Parameters<typeof intentId>[0])).toBe(f.id);
  f.shared.handle.change(d => writeIntentEntry(d, planted));
  expect((await admitAgentEntry(f.ports, f.entry, f.relay)).status).toBe("admitted");
  const rival = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(f.grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "class", capability: "y" }, verbs: f.verbs });
  expect(await admitAgentEntry(f.ports, rival, f.relay)).toEqual({ status: "refused", refusal: "id-collision" });
});

test("RED: a rotation merged while the ring answers reaches the commit turn through the live chain; CONTROL: no rotation admits", async () => {
  const f = await fixture();
  const freshKey = `0x${(await who(10)).key}`;
  const sig = await ed25519SignerFromSeed(hexToBytes(f.recovery.signingKey))(personaRotationSigningBytes(f.inception, freshKey));
  const rotation = await mintPersonaRotation({ head: f.inception, freshOpKeyDid: freshKey, recoveryRoster: [f.recovery.verifyingKey], recoveryThreshold: 1, rotationSigs: [{ signer: f.recovery.verifyingKey, sig }] });
  if (!rotation.ok) throw Error(rotation.reason);
  const run = async (arrives: boolean) => {
    const shared = plane(); shared.handle.change(d => writeIntentEntry(d, f.grant)); shared.change.mockClear();
    let merged = false;
    // The production shape: the loaded face reads its chain live off the board's replica.
    const ports: Parameters<typeof admitAgentEntry>[0] = { ...f.ports, plane: shared.handle, kelChain: () => merged ? [f.inception, rotation.event] : [f.inception],
      relayAdmits: async () => { if (arrives) merged = true; return true; } };
    return { result: await admitAgentEntry(ports, f.entry, f.relay), shared };
  };
  const late = await run(true);
  expect(late.result).toEqual({ status: "refused", refusal: "entry-refused" });
  expect(late.shared.change).not.toHaveBeenCalled();
  expect((await run(false)).result.status).toBe("admitted");
});

test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])("RED: a revocation merged %i microtask hops after the pass's last standing read never meets an effect; CONTROL: nothing merging runs the effect once", async hops => {
  const f = await fixture();
  const grant = await buildDelegation({ group: f.group, signer: f.root, epoch: 0, agent: f.agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: `hops-${hops}` });
  const revocation = await buildDelegationRevoke({ group: f.group, signer: f.root, epoch: 0, delegation: intentEntryCid(grant) });
  const entry = await buildAgentIntent({ group: f.group, signer: f.agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs: f.verbs });
  const run = async (lastCall: number, revokes: boolean) => {
    const shared = plane(); shared.handle.change(d => { writeIntentEntry(d, grant); writeIntentEntry(d, entry); });
    let calls = 0; const seen: boolean[] = [];
    const revokedNow = () => intentEntryRecordsOfGroup(shared.doc, f.group).some(r => (r as typeof revocation).body.entry === "delegate-revoke");
    const effect = vi.fn(async () => { seen.push(revokedNow()); return {}; });
    const standing = async () => { calls++; if (revokes && calls === lastCall) { let n = hops; const tick = (): void => { if (--n <= 0) shared.handle.change(d => writeIntentEntry(d, revocation)); else queueMicrotask(tick); }; queueMicrotask(tick); } return "stands" as const; };
    const door = makeFaceIntentDoor({ ...f.ports, plane: shared.handle, atom: f.d2, effects: new Map([["MOVE", effect]]), log: () => {}, ...witnessedStandings(standing, () => "v") });
    await door.heed();
    return { seen, calls };
  };
  const control = await run(0, false);
  expect(control.seen).toEqual([false]);
  const probe = await run(control.calls, true);
  expect(probe.seen.every(revoked => !revoked)).toBe(true);
});
