/**
 * device-removal through the REAL custody door — the removal's second signature (a certificate withdrawal) runs
 * through `nodeFaceKeyCustody.signAsFace` over a face proof key that rests sealed and cold on a scratch root.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/reach · lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withdrawForRemoval, foldWithdrawals, FACE_KEY_RESTS_ELSEWHERE, type FaceScope, type WithdrawalMemory } from "@lararium/mesh";
import { storeFaceProofKey, nodeFaceKeyCustody } from "../src/face-key-custody.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const publicOf = (secret: Uint8Array): string => {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]);
  return Buffer.from((createPublicKey(createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
};
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);
const memoryOf = (scope: FaceScope): WithdrawalMemory => {
  const fold = foldWithdrawals(scope, []);
  if (!("memory" in fold)) throw new Error("fixture: the history did not fold");
  return fold.memory;
};

const FACE_SECRET = secretOf(5);
const held = { faceKey: publicOf(FACE_SECRET), nexus: "nexus-" + "ab".repeat(32) } as unknown as FaceScope;
const cold = { faceKey: publicOf(secretOf(9)), nexus: "nexus-" + "cd".repeat(32) } as unknown as FaceScope;
const deviceFaceKey = publicOf(secretOf(77));

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("device-removal"); });
afterEach(async () => { await c.drop(); });

describe("the removal's second signature runs through the vessel's own custody door", () => {
  test("a withdrawal signed by the sealed face proof key verifies as the face's own, and a scope with no row reads unsigned by name", async () => {
    await storeFaceProofKey(held, FACE_SECRET, 2);
    const report = await withdrawForRemoval([
      { vesselFaceKey: deviceFaceKey, history: memoryOf(held), custody: nodeFaceKeyCustody },
      { vesselFaceKey: deviceFaceKey, history: memoryOf(cold), custody: nodeFaceKeyCustody },   // no row rests here for it
      { vesselFaceKey: deviceFaceKey, history: memoryOf(cold), custody: null },
    ]);
    expect(report.signed.map((s) => s.scope)).toEqual([held]);
    expect(report.signed[0]!.event.position).toBe(1);
    // The event folds under the face key alone: a reader that verifies every signature keeps it as a denial.
    const learned = foldWithdrawals(held, [report.signed[0]!.event]);
    expect("memory" in learned && learned.memory.denied).toHaveLength(1);
    expect(report.unsigned).toHaveLength(2);
    expect(report.unsigned[0]!.scope).toEqual(cold);
    expect(report.unsigned[0]!.why).toMatch(/^custody-refused: /);
    expect(report.unsigned[1]).toEqual({ scope: cold, why: FACE_KEY_RESTS_ELSEWHERE });
  });
});
