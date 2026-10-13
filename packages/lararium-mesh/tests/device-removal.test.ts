/**
 * device-removal — the second act of removing one vessel: a certificate withdrawal for each face key the device
 * holds a certificate under, signed or reported by name.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/reach · lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  withdrawForRemoval, foldWithdrawals, FACE_KEY_RESTS_ELSEWHERE,
  type FaceKeyCustody, type FaceScope, type FaceWithdrawal, type WithdrawalMemory,
} from "../src/index.js";
import { checkFaceChain } from "../src/face-authority.js";
import { chain, history, type Pair } from "./face-proof-fixture.js";

const custodyOf = (by: Pair): FaceKeyCustody => ({ signAsFace: (_scope, image) => ed25519.signAsync(image, by.secret) });
function memoryOf(scope: FaceScope, events: readonly FaceWithdrawal[] = []): WithdrawalMemory {
  const fold = foldWithdrawals(scope, events);
  if (!("memory" in fold)) throw new Error("fixture: the history did not fold");
  return fold.memory;
}
const NEXUS_A = "a1".repeat(32), NEXUS_B = "b2".repeat(32);

describe("a device's removal signs one withdrawal for each face key it holds a certificate under", () => {
  test("two scopes take two withdrawals, and a gate that learns one refuses the device's chain there", async () => {
    const a = await chain("removal a", NEXUS_A), b = await chain("removal b", NEXUS_B);
    const report = await withdrawForRemoval([
      { vesselFaceKey: a.vessel.key, history: memoryOf(a.scope), custody: custodyOf(a.face) },
      { vesselFaceKey: b.vessel.key, history: memoryOf(b.scope), custody: custodyOf(b.face) },
    ]);
    expect(report.unsigned).toEqual([]);
    expect(report.signed.map((s) => s.scope)).toEqual([a.scope, b.scope]);
    expect(report.signed.every((s) => s.event.position === 1)).toBe(true);
    const gate = (memory: WithdrawalMemory) => checkFaceChain({
      admitted: a.scope, certificate: a.certificate, sessionCertificate: a.sessionCertificate,
      frontier: memory.frontier, carried: [], memory,
    }).verdict;
    expect(gate(memoryOf(a.scope))).toBe("verified");                 // CONTROL: a gate that learned no denial accepts
    expect(gate(report.signed[0]!.history)).toBe("withdrawn");
  });

  test("a face key that rests on another vessel gets no signature, and the report names that scope", async () => {
    const here = await chain("removal here", NEXUS_A), cold = await chain("removal cold", NEXUS_B);
    const report = await withdrawForRemoval([
      { vesselFaceKey: here.vessel.key, history: memoryOf(here.scope), custody: custodyOf(here.face) },
      { vesselFaceKey: cold.vessel.key, history: memoryOf(cold.scope), custody: null },
    ]);
    expect(report.signed.map((s) => s.scope)).toEqual([here.scope]);
    expect(report.unsigned).toEqual([{ scope: cold.scope, why: FACE_KEY_RESTS_ELSEWHERE }]);
  });

  test("a key the history already denies reads as standing, and a custody door that refuses reads unsigned by name", async () => {
    const c = await chain("removal again", NEXUS_A), locked = await chain("removal locked", NEXUS_B);
    const denied = memoryOf(c.scope, await history(c, [c.vessel.key]));
    const report = await withdrawForRemoval([
      { vesselFaceKey: c.vessel.key, history: denied, custody: custodyOf(c.face) },
      { vesselFaceKey: locked.vessel.key, history: memoryOf(locked.scope), custody: { signAsFace: async () => { throw new Error("the custody seat stands locked"); } } },
    ]);
    expect(report.signed).toEqual([]);
    expect(report.standing).toEqual([c.scope]);
    expect(report.unsigned).toEqual([{ scope: locked.scope, why: "custody-refused: the custody seat stands locked" }]);
  });

  test("a custody door that signs under another key leaves the scope unsigned", async () => {
    const c = await chain("removal astray", NEXUS_A), other = await chain("removal other", NEXUS_B);
    const report = await withdrawForRemoval([{ vesselFaceKey: c.vessel.key, history: memoryOf(c.scope), custody: custodyOf(other.face) }]);
    expect(report.signed).toEqual([]);
    expect(report.unsigned.map((u) => u.why)).toEqual(["custody-astray"]);
  });
  test("two certificates under one face key take two events on ONE line, the second a position past the first", async () => {
    const c = await chain("removal twice", NEXUS_A), second = await chain("removal twice other vessel", NEXUS_A);
    const start = memoryOf(c.scope);
    const report = await withdrawForRemoval([
      { vesselFaceKey: c.vessel.key, history: start, custody: custodyOf(c.face) },
      { vesselFaceKey: second.vessel.key, history: start, custody: custodyOf(c.face) },
    ]);
    expect(report.signed.map((s) => s.event.position)).toEqual([1, 2]);
    // The two events fold as one unforked history that denies both keys.
    const fold = foldWithdrawals(c.scope, report.signed.map((s) => s.event));
    expect("memory" in fold && fold.memory.denied.length).toBe(2);
    expect("memory" in fold && fold.memory.frontier.position).toBe(2);
  });
});
