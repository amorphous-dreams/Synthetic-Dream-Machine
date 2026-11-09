import { publicIslandFixture } from "./public-share-fixture.js";
/**
 * face-switch-mid-compose — slice 5b's B8 red: an ask an island began under face A and resumes after the vessel switched to
 * face B never reaches B, and never answers as A's either.
 *
 * THE HAZARD the one composer carries: an island's ask reads its member off the record at ask time (`answerCustodyWrite`,
 * `answerSessionSign`) and may hold it across an await. A switch locks A's lift (its dispose) and composes B's over the same
 * record. The node's host custody writer resolves its face at call time (`custodyWriteGroup`, open-node-vessel.ts), and the
 * node's lift drop runs nothing (each session's signer drops at its own lock), so a member A's lift seated, called after A's
 * lock, writes into B's custody and signs with a session the lock already ended. The cure fences each member the lift seats:
 * once the lift locks, a call refuses `lift-locked` before it enters the host, and an answer that settles after the lock
 * refuses the same way.
 *
 *   F1  RED: a custody write held from A's record and resumed after the switch refuses `lift-locked`; B's custody takes no row.
 *   F2  RED: a session sign held from A's record and resumed after the switch refuses `lift-locked`; no signer signs.
 *   F3  RED: a sign that entered A's door before the switch and settles after it answers `lift-locked`, never A's signature.
 *   F0  CONTROL: after the switch the record answers for B (its write lands under B, its booked call signs), and an A call that
 *       settles before the lock answers as A's.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b; row B8)
 */
import { describe, expect, test } from "vitest";
import { composeVessel } from "../src/cap-compose.js";
import { islandFloorStack, islandLiftStack, larVesselOf, type LarVessel } from "../src/lar-vessel.js";
import { answerCustodyWrite, answerSessionSign, type CasFetcher, type CustodyWriter, type ReceiptIssuer } from "../src/capability-record.js";
import { SessionSignBook, type BookedSessionSigner } from "../src/session-sign-book.js";
import type { SessionOwnChain } from "../src/island-protocol.js";

const bytes = (s: string) => new TextEncoder().encode(s);
const cas: CasFetcher = async () => null;
const receipt: ReceiptIssuer = async () => {};
const CHAIN: SessionOwnChain = { scope: { faceKey: "aa".repeat(32), nexus: "nexus-one" }, vesselFaceKey: "bb".repeat(32) };

/** A deferred the test holds: the product's own await, released by the test's hand, never by a clock. */
function held<T = void>(): { promise: Promise<T>; release: (v: T) => void } {
  let release!: (v: T) => void;
  const promise = new Promise<T>((r) => { release = r; });
  return { promise, release };
}

/** A session signer that counts what it signs; `gate`, when set, holds the sign open until the test releases it. */
function signer(face: string) {
  const s = {
    face, signed: 0, gate: null as Promise<void> | null, entered: held(),
    certificate: { scope: CHAIN.scope, vesselFaceKey: CHAIN.vesselFaceKey },
    async sign(_p: "act", payload: Uint8Array): Promise<{ signature: string } | { refusal: string }> {
      s.entered.release();
      if (s.gate) await s.gate;
      s.signed += 1;
      return { signature: `sig-${face}-${payload.length}` };
    },
  };
  return s as typeof s & BookedSessionSigner;
}

/**
 * The node-shaped host: ONE custody writer that resolves the worn face at call time (the `custodyWriteGroup` cell), and a
 * lift whose drop runs nothing. Each face's lift books one call under its own session.
 */
function nodeHost() {
  const worn = { face: "G-A" };
  const rows: string[] = [];
  const hostWrite: CustodyWriter = async () => { rows.push(worn.face); };
  const liftOf = (face: string) => {
    const book = new SessionSignBook();
    const s = signer(face);
    book.hold("call-1", "sealed-seal", { signer: s, anchor: { kind: "nexus" }, subject: `subject-${face}` });
    return { s, lift: { face, custodyWrite: hostWrite, sessionSign: book.door(() => CHAIN), drop: () => {} } };
  };
  return { worn, rows, liftOf };
}

async function floor(): Promise<LarVessel> {
  return larVesselOf(await composeVessel(islandFloorStack({ ...publicIslandFixture, receipt, cas })));
}

/** The switch, as the vessel runs it: A's lift locks, the worn face moves, and B's lift composes over the same record. */
async function switchToB(host: ReturnType<typeof nodeHost>, vessel: LarVessel, a: { dispose(): Promise<void> }) {
  await a.dispose();
  host.worn.face = "G-B";
  const b = host.liftOf("G-B");
  const composed = await composeVessel(islandLiftStack(vessel, b.lift));
  return { b, composed };
}

const SIGN = { op: "sign" as const, ask: "call-1", verb: "sealed-seal", payload: bytes("seal") };

describe("B8: an ask begun under face A never reaches face B", () => {
  test("F0 CONTROL: after the switch the record answers for B, and an A call settled before the lock answers as A's", async () => {
    const host = nodeHost();
    const vessel = await floor();
    const a = host.liftOf("G-A");
    const la = await composeVessel(islandLiftStack(vessel, a.lift));
    expect((await answerCustodyWrite(vessel.record, { requestId: "c0", carrier: "veil", bytes: bytes("veil") })).written).toBe(true);
    expect(await answerSessionSign(vessel.record, { requestId: "s0", ...SIGN })).toMatchObject({ signature: "sig-G-A-4" });
    const { b, composed } = await switchToB(host, vessel, la);
    expect(vessel.liftedFace()).toBe("G-B");
    expect((await answerCustodyWrite(vessel.record, { requestId: "c1", carrier: "veil", bytes: bytes("veil") })).written).toBe(true);
    expect(await answerSessionSign(vessel.record, { requestId: "s1", ...SIGN })).toMatchObject({ signature: "sig-G-B-4" });
    expect(host.rows).toEqual(["G-A", "G-B"]);
    expect([a.s.signed, b.s.signed]).toEqual([1, 1]);
    await composed.dispose();
  });

  test("F1 RED: a custody write held from A's record and resumed after the switch refuses `lift-locked`; B takes no row", async () => {
    const host = nodeHost();
    const vessel = await floor();
    const la = await composeVessel(islandLiftStack(vessel, host.liftOf("G-A").lift));
    const heldWrite = vessel.record.custodyWrite!;   // the island's ask read its member under A
    const { composed } = await switchToB(host, vessel, la);
    await expect(heldWrite("veil", bytes("A's veil"))).rejects.toThrow(/lift-locked/);
    expect(host.rows, "A's write landed in B's custody").toEqual([]);
    await composed.dispose();
  });

  test("F2 RED: a session sign held from A's record and resumed after the switch refuses `lift-locked`; no signer signs", async () => {
    const host = nodeHost();
    const vessel = await floor();
    const a = host.liftOf("G-A");
    const la = await composeVessel(islandLiftStack(vessel, a.lift));
    const heldSign = vessel.record.sessionSign!;
    const { b, composed } = await switchToB(host, vessel, la);
    expect(await heldSign(SIGN)).toEqual({ refusal: "lift-locked" });
    expect(await heldSign({ op: "read", ask: "call-1", verb: "sealed-seal" })).toEqual({ refusal: "lift-locked" });
    expect([a.s.signed, b.s.signed], "a locked lift's door signed").toEqual([0, 0]);
    await composed.dispose();
  });

  test("F3 RED: a sign that entered A's door before the switch and settles after it answers `lift-locked`", async () => {
    const host = nodeHost();
    const vessel = await floor();
    const a = host.liftOf("G-A");
    const gate = held();
    a.s.gate = gate.promise;
    const la = await composeVessel(islandLiftStack(vessel, a.lift));
    const inFlight = answerSessionSign(vessel.record, { requestId: "s-flight", ...SIGN });
    await a.s.entered.promise;                        // the sign stands inside A's signer
    const { b, composed } = await switchToB(host, vessel, la);
    gate.release();
    expect(await inFlight).toEqual({ type: "session:signed", requestId: "s-flight", refusal: "lift-locked" });
    expect(b.s.signed).toBe(0);
    await composed.dispose();
  });
});
