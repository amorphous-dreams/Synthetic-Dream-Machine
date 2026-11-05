/**
 * face-relation-stance — F reads from the face's VERIFIED founding record, so a composition that holds the persona plane
 * but has not proven the face yet (a locked key, a joinee still syncing) mirrors no private kahua layer; a PROVEN face that
 * carries no F refuses by name. CI 41579915399 died on the first reading: a locked staged boot named a persona plane and no
 * proof, and `openDaemonVm` refused with "worn face requires faceRelation" before the daemon went live.
 *
 * Reds: the unproven stance (plane, no proof) answers `unproven` and throws nothing; a proven face without F throws by name.
 * Controls: no plane answers `no-face`; a proven face with F answers `worn`.
 */
import { describe, expect, test } from "vitest";
import { faceRelationStance } from "../src/open-daemon-vm.js";

const F = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
const PLANE = "lar:///ha.ka.ba/bags/persona-2a1f0c9e4b7d";

describe("the folder stance", () => {
  test("RED: a persona plane with no proof yet answers unproven and does not throw", () => {
    expect(faceRelationStance({ personaBagId: PLANE })).toBe("unproven");
    expect(faceRelationStance({ personaBagId: PLANE, faceRelation: null, faceGroup: null })).toBe("unproven");
  });
  test("RED: a proven face (its group named) that carries no F refuses by name", () => {
    expect(() => faceRelationStance({ personaBagId: PLANE, faceGroup: "g1", faceRelation: null })).toThrowError(/worn face requires faceRelation/);
  });
  test("CONTROL: no plane answers no-face; a proven face with F answers worn", () => {
    expect(faceRelationStance({})).toBe("no-face");
    expect(faceRelationStance({ personaBagId: PLANE, faceGroup: "g1", faceRelation: F })).toBe("worn");
  });
});
