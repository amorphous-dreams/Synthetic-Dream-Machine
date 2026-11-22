/**
 * lit-relation — a stage read names a face's relation only while the lit set would count that face: its actor reads lit, and a
 * sibling's own place session stands.
 */
import { expect, test } from "vitest";
import { provedLitRelation } from "../src/lit-relation.js";

const R0 = "00000000-0000-4000-8000-000000000000", R1 = "11111111-1111-4111-8111-111111111111";
const at = (lit: readonly number[], session = true) => ({
  mount: 0, wornRelation: R0, siblings: [{ ordinal: 1, relation: R1, session }], lit: (o: number) => lit.includes(o),
});

test("RED: a sibling whose session has not stood, a face closing (its actor no longer lit), or a worn face that closed names no relation", () => {
  expect(provedLitRelation(1, at([0, 1], false))).toBeNull();
  expect(provedLitRelation(1, at([0]))).toBeNull();
  expect(provedLitRelation(0, at([1]))).toBeNull();
});

test("CONTROL: the lit worn face and a lit sibling with its session standing name their relations; a face never held names none", () => {
  expect(provedLitRelation(0, at([0, 1]))).toBe(R0);
  expect(provedLitRelation(1, at([0, 1]))).toBe(R1);
  expect(provedLitRelation(2, at([0, 1, 2]))).toBeNull();
});
