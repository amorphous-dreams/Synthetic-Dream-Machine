/**
 * lock-receipt — a lock whose answer closed with the composition it left confirms itself by a fresh census.
 *
 *   K1  a face's lock reads confirmed once a composition sits and the face stands out of the lit set; the reads past
 *       "recomposing" and a closed line wait.
 *   K2  the vessel's lock reads confirmed where the census reads it locked.
 *   K3  a census that still lists the face lit, or no census at all, leaves the lock unconfirmed.
 */
import { describe, expect, test } from "vitest";
import { confirmLockByCensus } from "../src/lock-receipt.js";

const reads = (...answers: Array<Record<string, unknown> | null>) => {
  let i = 0;
  return async () => answers[Math.min(i++, answers.length - 1)] ?? null;
};
const noPause = async () => {};

describe("the lock's receipt by census", () => {
  test("K1 a face's lock confirms once a composition sits and the face stands out of the lit set", async () => {
    const out = await confirmLockByCensus(1, reads(null, { op: "census", standing: "recomposing" }, { op: "census", standing: "herm", locked: false, facesLit: [0] }), noPause);
    expect(out).toMatchObject({ confirmed: true });
  });
  test("K2 the vessel's lock confirms where the census reads it locked", async () => {
    expect(await confirmLockByCensus(undefined, reads({ op: "census", standing: "herm", locked: true }), noPause)).toMatchObject({ confirmed: true });
  });
  test("K3 a face still lit, or no census at all, leaves the lock unconfirmed", async () => {
    expect(await confirmLockByCensus(1, reads({ op: "census", standing: "hearth", locked: false, facesLit: [1] }), noPause)).toMatchObject({ confirmed: false });
    expect(await confirmLockByCensus(1, reads(null), noPause, 3)).toEqual({ confirmed: false, census: null });
  });
});
