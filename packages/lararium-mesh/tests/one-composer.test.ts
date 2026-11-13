/**
 * one-composer — slice 5b: the node and the browser compose their island record through the ONE `composeVessel`
 * (cap-compose), read it as the one `LarVessel`, and answer the same capability probes alike.
 *
 * THE SHAPE (the lead's measure at b81ba9b37): `composeVessel(stack)` stays the one composer. The carrier's
 * `substrate, floor, lifts` partition the stack each platform hands it: the substrate and the floor compose as one
 * vessel (`islandFloorStack` carries the record's floor members: receipt, cas, dyad), and a lift composes as its own
 * nested stack over that vessel (`islandLiftStack`: custodyWrite and sessionSign for one face, the nesting
 * `composeVerbPlane` already rides), so the lift's `dispose` IS the lock: both lift members leave the record, the
 * session's signer drops, and the floor stands on. `larVesselOf` reads the composed floor as one `LarVessel` (the
 * name `lar-vessel.ts` holds today for a kind-preset class nothing in production constructs; that class burns into
 * this record); roles read as predicates over its record (`stands`, `liftedFace`), never as a platform label.
 *
 *   P0  CONTROL: the probe reads both poles on today's record (a hand floor refuses the lift's asks, a hand lift answers).
 *   P1  RED (the carrier's red): a node-shaped and a browser-shaped floor compose through `composeVessel` and answer
 *       receipt, cas, custody:write and session:sign alike; the browser's absent dyad reads as `stands("dyad") === false`
 *       and an `aside` answer, never inferred from an optional argument.
 *   P2  RED: a lift over each floor answers custody:write for its face and session:sign for a booked call; its dispose
 *       (the lock) takes both back, drops the signer once, and leaves the floor answering as it did before the lift.
 *   P3  RED: one lift per record: a second lift while one stands refuses `lift-stands`; after the lock another face lifts,
 *       and the old lock run again takes nothing the new lift seated.
 *   P4  RED: both vessel shores compose through the one floor and lift stacks; no platform record composer survives.
 *   R2  RED (locked floor): each floor, composed with no lift and again after a lift's lock, refuses every session:sign op
 *       `signer-unavailable` and writes no custody. CONTROL: the admitted face's lift signs and writes.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slices 5a, 5b)
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeVessel, type CapModule, type ComposedVessel } from "../src/cap-compose.js";
import {
  answerCustodyWrite, answerDyad, answerReceipt, answerSessionSign,
  type CapabilityRecord, type CasFetcher, type CustodyWriter, type DyadReader, type ReceiptIssuer, type SessionSignDoor,
} from "../src/capability-record.js";
import { SessionSignBook, type BookedSessionSigner } from "../src/session-sign-book.js";
import type { SessionOwnChain } from "../src/island-protocol.js";

// ── the seam slice 5b builds in lar-vessel.ts (absent on its parent: each red names the missing export) ────────────
interface LarVesselRecord {
  readonly record: Readonly<CapabilityRecord>;
  stands(member: keyof CapabilityRecord): boolean;
  liftedFace(): string | null;
}
interface OneComposerSeam {
  islandFloorStack(floor: { receipt?: ReceiptIssuer; cas?: CasFetcher; dyad?: DyadReader }): CapModule[];
  islandLiftStack(vessel: LarVesselRecord, lift: { face: string; custodyWrite?: CustodyWriter; sessionSign: SessionSignDoor; drop: () => void }): CapModule[];
  larVesselOf(composed: ComposedVessel): LarVesselRecord;
}
const SEAM = "../src/lar-vessel.js";
async function seam(): Promise<OneComposerSeam> {
  const mod = (await import(/* @vite-ignore */ SEAM)) as Partial<OneComposerSeam>;
  const missing = (["islandFloorStack", "islandLiftStack", "larVesselOf"] as const).filter((name) => typeof mod[name] !== "function");
  if (missing.length > 0) throw new Error(`no one composer stands: lar-vessel exports no ${missing.join(", ")}`);
  return mod as OneComposerSeam;
}

// ── the two floors, shaped as each platform hands its own ──────────────────────────────────────────────────────────
const bytes = (s: string) => new TextEncoder().encode(s);
const cas: CasFetcher = async (cid) => (cid === "cid-held" ? bytes("held bytes") : null);
const receipt: ReceiptIssuer = async (ids) => { if (ids.includes("doc-unrested")) throw new Error("receipt-unissued: doc-unrested rests nowhere"); };
/** The node reads its fleet board on the vessel thread; the browser's island reads its own, so its floor carries no dyad. */
const nodeFloor = { receipt, cas, dyad: (() => "clear") as DyadReader };
const browserFloor = { receipt, cas };

const CHAIN: SessionOwnChain = { scope: { faceKey: "aa".repeat(32), nexus: "nexus-one" }, vesselFaceKey: "bb".repeat(32) };
function signer(): BookedSessionSigner & { drops: number; drop(): void } {
  const s = {
    dropped: false, drops: 0,
    certificate: { scope: CHAIN.scope, vesselFaceKey: CHAIN.vesselFaceKey },
    drop() { s.dropped = true; s.drops += 1; },
    async sign(_p: "act", payload: Uint8Array): Promise<{ signature: string } | { refusal: string }> {
      return s.dropped ? { refusal: "signer-dropped" } : { signature: `sig-${payload.length}` };
    },
  };
  return s;
}
/** One face's lift: its book with one booked call, its signer, and the custody rows it wrote (face-scoped). */
function liftOf(face: string) {
  const book = new SessionSignBook();
  const s = signer();
  book.hold("call-1", "sealed-seal", { signer: s, anchor: { kind: "nexus" }, subject: `subject-${face}` });
  const written: string[] = [];
  const custodyWrite: CustodyWriter = async () => { written.push(face); };
  return { s, written, lift: { face, custodyWrite, sessionSign: book.door(() => CHAIN), drop: () => s.drop() } };
}

const pick = (a: object): string =>
  "refusal" in a ? `refusal:${String((a as { refusal: unknown }).refusal)}` : "signature" in a ? "signature" : "certificate" in a ? "certificate" : "own";
/** The capability probes both vessels answer, normalised so two vessels compare by value. */
async function probe(record: Readonly<CapabilityRecord>) {
  const caps = record as CapabilityRecord;
  return {
    receipt:  (await answerReceipt(caps, { requestId: "r1", documentIds: ["doc-a"] })).issued,
    unrested: (await answerReceipt(caps, { requestId: "r2", documentIds: ["doc-unrested"] })).issued,
    cas:      record.cas ? new TextDecoder().decode((await record.cas("cid-held")) ?? new Uint8Array()) : "no-cas",
    casMiss:  record.cas ? await record.cas("cid-absent") : "no-cas",
    custody:  (await answerCustodyWrite(caps, { requestId: "c1", carrier: "veil", bytes: bytes("veil") })).written,
    signRead: pick(await answerSessionSign(caps, { requestId: "s1", op: "read", ask: "call-1", verb: "sealed-seal" })),
    signSign: pick(await answerSessionSign(caps, { requestId: "s2", op: "sign", ask: "call-1", verb: "sealed-seal", payload: bytes("x") })),
    signOwn:  pick(await answerSessionSign(caps, { requestId: "s3", op: "own", ask: "own", verb: "own" })),
  };
}
const dyadOf = async (record: Readonly<CapabilityRecord>) =>
  (await answerDyad(record as CapabilityRecord, { requestId: "d1", fleetRoot: "root", deviceKey: "dev" })).standing;

const LOCKED = { signRead: "refusal:signer-unavailable", signSign: "refusal:signer-unavailable", signOwn: "refusal:signer-unavailable", custody: false };
const FLOOR = { receipt: true, unrested: false, cas: "held bytes", casMiss: null, ...LOCKED };

describe("slice 5b: one composer, the same probes", () => {
  test("P0 CONTROL: the probe reads both poles on today's record", async () => {
    const floor: CapabilityRecord = { receipt, cas };
    expect(await probe(floor)).toEqual(FLOOR);
    const { lift } = liftOf("G-A");
    const lifted: CapabilityRecord = { receipt, cas, custodyWrite: lift.custodyWrite, sessionSign: lift.sessionSign };
    expect(await probe(lifted)).toMatchObject({ custody: true, signRead: "certificate", signSign: "signature", signOwn: "own" });
    expect(await dyadOf(floor)).toBe("aside");
    expect(await dyadOf({ dyad: () => "clear" })).toBe("clear");
  });

  test("P1 RED: a node-shaped and a browser-shaped floor compose through composeVessel and answer alike", async () => {
    const { islandFloorStack, larVesselOf } = await seam();
    const node = larVesselOf(await composeVessel(islandFloorStack(nodeFloor)));
    const browser = larVesselOf(await composeVessel(islandFloorStack(browserFloor)));
    expect(await probe(node.record)).toEqual(FLOOR);
    expect(await probe(browser.record)).toEqual(await probe(node.record));
    // The dyad's absence reads off the record by its own predicate, and the ask answers it: never an optional argument's guess.
    expect(node.stands("dyad")).toBe(true);
    expect(browser.stands("dyad")).toBe(false);
    expect(await dyadOf(node.record)).toBe("clear");
    expect(await dyadOf(browser.record)).toBe("aside");
  });

  test("P2 RED: a lift answers for its face, and its dispose (the lock) takes it back and leaves the floor as it stood", async () => {
    const { islandFloorStack, islandLiftStack, larVesselOf } = await seam();
    for (const floor of [nodeFloor, browserFloor]) {
      const vessel = larVesselOf(await composeVessel(islandFloorStack(floor)));
      const before = await probe(vessel.record);
      const a = liftOf("G-A");
      const lift = await composeVessel(islandLiftStack(vessel, a.lift));
      expect(vessel.liftedFace()).toBe("G-A");
      expect(vessel.stands("custodyWrite") && vessel.stands("sessionSign")).toBe(true);
      expect(await probe(vessel.record)).toMatchObject({ custody: true, signRead: "certificate", signSign: "signature" });
      expect(a.written).toEqual(["G-A"]);
      await lift.dispose();
      expect(vessel.liftedFace()).toBeNull();
      expect(vessel.stands("custodyWrite") || vessel.stands("sessionSign")).toBe(false);
      expect(a.s.drops).toBe(1);
      expect(await probe(vessel.record)).toEqual(before);
      await lift.dispose();
      expect(a.s.drops).toBe(1);
    }
  });

  test("P3 RED: one lift per record; after the lock another face lifts", async () => {
    const { islandFloorStack, islandLiftStack, larVesselOf } = await seam();
    const vessel = larVesselOf(await composeVessel(islandFloorStack(browserFloor)));
    const a = await composeVessel(islandLiftStack(vessel, liftOf("G-A").lift));
    await expect(composeVessel(islandLiftStack(vessel, liftOf("G-B").lift))).rejects.toThrow(/lift-stands/);
    expect(vessel.liftedFace()).toBe("G-A");
    await a.dispose();
    const b = liftOf("G-B");
    const lb = await composeVessel(islandLiftStack(vessel, b.lift));
    expect(vessel.liftedFace()).toBe("G-B");
    await a.dispose(); // the old lock run again takes nothing the new lift seated
    expect(vessel.liftedFace()).toBe("G-B");
    expect(await probe(vessel.record)).toMatchObject({ custody: true, signSign: "signature" });
    expect(b.written).toEqual(["G-B"]);
    await lb.dispose();
  });

  test("P4 RED: both vessel shores compose through the one floor and lift stacks", () => {
    const shores = ["../../lararium-node/src/open-node-vessel.ts", "../../lararium-browser/src/open-browser-vessel.ts"]
      .map((rel) => ({ rel, src: readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8") }));
    for (const { rel, src } of shores) {
      // The control half: each shore still hands its daemon island a record, so an absence below reads the cure.
      expect(src, `${rel} hands its island a record`).toMatch(/caps:\s*(p\.)?islandCaps/);
      expect(src, `${rel} composes its floor through the one stack`).toMatch(/islandFloorStack\(/);
      expect(src, `${rel} composes its lift through the one stack`).toMatch(/islandLiftStack\(/);
      for (const burnt of [/composeBrowserIslandCaps\(/, /liftBrowserIslandCaps\(/, /seatSessionSignLift\(/, /:\s*CapabilityRecord\s*=\s*\{\s*\}/]) {
        expect(src, `${rel} keeps a platform record composer (${burnt.source})`).not.toMatch(burnt);
      }
    }
  });
});

describe("R2: the locked floor opens and signs nothing", () => {
  test("CONTROL: the admitted face's lift signs a booked call and writes its custody", async () => {
    const { lift } = liftOf("G-A");
    const admitted: CapabilityRecord = { receipt, cas, custodyWrite: lift.custodyWrite, sessionSign: lift.sessionSign };
    expect(await probe(admitted)).toMatchObject({ custody: true, signSign: "signature" });
  });

  test("RED: each locked floor, composed and after a lift's lock, refuses every sign op and writes no custody", async () => {
    const { islandFloorStack, islandLiftStack, larVesselOf } = await seam();
    for (const floor of [nodeFloor, browserFloor]) {
      const vessel = larVesselOf(await composeVessel(islandFloorStack(floor)));
      expect(vessel.liftedFace()).toBeNull();
      expect(await probe(vessel.record)).toMatchObject(LOCKED);
      const a = liftOf("G-A");
      await (await composeVessel(islandLiftStack(vessel, a.lift))).dispose();
      expect(await probe(vessel.record)).toMatchObject(LOCKED);
      expect(a.written).toEqual([]);
      expect(a.s.dropped).toBe(true);
    }
  });
});
