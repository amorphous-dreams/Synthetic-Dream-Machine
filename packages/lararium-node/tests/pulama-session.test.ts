/**
 * pulama-session — what a pūlama's session carries and what it refuses: no frame holds a key, cold rows and every act a
 * human route guards refuse by name, another face's rows stay outside the lei, and a lock zero-fills what the holder held.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { FLOOR_REST_KEY_INFO } from "@lararium/mesh/domains";
import { hex } from "@lararium/mesh/crypto";
import { custodyRootFromBytes, openCustodyRootCarrier } from "../src/custody-root.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { faceProofKeyFile } from "../src/face-key-custody.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { makePulamaHolder } from "../src/pulama-holder.js";
import { PulamaRefused, pulamaChannelPair, unpackBytes, type PulamaChannel } from "../src/pulama-wire.js";
import { fixtureRoute, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const HOT = ".persona-admissions.json";
const GROUP_A = "group-pulama-a";
const GROUP_B = "group-pulama-b";
const GROUP_C = "group-pulama-c";
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
    fx = await standPulama("pulama-no-key", () => openGate({ faces: lend(0), coldReads: ["face-proof-key"] }));
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
    fx = await standPulama("pulama-lock", () => openGate({ faces: lend(0), coldReads: [] }));
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
    fx = await standPulama("pulama-record-ops", () => openGate({ faces: lend(0), coldReads: ["face-proof-key"] }));
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
    fx = await standPulama("pulama-admission", () => ({ admit: async () => { asked += 1; await reading; return { ok: true, scope: { faces: lend(0), coldReads: [] } }; } }));
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
    fx = await standPulama("pulama-swap", () => openGate({ faces: lend(0), coldReads: [] }));
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
    fx = await standPulama("pulama-cold", () => openGate({ faces: lend(0), coldReads: ["face-proof-key"] }));
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
    fx = await standPulama("pulama-human", () => openGate({ faces: lend(0), coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const human = { name: "PulamaRefused", reading: "needs-the-human" };
    await expect(vessel.withWardKey({ ordinal: 0 }, fixtureRoute, async () => "ran")).rejects.toMatchObject(human);
    await expect(vessel.proves(fixtureRoute)).rejects.toMatchObject(human);
    await expect(vessel.adopt(fx.treeKey)).rejects.toMatchObject(human);
    await expect(vessel.foundFace({ ordinal: 1, slots: fixtureSlots })).rejects.toMatchObject(human);
    // A vessel that spoke the codec by hand meets the same refusal: the server holds no such operation.
    const channel = fx.channel()!;
    let id = 9000;
    for (const op of ["unlock", "proves", "backup", "adopt", "ward", "withWardKey", "foundFace", "lock", "lockFace", "derive"]) {
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

  test("RED lend-set-guard: a session lent {h0, h2} reads both faces' rows and refuses h1's outside-the-lei, naming the set; CONTROL: the pūlama's own holder reads h1", async () => {
    fx = await standPulama("pulama-lend-guard", () => openGate({ faces: lend(0, 2), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const c = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_C), ordinal: 2, slots: fixtureSlots });
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_A), Uint8Array.from([1]));
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_B), Uint8Array.from([2]));
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_C), Uint8Array.from([3]));
    const vessel = fx.vessel();
    await vessel.unlock([]);
    expect(vessel.lends()).toEqual([0, 2]);
    expect(await vessel.readRecord("identity", faceAtomGroupFile(GROUP_A))).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
    expect(await vessel.readRecord("identity", faceAtomGroupFile(GROUP_C))).toEqual({ reading: "opens", plaintext: Uint8Array.from([3]) });
    // THE WIDENING KEEPS THE WALL: a face outside the lent set refuses at every door, and the refusal names the set.
    const outside = { name: "PulamaRefused", reading: "outside-the-lei" };
    await expect(vessel.readRecord("identity", faceAtomGroupFile(GROUP_B))).rejects.toMatchObject({
      ...outside,
      message: `outside-the-lei: the pūlama lends this vessel h0, h2; this face-atom row selects {"group":"${personaGroupDigest(GROUP_B)}"}, face h1`,
    });
    await expect(vessel.writeRecord("identity", faceAtomGroupFile(GROUP_B), Uint8Array.from([9]))).rejects.toMatchObject(outside);
    await expect(vessel.updateRecord("identity", faceAtomGroupFile(GROUP_B), () => ({ plaintext: Uint8Array.from([9]), value: null }))).rejects.toMatchObject(outside);
    await expect(vessel.withRecords((records) => records.read("identity", faceAtomGroupFile(GROUP_B)))).rejects.toMatchObject(outside);
    await expect(vessel.wardPublicKey({ ordinal: 1 })).rejects.toMatchObject(outside);
    expect(await vessel.faceStanding({ fcid: b.fcid })).toBeNull();
    expect(await vessel.faceStanding({ ordinal: 2 })).toMatchObject({ fcid: c.fcid, ordinal: 2 });
    expect((await vessel.unlockFaces([])).map((f) => f.reading === "already-unlocked" ? f.ordinal : f.reading)).toEqual([0, 2]);
    expect(await fx.kept.readRecord("identity", faceAtomGroupFile(GROUP_B))).toEqual({ reading: "opens", plaintext: Uint8Array.from([2]) });
    expect(a.fcid).not.toBe(c.fcid);
  });

  test("RED lend-set-binds-fcid: a lent face the admission names by custody id serves only while the index still names that id at its ordinal", async () => {
    let lent = lend(0);
    fx = await standPulama("pulama-lend-fcid", () => ({ admit: async () => ({ ok: true, scope: { faces: lent, coldReads: [] } }) }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    await fx.kept.writeRecord("identity", faceAtomGroupFile(GROUP_A), Uint8Array.from([1]));
    lent = lend({ fcid: "f".repeat(32), ordinal: 0 });
    const stale = fx.vessel();
    await stale.unlock([]);
    expect(stale.unlockedFaces()).toEqual([]);
    expect(stale.waiting()).toEqual([0]);
    await expect(stale.readRecord("identity", faceAtomGroupFile(GROUP_A))).rejects.toMatchObject({ reading: "outside-the-lei" });
    await stale.lock();
    // CONTROL: the admission's own custody id serves.
    lent = lend({ fcid: a.fcid, ordinal: 0 });
    const bound = fx.vessel();
    await bound.unlock([]);
    expect(bound.unlockedFaces()).toEqual([a.fcid]);
    expect(await bound.readRecord("identity", faceAtomGroupFile(GROUP_A))).toEqual({ reading: "opens", plaintext: Uint8Array.from([1]) });
  });

  test("RED lend-set-standing: the standing names the lent faces that stand lit and the lent faces that wait, at the session and at every refresh, and never a face outside the set", async () => {
    fx = await standPulama("pulama-lend-standing", () => openGate({ faces: lend(0, 2), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const c = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_C), ordinal: 2, slots: fixtureSlots });
    // The pūlama holds all three lit; the lend names two.
    expect([...fx.kept.unlockedFaces()].sort()).toEqual([a.fcid, b.fcid, c.fcid].sort());
    const vessel = fx.vessel();
    await vessel.unlock([]);
    expect(vessel.unlockedFaces()).toEqual([a.fcid, c.fcid]);
    expect(vessel.waiting()).toEqual([]);
    expect(await vessel.isFaceUnlocked({ fcid: b.fcid })).toBe(false);
    // PARTIAL LIGHTING: a lent face the pūlama dims waits by name; the lit one keeps serving.
    await fx.kept.lockFace(c.fcid);
    fx.server.refresh();
    await vi.waitFor(() => expect(vessel.waiting()).toEqual([2]));
    expect(vessel.unlockedFaces()).toEqual([a.fcid]);
    // The session frame names the lent set, ordinals with their custody ids where the gate named them.
    const session = fx.lines.fromPulama.map((l) => JSON.parse(l) as Record<string, unknown>).find((f) => f["t"] === "session")!;
    expect(session["scope"]).toEqual({ faces: [{ ordinal: 0 }, { ordinal: 2 }] });
  });

  test("each opening of a lent face takes its own number: a dim and re-light of one face reads a new opening; the other lit face's stands", async () => {
    fx = await standPulama("pulama-face-opening", () => openGate({ faces: lend(0, 2), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const c = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_C), ordinal: 2, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const first = vessel.faceOpening?.(c.fcid), other = vessel.faceOpening?.(a.fcid);
    expect(typeof first).toBe("string");
    // THE LOCK TELLS THE VESSEL ITSELF: no refresh, the pūlama's own standing lands the moment the face shuts.
    await fx.kept.lockFace(c.fcid);
    await vi.waitFor(() => expect(vessel.faceOpening?.(c.fcid)).toBeNull());
    await fx.kept.unlockFace({ fcid: c.fcid }, fixtureRoute);
    fx.server.refresh();
    await vi.waitFor(() => expect(typeof vessel.faceOpening?.(c.fcid)).toBe("string"));
    expect(vessel.faceOpening?.(c.fcid)).not.toBe(first);
    expect(vessel.faceOpening?.(a.fcid)).toBe(other);
  });

  test("RED re-lend: the pūlama locks and re-lends a face back to back, and the vessel reads the new opening from the pūlama's own name, never one inferred from what it observed", async () => {
    fx = await standPulama("pulama-face-relend", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const first = vessel.faceOpening?.(a.fcid);
    expect(first).toBe(fx.kept.faceOpening?.(a.fcid));
    // The lock and the re-lend land at the pūlama back to back: no standing reaches the vessel in between.
    await fx.kept.lockFace(a.fcid);
    await fx.kept.unlockFace({ fcid: a.fcid }, fixtureRoute);
    fx.server.refresh();
    await vi.waitFor(() => expect(vessel.faceOpening?.(a.fcid)).toBe(fx!.kept.faceOpening?.(a.fcid)));
    expect(vessel.faceOpening?.(a.fcid)).not.toBe(first);
  });

  test("TWO-PHASE CLOSE, WITH THE ACK: the pūlama's close sends closing(face, opening) and keeps the key; it locks only once the vessel answers closed for that opening", async () => {
    fx = await standPulama("pulama-close-ack", () => openGate({ faces: lend(0, 2), coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const c = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_C), ordinal: 2, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const heard: Array<{ fcid: string; opening: string | null }> = [];
    vessel.onClosing!((fcid, opening) => heard.push({ fcid, opening }));
    const opening = fx.kept.faceOpening!(c.fcid);
    expect(await fx.server.closeFace(2)).toMatchObject({ reading: "closing", face: 2, unanswered: 1 });
    await vi.waitFor(() => expect(heard).toEqual([{ fcid: c.fcid, opening }]));
    // The key stays while the vessel drains: its rows still serve, and no clock locks it.
    expect(fx.kept.unlockedFaces()).toContain(c.fcid);
    expect(vessel.closingFaces!()).toEqual([c.fcid]);
    await vessel.faceClosed!(c.fcid, opening);
    await vi.waitFor(() => expect(fx!.kept.unlockedFaces()).not.toContain(c.fcid));
    await vi.waitFor(() => expect(vessel.faceOpening?.(c.fcid)).toBeNull());
    expect(fx.server.closing()).toEqual([]);
  });

  test("TWO-PHASE CLOSE, WITHOUT THE ACK: a silent vessel keeps the face closing with no clock; the pūlama names it, and only the operator's hand forces the lock", async () => {
    fx = await standPulama("pulama-close-silent", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(fx.kept.unlockedFaces(), "no clock locks a face its vessel never answered").toContain(a.fcid);
    expect(fx.server.closing()).toEqual([{ face: 0, unanswered: 1, note: "face h0: the vessel has not answered its close; close it again to tell the vessel again, or force it by hand" }]);
    // A closed naming another opening answers nothing and leaves the close waiting.
    await vessel.faceClosed!(a.fcid, "not-the-opening");
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
    // THE OPERATOR'S HAND confirms the forced lock.
    expect(await fx.server.closeFace(0, { force: true })).toMatchObject({ reading: "locked", face: 0, forced: true });
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
    expect(fx.server.closing()).toEqual([]);
  });

  test("F6 THE CLEARING LINE: a close asked again tells each unanswered session again (a vessel whose drain faulted drains again); a session that ends unanswered counts dropped, and only the operator's hand then locks the face", async () => {
    fx = await standPulama("pulama-close-again", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const heard: string[] = [];
    vessel.onClosing!((fcid) => heard.push(fcid));
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vi.waitFor(() => expect(heard).toEqual([a.fcid]));
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vi.waitFor(() => expect(heard, "the unanswered vessel hears the close again").toEqual([a.fcid, a.fcid]));
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
    // The told session ends without answering: its vessel may still hold an unsealed save, and the status names the clearing line.
    await vessel.lock();
    await vi.waitFor(() => expect(fx!.server.closing()).toEqual([{ face: 0, unanswered: 0, dropped: 1, note: "face h0: 1 session(s) it told ended unanswered, and their vessel may still hold an unsealed save; close it again to tell every live vessel, and only a forced lock by hand locks it" }]));
    expect(fx.kept.unlockedFaces(), "no clock locks it").toContain(a.fcid);
    expect(await fx.server.closeFace(0), "a plain close never locks over a dropped session").toMatchObject({ reading: "closing", unanswered: 0 });
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
    expect(await fx.server.closeFace(0, { force: true })).toMatchObject({ reading: "locked", forced: true });
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
    expect(fx.server.closing()).toEqual([]);
  });

  test("R6 B1 (the lock awaited mid-transition): while the holder's lock waits its turn, the face still reads closing and shut to every session, so a standing sent then shows it lit to none, and a close asked meanwhile joins that lock", async () => {
    fx = await standPulama("pulama-close-locking", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const heard: string[] = [];
    vessel.onClosing!((fcid) => heard.push(fcid));
    // The holder's lock waits its turn (an unlock queued ahead of it, rows in flight): held here by hand.
    let letLock!: () => void;
    const gate = new Promise<void>((r) => { letLock = r; });
    const lockFace = fx.kept.lockFace.bind(fx.kept);
    let locks = 0;
    (fx.kept as { lockFace: (fcid: string) => Promise<void> }).lockFace = async (fcid) => { locks += 1; await gate; await lockFace(fcid); };
    const opening = fx.kept.faceOpening!(a.fcid);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await vi.waitFor(() => expect(heard).toEqual([a.fcid]));
    const answered = vessel.faceClosed!(a.fcid, opening);
    await vi.waitFor(() => expect(locks).toBe(1));
    // IN THE GAP: a refresh sends every standing; the face reads closing and shut, never lit.
    fx.server.refresh();
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(vessel.unlockedFaces(), "no standing shows the face lit while its key locks").toEqual([]);
    expect(vessel.closingFaces!()).toEqual([a.fcid]);
    expect(fx.server.closing()).toHaveLength(1);
    // A close asked in the gap joins the lock in flight: no fresh close, no second lock.
    const again = fx.server.closeFace(0);
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(heard, "no fresh closing is sent").toEqual([a.fcid]);
    letLock();
    expect(await again).toMatchObject({ reading: "locked", face: 0 });
    await answered;
    expect(locks).toBe(1);
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
    expect(fx.server.closing()).toEqual([]);
    await vi.waitFor(() => expect(vessel.closingFaces!()).toEqual([]));
  });

  test("R7 F1 (a first close with no lender locked bare): the close stands through the lock's wait, so a session admitted meanwhile reads the face shut and its rows refuse face-closing", async () => {
    fx = await standPulama("pulama-close-unlent-wait", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    let letLock!: () => void;
    const gate = new Promise<void>((r) => { letLock = r; });
    const lockFace = fx.kept.lockFace.bind(fx.kept);
    (fx.kept as { lockFace: (fcid: string) => Promise<void> }).lockFace = async (fcid) => { await gate; await lockFace(fcid); };
    const closed = fx.server.closeFace(0);
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    // A vessel that lends the face is admitted while the key waits to lock.
    const late = fx.vessel();
    await late.unlock([]);
    expect(late.unlockedFaces(), "the late session reads the face shut").toEqual([]);
    await expect(late.readRecord("identity", faceAtomGroupFile(GROUP_A))).rejects.toMatchObject({ reading: "face-closing" });
    letLock();
    expect(await closed).toMatchObject({ reading: "locked", face: 0 });
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
    expect(fx.server.closing()).toEqual([]);
  });

  test("R7 F2: a force asked while a lock runs joins it (one lock); a lock that throws puts back the sessions still owing, so a plain close never locks over them", async () => {
    fx = await standPulama("pulama-close-force-join", () => openGate({ faces: lend(0, 1), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const lockFace = fx.kept.lockFace.bind(fx.kept);
    let letLock!: () => void;
    let gate = new Promise<void>((r) => { letLock = r; });
    let locks = 0;
    let fault: Error | null = null;
    (fx.kept as { lockFace: (fcid: string) => Promise<void> }).lockFace = async (fcid) => {
      locks += 1;
      await gate;
      if (fault !== null) { const f = fault; fault = null; throw f; }
      await lockFace(fcid);
    };
    // THE JOIN: the vessel answers, the lock waits; a force asked meanwhile joins that one lock.
    const openingA = fx.kept.faceOpening!(a.fcid);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    const answered = vessel.faceClosed!(a.fcid, openingA);
    await vi.waitFor(() => expect(locks).toBe(1));
    const forced = fx.server.closeFace(0, { force: true });
    letLock();
    expect(await forced).toMatchObject({ reading: "locked", forced: true });
    await answered;
    expect(locks, "one lock per close").toBe(1);
    expect(fx.kept.unlockedFaces()).not.toContain(a.fcid);
    // THE THROW: face 1's vessel never answers; a forced lock throws; the vessel owes its answer again.
    locks = 0;
    gate = Promise.resolve();
    fault = new Error("the holder refused the lock");
    expect(await fx.server.closeFace(1)).toMatchObject({ reading: "closing", unanswered: 1 });
    await expect(fx.server.closeFace(1, { force: true })).rejects.toThrow("the holder refused the lock");
    expect(fx.server.closing(), "the told session owes its answer again").toMatchObject([{ face: 1, unanswered: 1 }]);
    expect(await fx.server.closeFace(1), "a plain close tells it again, and locks nothing").toMatchObject({ reading: "closing", unanswered: 1 });
    expect(fx.kept.unlockedFaces()).toContain(b.fcid);
  });

  test("H1 (a dropped session plus another's answer locked the key): two lenders are told; one drops unanswered, the other answers; the key stays open until the operator's hand", async () => {
    fx = await standPulama("pulama-close-drop-answer", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const one = fx.vessel();
    await one.unlock([]);
    const two = fx.vessel();
    await two.unlock([]);
    const opening = fx.kept.faceOpening!(a.fcid);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 2 });
    // Vessel one's channel drops while it still holds a save it never sealed.
    await one.lock();
    await vi.waitFor(() => expect(fx!.server.closing()[0]).toMatchObject({ unanswered: 1, dropped: 1 }));
    await two.faceClosed!(a.fcid, opening);
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(fx.kept.unlockedFaces(), "no key locks over the dropped vessel's save on another's answer").toContain(a.fcid);
    expect(fx.server.closing()[0]).toMatchObject({ unanswered: 0, dropped: 1 });
  });

  test("H2 (the re-close ignored a vessel that came back): a re-close tells every live lender, a late session included, opens its rows to its drain, and never locks over it", async () => {
    fx = await standPulama("pulama-close-reconnect", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const first = fx.vessel();
    await first.unlock([]);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    await first.lock();
    // The same vessel comes back under a new session: it reads the face shut, and its rows refuse, until a close tells it.
    const back = fx.vessel();
    await back.unlock([]);
    const heard: string[] = [];
    back.onClosing!((fcid) => heard.push(fcid));
    expect(back.unlockedFaces()).toEqual([]);
    await expect(back.readRecord("identity", faceAtomGroupFile(GROUP_A))).rejects.toMatchObject({ reading: "face-closing" });
    expect(await fx.server.closeFace(0), "the re-close finds the late lender and locks nothing").toMatchObject({ reading: "closing", unanswered: 1 });
    await vi.waitFor(() => expect(heard).toEqual([a.fcid]));
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
    // While the face closes, `unlockedFaces()` reads the set the pūlama serves THIS session: a told session reads the closing face
    // served (its rows open to its drain), and a session outside the close reads it shut.
    await vi.waitFor(() => expect(back.unlockedFaces(), "the told session drains under the face").toEqual([a.fcid]));
    expect(await back.readRecord("identity", faceAtomGroupFile(GROUP_A))).toMatchObject({ reading: expect.any(String) });
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    expect(fx.kept.unlockedFaces()).toContain(a.fcid);
  });

  test("SOL R7 (a session admitted after the close lights the face from its standing): it reads the closing face shut, its rows refuse face-closing, and the told session still drains under it", async () => {
    fx = await standPulama("pulama-close-late-session", () => openGate({ faces: lend(0), coldReads: [] }));
    const a = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const told = fx.vessel();
    await told.unlock([]);
    expect(await fx.server.closeFace(0)).toMatchObject({ reading: "closing", unanswered: 1 });
    const late = fx.vessel();
    await late.unlock([]);
    expect(late.unlockedFaces(), "the late session never reads the closing face as served").toEqual([]);
    expect(await late.isFaceUnlocked({ fcid: a.fcid })).toBe(false);
    expect(late.closingFaces!()).toEqual([a.fcid]);
    await expect(late.readRecord("identity", faceAtomGroupFile(GROUP_A))).rejects.toMatchObject({ reading: "face-closing" });
    expect(told.unlockedFaces(), "the told session still drains under the face").toEqual([a.fcid]);
    expect(await told.readRecord("identity", faceAtomGroupFile(GROUP_A))).toMatchObject({ reading: expect.any(String) });
    expect(fx.server.closing()).toEqual([{ face: 0, unanswered: 1, note: "face h0: the vessel has not answered its close; close it again to tell the vessel again, or force it by hand" }]);
    await told.faceClosed!(a.fcid, fx.kept.faceOpening!(a.fcid));
    await vi.waitFor(() => expect(fx!.kept.unlockedFaces()).not.toContain(a.fcid));
  });

  test("a close of a face no session lends locks at once; a shut face answers face-locked", async () => {
    fx = await standPulama("pulama-close-unlent", () => openGate({ faces: lend(0), coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    expect(await fx.server.closeFace(1)).toMatchObject({ reading: "locked", face: 1 });
    expect(fx.kept.unlockedFaces()).not.toContain(b.fcid);
    expect(await fx.server.closeFace(1)).toMatchObject({ reading: "face-locked", face: 1 });
    expect(await fx.server.closeFace(7)).toMatchObject({ reading: "face-absent", face: 7 });
  });

  test("SOL R6 L (existence leak): face.closed names nothing back: a face outside the lend, an unknown id and a face not closing all answer alike", async () => {
    fx = await standPulama("pulama-closed-scope", () => openGate({ faces: lend(0), coldReads: [] }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    const b = await fx.kept.foundFace({ group: personaGroupDigest(GROUP_B), ordinal: 1, slots: fixtureSlots });
    const vessel = fx.vessel();
    await vessel.unlock([]);
    const channel = fx.channel()!;
    const outside = await ask(channel, 900, "face.closed", { fcid: b.fcid, opening: "x" });
    const unknown = await ask(channel, 901, "face.closed", { fcid: "no-such-face", opening: "x" });
    expect(outside).toEqual({ t: "res", id: 900, ok: true, v: null });
    expect(unknown).toEqual({ t: "res", id: 901, ok: true, v: null });
    expect(fx.kept.unlockedFaces()).toContain(b.fcid);
    // The opening question leaves the session: no frame asks a face's opening.
    expect(await ask(channel, 902, "face.opening", { fcid: b.fcid })).toMatchObject({ ok: false });
  });

  test("RED no-set-serves-no-face: a gate scope naming no lent set refuses the hello by name and no session stands; NO SET NEVER MEANS EVERY FACE", async () => {
    let faces: unknown = null;
    fx = await standPulama("pulama-lend-none", () => ({ admit: async () => ({ ok: true, scope: { faces, coldReads: [] } as never }) }));
    await fx.kept.foundFace({ group: personaGroupDigest(GROUP_A), ordinal: 0, slots: fixtureSlots });
    for (const none of [null, undefined, []]) {
      faces = none;
      const vessel = fx.vessel();
      await expect(vessel.unlock([])).rejects.toMatchObject({ name: "PulamaRefused", reading: "lent-faces-empty" });
      expect(vessel.isUnlocked()).toBe(false);
      expect(fx.server.sessions()).toBe(0);
    }
    faces = [0, 0];
    await expect(fx.vessel().unlock([])).rejects.toMatchObject({ reading: "lent-faces-duplicate" });
  });

  test("RED session-frame-names-its-set: a session frame whose scope names no lent set, or a malformed one, refuses at the vessel by the set's own reading, and no session stands", async () => {
    fx = await standPulama("pulama-lend-frame", () => openGate({ faces: lend(0), coldReads: [] }));
    for (const [scope, reading] of [
      [{ ordinal: 0 }, "lent-faces-empty"], [{ faces: [] }, "lent-faces-empty"], [undefined, "lent-faces-empty"],
      [{ faces: 0 }, "lent-faces-malformed"], [{ faces: ["h0"] }, "lent-faces-malformed"], [{ faces: [0, 0] }, "lent-faces-duplicate"],
    ] as const) {
      const vessel = makePulamaHolder({
        homes: fx.seat.homes, offer: () => ({}),
        dial: async () => {
          const pair = pulamaChannelPair();
          pair.pulama.onFrame((f) => { if (f.t === "hello") pair.pulama.send({ t: "session", scope, standing: { slot: "s", attemptsLeft: 3, faces: [] }, derived: {} }); });
          return pair.vessel;
        },
      });
      await expect(vessel.unlock([])).rejects.toMatchObject({ name: "PulamaRefused", reading });
      expect(vessel.isUnlocked()).toBe(false);
    }
  });
});
