/**
 * sense-hand-only — the sense lifecycle verbs that move what the house keeps (`promote`, `retire`, `un-retire`, `purge`) run on
 * a person's hand alone (hitl-reads-a-hand). The gate reads the hand a door read, never a value a caller fills: an `approve`
 * boolean, a truthy string or an operator-named cap each refuse `sense-needs-hand`. CONTROL: the hand a door read lands each
 * one, and the reads and the reversible re-settle stay open to every caller.
 */
import { describe, expect, test } from "vitest";
import { guardHitl, SENSE_HAND_CODES } from "../src/sensorium-lifecycle.js";

const HAND_ONLY = ["promote", "retire", "un-retire", "purge"] as const;

describe("a sense lifecycle verb that moves what the house keeps reads a hand", () => {
  test("RED: each hand-only verb names its code in the one table", () => {
    for (const verb of HAND_ONLY) expect(SENSE_HAND_CODES[verb], verb).toBe("sense-needs-hand");
  });

  for (const verb of HAND_ONLY) {
    test(`RED: ${verb} refuses a seat's boolean, a truthy string and no hand at all; CONTROL: the hand a door read lands it`, () => {
      for (const forged of [true, "1", "operator-hand", "operator-granted-cap", undefined]) {
        expect(() => guardHitl(verb, forged as never), `${verb} · ${String(forged)}`).toThrow(/sense-needs-hand/);
      }
      expect(() => guardHitl(verb, "hand")).not.toThrow();
    });
  }

  test("CONTROL: the reads and the reversible re-settle stay open to every caller", () => {
    for (const verb of ["roster", "inspect", "reconcile", "build"]) expect(() => guardHitl(verb)).not.toThrow();
  });

  test("RED: the refusal names the hand act to run on a real terminal", () => {
    expect(() => guardHitl("purge", true as never)).toThrow(/lares sense purge/);
  });
});
