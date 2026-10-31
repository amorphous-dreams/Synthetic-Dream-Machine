import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fixtureIntentVerbs, signIntentEntry, buildAnswer, buildAsks, buildIntent, intentEntryCid, writeIntentEntry, actCid, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, intentEntryRecordsOfGroup, intentId,
  mintPersonaInception, signPersonaAct, type DocHandle, type LarDoc } from "@lararium/mesh";
import { makeFaceIntentDoor, requestFaceJoin, witnessedStandings } from "../src/face-intent-door.js";

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
    const start = source.indexOf("const door = makeFaceIntentDoor({");
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf("\n            });", start));
    expect(block).not.toMatch(captured);
    expect(block).not.toMatch(asyncPort);
    expect(block).toMatch(live);
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
    const start = source.indexOf("const attachDoor = async (): Promise<void> => {");
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf("const door = makeFaceIntentDoor({", start));
    expect(block).not.toMatch(external);
    expect(block).toMatch(composed);
  });
});
