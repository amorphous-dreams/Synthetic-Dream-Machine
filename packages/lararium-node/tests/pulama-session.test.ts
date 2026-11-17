/**
 * pulama-session — what a pūlama's session carries and what it refuses: no frame holds a key, cold rows and every act a
 * human route guards refuse by name, another face's rows stay outside the lei, and a lock zero-fills what the holder held.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { FLOOR_REST_KEY_INFO, hex } from "@lararium/mesh";
import { custodyRootFromBytes, openCustodyRootCarrier } from "../src/custody-root.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { faceProofKeyFile } from "../src/face-key-custody.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { PulamaRefused, unpackBytes, type PulamaChannel } from "../src/pulama-wire.js";
import { fixtureRoute, fixtureSlots, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const HOT = ".persona-admissions.json";
const GROUP_A = "group-pulama-a";
const GROUP_B = "group-pulama-b";
const WARDED = ".persona-group-root-h0.json";
const COLD_NODE = "intent-relay-key.bin";

let fx: PulamaFixture | null = null;
afterEach(async () => { await fx?.drop(); fx = null; });

/** Every byte string a line carries under `$b`, decoded. */
function bytesIn(line: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  const walk = (v: unknown): void => {
    if (v instanceof Uint8Array) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object" && v !== null) Object.values(v).forEach(walk);
  };
  walk(unpackBytes(JSON.parse(line)));
  return out;
}
const holds = (hay: Uint8Array, needle: Uint8Array): boolean => Buffer.from(hay).includes(Buffer.from(needle));
/** Whether any line carries `secret`: as bytes inside a byte field, or spelled in hex or base64 anywhere in the line. */
const carries = (lines: readonly string[], secret: Uint8Array): boolean =>
  lines.some((line) => line.includes(hex(secret)) || line.includes(Buffer.from(secret).toString("base64")) || bytesIn(line).some((b) => holds(b, secret)));

/** Send one raw request on a session's channel and read its answer frame. */
function ask(channel: PulamaChannel, id: number, op: string, a: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    channel.onFrame((f) => { if (f.t === "res" && f["id"] === id) resolve(f as Record<string, unknown>); });
    channel.send({ t: "req", id, op, a });
  });
}

describe("RED pulama-serves-no-key: no frame either side writes carries a key the holder holds", () => {
  test("a working session's frames hold no vessel key, custody root, face key or ward key; CONTROL: the scan finds a derived child", async () => {
    fx = await standPulama("pulama-no-key", () => openGate({ face: null, coldReads: ["face-proof-key"] }));
    const face = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const wardKeys: Uint8Array[] = [];
    fx.kept.watchWardKeys((key) => { wardKeys.push(Uint8Array.from(key)); });
    await fx.kept.withWardKey({ fcid: face.fcid }, fixtureRoute, async (seat) => { await seat.update(WARDED, () => ({ plaintext: new Uint8Array(32).fill(3), value: null })); });
    await fx.kept.updateColdRecord("identity", faceProofKeyFile(0, "nexus-x"), () => ({ plaintext: new Uint8Array(32).fill(6), value: null }));
    const opened = await openCustodyRootCarrier({ io: fx.seat.io, treeKey: fx.treeKey, identityDir: fx.seat.homes.identity });
    if (opened.reading !== "opens") throw new Error("the fixture's custody root did not open");
    const root = custodyRootFromBytes(opened.opened).bytes;

    const vessel = fx.vessel();
    await vessel.unlock([{ kind: "passphrase", passphrase: "a-passphrase-the-vessel-was-handed" }]);
    await vessel.writeRecord("identity", HOT, Uint8Array.from([1, 2, 3]));
    await vessel.updateRecord("identity", HOT, () => ({ plaintext: Uint8Array.from([4]), value: null }));
    await vessel.writeRecord("identity", faceAtomGroupFile(GROUP_A), new Uint8Array(32).fill(8));
    await vessel.readRecord("identity", faceAtomGroupFile(GROUP_A));
    await vessel.withRecords((records) => records.read("identity", HOT));
    await vessel.exclusive(async () => undefined);
    await vessel.openColdRecord("identity", faceProofKeyFile(0, "nexus-x"), () => undefined);
    await vessel.unlockFaces([{ kind: "passphrase", passphrase: "a-passphrase-the-vessel-was-handed" }]);
    await vessel.wardPublicKey({ ordinal: 0 });
    await vessel.faceStanding({ ordinal: 0 });
    await expect(vessel.openColdRecord("identity", COLD_NODE, () => undefined)).rejects.toBeInstanceOf(PulamaRefused);
    fx.server.refresh();
    const child = vessel.derive(FLOOR_REST_KEY_INFO);

    const lines = [...fx.lines.fromPulama, ...fx.lines.fromVessel];
    expect(lines.length).toBeGreaterThan(20);
    expect(wardKeys).toHaveLength(1);
    expect(fx.faceKeys.length).toBeGreaterThan(0);
    for (const [name, secret] of [["vessel key", fx.treeKey], ["custody root", root], ["ward key", wardKeys[0]!], ...fx.faceKeys.map((k) => ["face key", k] as const)] as const) {
      expect(secret.some((b) => b !== 0), `${name} read live`).toBe(true);
      expect(carries(lines, secret), `a frame carries the ${name}`).toBe(false);
    }
    // No credential handed to the vessel's side reaches a frame.
    expect(lines.some((l) => l.includes("a-passphrase-the-vessel-was-handed"))).toBe(false);
    // CONTROL: the scan reads what does cross. A derived child rides the session frame, and the scan finds it there.
    expect(carries(fx.lines.fromPulama, child)).toBe(true);
    expect(carries(fx.lines.fromPulama, new Uint8Array(32).fill(8))).toBe(true);
  });

  test("a lock drops every session and zero-fills the keys the holder held", async () => {
    fx = await standPulama("pulama-lock", () => openGate({ face: null, coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    let closed = 0;
    vessel.onClosed(() => { closed += 1; });
    expect(fx.faceKeys.some((k) => k.some((b) => b !== 0))).toBe(true);
    await fx.server.lock();
    expect(fx.server.sessions()).toBe(0);
    expect(fx.kept.isUnlocked()).toBe(false);
    for (const key of fx.faceKeys) expect([...key].every((b) => b === 0)).toBe(true);
    await vi.waitFor(() => expect(closed).toBe(1));
    expect(vessel.isUnlocked()).toBe(false);
    // A hello at an unlit pūlama refuses by name and reaches no gate.
    await expect(fx.vessel().unlock([])).rejects.toMatchObject({ name: "PulamaRefused", reading: "pulama-locked" });
  });
});

describe("RED pulama-record-ops: both ends of the wire name a custody record's ops `record.*` and the claim `records`", () => {
  test("the vessel's doors send record ops alone and the pūlama answers them; the retired row ops answer as no operation", async () => {
    fx = await standPulama("pulama-record-ops", () => openGate({ face: null, coldReads: ["face-proof-key"] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    await fx.kept.updateColdRecord("identity", faceProofKeyFile(0, "nexus-x"), () => ({ plaintext: new Uint8Array(32).fill(6), value: null }));
    const vessel = fx.vessel();
    await vessel.unlock([]);
    await vessel.writeRecord("identity", HOT, Uint8Array.from([1, 2, 3]));
    await vessel.readRecord("identity", HOT);
    await vessel.updateRecord("identity", HOT, () => ({ plaintext: Uint8Array.from([4]), value: null }));
    await vessel.withRecords(async (records) => { await records.read("identity", HOT); await records.remove("identity", HOT); });
    await vessel.writeRecord("identity", HOT, Uint8Array.from([5]));
    await vessel.removeRecord("identity", HOT, () => true);
    await vessel.openColdRecord("identity", faceProofKeyFile(0, "nexus-x"), () => undefined);
    const sent = fx.lines.fromVessel.map((l) => JSON.parse(l) as { t?: string; op?: string; a?: { kind?: string } }).filter((f) => f.t === "req");
    const ops = new Set(sent.map((f) => f.op));
    for (const op of ["record.write", "record.read", "record.standing", "record.swap", "record.remove", "records.read", "records.remove", "record.cold-open"]) expect(ops.has(op), op).toBe(true);
    expect([...ops].filter((op) => op !== undefined && /^rows?\./.test(op))).toEqual([]);
    expect(sent.filter((f) => f.op === "claim.begin").map((f) => f.a?.kind)).toContain("records");
    // The pūlama's side: a record op answers, and the retired row op reads as an operation the session never carries.
    const channel = fx.channel()!;
    let id = 7000;
    expect((await ask(channel, ++id, "record.read", { home: "identity", file: HOT }))["ok"]).toBe(true);
    const moved = await ask(channel, ++id, "record.move", { home: "identity", source: HOT, destination: HOT, expected: Uint8Array.from([9]) });
    expect((moved["err"] as { reading?: string } | undefined)?.reading).not.toBe("needs-the-human");
    for (const op of ["row.read", "row.write", "row.standing", "row.swap", "row.move", "row.remove", "row.cold-open", "rows.read", "rows.remove"]) {
      const res = await ask(channel, ++id, op, { home: "identity", file: HOT });
      expect(res["ok"], op).toBe(false);
      expect(res["err"], op).toMatchObject({ name: "PulamaRefused", reading: "needs-the-human" });
    }
    const rowsClaim = await ask(channel, ++id, "claim.begin", { kind: "rows" });
    expect(rowsClaim["ok"]).toBe(false);
    expect(rowsClaim["err"]).toMatchObject({ name: "PulamaRefused", reading: "pulama-frame-malformed" });
  });
});

describe("a session stands only on a live channel, and a decision writes only over the row it read", () => {
  test("RED: a channel that leaves while the gate reads gets no session; a vessel that leaves mid-dial seats none", async () => {
    let pass!: () => void;
    const reading = new Promise<void>((resolve) => { pass = resolve; });
    let asked = 0;
    fx = await standPulama("pulama-admission", () => ({ admit: async () => { asked += 1; await reading; return { ok: true, scope: { face: null, coldReads: [] } }; } }));
    // The channel closes while the gate still reads its hello.
    const gone = fx.vessel();
    const dial = gone.unlock([]);
    dial.catch(() => undefined);
    await vi.waitFor(() => expect(asked).toBe(1));
    fx.channel()!.close();
    await expect(dial).rejects.toMatchObject({ reading: "pulama-unreachable" });
    // The vessel's own lock lands while a second dial waits on the gate.
    const leaving = fx.vessel();
    const second = leaving.unlock([]);
    second.catch(() => undefined);
    await vi.waitFor(() => expect(asked).toBe(2));
    await leaving.lock();
    pass();
    await expect(second).rejects.toMatchObject({ name: "CustodyLocked" });
    expect(leaving.isUnlocked()).toBe(false);
    await vi.waitFor(() => expect(fx!.server.sessions()).toBe(0));
    // CONTROL: with the gate open, a fresh dial stands a session.
    expect((await fx.vessel().unlock([])).reading).toBe("opens");
    expect(fx.server.sessions()).toBe(1);
  });

  test("RED: a decision that writes into the bytes it was handed never lands over a row another writer moved; it decides again", async () => {
    fx = await standPulama("pulama-swap", () => openGate({ face: null, coldReads: [] }));
    const vessel = fx.vessel();
    await vessel.unlock([]);
    await fx.local.writeRecord("identity", HOT, Uint8Array.from([0xa]));
    const saw: number[] = [];
    let other: Promise<void> | null = null;
    await vessel.updateRecord("identity", HOT, (r) => {
      if (r.reading !== "opens") throw new Error("the row did not open");
      saw.push(r.plaintext[0]!);
      if (other === null) {
        // Another writer moves the row to B after this decision read A, and the decision scribbles B into its own copy.
        other = fx!.local.writeRecord("identity", HOT, Uint8Array.from([0xb]));
        r.plaintext[0] = 0xb;
      }
      return { plaintext: Uint8Array.from([0xc, saw.length]), value: null };
    });
    await other;
    expect(saw).toEqual([0xa, 0xb]);
    expect(await fx.kept.readRecord("identity", HOT)).toEqual({ reading: "opens", plaintext: Uint8Array.from([0xc, 2]) });
  });
});

describe("RED pulama-refuses-cold-rows: a session opens no cold row, no warded row and no act a human route guards", () => {
  test("cold rows refuse needs-the-human; the one cold row the scope names reads and never writes; CONTROL: the pūlama's own holder opens them", async () => {
    fx = await standPulama("pulama-cold", () => openGate({ face: null, coldReads: ["face-proof-key"] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const proof = faceProofKeyFile(0, "nexus-x");
    await fx.kept.updateColdRecord("identity", COLD_NODE, () => ({ plaintext: new Uint8Array(32).fill(1), value: null }));
    await fx.kept.updateColdRecord("identity", proof, () => ({ plaintext: new Uint8Array(32).fill(2), value: null }));
    await fx.kept.withWardKey({ ordinal: 0 }, fixtureRoute, async (seat) => { await seat.update(WARDED, () => ({ plaintext: new Uint8Array(32).fill(3), value: null })); });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const human = { name: "PulamaRefused", reading: "needs-the-human" };
    // A cold row the scope does not name: no read, no decision, no removal.
    await expect(vessel.openColdRecord("identity", COLD_NODE, (p) => [...p])).rejects.toMatchObject(human);
    await expect(vessel.updateColdRecord("identity", COLD_NODE, () => ({ plaintext: null, value: null }))).rejects.toMatchObject(human);
    await expect(vessel.removeColdRecord("identity", COLD_NODE)).rejects.toMatchObject(human);
    // The named one reads; a write, a removal and a hot-door write of it refuse.
    expect(await vessel.openColdRecord("identity", proof, (p) => p[0])).toBe(2);
    await expect(vessel.updateColdRecord("identity", proof, () => ({ plaintext: new Uint8Array(32).fill(9), value: null }))).rejects.toMatchObject(human);
    await expect(vessel.removeColdRecord("identity", proof)).rejects.toMatchObject(human);
    await expect(vessel.writeRecord("identity", proof, new Uint8Array(32).fill(9))).rejects.toMatchObject(human);
    // A warded row answers no door of a session.
    await expect(vessel.readRecord("identity", WARDED)).rejects.toMatchObject(human);
    await expect(vessel.writeRecord("identity", WARDED, new Uint8Array(32))).rejects.toMatchObject(human);
    // CONTROL: the rows stand whole under the pūlama's own holder.
    expect(await fx.kept.openColdRecord("identity", COLD_NODE, (p) => p[0])).toBe(1);
    expect(await fx.kept.openColdRecord("identity", proof, (p) => p[0])).toBe(2);
  });

  test("a ward act, a backup's proof, an unlock, an adoption, a founding and a lock refuse on the vessel's side and at the pūlama's door", async () => {
    fx = await standPulama("pulama-human", () => openGate({ face: null, coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const human = { name: "PulamaRefused", reading: "needs-the-human" };
    await expect(vessel.withWardKey({ ordinal: 0 }, fixtureRoute, async () => "ran")).rejects.toMatchObject(human);
    await expect(vessel.proves(fixtureRoute)).rejects.toMatchObject(human);
    await expect(vessel.rewrapWard({ ordinal: 0 }, fixtureRoute)).rejects.toMatchObject(human);
    await expect(vessel.adopt(fx.treeKey)).rejects.toMatchObject(human);
    await expect(vessel.foundFace({ ordinal: 1, slots: fixtureSlots })).rejects.toMatchObject(human);
    // A vessel that spoke the codec by hand meets the same refusal: the server holds no such operation.
    const channel = fx.channel()!;
    let id = 9000;
    for (const op of ["unlock", "proves", "backup", "adopt", "ward", "withWardKey", "rewrapWard", "foundFace", "lock", "lockFace", "derive"]) {
      const res = await ask(channel, ++id, op, { credentials: fixtureRoute, domain: FLOOR_REST_KEY_INFO });
      expect(res["ok"], op).toBe(false);
      expect(res["err"], op).toMatchObject(human);
    }
    // CONTROL: the session still serves, and the pūlama stays lit.
    expect((await ask(channel, ++id, "record.read", { home: "identity", file: HOT }))["ok"]).toBe(true);
    expect(fx.kept.isUnlocked()).toBe(true);
    // A vessel's lock leaves its session and never dims the pūlama.
    await vessel.lock();
    expect(vessel.isUnlocked()).toBe(false);
    expect(fx.kept.isUnlocked()).toBe(true);
  });

  test("a session bound to one face reads no other face's rows; CONTROL: its own face's rows read", async () => {
    let scoped: { fcid: string; ordinal: number } | null = null;
    fx = await standPulama("pulama-lei-face", () => ({ admit: async () => ({ ok: true, scope: { face: scoped, coldReads: [] } }) }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_A), Uint8Array.from([1]));
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_B), Uint8Array.from([2]));
    scoped = { fcid: a.fcid, ordinal: 0 };
    const vessel = fx.vessel();
    await vessel.unlock([]);
    expect(vessel.wears()).toBe(0);
    expect(await vessel.readRecord("identity", faceAtomGroupFile(GROUP_A))).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
    const outside = { name: "PulamaRefused", reading: "outside-the-lei" };
    await expect(vessel.readRecord("identity", faceAtomGroupFile(GROUP_B))).rejects.toMatchObject(outside);
    await expect(vessel.writeRecord("identity", faceAtomGroupFile(GROUP_B), Uint8Array.from([9]))).rejects.toMatchObject(outside);
    await expect(vessel.withRecords((records) => records.read("identity", faceAtomGroupFile(GROUP_B)))).rejects.toMatchObject(outside);
    expect(await vessel.faceStanding({ fcid: b.fcid })).toBeNull();
    expect((await vessel.unlockFaces([])).map((f) => f.reading)).toEqual(["already-unlocked"]);
    expect(await fx.kept.readRecord("identity", faceAtomGroupFile(GROUP_B))).toEqual({ reading: "opens", plaintext: Uint8Array.from([2]) });
  });

  test("RED session-standing-names-the-lei-face: a session bound to one face names only that face open, at the session and at every refresh, though the pūlama holds more open", async () => {
    let scoped: { fcid: string; ordinal: number } | null = null;
    fx = await standPulama("pulama-lei-standing", () => ({ admit: async () => ({ ok: true, scope: { face: scoped, coldReads: [] } }) }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_A), Uint8Array.from([1]));
    // The pūlama holds both faces open; the lei names the first.
    expect([...fx.kept.unlockedFaces()].sort()).toEqual([a.fcid, b.fcid].sort());
    scoped = { fcid: a.fcid, ordinal: 0 };
    const vessel = fx.vessel();
    await vessel.unlock([]);
    // A boot reader walks the faces the holder names open and reads each one's rows: every face it names serves.
    expect(vessel.unlockedFaces()).toEqual([a.fcid]);
    expect(await vessel.isFaceUnlocked({ fcid: b.fcid })).toBe(false);
    for (const fcid of vessel.unlockedFaces()) {
      const face = await vessel.faceStanding({ fcid });
      expect(await vessel.readRecord("identity", `anchors-h${face!.ordinal}.json`)).toMatchObject({ reading: "absent" });
    }
    fx.server.refresh();
    await new Promise((settle) => setTimeout(settle, 10));
    expect(vessel.unlockedFaces()).toEqual([a.fcid]);
    // CONTROL: a session the gate scoped to no face apart names every face the pūlama holds open.
    await vessel.lock();
    scoped = null;
    const wide = fx.vessel();
    await wide.unlock([]);
    expect([...wide.unlockedFaces()].sort()).toEqual([a.fcid, b.fcid].sort());
  });
});
