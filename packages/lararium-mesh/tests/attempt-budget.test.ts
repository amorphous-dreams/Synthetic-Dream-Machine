/**
 * attempt-budget — five tries before any burn, and a warning that climbs from the third miss (operator, 2026-11-23:
 * "Bump 'three tries' to 5 in all cases in the security layers … the warning should get increasingly frantic at 3+").
 *
 * Proven here, each with its control:
 *   · ATTEMPT_BUDGET counts five, and one constant owns it (every budget in the security layers derives from it);
 *   · the tiers: misses 1-2 read calm, the 3rd alarms, the 4th names the last try, the 5th reads spent;
 *   · every tier names the tries left, what the burn does, and the recovery road; each tier's words differ from the one before.
 */
import { describe, expect, test } from "vitest";
import { ATTEMPT_ALARM_FROM, ATTEMPT_BUDGET, ATTEMPT_STAKES, attemptTier, attemptWarning } from "../src/attempt-budget.js";

const stakes = ATTEMPT_STAKES.vessel;

describe("the budget", () => {
  test("five tries, the alarm from the third miss", () => {
    expect(ATTEMPT_BUDGET).toBe(5);
    expect(ATTEMPT_ALARM_FROM).toBe(3);
  });

  test("the tiers by misses: 1-2 calm, 3 alarm, 4 last, 5 spent; CONTROL: no miss reads calm", () => {
    expect([0, 1, 2, 3, 4, 5].map((failed) => attemptTier(failed))).toEqual(["calm", "calm", "calm", "alarm", "last", "spent"]);
    expect(attemptTier(9)).toBe("spent");
  });
});

describe("the warning climbs", () => {
  const at = (failed: number): string => attemptWarning(ATTEMPT_BUDGET - failed, stakes);

  test("every tier names the tries left, the burn and the recovery road", () => {
    for (const failed of [1, 2, 3, 4]) {
      const left = ATTEMPT_BUDGET - failed;
      const line = at(failed);
      expect(line).toContain(`${left} of ${ATTEMPT_BUDGET}`);
      expect(line).toContain(stakes.burn);
      expect(line).toContain(stakes.recovery);
    }
    expect(at(5)).toContain(`0 of ${ATTEMPT_BUDGET}`);
    expect(at(5)).toContain(stakes.spent);
    expect(at(5)).toContain(stakes.recovery);
  });

  test("calm on misses 1-2, louder at 3, louder still at 4, spent at 5", () => {
    expect(at(1)).not.toMatch(/[A-Z]{4,}/);
    expect(at(2)).not.toMatch(/[A-Z]{4,}/);
    expect(at(3)).toMatch(/^CAREFUL/);
    expect(at(4)).toMatch(/^LAST TRY/);
    expect(at(5)).toMatch(/^SPENT/);
    expect(new Set([at(2), at(3), at(4), at(5)]).size).toBe(4);
  });

  test("CONTROL: a smaller budget keeps the same climb: its last try reads last, never alarm", () => {
    expect(attemptTier(1, 2)).toBe("last");
    expect(attemptTier(2, 2)).toBe("spent");
  });
});
