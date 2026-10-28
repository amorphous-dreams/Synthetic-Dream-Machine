import { afterEach, describe, expect, test, vi } from "vitest";
import { actCid, buildAgentIntent, buildDelegation, buildIntent, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fixtureIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, intentId, mayAct, mintPersonaInception, signPersonaAct, writeIntentEntry, type DocHandle, type LarDoc } from "@lararium/mesh";
import { intentAdmissionCid, intentAdmissionRecordsOfGroup } from "../../lararium-mesh/src/intent-admission.js";
import { admitAgentEntry, makeFaceIntentDoor, makeFaceIntentReader } from "../src/face-intent-door.js";

const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc;
  const change = vi.fn((edit: (draft: LarDoc) => void) => edit(doc));
  return { doc, change, handle: { doc: () => doc, change, on: () => {}, off: () => {} } as unknown as DocHandle<LarDoc> };
};
const fixture = async () => {
  const root = await who(9), d1 = await who(1), d2 = await who(2), agent = await who(3), relay = await who(4), relay2 = await who(5), group = "face-a";
  const inception = mintPersonaInception(`0x${root.key}`, "recovery"), log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
  for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }], ["admission", { deviceKey: d1.key }], ["admission", { deviceKey: d2.key }]] as const) {
    const head = log.at(-1);
    log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
  }
  const shared = plane(), verbs = fixtureIntentVerbs({ MOVE: "idempotent" });
  const ports = { group, plane: shared.handle, personaRecords: () => log, kelChain: [inception], standing: () => "stands" as const, verbs };
  const grant = await buildDelegation({ group, signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: { kind: "closed-args", args: { x: { type: "integer", oneOf: [1] } } }, bound: { until: { roster: "a".repeat(64) } }, nonce: "grant" });
  const entry = await buildAgentIntent({ group, signer: agent, delegation: intentEntryCid(grant), verb: "MOVE", args: { x: 1 }, nonce: "", audience: { mode: "every" }, verbs });
  const id = intentId({ issuer: agent.key, verb: "MOVE", args: { x: 1 }, nonce: "" });
  return { root, d1, d2, agent, relay, relay2, group, shared, ports, grant, entry, id, verbs };
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
