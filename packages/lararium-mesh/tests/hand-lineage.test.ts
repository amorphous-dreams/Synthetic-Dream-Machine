/**
 * hand-lineage — rosters per epoch, built or refused. Controls: a climbing lineage builds, and a charter lineage
 * binds to its verified seal-epoch chain. Reds: a gap, a threshold past the seats, duplicate seats and a charter
 * whose epoch names another roster each return null.
 */
import { describe, expect, test } from "vitest";
import { bookSeat, bookedGenesis } from "./charter-fixture.js";
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
  test("CONTROL: a charter lineage binds to its verified seal-epoch chain, hash for hash", () => {
    const keys = [1, 2, 3].map((n) => bookSeat(new Uint8Array(32).fill(n)));
    const genesis = bookedGenesis(keys, 2);
    const lineage = makeHandLineage([{ epoch: 0, signers: keys, threshold: 2 }], [genesis]);
    expect(lineage).not.toBeNull();
    expect(rosterAt(lineage!, 0)?.rosterHash).toBe(genesis.keySetHash);
  });
  test("RED: a roster the chain never sealed, and a threshold it never armed, bind to nothing", () => {
    const keys = [1, 2, 3].map((n) => bookSeat(new Uint8Array(32).fill(n)));
    const genesis = bookedGenesis(keys, 2);
    expect(makeHandLineage([{ epoch: 0, signers: [keys[0]!, keys[1]!], threshold: 2 }], [genesis])).toBeNull();
    expect(makeHandLineage([{ epoch: 0, signers: keys, threshold: 3 }], [genesis])).toBeNull();
    expect(makeHandLineage([{ epoch: 0, signers: keys, threshold: 2 }, { epoch: 1, signers: keys, threshold: 2 }], [genesis])).toBeNull();
  });
});
