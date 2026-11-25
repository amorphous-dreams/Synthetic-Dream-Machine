/**
 * vault-unlock-five-tries — the CLI's unlock lines speak the attempt budget's climb (operator, 2026-11-23): calm on the first
 * two misses, CAREFUL on the third, LAST TRY on the fourth, SPENT on the fifth; each names the tries left, the burn and the road
 * back. A face's refusal carrying its own count climbs the same way.
 */
import { describe, expect, test } from "vitest";
import { ATTEMPT_BUDGET } from "@lararium/mesh/attempt-budget";
import { unlockLine } from "../src/commands/vault.js";

const miss = (attemptsLeft: number): string => unlockLine({ op: "unlock", reading: "no-slot-opens", attemptsLeft, warning: "", standing: "herm" });

describe("the unlock line climbs", () => {
  test("misses 1-2 calm, 3 CAREFUL, 4 LAST TRY, 5 SPENT; every line names the tries left and the restart road", () => {
    const lines = [1, 2, 3, 4, 5].map((failed) => miss(ATTEMPT_BUDGET - failed));
    expect(lines[0]).toContain("4 of 5 tries remain");
    expect(lines[0]).not.toMatch(/CAREFUL|LAST TRY|SPENT/);
    expect(lines[1]).not.toMatch(/CAREFUL|LAST TRY|SPENT/);
    expect(lines[2]).toMatch(/CAREFUL/);
    expect(lines[3]).toMatch(/LAST TRY/);
    expect(lines[4]).toMatch(/SPENT/);
    for (const line of lines) {
      expect(line).toContain("lares vessel stand --restart");
      expect(line).toMatch(/until (the vessel|it) restarts/);
    }
  });

  test("an answer naming no count reads unknown, never a full budget", () => {
    const line = unlockLine({ op: "unlock", reading: "no-slot-opens", standing: "herm" });
    expect(line).toMatch(/named no count of tries left/);
    expect(line).not.toMatch(/of 5 tries remain/);
  });

  test("the spent reading names zero tries left; CONTROL: a face refusal with no count stays plain", () => {
    expect(unlockLine({ op: "unlock", reading: "attempts-spent", attemptsLeft: 0, standing: "herm" })).toMatch(/SPENT: 0 of 5 tries remain/);
    expect(unlockLine({ op: "unlock", reading: "face-refused", face: 1, faceReading: "no-slot-opens", standing: "herm" })).not.toMatch(/tries remain/);
    expect(unlockLine({ op: "unlock", reading: "face-refused", face: 1, faceReading: "no-slot-opens", attemptsLeft: 2, standing: "herm" })).toMatch(/CAREFUL: 3 misses now, and 2 of 5 tries remain/);
  });
});
