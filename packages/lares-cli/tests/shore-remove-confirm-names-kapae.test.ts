/**
 * THE REMOVE'S CONFIRMATION NAMES THE KĀPAE IT RAISES (lar:///ha.ka.ba/lares/api/pono/kapae#/disk-sense).
 *
 * A pending row whose title a lower layer also holds carries `beneath`; the confirmation line names that layer in one
 * clause, and the person's y approves the kāpae. A row with nothing beneath reads as a plain removal: nothing stands in
 * its place, and the line names no kāpae.
 */
import { describe, expect, test } from "vitest";
import { confirmLine, removeRaisingOf } from "../src/commands/shore.js";

const LOW = "lar:///ha.ka.ba/bags/lares";
const OWN = "lar:///ha.ka.ba/bags/lararium";
const A = "lar:///ha.ka.ba/lararium/tw5/active-wiki";
const B = "lar:///ha.ka.ba/lararium/tw5/other";
const rows = [
  { uri: A, bagId: OWN, path: "a.mem" },
  { uri: B, bagId: OWN, path: "b.mem", beneath: [LOW] },
];

describe("the remove confirmation reads the layers beneath", () => {
  test("★ a row with nothing beneath: the line names a plain removal and no kāpae ★", () => {
    const shaped = { op: "remove", uris: [A] };
    const raising = removeRaisingOf(rows, shaped);
    expect(raising).toEqual([]);
    const line = confirmLine("remove", shaped, raising);
    expect(line).toContain("nothing stands in its place");
    expect(line).not.toContain("kāpae");
    expect(line).not.toContain("tombstone");
  });

  test("★ a row a lower layer holds: the line names that layer, and the kāpae it raises, in one clause ★", () => {
    const shaped = { op: "remove", uris: [A, B], count: 2 };
    const raising = removeRaisingOf(rows, shaped);
    expect(raising).toEqual([{ uri: B, beneath: [LOW] }]);
    expect(confirmLine("remove", shaped, raising)).toContain(`a lower layer (${LOW}) holds ${B}, so the removal raises a kāpae and it never returns`);
  });

  test("`all` reads every row of the named bag; a row of another bag stays out", () => {
    const shaped = { op: "remove", all: true, count: 2, bag: OWN };
    expect(removeRaisingOf([...rows, { uri: "lar:///x/y/z", bagId: LOW, beneath: ["lar:///deeper"] }], shaped)).toEqual([{ uri: B, beneath: [LOW] }]);
  });
});
