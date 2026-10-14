/**
 * delete-gate — vectors for the wave-level deletion decision (watcher build 4,
 * the moʻolelo ruling 2026-06-14). PURE: synthetic hashes, no live carrier,
 * no I/O — the grace window + durability live in the watcher; the SPLIT
 * (a re-link, or nothing at all) lives here.
 *
 * The ruling under proof:
 *   - a projected carrier gone from disk, no pairing add → TOMBSTONE
 *   - a delete whose synced-hash UNIQUELY matches a fresh add's disk-hash → RENAME re-link
 *   - hash collision (identical-content carriers) → NO guess; fall to tombstone
 *   - tombstones above a FRACTION of the bag's carriers → SUSPEND, apply nothing
 *   - renames never count toward the mass-delete brake (a move is not a loss)
 */

import { describe, test, expect } from "vitest";
import { pairRenames } from "../src/delete-gate.js";

describe("delete-gate — a vanished address re-links or stands; no wave tombstones", () => {
  test("★ a vanished carrier with no pairing arrival reads declined: the gate names no tombstone ★", () => {
    const d = pairRenames({ deletes: [{ uri: "lar:///a", syncedHash: "h-a" }], adds: [] });
    expect(d).toEqual({ renames: [], declined: ["lar:///a"] });
    expect(Object.keys(d).sort(), "the decision carries a re-link list and a declined list, and nothing a caller could read as a removal").toEqual(["declined", "renames"]);
  });

  test("unique synced↔disk hash match → rename re-link", () => {
    const d = pairRenames({ deletes: [{ uri: "lar:///old", syncedHash: "H" }], adds: [{ uri: "lar:///new", diskHash: "H" }] });
    expect(d).toEqual({ renames: [{ fromUri: "lar:///old", toUri: "lar:///new" }], declined: [] });
  });

  test("hash collision (identical content) → no guess: each side declines", () => {
    // two vanished addresses share hash H with one arrival — ambiguous which one moved.
    const twoGone = pairRenames({
      deletes: [{ uri: "lar:///a", syncedHash: "H" }, { uri: "lar:///b", syncedHash: "H" }],
      adds: [{ uri: "lar:///c", diskHash: "H" }],
    });
    expect(twoGone).toEqual({ renames: [], declined: ["lar:///a", "lar:///b"] });
    // one vanished address, two files of the wave holding its bytes — ambiguous where it went.
    const twoHere = pairRenames({
      deletes: [{ uri: "lar:///a", syncedHash: "H" }],
      adds: [{ uri: "lar:///c", diskHash: "H" }, { uri: "lar:///d", diskHash: "H" }],
    });
    expect(twoHere).toEqual({ renames: [], declined: ["lar:///a"] });
  });

  test("★ a flood of vanished addresses declines whole: no count turns a vanish into a removal ★", () => {
    const deletes = ["a", "b", "c", "d", "e", "f"].map((u) => ({ uri: `lar:///${u}`, syncedHash: `h-${u}` }));
    const d = pairRenames({ deletes, adds: [] });
    expect(d.renames).toEqual([]);
    expect(d.declined).toEqual(deletes.map((x) => x.uri));
  });

  test("CONTROL: three unique pairs re-link, and a fourth unpaired address declines beside them", () => {
    const d = pairRenames({
      deletes: [
        { uri: "lar:///o1", syncedHash: "1" }, { uri: "lar:///o2", syncedHash: "2" },
        { uri: "lar:///o3", syncedHash: "3" }, { uri: "lar:///o4", syncedHash: "4" },
      ],
      adds: [{ uri: "lar:///n1", diskHash: "1" }, { uri: "lar:///n2", diskHash: "2" }, { uri: "lar:///n3", diskHash: "3" }],
    });
    expect(d.renames.length).toBe(3);
    expect(d.declined).toEqual(["lar:///o4"]);
  });
});
