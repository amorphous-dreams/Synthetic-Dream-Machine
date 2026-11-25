/**
 * ask-routes-five — every browser unlock (the boot's stand, a session's own unlock, a face's own unlock in vessel-sessions)
 * asks through one loop, `askRoutes`, whose default counts five (operator, 2026-11-23). Runs in Node: the loop reads no keystore.
 *
 *   A1  with no count passed, five misses spend it and a sixth ask never comes; the spent reading carries 0 and the spent words.
 *   A2  the asks climb: none on the first, calm on the second and third, CAREFUL on the fourth, LAST TRY on the fifth.
 *   CONTROL: the right route on the fifth ask opens, and a decline stops the asks.
 */
import { describe, expect, test } from "vitest";
import { ATTEMPT_BUDGET } from "@lararium/mesh/attempt-budget";
import { type Credential } from "@lararium/mesh/keyslot-door";
import { askRoutes, type RouteAsk } from "../src/browser-boot-custody.js";

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const opener = (right: string) => async (route: Credential) =>
  route.kind === "passphrase" && route.passphrase === right ? { opened: true as const, value: "key" } : { opened: false as const, notes: [] };

describe("one ask loop, five tries", () => {
  test("A1+A2 five misses spend the default budget, never four, and the asks climb", async () => {
    const asks: RouteAsk[] = [];
    const asked = await askRoutes({ ask: async (q) => { asks.push(q); return pass("wrong"); }, open: opener("right") });
    expect(asks.map((q) => q.attempt)).toEqual([1, 2, 3, 4, 5]);
    expect(asks.every((q) => q.of === ATTEMPT_BUDGET)).toBe(true);
    expect(asks[0]!.warning).toBeUndefined();
    expect(asks[1]!.warning).toContain("4 of 5 tries remain");
    expect(asks[2]!.warning).not.toMatch(/CAREFUL|LAST TRY/);
    expect(asks[3]!.warning).toMatch(/^CAREFUL/);
    expect(asks[4]!.warning).toMatch(/^LAST TRY/);
    expect(asked).toMatchObject({ reading: "no-slot-opens", attempts: 5, attemptsLeft: 0 });
    expect((asked as { warning: string }).warning).toMatch(/^SPENT/);
  });

  test("CONTROL: the right route on the fifth ask opens; a decline stops the asks", async () => {
    let n = 0;
    expect(await askRoutes({ ask: async () => pass(++n === 5 ? "right" : "wrong"), open: opener("right") })).toMatchObject({ reading: "opens", value: "key" });
    let asked = 0;
    expect(await askRoutes({ ask: async () => (++asked === 2 ? null : pass("wrong")), open: opener("right") })).toEqual({ reading: "declined" });
    expect(asked).toBe(2);
  });
});
