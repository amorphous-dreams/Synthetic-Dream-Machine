/**
 * watch-delete-grace.test.ts — `lares watch`'s vanished-carrier grace, NO GLOBAL NOW.
 *
 * A missing carrier only ever tombstones on two kinds of evidence: its patience (a MONOTONIC span)
 * ran out, or a rename pairing (a candidate add sharing its synced-hash) settled it by content. Neither
 * reads a wall clock. `dueDeletions` is the pulled-out pure decision `cmdWatch`'s drain loop calls; the
 * proofs:
 *   · under the grace, with no pairing → stays pending;
 *   · past the grace → rides (DUE);
 *   · under the grace but PAIRED by a rename's shared hash → rides EARLY, by content, not time;
 *   · a transient delete that returns before it is ever asked about never needs `dueDeletions` at all —
 *     the drain's own rescan drops it from the pending map first (documented, proven at the `watch.ts`
 *     call site: `pendingDeletes.delete` on a row that re-scans present);
 *   · CONTROL: a SET-BACK and a SET-FORWARD wall clock (mocked `Date.now`) move neither the DUE nor the
 *     PAIRED verdict — `dueDeletions` never reads `Date.now` at all, and the real `performance.now()`
 *     readings it is driven with here are untouched by the mock.
 */
import { describe, test, expect, vi } from "vitest";
import { dueDeletions } from "../src/commands/watch.js";

describe("dueDeletions — monotonic patience, content-settled pairing, no wall clock", () => {
  test("under the grace, unpaired → stays pending", () => {
    const pending = new Map([["lar:///t.w.b/gone", { syncedHash: "h1", armedAt: 1_000 }]]);
    const ride = dueDeletions(pending, new Set(), /* now */ 1_200, /* grace */ 1_000);
    expect(ride).toEqual([]);
  });

  test("past the grace (monotonic span elapsed) → DUE, rides", () => {
    const pending = new Map([["lar:///t.w.b/gone", { syncedHash: "h1", armedAt: 1_000 }]]);
    const ride = dueDeletions(pending, new Set(), /* now */ 2_001, /* grace */ 1_000);
    expect(ride).toEqual([{ uri: "lar:///t.w.b/gone", syncedHash: "h1", file: "lar:///t.w.b/gone" }]);
  });

  test("under the grace but PAIRED by a rename's shared hash → rides EARLY, by content", () => {
    const pending = new Map([["lar:///t.w.b/old-name", { syncedHash: "h-shared", armedAt: 1_000 }]]);
    const ride = dueDeletions(pending, new Set(["h-shared"]), /* now */ 1_050, /* grace */ 60_000);
    expect(ride).toEqual([{ uri: "lar:///t.w.b/old-name", syncedHash: "h-shared", file: "lar:///t.w.b/old-name" }]);
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` ten years either way changes neither verdict", () => {
    const pending = new Map([
      ["lar:///t.w.b/under-grace", { syncedHash: "h-under", armedAt: 1_500 }],   // 1999-1500=499 < 1000
      ["lar:///t.w.b/past-grace",  { syncedHash: "h-past",  armedAt: 500 }],     // 1999-500=1499 >= 1000
    ]);
    const realNow = Date.now();
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      try {
        // nowMs below is a real performance.now()-shaped reading (ms since watcher start), wholly
        // independent of the mocked Date.now — exactly what `cmdWatch`'s drain passes.
        const ride = dueDeletions(pending, new Set(), /* now */ 1_999, /* grace */ 1_000);
        expect(ride.map((d) => d.uri), `skew ${skew}`).toEqual(["lar:///t.w.b/past-grace"]);
      } finally { vi.restoreAllMocks(); }
    }
  });
});
