/**
 * promote-verbs — the store door names the promote and kapae rows: each rides a face (it acts as the worn face), the hand-only set
 * carries its own refusal codes, and the prepare, flag and list rows stay open to a seat.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { expect, test } from "vitest";
import { PROMOTE_HAND_CODES, STORE_DOOR_FACE_ROWS, STORE_DOOR_VERBS, KAHUA_OPERATOR_ROWS } from "../src/store-door-verbs.js";

const ROWS = ["promote-prepare", "promote-commit", "promote-drop", "promote-orphan", "promote-list", "kapae-raise", "kapae-lower", "kapae-flag"] as const;

test("RED: every promote and kapae row is a store-door verb that acts as a face; CONTROL: the kahua rows stay as they stood", () => {
  for (const row of ROWS) {
    expect(STORE_DOOR_VERBS as readonly string[], row).toContain(row);
    expect(STORE_DOOR_FACE_ROWS.has(row as never), row).toBe(true);
  }
  expect(KAHUA_OPERATOR_ROWS).toEqual(new Set(["kahua-mint", "kahua-lift", "kahua-withdraw", "kahua-carry"]));
});

test("RED: the hand-only rows carry `promote-needs-hand` or `kapae-needs-hand`; CONTROL: prepare, flag and list are not hand-only", () => {
  expect(Object.fromEntries(PROMOTE_HAND_CODES)).toEqual({
    "promote-commit": "promote-needs-hand", "promote-drop": "promote-needs-hand", "promote-orphan": "promote-needs-hand",
    "kapae-raise": "kapae-needs-hand", "kapae-lower": "kapae-needs-hand",
  });
  for (const open of ["promote-prepare", "kapae-flag", "promote-list"]) expect(PROMOTE_HAND_CODES.has(open)).toBe(false);
});
