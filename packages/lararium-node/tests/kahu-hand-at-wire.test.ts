/**
 * kahu-hand-at-wire — the hearth's consult for Kahu reach at its wire (road `P26`), and the canon's document ids.
 *
 * A peer holds reach exactly where its session wears the face whose counted admission stood this vessel's canon,
 * proven same-operator, after that face's own proof. Written beside its cure (the mesh red, realm-bag-kahu-reach, holds
 * the behaviour); the parent carried no consult, so every row below reads as the composer's new wiring.
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, type AutomergeUrl } from "@automerge/automerge-repo";
import { deterministicDocUrl } from "@lararium/mesh";
import { kahuCanonDocIds, kahuHandAtWire } from "../src/kahu-realm.js";

const group = "0x" + "ab".repeat(32);
const lares = deterministicDocUrl("kahu-hand-lares") as AutomergeUrl, lararium = deterministicDocUrl("kahu-hand-lararium") as AutomergeUrl;
const canon = { lares, lararium };
const sameOp = (personaGroup: string) => ({ class: "same-operator", face: { personaGroup } });

describe("Kahu reach at the hearth's wire", () => {
  test("the custody face's own same-operator session holds reach once the face proved (case folds)", () => {
    expect(kahuHandAtWire({ session: sameOp(group.toUpperCase().replace("0X", "0x")), custodyGroup: group, faceProven: true, canon, kahuStanding: true })).toBe(true);
  });
  test("before the face proof, no session holds reach", () => {
    expect(kahuHandAtWire({ session: sameOp(group), custodyGroup: group, faceProven: false, canon, kahuStanding: true })).toBe(false);
  });
  test("a contracted member, a session of another face, and an unseated peer hold none", () => {
    expect(kahuHandAtWire({ session: { class: "contracted", face: null }, custodyGroup: group, faceProven: true, canon, kahuStanding: true })).toBe(false);
    expect(kahuHandAtWire({ session: sameOp("0x" + "cd".repeat(32)), custodyGroup: group, faceProven: true, canon, kahuStanding: true })).toBe(false);
    expect(kahuHandAtWire({ session: undefined, custodyGroup: group, faceProven: true, canon, kahuStanding: true })).toBe(false);
  });
  test("a vessel that stood no canon, or names no custody face, grants none", () => {
    expect(kahuHandAtWire({ session: sameOp(group), custodyGroup: group, faceProven: true, canon: {}, kahuStanding: true })).toBe(false);
    expect(kahuHandAtWire({ session: sameOp(group), custodyGroup: null, faceProven: true, canon, kahuStanding: true })).toBe(false);
  });
  test("the canon's document ids are the two live documents, and nothing else", () => {
    expect([...kahuCanonDocIds(canon)].sort()).toEqual([String(interpretAsDocumentId(lares)), String(interpretAsDocumentId(lararium))].sort());
    expect(kahuCanonDocIds({}).size).toBe(0);
  });
});
