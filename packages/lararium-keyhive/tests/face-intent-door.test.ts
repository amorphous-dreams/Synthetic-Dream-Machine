import { describe, expect, test, vi } from "vitest";
import { fixtureIntentVerbs, signIntentEntry, buildAnswer, buildAsks, buildIntent, intentEntryCid, writeIntentEntry, actCid, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, intentEntryRecordsOfGroup, intentId,
  mintPersonaInception, signPersonaAct, type DocHandle, type LarDoc } from "@lararium/mesh";
import { makeFaceIntentDoor, requestFaceJoin } from "../src/face-intent-door.js";

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc;
  const listeners = new Set<() => void>();
  return { doc, handle: { doc: () => doc, change: (edit: (draft: LarDoc) => void) => { edit(doc); for (const f of listeners) f(); },
    on: (_event: string, listener: () => void) => { listeners.add(listener); }, off: (_event: string, listener: () => void) => { listeners.delete(listener); } } as unknown as DocHandle<LarDoc> };
};

describe("face intent request", () => {
  test("RED: two hearths see one pin and only the pinned hearth acts; CONTROL: it records an outcome; POSITIVE: replay stays answered", async () => {
    const root = await signer(9), h1 = await signer(1), h2 = await signer(2), joinee = await signer(3), group = "face-a";
    const inception = mintPersonaInception(`0x${root.key}`, "recovery");
    const log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
    for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }],
      ["admission", { deviceKey: h1.key }], ["admission", { deviceKey: h2.key }], ["admission", { deviceKey: joinee.key }]] as const) {
      const head = log.at(-1);
      log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
    }
    const shared = plane(), verbs = faceIntentVerbs(), add1 = vi.fn(async () => ({ recordCid: "grant" })), add2 = vi.fn(async () => ({ recordCid: "other" }));
    const base = { group, plane: shared.handle, personaRecords: () => log, kelChain: [inception], standing: () => "stands" as const, verbs, log: () => {} };
    const first = makeFaceIntentDoor({ ...base, atom: h1, effects: new Map([["face-join", add1]]) });
    const second = makeFaceIntentDoor({ ...base, atom: h2, effects: new Map([["face-join", add2]]) });
    const id = await requestFaceJoin({ group, plane: shared.handle, atom: joinee, hearthAtom: h1.key, summons: { card: "one" }, verbs });
    await first.heed(); await second.heed();
    expect(add1).toHaveBeenCalledTimes(1);
    expect(add2).not.toHaveBeenCalled();
    expect(intentEntryRecordsOfGroup(shared.doc, group)).toHaveLength(2);
    await first.heed();
    expect(add1).toHaveBeenCalledTimes(1);
    expect((await first.describe()).view.intents.find((i) => i.id === id)?.status).toBe("answered");
  });
  test("RED: another face's plane carries no summons; CONTROL: the addressed plane does; POSITIVE: replay retains one id", async () => {
    const a = await signer(1), hearth = await signer(2), own = plane(), other = plane();
    const request = { group: "face-a", plane: own.handle, atom: a, projection: { admissions: [{ deviceKey: hearth.key }] }, summons: { card: "one" }, verbs: faceIntentVerbs() };
    const first = await requestFaceJoin(request);
    const replay = await requestFaceJoin(request);
    expect(replay).toBe(first);
    expect(intentEntryRecordsOfGroup(own.doc, "face-a")).toHaveLength(1);
    expect(intentEntryRecordsOfGroup(other.doc, "face-b")).toHaveLength(0);
    const body = (intentEntryRecordsOfGroup(own.doc, "face-a")[0] as { body: { issuer: string; verb: string; args: unknown; nonce: string } }).body;
    expect(intentId(body)).toBe(first);
  });
});

const faceOf = async () => {
  const root = await signer(9), h1 = await signer(1), h2 = await signer(2), joinee = await signer(3), group = "face-a";
  const inception = mintPersonaInception(`0x${root.key}`, "recovery");
  const log = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
  for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }],
    ["admission", { deviceKey: h1.key }], ["admission", { deviceKey: h2.key }], ["admission", { deviceKey: joinee.key }]] as const) {
    const head = log.at(-1);
    log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
  }
  return { root, h1, h2, joinee, group, inception, log };
};

describe("face intent door stalls and gates", () => {
  test("the place seed and face B cannot issue A's face-join intent; A's atom can", async () => {
    const f = await faceOf(), verbs = faceIntentVerbs();
    const effect = vi.fn(async () => ({ recordCid: "grant" }));
    const doorFor = (shared: ReturnType<typeof plane>) => makeFaceIntentDoor({
      group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception],
      verbs, log: () => {}, atom: f.h1, standing: () => "stands", effects: new Map([["face-join", effect]]),
    });
    for (const thief of [await signer(91), f.h2]) {
      const shared = plane(), door = doorFor(shared);
      const forged = await buildIntent({
        group: f.group, signer: { key: f.joinee.key, sign: thief.sign },
        verb: "face-join", args: { summons: {} }, nonce: thief.key,
        audience: { mode: "pinned", atom: f.h1.key }, verbs,
      });
      shared.handle.change((d) => writeIntentEntry(d, forged));
      await door.heed();
      expect(effect).not.toHaveBeenCalled();
    }
    const shared = plane(), door = doorFor(shared);
    await requestFaceJoin({ group: f.group, plane: shared.handle, atom: f.joinee, hearthAtom: f.h1.key, summons: { card: "one" }, verbs });
    await door.heed();
    expect(effect).toHaveBeenCalledTimes(1);
  });

  test("RED: an unknown frontier runs no effect and the clock is never read; CONTROL: the same intent acts once the frontier knows", async () => {
    const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs(), effect = vi.fn(async () => ({ recordCid: "grant" }));
    let known = false;
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception], verbs, log: () => {},
      atom: f.h1, standing: () => (known ? "stands" : "unknown"), effects: new Map([["face-join", effect]]) });
    await requestFaceJoin({ group: f.group, plane: shared.handle, atom: f.joinee, hearthAtom: f.h1.key, summons: { card: "one" }, verbs });
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("clock read"); });
    const perf = vi.spyOn(performance, "now").mockImplementation(() => { throw new Error("clock read"); });
    try {
      await door.heed();
      expect(effect).not.toHaveBeenCalled();
      known = true;
      await door.heed();
      expect(effect).toHaveBeenCalledTimes(1);
    } finally { now.mockRestore(); perf.mockRestore(); }
  });
  test("RED: an asks-gated face-join waits, a stray answer re-pins nothing, the answer-named atom acts; CONTROL: the other hearth never acts", async () => {
    const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
    const a1 = vi.fn(async () => ({ recordCid: "one" })), a2 = vi.fn(async () => ({ recordCid: "two" }));
    const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
    const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
    const d2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) });
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
    const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
    shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); });
    const stray = await buildAnswer({ group: f.group, signer: f.h2, ask: "no-such-ask", verdict: "approve", executor: f.h2.key });
    shared.handle.change((d) => writeIntentEntry(d, stray));
    await d1.heed(); await d2.heed();
    expect(a1).not.toHaveBeenCalled(); expect(a2).not.toHaveBeenCalled();
    const answer = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
    shared.handle.change((d) => writeIntentEntry(d, answer));
    await d1.heed(); await d2.heed();
    expect(a1).toHaveBeenCalledTimes(1); expect(a2).not.toHaveBeenCalled();
  });

  test("RED: a declared single-effect verb with no fenced effect never runs through the generic road; CONTROL: an idempotent verb does", async () => {
    const f = await faceOf(), shared = plane(), verbs = fixtureIntentVerbs({ once: "single-effect", echo: "idempotent" });
    const declared = vi.fn(async () => ({ ok: true }));
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception], verbs, log: () => {},
      atom: f.h1, standing: () => "stands", holdsCapability: () => true, runDeclaredEffect: declared });
    const once = await buildIntent({ group: f.group, signer: f.joinee, verb: "once", args: {}, nonce: "n", audience: { mode: "pinned", atom: f.h1.key }, verbs });
    shared.handle.change((d) => writeIntentEntry(d, once));
    await door.heed();
    expect(declared).not.toHaveBeenCalled();
    const echo = await buildIntent({ group: f.group, signer: f.joinee, verb: "echo", args: {}, nonce: "", audience: { mode: "class", capability: "x" }, verbs });
    shared.handle.change((d) => writeIntentEntry(d, echo));
    await door.heed();
    expect(declared).toHaveBeenCalledTimes(1);
  });
  test("RED: a re-pin after the first answer ran never runs the second hearth; CONTROL: a legitimate first answer pins and runs once", async () => {
    const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
    const a1 = vi.fn(async () => ({ recordCid: "one" })), a2 = vi.fn(async () => ({ recordCid: "two" }));
    const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
    const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
    const d2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) });
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
    const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
    const first = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
    shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); writeIntentEntry(d, first); });
    await d1.heed(); await d2.heed();
    expect(a1).toHaveBeenCalledTimes(1); expect(a2).not.toHaveBeenCalled();
    const repin = await signIntentEntry({ group: f.group, entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(asks), verdict: "approve", executor: f.h2.key }, f.h1);
    shared.handle.change((d) => writeIntentEntry(d, repin));
    await d1.heed(); await d2.heed();
    expect(a1).toHaveBeenCalledTimes(1); expect(a2).not.toHaveBeenCalled();
  });
  test("RED: a re-pin landing while the first effect runs opens no second run; CONTROL: a first effect that faults leaves the re-pinned hearth free to act", async () => {
    const run = async (faults: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
      let release!: () => void; const held = new Promise<void>((r) => { release = r; });
      const a1 = vi.fn(async () => { await held; if (faults) throw new Error("first hearth faulted"); return { recordCid: "one" }; }), a2 = vi.fn(async () => ({ recordCid: "two" }));
      const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
      const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
      const d2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) });
      const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
      const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
      const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
      const first = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
      shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); writeIntentEntry(d, first); });
      const running = d1.heed();
      await Promise.resolve();
      const repin = await signIntentEntry({ group: f.group, entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(asks), verdict: "approve", executor: f.h2.key }, f.h1);
      shared.handle.change((d) => writeIntentEntry(d, repin));
      await d2.heed();
      const during = a2.mock.calls.length;
      release(); await running;
      await d2.heed();
      return { during, after: a2.mock.calls.length };
    };
    const live = await run(false);
    expect(live.during).toBe(0); expect(live.after).toBe(0);
    const faulted = await run(true);
    expect(faulted.during).toBe(0); expect(faulted.after).toBe(1);
  });
});
