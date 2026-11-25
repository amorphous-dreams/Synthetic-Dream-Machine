/**
 * pulama-matches-local — a vessel that seats a `PulamaHolder` reads the same answers the in-process holder gives over the same
 * store, across the surface a session serves: hot rows, face rows, the two claims, the read of a cold row the scope names,
 * derivations and a face's standing.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, PERSONA_SCOPE_INFO } from "@lararium/mesh/domains";
import { CustodyLocked, CustodyRecordUnavailable, CustodyRecordUnknown, FaceLocked, type CustodyHolder } from "../src/custody-holder.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { faceProofKeyFile } from "../src/face-key-custody.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { PulamaRefused } from "../src/pulama-wire.js";
import { fixtureRoute, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const HOT = ".persona-admissions.json";
const GROUP = "group-pulama-matches";
const NEXUS = "nexus-pulama-matches";
const bytes = (...n: number[]) => Uint8Array.from(n);

let fx: PulamaFixture | null = null;
afterEach(async () => { await fx?.drop(); fx = null; });

/** What one call answered: its value, or the class and words of its refusal. */
async function outcome<T>(run: () => Promise<T> | T): Promise<unknown> {
  try { return { value: await run() }; }
  catch (err) { return { refused: (err as Error).name, message: (err as Error).message }; }
}

async function stand() {
  fx = await standPulama("pulama-matches", () => openGate({ faces: lend(0), coldReads: ["face-proof-key"] }));
  const face = await fx.local.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  expect((await fx.kept.unlockFace({ fcid: face.fcid }, fixtureRoute)).reading).toBe("opens");
  const remote = fx.vessel();
  expect(await remote.unlock([])).toEqual({ reading: "opens", slot: "pulama", opener: [] });
  /** Run one call on the in-process holder, then on the vessel's side of the pūlama, and hold the two answers equal. */
  const both = async <T>(run: (holder: CustodyHolder) => Promise<T> | T): Promise<unknown> => {
    const local = await outcome(() => run(fx!.local));
    const far = await outcome(() => run(remote));
    expect(far).toEqual(local);
    return local;
  };
  return { fx, face, remote, both };
}

describe("RED remote-holder-matches-local: the vessel's side of a pūlama answers as the in-process holder does", () => {
  test("hot rows read, write, update, move and remove alike, and each sees the other's writes", async () => {
    const { both, fx: f, remote } = await stand();
    expect(await both((h) => h.readRecord("identity", HOT))).toEqual({ value: { reading: "absent" } });
    await remote.writeRecord("identity", HOT, bytes(1, 2, 3));
    expect(await both((h) => h.readRecord("identity", HOT))).toEqual({ value: { reading: "opens", plaintext: bytes(1, 2, 3) } });
    // A decision runs on the caller's side and its write lands under the holder's claim.
    expect(await both((h) => h.updateRecord("identity", HOT, (r) => ({ plaintext: r.reading === "opens" ? Uint8Array.from([...r.plaintext, 9]) : null, value: r.reading })))).toEqual({ value: "opens" });
    expect(await f.local.readRecord("identity", HOT)).toEqual({ reading: "opens", plaintext: bytes(1, 2, 3, 9, 9) });
    // A decision that writes nothing leaves the row, and one that throws lands nothing.
    expect(await both((h) => h.updateRecord("identity", HOT, () => ({ plaintext: null, value: "left" })))).toEqual({ value: "left" });
    expect(await both((h) => h.updateRecord("identity", HOT, () => { throw new Error("the decision refused"); }))).toEqual({ refused: "Error", message: "the decision refused" });
    // A removal's predicate reads the standing bytes; a row it declines stays.
    expect(await both((h) => h.removeRecord("identity", HOT, (p) => p.length === 1))).toEqual({ value: false });
    expect(await both((h) => h.removeRecord("identity", ".persona-grant-pending.json"))).toEqual({ value: false });
    // A predicate over a row nothing stands at removes nothing, and never runs.
    expect(await both((h) => h.removeRecord("identity", ".persona-grant-pending.json", () => true))).toEqual({ value: false });
    expect(await remote.removeRecord("identity", HOT, (p) => p.length === 5)).toBe(true);
    expect(await both((h) => h.readRecord("identity", HOT))).toEqual({ value: { reading: "absent" } });
    // A row no carrier names, and a cold row at a hot door, refuse by the holder's own name on both sides.
    expect((await both((h) => h.readRecord("identity", "no-such-row.bin")) as { refused: string }).refused).toBe(new CustodyRecordUnknown("identity", "x").name);
    expect((await both((h) => h.readRecord("identity", "intent-relay-key.bin")) as { refused: string }).refused).toBe("CustodyRecordUnknown");
  });

  test("face rows, a row move and the rows claim answer alike", async () => {
    const { both, fx: f, remote } = await stand();
    const atom = faceAtomGroupFile(GROUP);
    await remote.writeRecord("identity", atom, bytes(7, 7));
    expect(await both((h) => h.readRecord("identity", atom))).toEqual({ value: { reading: "opens", plaintext: bytes(7, 7) } });
    expect(await both((h) => h.withRecords(async (records) => [await records.read("identity", atom), await records.read("identity", HOT), await records.remove("identity", atom, (b) => b.length === 9)]))).toEqual({ value: [bytes(7, 7), null, false] });
    expect(await remote.withRecords((records) => records.remove("identity", atom, (b) => b.length === 2))).toBe(true);
    expect(await f.local.readRecord("identity", atom)).toEqual({ reading: "absent" });
    // The exclusive claim runs the caller's act while the pūlama holds the custody claim, and releases it after.
    expect(await both((h) => h.exclusive(async () => "ran"))).toEqual({ value: "ran" });
    expect(await both((h) => h.exclusive(async () => { throw new Error("the act refused"); }))).toEqual({ refused: "Error", message: "the act refused" });
    await f.local.writeRecord("identity", HOT, bytes(4));
    expect(await both((h) => h.readRecord("identity", HOT))).toEqual({ value: { reading: "opens", plaintext: bytes(4) } });
    // A face the index does not name reads absent and removes nothing, on both sides.
    expect(await both((h) => h.readRecord("identity", faceAtomGroupFile("group-nobody-founded")))).toEqual({ value: { reading: "absent" } });
    expect(await both((h) => h.removeRecord("identity", faceAtomGroupFile("group-nobody-founded")))).toEqual({ value: false });
  });

  test("a face's standing, its ward key, the derived children and the cold read the scope names answer alike", async () => {
    const { both, fx: f, face, remote } = await stand();
    expect(await both((h) => h.faceStanding({ ordinal: 0 }))).toEqual({ value: { ordinal: 0, fcid: face.fcid, group: personaGroupDigest(GROUP), ask: null, unlocked: true } });
    expect(await both((h) => h.faceStanding({ ordinal: 4 }))).toEqual({ value: null });
    expect(await both((h) => h.isFaceUnlocked({ fcid: face.fcid }))).toEqual({ value: true });
    expect(await both((h) => h.unlockedFaces())).toEqual({ value: [face.fcid] });
    expect(((await both((h) => h.wardPublicKey({ ordinal: 0 }))) as { value: string }).value).toMatch(/^[0-9a-f]{64}$/);
    expect(await both((h) => h.isUnlocked())).toEqual({ value: true });
    for (const domain of [FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO]) expect(((await both((h) => h.derive(domain))) as { value: Uint8Array }).value).toHaveLength(32);
    // A domain outside the session derives nothing on the vessel's side.
    expect(() => remote.derive(PERSONA_SCOPE_INFO)).toThrow(PulamaRefused);
    // The per-Nexus key a boot reads unattended: a cold row the scope names reads through, and both sides read the same bytes.
    const proof = faceProofKeyFile(0, NEXUS);
    await f.local.updateColdRecord("identity", proof, () => ({ plaintext: new Uint8Array(32).fill(5), value: null }));
    expect(await both((h) => h.updateColdRecord("identity", proof, (r) => ({ plaintext: null, value: r.reading === "opens" ? [...r.plaintext] : r.reading })))).toEqual({ value: new Array(32).fill(5) });
    expect(await both((h) => h.openColdRecord("identity", proof, (p) => [...p]))).toEqual({ value: new Array(32).fill(5) });
  });

  test("a locked pūlama answers the vessel as a locked holder answers: rows refuse CustodyLocked, a locked face FaceLocked", async () => {
    const { fx: f, face, remote } = await stand();
    await f.kept.lockFace(face.fcid);
    await expect(remote.writeRecord("identity", faceAtomGroupFile(GROUP), bytes(1))).rejects.toBeInstanceOf(FaceLocked);
    expect(await remote.readRecord("identity", faceAtomGroupFile(GROUP))).toEqual({ reading: "locked", fcid: face.fcid });
    await f.local.writeRecord("identity", HOT, bytes(1));
    await f.local.updateRecord("identity", HOT, () => ({ plaintext: bytes(0xff), value: null }));
    // A row that stands and does not open names what stands, across the channel, as the same class.
    const torn = remote.updateRecord("identity", HOT, (r) => { if (r.reading === "unavailable") throw new CustodyRecordUnavailable("identity", HOT, r.why); return { plaintext: null, value: r.reading }; });
    await expect(torn).resolves.toBe("opens");
    await f.server.lock();
    expect(remote.isUnlocked()).toBe(false);
    expect(await remote.readRecord("identity", HOT)).toEqual({ reading: "locked" });
    await expect(remote.writeRecord("identity", HOT, bytes(2))).rejects.toBeInstanceOf(CustodyLocked);
    expect(() => remote.derive(FLOOR_REST_KEY_INFO)).toThrow(CustodyLocked);
  });
});
