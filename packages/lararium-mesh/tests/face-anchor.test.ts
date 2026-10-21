/**
 * face-anchor — the sealed identity anchor. Reds: a forged selector, a coherent valid foreign bundle and a
 * missing anchor each refuse by name; the frontier never falls. Controls: the pinned face passes; a raise lifts.
 */
import { describe, expect, test } from "vitest";
import { checkFacePins, leaseEpochUnderAnchor, mintFaceAnchor, raiseFaceFrontier, readFaceAnchor } from "../src/face-anchor.js";

const edge = { deviceVerifyingKey: "aa", boundEpoch: 3 };
const mine = { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge, leaseEpoch: 3 };
const anchor = mintFaceAnchor(mine);

describe("face-anchor", () => {
  test("CONTROL: the pinned face passes every check, and the row round-trips", () => {
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge })).toEqual({ ok: true });
    expect(readFaceAnchor(JSON.parse(JSON.stringify(anchor)))).toEqual(anchor);
  });

  test("RED: a missing anchor refuses by name", () => {
    expect(checkFacePins(null, { personaGroup: "g-mine" })).toEqual({ ok: false, refusal: "anchor-missing" });
  });

  test("RED: a forged selector row names another group or prefix and switches no pinned face", () => {
    expect(checkFacePins(anchor, { personaGroup: "g-other" })).toEqual({ ok: false, refusal: "group" });
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-other" })).toEqual({ ok: false, refusal: "kel-prefix" });
  });

  test("RED: a coherent valid foreign bundle (its own group, prefix, root and edge) is refused", () => {
    const foreign = { personaGroup: "g-other", personaKelPrefix: "kel-other", personaRootDid: "did:key:root-other", edge: { deviceVerifyingKey: "bb", boundEpoch: 9 } };
    expect(checkFacePins(anchor, foreign).ok).toBe(false);
    // even with the selectors forged to match, the root and edge still name another face
    expect(checkFacePins(anchor, { ...foreign, personaGroup: "g-mine", personaKelPrefix: "kel-mine" })).toEqual({ ok: false, refusal: "root" });
    expect(checkFacePins(anchor, { personaGroup: "g-mine", personaKelPrefix: "kel-mine", personaRootDid: "did:key:root-mine", edge: foreign.edge })).toEqual({ ok: false, refusal: "edge" });
  });

  test("RED: the frontier never falls: a stale or replayed observation lowers nothing", () => {
    const raised = raiseFaceFrontier(anchor, { leaseEpoch: 7, actSeq: 2, actCid: "c2" });
    expect(raised.frontier).toEqual({ leaseEpoch: 7, actSeq: 2, actCid: "c2" });
    expect(raiseFaceFrontier(raised, { leaseEpoch: 3, actSeq: 0, actCid: "c0" })).toBe(raised);
    expect(raiseFaceFrontier(raised, {})).toBe(raised);
    expect(leaseEpochUnderAnchor(raised, 3)).toEqual({ epoch: 7, refusal: "frontier-falls" });
    expect(leaseEpochUnderAnchor(raised, 8)).toEqual({ epoch: 8, refusal: null });
  });

  test("a torn row reads null, never a partial anchor", () => {
    expect(readFaceAnchor({ ...anchor, frontier: { leaseEpoch: -1, actSeq: -1, actCid: null } })).toBeNull();
    expect(readFaceAnchor({ ...anchor, frontier: { leaseEpoch: 1, actSeq: 0, actCid: null } })).toBeNull();
    expect(readFaceAnchor(null)).toBeNull();
  });
});
