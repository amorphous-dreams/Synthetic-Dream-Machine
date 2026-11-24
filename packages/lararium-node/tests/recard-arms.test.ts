/**
 * recard-arms — an arm never outlives the act that armed it.
 *
 *   A1  a light TAKES its arm as it starts: a light whose proof fails spends it, and the next ordinary light recards nothing.
 *   A2  a face's close, drop or hold, and a whole lock, clear an arm no light took.
 */
import { describe, expect, test } from "vitest";
import { armedLight, recardArms } from "../src/recard-arms.js";

describe("the recard's arm", () => {
  test("A1 armed, the proof fails once, and the next ordinary light does not recard", async () => {
    const arms = recardArms();
    arms.arm(2);
    const seen: boolean[] = [];
    // The light reads its arm, then its proof fails (a custody read, joinedFaceAuth, or `live()`): it throws.
    await expect(armedLight(arms, 2, async (recard) => { seen.push(recard); throw new Error("face h2 stands shut, or proves nothing here"); })).rejects.toThrow("proves nothing");
    expect(arms.armed(2)).toBe(false);
    await armedLight(arms, 2, async (recard) => { seen.push(recard); });
    expect(seen).toEqual([true, false]);
  });

  test("A2 a close, a drop, a hold or a whole lock clears an arm no light took; another face's arm stands", () => {
    const arms = recardArms();
    arms.arm(1); arms.arm(2);
    arms.clear(2);
    expect([arms.armed(1), arms.armed(2)]).toEqual([true, false]);
    arms.arm(2);
    arms.clearAll();
    expect([arms.armed(1), arms.armed(2)]).toEqual([false, false]);
  });
});
