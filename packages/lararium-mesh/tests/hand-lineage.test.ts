/**
 * hand-lineage — rosters per epoch, built or refused. Controls: a climbing lineage builds, and a charter lineage
 * binds to its verified seal-epoch chain. Reds: a gap, a threshold past the seats, duplicate seats and a charter
 * whose epoch names another roster each return null.
 */
import { describe, expect, test } from "vitest";
import { currentRoster, makeHandLineage, rosterAt } from "../src/hand-lineage.js";

describe("hand-lineage", () => {
  test("CONTROL: a climbing lineage builds and reads per epoch", () => {
    const l = makeHandLineage([{ epoch: 0, signers: ["aa"], threshold: 1 }, { epoch: 1, signers: ["bb"], threshold: 1 }])!;
    expect(rosterAt(l, 0)?.signers).toEqual(["aa"]);
    expect(rosterAt(l, 1)?.signers).toEqual(["bb"]);
    expect(rosterAt(l, 2)).toBeNull();
    expect(currentRoster(l).epoch).toBe(1);
  });
  test("RED: a gap, an unreachable threshold, duplicate seats and an empty lineage are refused", () => {
    expect(makeHandLineage([{ epoch: 0, signers: ["aa"], threshold: 1 }, { epoch: 2, signers: ["bb"], threshold: 1 }])).toBeNull();
    expect(makeHandLineage([{ epoch: 0, signers: ["aa"], threshold: 2 }])).toBeNull();
    expect(makeHandLineage([{ epoch: 0, signers: ["aa", "AA"], threshold: 1 }])).toBeNull();
    expect(makeHandLineage([])).toBeNull();
  });
  test("RED: a charter lineage must match a verified seal-epoch chain, hash for hash", () => {
    // a one-epoch chain whose key-set hash names another roster does not bind
    const fake = [{ epochCid: "e0", keySetHash: "not-this-roster", nextKeyDigests: [], nextThreshold: 1, predecessors: [] }];
    expect(makeHandLineage([{ epoch: 0, signers: ["aa"], threshold: 1 }], fake as never)).toBeNull();
  });
});
