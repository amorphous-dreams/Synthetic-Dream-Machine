import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fixtureIntentVerbs, faceIntentVerbs } from "@lararium/mesh/intent-verbs";
import { signIntentEntry, intentEntryCid, writeIntentEntry, intentEntryRecordsOfGroup, intentId } from "@lararium/mesh/intent-entry";
import { buildAnswer, buildAsks, buildIntent } from "@lararium/mesh/intent-issue";
import { actCid } from "@lararium/mesh/signed-act";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { mintPersonaInception } from "@lararium/mesh/persona-kel";
import { signPersonaAct } from "@lararium/mesh/persona-act-board";
import { personaBagIdFor, personaSiblingBagIds } from "@lararium/mesh/persona-scope";
import { storedLarRecord } from "@lararium/mesh/stored-record";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { faceDoors } from "../src/face-doors.js";
import { admitShoreVotum, faceShoreVow, makeFaceIntentDoor, requestFaceJoin, witnessedStandings } from "../src/face-intent-door.js";
import { taggedAdmission } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

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
      ["admission", { ...(await taggedAdmission(10, group, h1.key)) }], ["admission", { ...(await taggedAdmission(11, group, h2.key)) }], ["admission", { ...(await taggedAdmission(12, group, joinee.key)) }]] as const) {
      const head = log.at(-1);
      log.push(await signPersonaAct(head ? { seq: head.body.seq, cid: actCid(head.body) } : null, { group, act, epoch: 0, fields }, root));
    }
    const shared = plane(), verbs = faceIntentVerbs(), add1 = vi.fn(async () => ({ recordCid: "grant" })), add2 = vi.fn(async () => ({ recordCid: "other" }));
    const base = { group, plane: shared.handle, personaRecords: () => log, kelChain: () => [inception], standing: () => "stands" as const, verbs, log: () => {} };
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
    ["admission", { ...(await taggedAdmission(10, group, h1.key)) }], ["admission", { ...(await taggedAdmission(11, group, h2.key)) }], ["admission", { ...(await taggedAdmission(12, group, joinee.key)) }]] as const) {
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
      group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception],
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
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
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
    const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
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
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
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
    const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
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
      const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
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

type Standing = "stands" | "aside" | "unknown";
/**
 * An async standing source as production holds one (the daemon's dyad fold over the edge board): `answer` reads the fold as
 * the documents stand, `move` lands a change on them, and `version` names their heads, which every change moves.
 */
const standingSource = () => {
  let version = 0; const moved = new Map<string, Standing>();
  return { answer: (atom: string): Standing => moved.get(atom.toLowerCase()) ?? "stands",
    move: (atom: string, to: Standing) => { moved.set(atom.toLowerCase(), to); version++; }, version: () => String(version) };
};
/**
 * THE PORT ADAPTER: how a production door is handed an async standing source, in this head's port shape. The scenarios and
 * their assertions below stand as written; a fix that changes the port's shape moves only this adapter.
 */
const asyncStanding = (source: ReturnType<typeof standingSource>, read: (atom: string) => Promise<Standing> = async (atom) => { const a = source.answer(atom); await Promise.resolve(); return a; }) =>
  witnessedStandings(read, source.version);
/** A promise that records whether anyone ever awaited it: a read the door started and abandoned stays unawaited. */
class Watched<T> extends Promise<T> {
  static override get [Symbol.species]() { return Promise; }
  awaited = false;
  override then<A = T, B = never>(ok?: ((v: T) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> { this.awaited = true; return super.then(ok, no); }
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise<void>((r) => setTimeout(r, 0)); };

describe("the boundary acquires asynchronously, then observes in one synchronous turn", () => {
  const twoPinned = async (f: Awaited<ReturnType<typeof faceOf>>, shared: ReturnType<typeof plane>, verbs: ReturnType<typeof faceIntentVerbs>) => {
    for (const nonce of ["one", "two"]) {
      const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: { nonce } }, nonce, audience: { mode: "pinned", atom: f.h1.key }, verbs });
      shared.handle.change((d) => writeIntentEntry(d, intent));
    }
  };

  test("RED: the executor moved aside during the first effect stops the second; CONTROL: no move runs both", async () => {
    const run = async (moves: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs(), source = standingSource();
      const effect = vi.fn(async () => { if (moves) source.move(f.h1.key, "aside"); return { recordCid: "r" }; });
      await twoPinned(f, shared, verbs);
      const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
        atom: f.h1, ...asyncStanding(source), effects: new Map([["face-join", effect]]) });
      await door.heed();
      return effect.mock.calls.length;
    };
    expect(await run(true)).toBe(1);
    expect(await run(false)).toBe(2);
  });

  test("RED: an executor read early, moved aside while a later standing still fetches, runs no effect; CONTROL: no move runs it", async () => {
    const run = async (moves: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs(), source = standingSource();
      const effect = vi.fn(async () => ({ recordCid: "r" }));
      await requestFaceJoin({ group: f.group, plane: shared.handle, atom: f.joinee, hearthAtom: f.h1.key, summons: { card: "one" }, verbs });
      // The executor reads first; the move lands while the joinee's standing, read last, is still in flight.
      const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
        atom: f.h1, ...asyncStanding(source, async (atom) => { const a = source.answer(atom); await Promise.resolve();
          if (moves && atom.toLowerCase() === f.joinee.key.toLowerCase()) source.move(f.h1.key, "aside"); return a; }),
        effects: new Map([["face-join", effect]]) });
      await door.heed();
      return effect.mock.calls.length;
    };
    expect(await run(true)).toBe(0);
    expect(await run(false)).toBe(1);
  });

  test("RED: no standing read is started and abandoned, so a failing source rejects into the door and never into the process; CONTROL: the instrument names an unawaited read", async () => {
    const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs(), source = standingSource();
    const effect = vi.fn(async () => ({ recordCid: "r" }));
    await requestFaceJoin({ group: f.group, plane: shared.handle, atom: f.joinee, hearthAtom: f.h1.key, summons: { card: "one" }, verbs });
    // The first acquisition answers; every read after it rejects (a board that stops resolving).
    const reads: Watched<Standing>[] = []; let answered = 0;
    const atoms = new Set([f.h1.key, f.h2.key, f.joinee.key].map((k) => k.toLowerCase()));
    const read = (atom: string): Promise<Standing> => {
      const ok = answered < atoms.size; if (ok) answered++;
      const p = new Watched<Standing>((resolve, reject) => { if (ok) resolve(source.answer(atom)); else reject(new Error("board unreachable")); });
      reads.push(p); return p;
    };
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
      atom: f.h1, ...asyncStanding(source, read), effects: new Map([["face-join", effect]]) });
    await door.heed();
    await settle();
    expect(reads.filter((p) => !p.awaited)).toHaveLength(0);
    expect(effect).toHaveBeenCalledTimes(1);
    const planted = new Watched<Standing>((resolve) => resolve("stands"));
    expect(planted.awaited).toBe(false);
    await planted;
    expect(planted.awaited).toBe(true);
  });

  test("RED: a fault in the fenced run wakes the attached hearth it fenced, with no manual heed; CONTROL: an attached hearth pinned from the start runs on its own", async () => {
    const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    const a1 = vi.fn(async () => { await held; throw new Error("first hearth faulted"); }), a2 = vi.fn(async () => ({ recordCid: "two" }));
    const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
    const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
    const first = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
    shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); writeIntentEntry(d, first); });
    const stop1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) }).attach();
    const stop2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) }).attach();
    try {
      await settle();
      expect(a1).toHaveBeenCalledTimes(1);
      const repin = await signIntentEntry({ group: f.group, entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(asks), verdict: "approve", executor: f.h2.key }, f.h1);
      shared.handle.change((d) => writeIntentEntry(d, repin));
      await settle();
      expect(a2).not.toHaveBeenCalled();
      release();
      await settle();
      expect(a2).toHaveBeenCalledTimes(1);
    } finally { stop1(); stop2(); }

    const g = await faceOf(), other = plane(), b2 = vi.fn(async () => ({ recordCid: "two" }));
    await requestFaceJoin({ group: g.group, plane: other.handle, atom: g.joinee, hearthAtom: g.h2.key, summons: { card: "one" }, verbs });
    const stop = makeFaceIntentDoor({ group: g.group, plane: other.handle, personaRecords: () => g.log, kelChain: () => [g.inception], verbs, log: () => {}, standing: () => "stands", atom: g.h2, effects: new Map([["face-join", b2]]) }).attach();
    try { await settle(); expect(b2).toHaveBeenCalledTimes(1); } finally { stop(); }
  });

  test("RED: the daemon's intent door reads its chain and standings LIVE, never the boot's captured chain or an async port; CONTROL: the census finds planted forms", () => {
    const source = readFileSync(new URL("../src/operator-daemon-behavior.ts", import.meta.url), "utf8");
    const captured = /kelChain\s*:\s*daemonAuth\.personaKel!?\.chain\b/, asyncPort = /\bstanding\s*:\s*async\b/, live = /kelChain\s*:\s*\(\)\s*=>/;
    expect(captured.test("kelChain: daemonAuth.personaKel!.chain, anchor")).toBe(true);
    expect(asyncPort.test("standing: async (device) => x")).toBe(true);
    expect(live.test("kelChain: () => chainNow()")).toBe(true);
    // ONE DOOR SHAPE FOR EVERY FACE: the mounted door and each lit sibling's stand through `faceIntentDoorOver`.
    const start = source.indexOf("const faceIntentDoorOver = async");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("const standSiblingDoor = async", start);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    expect(block).not.toMatch(captured);
    expect(block).not.toMatch(asyncPort);
    expect(block).toMatch(live);
    expect(source.match(/makeFaceIntentDoor\(\{/g), "no door stands outside the one shape").toHaveLength(1);
  });
});

describe("the door wakes on its authority and keeps what settled", () => {
  test("RED: an attached door whose standing source settles after its re-passes ran out acts on the source's own wake; CONTROL: a detached door hears nothing", async () => {
    const run = async (detach: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs(), effect = vi.fn(async () => ({ recordCid: "r" }));
      let known = false, version = 0; const listeners = new Set<() => void>();
      const standing = (_atom: string): Standing => (known ? "stands" : "unknown");
      // An async source that answers `unknown` until its documents settle, then wakes whoever watches it.
      const acquisition = { acquire: async (_atoms: ReadonlySet<string>) => {}, holds: () => known,
        watch: (wake: () => void) => { listeners.add(wake); return () => { listeners.delete(wake); }; } };
      const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {},
        atom: f.h1, standing, acquisition, effects: new Map([["face-join", effect]]) });
      const stop = door.attach();
      await requestFaceJoin({ group: f.group, plane: shared.handle, atom: f.joinee, hearthAtom: f.h1.key, summons: { card: "one" }, verbs });
      await settle();
      expect(effect).not.toHaveBeenCalled();
      if (detach) stop();
      known = true; version++;
      for (const wake of [...listeners]) wake();
      await settle();
      if (!detach) stop();
      return { calls: effect.mock.calls.length, listening: listeners.size, version };
    };
    const live = await run(false);
    expect(live.calls).toBe(1);
    expect(live.listening).toBe(0);
    const gone = await run(true);
    expect(gone.calls).toBe(0);
    expect(gone.listening).toBe(0);
  });

  test("RED: a run that settled with an outcome on one replica opens no second run on another handle over the same document; CONTROL: a run that faulted frees it", async () => {
    const run = async (faults: boolean) => {
      const f = await faceOf(), verbs = faceIntentVerbs();
      // Two handles over ONE document id, each with its own replica (the second has not yet received the first's outcome).
      const replica = () => { const p = plane(); (p.handle as unknown as { documentId: string }).documentId = `doc-${faults}`; return p; };
      const a = replica(), b = replica();
      let release!: () => void; const held = new Promise<void>((r) => { release = r; });
      const first = vi.fn(async () => { await held; if (faults) throw new Error("faulted"); return { recordCid: "one" }; }), second = vi.fn(async () => ({ recordCid: "two" }));
      const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "pinned", atom: f.h1.key }, verbs });
      for (const p of [a, b]) p.handle.change((d) => writeIntentEntry(d, intent));
      const base = { group: f.group, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const, atom: f.h1 };
      const onA = makeFaceIntentDoor({ ...base, plane: a.handle, effects: new Map([["face-join", first]]) });
      const onB = makeFaceIntentDoor({ ...base, plane: b.handle, effects: new Map([["face-join", second]]) });
      const running = onA.heed();
      await Promise.resolve();
      await onB.heed();
      const during = second.mock.calls.length;
      release(); await running; await settle();
      await onB.heed();
      return { during, after: second.mock.calls.length };
    };
    const settled = await run(false);
    expect(settled.during).toBe(0); expect(settled.after).toBe(0);
    const faulted = await run(true);
    expect(faulted.during).toBe(0); expect(faulted.after).toBe(1);
  });

  test("RED: the daemon's intent door folds its standings over the documents it witnesses, never through an external dyad reader; CONTROL: the census finds planted forms", () => {
    const source = readFileSync(new URL("../src/operator-daemon-behavior.ts", import.meta.url), "utf8");
    const external = /\bdyadReader\s*\(/, composed = /\bintentDoorStandings\s*\(/;
    expect(external.test("requireDyadReader(dyadReader(ctx, liveFace()), x)")).toBe(true);
    expect(composed.test("const standings = intentDoorStandings({ repo })")).toBe(true);
    const shape = source.slice(source.indexOf("const faceIntentDoorOver = async"), source.indexOf("return makeFaceIntentDoor({"));
    expect(shape.length).toBeGreaterThan(0);
    expect(shape).not.toMatch(external);
    expect(shape).toMatch(composed);
    // Neither the mounted face's attach nor a lit sibling's stand reads through an external reader before the shape.
    for (const [from, to] of [["const attachDoor = async (): Promise<void> => {", "const door = await faceIntentDoorOver("], ["const standSiblingDoor = async", "const door = await faceIntentDoorOver("]] as const) {
      const start = source.indexOf(from);
      expect(start).toBeGreaterThan(-1);
      const end = source.indexOf(to, start);
      expect(end).toBeGreaterThan(start);
      expect(source.slice(start, end)).not.toMatch(external);
    }
  });
});

describe("a completed effect stays settled, a detached door hears no fence, and settled ids leave once every replica sees the outcome", () => {
  const asksFixture = async (shared: ReturnType<typeof plane>, f: Awaited<ReturnType<typeof faceOf>>, verbs: ReturnType<typeof faceIntentVerbs>) => {
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
    const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
    const first = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
    shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); writeIntentEntry(d, first); });
    const repin = await signIntentEntry({ group: f.group, entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(asks), verdict: "approve", executor: f.h2.key }, f.h1);
    return { id, repin };
  };

  test("RED: an effect that ran to completion stays fenced when its receipt fails, and the receipt lands on a later pass; CONTROL: a fault mid-effect frees the id", async () => {
    const run = async (mode: "receipt-fails" | "effect-faults") => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
      const a1 = vi.fn(async () => { if (mode === "effect-faults") throw new Error("mid-effect"); return { recordCid: "one" }; }), a2 = vi.fn(async () => ({ recordCid: "two" }));
      const { id, repin } = await asksFixture(shared, f, verbs);
      // The receipt's publication fails once, after the effect returned.
      let failNext = mode === "receipt-fails";
      const handle = { ...shared.handle, change: (edit: (draft: LarDoc) => void) => { if (failNext) { failNext = false; throw new Error("receipt write failed"); } shared.handle.change(edit); } } as unknown as DocHandle<LarDoc>;
      const base = { group: f.group, plane: handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
      const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
      const d2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) });
      await d1.heed();
      shared.handle.change((d) => writeIntentEntry(d, repin));
      await d2.heed();
      await d1.heed();
      const outcomes = intentEntryRecordsOfGroup(shared.doc, f.group).filter((r) => (r as { body: { entry: string; cause?: string } }).body.entry === "outcome" && (r as { body: { cause?: string } }).body.cause === id).length;
      return { first: a1.mock.calls.length, second: a2.mock.calls.length, outcomes };
    };
    const failed = await run("receipt-fails");
    expect(failed.first).toBe(1); expect(failed.second).toBe(0); expect(failed.outcomes).toBe(1);
    const faulted = await run("effect-faults");
    expect(faulted.first).toBe(1); expect(faulted.second).toBe(1);
  });

  test("RED: a detached door's fence waiter never fires; CONTROL: an attached one does", async () => {
    const run = async (detach: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
      let release!: () => void; const held = new Promise<void>((r) => { release = r; });
      const a1 = vi.fn(async () => { await held; throw new Error("faulted"); }), a2 = vi.fn(async () => ({ recordCid: "two" }));
      const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
      const { repin } = await asksFixture(shared, f, verbs);
      const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
      const running = d1.heed();
      await Promise.resolve();
      shared.handle.change((d) => writeIntentEntry(d, repin));
      const stop2 = makeFaceIntentDoor({ ...base, atom: f.h2, effects: new Map([["face-join", a2]]) }).attach();
      await settle();
      expect(a2).not.toHaveBeenCalled();
      if (detach) stop2();
      release(); await running; await settle();
      if (!detach) stop2();
      return a2.mock.calls.length;
    };
    expect(await run(true)).toBe(0);
    expect(await run(false)).toBe(1);
  });

  test("RED: a settled id stays in the retention for the process, while a handle lacks the outcome and after every handle reads it; CONTROL: no run, no entry", async () => {
    const path = "../src/face-intent-door.js";
    const module = await import(path) as { settledRunsOf?: (plane: DocHandle<LarDoc>) => ReadonlySet<string> };
    expect(module.settledRunsOf, "settledRunsOf names the retention").toBeTypeOf("function");
    const f = await faceOf(), verbs = faceIntentVerbs();
    const replica = () => { const p = plane(); (p.handle as unknown as { documentId: string }).documentId = "doc-retention"; return p; };
    const a = replica(), b = replica();
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "pinned", atom: f.h1.key }, verbs });
    const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
    for (const p of [a, b]) p.handle.change((d) => writeIntentEntry(d, intent));
    const base = { group: f.group, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const, atom: f.h1 };
    const effect = vi.fn(async () => ({ recordCid: "one" }));
    const onA = makeFaceIntentDoor({ ...base, plane: a.handle, effects: new Map([["face-join", effect]]) });
    const onB = makeFaceIntentDoor({ ...base, plane: b.handle, effects: new Map([["face-join", effect]]) });
    expect(module.settledRunsOf!(a.handle).size, "CONTROL: no run, no entry").toBe(0);
    await onB.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect([...module.settledRunsOf!(a.handle)]).toEqual([id]);
    await onA.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect([...module.settledRunsOf!(a.handle)], "handle A has not read the outcome yet").toEqual([id]);
    const outcome = intentEntryRecordsOfGroup(b.doc, f.group).find((r) => (r as { body: { entry: string } }).body.entry === "outcome")!;
    a.handle.change((d) => writeIntentEntry(d, outcome as Parameters<typeof writeIntentEntry>[1]));
    await onA.heed();
    expect([...module.settledRunsOf!(a.handle)], "every handle reads the outcome, and the entry stays for the process (a late handle may still lag)").toEqual([id]);
    expect(effect).toHaveBeenCalledTimes(1);
  });
});

describe("a detach that lands while a pass is in flight", () => {
  test("RED: a door detached while its pass still acquires joins no fence wait and runs nothing after; CONTROL: the same door left attached runs once the fence frees", async () => {
    const run = async (detach: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
      let release!: () => void; const held = new Promise<void>((r) => { release = r; });
      const a1 = vi.fn(async () => { await held; throw new Error("faulted"); }), a2 = vi.fn(async () => ({ recordCid: "two" }));
      const base = { group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const };
      const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: f.joinee.key, audience: { mode: "asks" }, verbs });
      const id = intentId(intent.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
      const asks = await buildAsks({ group: f.group, signer: f.joinee, intent: id, needs: "executor" });
      const first = await buildAnswer({ group: f.group, signer: f.h1, ask: intentEntryCid(asks), verdict: "approve", executor: f.h1.key });
      shared.handle.change((d) => { writeIntentEntry(d, intent); writeIntentEntry(d, asks); writeIntentEntry(d, first); });
      const d1 = makeFaceIntentDoor({ ...base, atom: f.h1, effects: new Map([["face-join", a1]]) });
      const running = d1.heed();
      await Promise.resolve();
      const repin = await signIntentEntry({ group: f.group, entry: "answer", refs: [intentEntryCid(first)], ask: intentEntryCid(asks), verdict: "approve", executor: f.h2.key }, f.h1);
      shared.handle.change((d) => writeIntentEntry(d, repin));
      // The second door's acquisition holds open, so its first pass is still in flight when the detach lands.
      let open!: () => void; const gate = new Promise<void>((r) => { open = r; });
      const acquisition = { acquire: async () => { await gate; }, holds: () => true };
      const stop2 = makeFaceIntentDoor({ ...base, atom: f.h2, acquisition, effects: new Map([["face-join", a2]]) }).attach();
      await settle();
      if (detach) stop2();
      open(); await settle();
      release(); await running; await settle();
      if (!detach) stop2();
      return a2.mock.calls.length;
    };
    expect(await run(true)).toBe(0);
    expect(await run(false)).toBe(1);
  });
});

describe("what ran stays ran for the process, and a detached door publishes nothing", () => {
  test("RED: a late handle whose replica lacks the outcome runs a completed effect 0 times, after the first handle read its outcome; CONTROL: a fresh id still runs once", async () => {
    const f = await faceOf(), verbs = faceIntentVerbs();
    const replica = () => { const p = plane(); (p.handle as unknown as { documentId: string }).documentId = "doc-late-reader"; return p; };
    const a = replica();
    const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: "late", audience: { mode: "pinned", atom: f.h1.key }, verbs });
    a.handle.change((d) => writeIntentEntry(d, intent));
    const base = { group: f.group, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands" as const, atom: f.h1 };
    const effect = vi.fn(async () => ({ recordCid: "one" }));
    const onA = makeFaceIntentDoor({ ...base, plane: a.handle, effects: new Map([["face-join", effect]]) });
    await onA.heed(); await onA.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    // A second handle over the same document starts late, its replica still without the outcome.
    const b = replica(); b.handle.change((d) => writeIntentEntry(d, intent));
    const onB = makeFaceIntentDoor({ ...base, plane: b.handle, effects: new Map([["face-join", effect]]) });
    await onB.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    const fresh = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: "fresh", audience: { mode: "pinned", atom: f.h1.key }, verbs });
    b.handle.change((d) => writeIntentEntry(d, fresh));
    await onB.heed();
    expect(effect).toHaveBeenCalledTimes(2);
  });

  test.each(["effect-held", "signing-held", "owed-retry-held"] as const)("RED: a door detached while its %s path holds open publishes no outcome after the detach, and the run stays settled; CONTROL: attached, it publishes", async (mode) => {
    const run = async (detach: boolean) => {
      const f = await faceOf(), shared = plane(), verbs = faceIntentVerbs();
      let open!: () => void; const gate = new Promise<void>((r) => { open = r; });
      let entered!: () => void; const holding = new Promise<void>((r) => { entered = r; });
      let signs = 0, failWrite = mode === "owed-retry-held";
      const holdSign = (n: number) => (mode === "signing-held" && n === 1) || (mode === "owed-retry-held" && n === 2);
      const atom = { key: f.h1.key, sign: async (bytes: Uint8Array) => { signs++; if (holdSign(signs)) { entered(); await gate; } return f.h1.sign(bytes); } };
      const effect = vi.fn(async () => { if (mode === "effect-held") { entered(); await gate; } return { recordCid: "one" }; });
      const handle = { ...shared.handle, change: (edit: (draft: LarDoc) => void) => { if (failWrite) { failWrite = false; throw new Error("receipt write failed"); } shared.handle.change(edit); } } as unknown as DocHandle<LarDoc>;
      const intent = await buildIntent({ group: f.group, signer: f.joinee, verb: "face-join", args: { summons: {} }, nonce: `held-${mode}`, audience: { mode: "pinned", atom: f.h1.key }, verbs });
      shared.handle.change((d) => writeIntentEntry(d, intent));
      const door = makeFaceIntentDoor({ group: f.group, plane: handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands", atom, effects: new Map([["face-join", effect]]) });
      const stop = door.attach();
      // The owed-retry mode: the first receipt write fails, and the retry (its signing held) runs on the next pass.
      if (mode === "owed-retry-held") { await settle(); void door.heed(); }
      await holding;
      if (detach) stop();
      open(); await settle();
      // The attached control waits out the door's own pass (its signing and receipt write run on crypto that a loaded floor
      // stretches past any fixed count of ticks), then detaches; the detached run above dropped its attach before the gate opened.
      if (!detach) { await door.heed(); stop(); }
      const outcomes = intentEntryRecordsOfGroup(shared.doc, f.group).filter((r) => (r as { body: { entry: string } }).body.entry === "outcome").length;
      // The run stays settled either way: a second door over this plane never runs it again.
      const other = vi.fn(async () => ({ recordCid: "two" }));
      await makeFaceIntentDoor({ group: f.group, plane: handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs, log: () => {}, standing: () => "stands", atom: f.h1, effects: new Map([["face-join", other]]) }).heed();
      return { effects: effect.mock.calls.length, outcomes, again: other.mock.calls.length };
    };
    const detached = await run(true);
    expect(detached.effects).toBe(1); expect(detached.outcomes).toBe(0); expect(detached.again).toBe(0);
    const attached = await run(false);
    expect(attached.effects).toBe(1); expect(attached.outcomes).toBe(1); expect(attached.again).toBe(0);
  });
});

describe("vota answer on the face's own turn, and each outcome keeps its chore mark at home", () => {
  const calendar = async (f: Awaited<ReturnType<typeof faceOf>>, shared: ReturnType<typeof plane>) => {
    const votum = await buildIntent({ group: f.group, signer: f.joinee, verb: "ddate", args: { today: { year: 2026, month: 11, day: 21 } }, nonce: "",
      audience: { mode: "pinned", atom: f.h1.key }, verbs: faceIntentVerbs() });
    shared.handle.change((d) => writeIntentEntry(d, votum));
    return intentId(votum.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  };
  const outcomesOf = (shared: ReturnType<typeof plane>, group: string) =>
    (intentEntryRecordsOfGroup(shared.doc, group) as { body: { entry: string; cause?: string } }[]).filter((r) => r.body.entry === "outcome");

  test("RED: a face standing dark answers no votum; CONTROL: its lit pass answers it once and settles its ticket; POSITIVE: the same votum worded again and a second lit pass land nothing more", async () => {
    const f = await faceOf(), shared = plane(), effect = vi.fn(async () => ({ text: "Sweetmorn" }));
    let lit = false, admitted = 0, settled = 0;
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(), log: () => {},
      atom: f.h1, standing: () => "stands", runDeclaredEffect: effect,
      admitTurn: () => { if (!lit) return null; admitted++; return { done: () => { settled++; } }; } });
    const id = await calendar(f, shared);
    await door.heed();
    expect(effect).not.toHaveBeenCalled();
    expect(outcomesOf(shared, f.group)).toHaveLength(0);
    lit = true;
    await door.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(outcomesOf(shared, f.group).map((r) => r.body.cause)).toEqual([id]);
    expect([admitted, settled]).toEqual([1, 1]);
    expect(await calendar(f, shared)).toBe(id);
    await door.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(outcomesOf(shared, f.group)).toHaveLength(1);
    expect(admitted).toBe(settled);
  });

  test("RED: the signed outcome carries no handle index, hand or session; CONTROL: the door keeps the house-local mark beside it; POSITIVE: a re-run keeps one outcome and one mark", async () => {
    const f = await faceOf(), shared = plane(), effect = vi.fn(async () => ({ text: "Sweetmorn" }));
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(), log: () => {},
      atom: f.h1, standing: () => "stands", runDeclaredEffect: effect, acting: () => 7 });
    const id = await calendar(f, shared);
    await door.heed();
    const [outcome] = outcomesOf(shared, f.group);
    const bytes = JSON.stringify(outcome);
    for (const word of ["chore", "acting", "asker", "session", "\"seat\""]) expect(bytes).not.toContain(word);
    const { answered } = await door.describe();
    expect(answered.get(id)).toEqual({ outcome: intentEntryCid(outcome as never), chore: { acting: 7, asker: "seat", session: null } });
    await door.heed();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(outcomesOf(shared, f.group)).toHaveLength(1);
    expect([...(await door.describe()).answered.keys()]).toEqual([id]);
  });

  test("RED: a door that names no acting face keeps no mark; CONTROL: its outcome still lands", async () => {
    const f = await faceOf(), shared = plane();
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(), log: () => {},
      atom: f.h1, standing: () => "stands", runDeclaredEffect: async () => ({ text: "Sweetmorn" }), acting: () => null });
    await calendar(f, shared);
    await door.heed();
    expect(outcomesOf(shared, f.group)).toHaveLength(1);
    expect((await door.describe()).answered.size).toBe(0);
  });
});

describe("each lit face stands its own door: the lit life bounds it, and every write names its face", () => {
  const calendarOn = async (f: Awaited<ReturnType<typeof faceOf>>, shared: ReturnType<typeof plane>, day: number) => {
    const votum = await buildIntent({ group: f.group, signer: f.joinee, verb: "ddate", args: { today: { year: 2026, month: 11, day } }, nonce: "",
      audience: { mode: "pinned", atom: f.h1.key }, verbs: faceIntentVerbs() });
    shared.handle.change((d) => writeIntentEntry(d, votum));
  };
  const outcomes = (shared: ReturnType<typeof plane>, group: string) =>
    (intentEntryRecordsOfGroup(shared.doc, group) as { body: { entry: string } }[]).filter((r) => r.body.entry === "outcome").length;

  test("L3 RED: a dropped face's door answers nothing more and detaches, after the votum in flight lands; CONTROL: standing, its turn answers", async () => {
    const f = await faceOf(), shared = plane(), lot = faceDoors(() => {});
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let calls = 0;
    const door = makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(), log: () => {},
      atom: f.h1, standing: () => "stands", admitTurn: () => (lot.open("h1") ? { done: () => {} } : null),
      runDeclaredEffect: async () => { calls++; if (calls === 1) await held; return { text: "Sweetmorn" }; } });
    await calendarOn(f, shared, 21); await calendarOn(f, shared, 22);
    const released: string[] = [];
    await lot.stand("h1", () => door, { opened: ["plane-h1", "persona-h1"], evict: (ids) => { released.push(`released ${ids.join(",")} after ${outcomes(shared, f.group)} outcome(s)`); } });
    for (let i = 0; i < 200 && calls === 0; i++) await new Promise((r) => setImmediate(r));
    expect(calls).toBe(1);
    const dropped = lot.drop("h1");
    expect(lot.open("h1"), "a closing face answers nothing more").toBe(false);
    release();
    await dropped;
    expect(outcomes(shared, f.group), "the votum in flight lands").toBe(1);
    expect(calls, "no next votum after the close began").toBe(1);
    expect(lot.keys()).toEqual([]);
    // THE CLOSE EVICTS WHAT THE DOOR OPENED: the release runs once, after the votum in flight landed and the door detached.
    expect(released).toEqual(["released plane-h1,persona-h1 after 1 outcome(s)"]);
    await lot.drop("h1");
    expect(released, "a second drop releases nothing").toHaveLength(1);
    // Detached: a plane change and a turn wake nothing.
    await calendarOn(f, shared, 23);
    lot.turn("h1");
    await door.heed();
    expect(calls).toBe(1);
    expect(outcomes(shared, f.group)).toBe(1);
  });

  test("EDGE A RED: a repeat light re-stands the face's door and evicts only what the new door no longer holds; CONTROL: a plain drop evicts all it opened", async () => {
    const lot = faceDoors(() => {}), evicted: string[][] = [];
    const quiet = (): { heed: () => Promise<void>; attach: () => () => void } => ({ heed: async () => {}, attach: () => () => {} });
    await lot.stand("h1", quiet, { opened: ["plane", "persona"], evict: (ids) => { evicted.push([...ids]); } });
    // The same pair lit again: the old door drops, and nothing it opened leaves, since the new door holds both.
    await lot.stand("h1", quiet, { opened: ["plane", "persona"], evict: (ids) => { evicted.push([...ids]); } });
    expect(evicted).toEqual([]);
    // A moved persona plane: only the plane the new door no longer holds leaves.
    await lot.stand("h1", quiet, { opened: ["plane", "persona-2"], evict: (ids) => { evicted.push([...ids]); } });
    expect(evicted).toEqual([["persona"]]);
    await lot.drop("h1");
    expect(evicted).toEqual([["persona"], ["plane", "persona-2"]]);
  });

  test("EDGE B RED: a stand that refuses after opening evicts what it opened, except what the standing door still holds", async () => {
    const lot = faceDoors(() => {}), evicted: string[][] = [];
    const quiet = (): { heed: () => Promise<void>; attach: () => () => void } => ({ heed: async () => {}, attach: () => () => {} });
    lot.evictUnheld("h1", ["plane", "persona"], (ids) => { evicted.push([...ids]); });
    expect(evicted, "no door stands: both leave").toEqual([["plane", "persona"]]);
    await lot.stand("h1", quiet, { opened: ["plane", "persona"], evict: () => {} });
    lot.evictUnheld("h1", ["plane", "persona-2"], (ids) => { evicted.push([...ids]); });
    expect(evicted[1], "the standing door keeps its plane").toEqual(["persona-2"]);
    lot.evictUnheld("h1", ["plane"], (ids) => { evicted.push([...ids]); });
    expect(evicted, "nothing unheld, nothing evicted").toHaveLength(2);
  });

  test("L2 RED: a lit sibling's door opens its intents plane only after its pair re-reads against its own log and KEL, and stands only through the lot; CONTROL: the census finds the planted order", () => {
    const source = readFileSync(new URL("../src/operator-daemon-behavior.ts", import.meta.url), "utf8");
    const start = source.indexOf("const standSiblingDoor = async"), end = source.indexOf("intentDoors.stand(key", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    const read = block.indexOf("readSiblingFacePlanes("), recheck = block.indexOf("recheckSiblingPlanes("), opensIntents = block.indexOf("own(read.planes.intents");
    expect(read).toBeGreaterThan(-1);
    expect(recheck).toBeGreaterThan(read);
    expect(opensIntents, "the intents plane opens after the re-check").toBeGreaterThan(recheck);
    expect(block).toMatch(/if \(!recheck\.ok\) return refuse\(/);
    expect(block).toMatch(/hold: \(pending\) => holding\(provider, pending\)/);
    // A sibling's door pays idempotent declared verbs alone (no effects map), so an outcome that misses the vessel's drain answers again whole.
    expect(block).not.toMatch(/\beffects:/);
    // EDGE B: every refusal after opening evicts what it opened (the standing door's own kept), and so does a throw.
    expect(block).toMatch(/const refuse = \(why: string\): void => \{\s*intentDoors\.evictUnheld\(key, openedIds, evict\);/);
    expect(source.slice(start, source.indexOf("\n  };\n", start))).toMatch(/catch \(error\) \{\s*intentDoors\.evictUnheld\(key, openedIds, evict\);\s*throw error;/);
  });

  test("L4 RED: a door handed the other face's plane lands no outcome (its receipt stays owed); CONTROL: on its own plane it lands", async () => {
    const f = await faceOf(), worn = plane(), own = plane();
    const wornBag = personaSiblingBagIds(personaBagIdFor("g-worn"))!.intents, ownBag = personaSiblingBagIds(personaBagIdFor(f.group))!.intents;
    worn.handle.change((d) => { d.tiddlers[wornBag] = storedLarRecord(wornBag, { text: "automerge:worn" }, "lararium-seed"); });
    own.handle.change((d) => { d.tiddlers[ownBag] = storedLarRecord(ownBag, { text: "automerge:own" }, "lararium-seed"); });
    const logged: string[] = [];
    for (const shared of [worn, own]) {
      // The votum rides the misfiled plane under its own group, as a planted write would.
      const votum = await buildIntent({ group: f.group, signer: f.joinee, verb: "ddate", args: { today: { year: 2026, month: 11, day: 21 } }, nonce: "",
        audience: { mode: "pinned", atom: f.h1.key }, verbs: faceIntentVerbs() });
      const key = `lar:///ha.ka.ba/dreamnet/intent-entry/${encodeURIComponent(f.group)}/${intentEntryCid(votum)}`;
      shared.handle.change((d) => { d.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(votum) }, intentEntryCid(votum)); });
      await makeFaceIntentDoor({ group: f.group, plane: shared.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(),
        log: (line) => logged.push(line), atom: f.h1, standing: () => "stands", runDeclaredEffect: async () => ({ text: "Sweetmorn" }) }).heed();
    }
    expect(outcomes(worn, f.group)).toBe(0);
    expect(logged.some((line) => /receipt is owed: .*intent-plane-misfiled/.test(line))).toBe(true);
    expect(outcomes(own, f.group)).toBe(1);
  });
});

describe("a write into another face's layer rides as a votum (comms-ux-enacts landing 13)", () => {
  const BAG = "lar:///ha.ka.ba/wikis/shared/working";
  const votumOf = (vower: string | null) => ({ holder: "face-a", vower, verb: "tiddler-put" as const, act: "acts/stamp#r1",
    args: { bag: BAG, title: "Shared note", fields: { title: "Shared note", text: "from b" }, create: true } });

  test("RED: the vow lands one votum on the holder's own plane carrying the VOWER's proof, and the holder's door pays it only through the vower's grant on the bag, once; CONTROL: the vower's plane holds no entry; POSITIVE: the same vow again keeps one id and one effect", async () => {
    const f = await faceOf(), holder = plane(), vowerPlane = plane(), vowerAtom = await signer(44);
    const paid = vi.fn(async (_args: Record<string, unknown>) => ({ decision: "put" }));
    const asked: string[] = [];
    const door = makeFaceIntentDoor({ group: f.group, plane: holder.handle, personaRecords: () => f.log, kelChain: () => [f.inception], verbs: faceIntentVerbs(), log: () => {},
      atom: f.h1, standing: () => "stands",
      runDeclaredEffect: async (verb, args, at) => paid(await admitShoreVotum(f.group, verb, args as Record<string, unknown>, at.agent, async (key, bag) => { asked.push(`${key}@${bag}`); return { ok: true }; })) });
    const vow = faceShoreVow({ seatOf: (group) => (group === f.group ? { group: f.group, plane: holder.handle, atom: f.h1 } : null),
      vowerOf: (vower) => (vower === "face-b" ? vowerAtom : null), verbs: faceIntentVerbs() });
    const id = await vow(votumOf("face-b"));
    expect(intentEntryRecordsOfGroup(vowerPlane.doc, f.group)).toHaveLength(0);
    await door.heed();
    expect(paid).toHaveBeenCalledTimes(1);
    expect(paid.mock.calls[0]![0]).toMatchObject({ title: "Shared note", fields: { text: "from b" }, act: "acts/stamp#r1" });
    expect(paid.mock.calls[0]![0], "the proof leaves before the door verb runs").not.toHaveProperty("vower");
    expect(asked, "the VOWER's grant decides, never the holder's reach").toEqual([`${vowerAtom.key.toLowerCase()}@${BAG}`]);
    expect((await door.describe()).view.intents.find((i) => i.id === id)?.status).toBe("answered");
    expect(await vow(votumOf("face-b"))).toBe(id);
    await door.heed();
    expect(paid).toHaveBeenCalledTimes(1);
  });

  test("RED: the drain refuses a votum whose vower holds no write on the bag, a proof over moved arguments, no proof at all, and an agent's relayed intent; CONTROL: the granted, unmoved vow pays", async () => {
    const vowerAtom = await signer(44), shared = plane();
    await faceShoreVow({ seatOf: () => ({ group: "face-a", plane: shared.handle, atom: vowerAtom }), vowerOf: () => vowerAtom, verbs: faceIntentVerbs() })(votumOf("face-b"));
    const carried = (intentEntryRecordsOfGroup(shared.doc, "face-a")[0] as { body: { args: Record<string, unknown> } }).body.args;
    const granted = async () => ({ ok: true });
    expect(await admitShoreVotum("face-a", "tiddler-put", carried, null, granted)).toMatchObject({ title: "Shared note", bag: BAG });
    await expect(admitShoreVotum("face-a", "tiddler-put", carried, null, async () => ({ ok: false, reason: "no-grant" }))).rejects.toMatchObject({ reason: "votum-vower-ungranted" });
    await expect(admitShoreVotum("face-a", "tiddler-put", { ...carried, title: "Another note" }, null, granted)).rejects.toMatchObject({ reason: "votum-vower-forged" });
    await expect(admitShoreVotum("face-b", "tiddler-put", carried, null, granted), "a proof over another holder").rejects.toMatchObject({ reason: "votum-vower-forged" });
    const { vower: _proof, ...bare } = carried;
    await expect(admitShoreVotum("face-a", "tiddler-put", bare, null, granted)).rejects.toMatchObject({ reason: "votum-vower-missing" });
    await expect(admitShoreVotum("face-a", "tiddler-put", carried, { key: "agent", delegation: "d" }, granted)).rejects.toMatchObject({ reason: "votum-agent-relayed" });
  });

  test("RED: a holder or a vower no seat of this vessel reaches refuses by name with a cure and lands nothing", async () => {
    const atom = await signer(44);
    await expect(faceShoreVow({ seatOf: () => null, vowerOf: () => atom, verbs: faceIntentVerbs() })(votumOf("face-b")))
      .rejects.toThrow(/votum-holder-unreached: .*`lares wear`/);
    await expect(faceShoreVow({ seatOf: () => ({ group: "face-a", plane: plane().handle, atom }), vowerOf: () => null, verbs: faceIntentVerbs() })(votumOf(null)))
      .rejects.toThrow(/votum-vower-unseated: .*`lares wear`/);
  });
});

