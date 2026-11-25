/**
 * ward-attempts-five — the page's ward bound counts five (operator, 2026-11-23), derived from the one constant, and each miss
 * carries the tries left and the climbing words. Runs in Node: the charge reads no keystore.
 *
 *   W1  four misses leave the ward open to a fifth try; the fifth miss spends it, and the next act refuses unrun.
 *   W2  each miss keeps its reading `ward-no-slot-opens` and carries `attemptsLeft` 4, 3, 2, 1, 0; the words climb at 3, 4, 5.
 *   CONTROL: an act that opens earns its charge back; another keystore's count stands apart.
 */
import { describe, expect, test } from "vitest";
import { ATTEMPT_BUDGET } from "@lararium/mesh/attempt-budget";
import { WardRefused } from "@lararium/mesh/ward-slots";
import { chargeWardAttempt, WARD_ATTEMPTS_PER_PAGE } from "../src/browser-ward-tree.js";

let serial = 0;
const store = (): string => `lares:test-ward-five:${serial++}`;
const miss = (): Promise<never> => Promise.reject(new WardRefused("ward-no-slot-opens", "the route opens no slot of this face's ward"));

describe("the page ward counts five", () => {
  test("the page bound derives from the one constant", () => {
    expect(WARD_ATTEMPTS_PER_PAGE).toBe(ATTEMPT_BUDGET);
    expect(WARD_ATTEMPTS_PER_PAGE).toBe(5);
  });

  test("W1+W2 the fifth miss spends the ward, never the fourth; each miss carries the tries left and climbing words", async () => {
    const idb = store();
    const refusals: WardRefused[] = [];
    for (let i = 0; i < 5; i++) refusals.push(await chargeWardAttempt(idb, miss).then(() => { throw new Error("opened"); }, (e: WardRefused) => e));
    expect(refusals.map((r) => r.reading)).toEqual(Array(5).fill("ward-no-slot-opens"));
    expect(refusals.map((r) => r.attemptsLeft)).toEqual([4, 3, 2, 1, 0]);
    expect(refusals[1]!.message).not.toMatch(/CAREFUL|LAST TRY/);
    expect(refusals[2]!.message).toMatch(/CAREFUL/);
    expect(refusals[3]!.message).toMatch(/LAST TRY/);
    expect(refusals[4]!.message).toMatch(/SPENT/);
    let ran = false;
    await expect(chargeWardAttempt(idb, async () => { ran = true; })).rejects.toMatchObject({ reading: "ward-attempts-spent", attemptsLeft: 0 });
    expect(ran).toBe(false);
  });

  test("CONTROL: after four misses an act that opens runs, and earns its charge back", async () => {
    const idb = store();
    for (let i = 0; i < 4; i++) await chargeWardAttempt(idb, miss).catch(() => undefined);
    expect(await chargeWardAttempt(idb, async () => "signed")).toBe("signed");
    await expect(chargeWardAttempt(idb, miss)).rejects.toMatchObject({ attemptsLeft: 0 });
    expect(await chargeWardAttempt(store(), async () => "other")).toBe("other");
  });
});
