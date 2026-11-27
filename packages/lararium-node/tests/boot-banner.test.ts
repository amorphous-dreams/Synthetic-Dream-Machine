/**
 * boot-banner — a process's first composition prints every address row; a later composition of the same process prints
 * only the rows whose value moved and ONE fold line that names the composition, the process and the rows it folded.
 *
 * CONTROL: a row whose value moved between compositions prints in full and stays out of the fold line.
 */

import { describe, expect, test } from "vitest";

import { bannerMemo, foldedBanner, type BannerRow } from "../src/boot-banner.js";

const floorRows: BannerRow[] = [["catalog:   ", "automerge:cat"], ["oracle:    ", "automerge:ora"], ["daemon:    ", "automerge:dae"]];
const hearthRows: BannerRow[] = [["catalog:  ", "automerge:cat"], ["oracle:   ", "automerge:ora"], ["lararium: ", "automerge:lar"], ["daemon:   ", "automerge:dae"]];

describe("the floor banner folds at a later composition", () => {
  test("the first composition prints every row as it stands, and no fold line", () => {
    expect(foldedBanner(bannerMemo(), "[herm]", floorRows, 7)).toEqual([
      "[herm] catalog:   automerge:cat",
      "[herm] oracle:    automerge:ora",
      "[herm] daemon:    automerge:dae",
    ]);
  });

  test("the second composition prints the row the first never named and folds the three it repeats into one line", () => {
    const memo = bannerMemo();
    foldedBanner(memo, "[herm]", floorRows, 7);
    expect(foldedBanner(memo, "[lararium]", hearthRows, 7)).toEqual([
      "[lararium] lararium: automerge:lar",
      "[lararium] composition 2 of pid 7: a custody unlock, a lock or a mount's close stood a fresh composition over the same store, so its pid and phase lines print again; catalog, oracle, daemon read as an earlier composition printed them",
    ]);
  });

  test("CONTROL: a row whose value moved prints in full and stays out of the fold", () => {
    const memo = bannerMemo();
    foldedBanner(memo, "[herm]", floorRows, 7);
    const lines = foldedBanner(memo, "[lararium]", [["catalog:  ", "automerge:cat"], ["oracle:   ", "automerge:moved"], ["daemon:   ", "automerge:dae"]], 7);
    expect(lines[0]).toBe("[lararium] oracle:   automerge:moved");
    expect(lines[1]).toMatch(/composition 2 of pid 7: .*; catalog, daemon read as an earlier composition printed them$/);
    // A third composition folds against the values the second printed.
    expect(foldedBanner(memo, "[herm]", [["oracle:    ", "automerge:moved"]], 7)).toEqual([
      expect.stringMatching(/^\[herm\] composition 3 of pid 7: .*; oracle read as an earlier composition printed them$/),
    ]);
  });

  test("a composition whose every row moved says so in its one line", () => {
    const memo = bannerMemo();
    foldedBanner(memo, "[herm]", floorRows, 7);
    expect(foldedBanner(memo, "[herm]", [["catalog:   ", "automerge:other"]], 7).at(-1)).toMatch(/; every address row moved and prints above$/);
  });

  test("the fold line names no boot milestone and ends no pid line", () => {
    const memo = bannerMemo();
    foldedBanner(memo, "[herm]", floorRows, 7);
    const fold = foldedBanner(memo, "[lararium]", hearthRows, 7).at(-1)!;
    // The two readings the store door takes off a boot log (`stand-socket-wait` MILESTONE_LINE, `store-door` standBootLog).
    expect(fold).not.toMatch(/\bphase → ([a-z0-9-]+)\s*$/);
    expect(fold).not.toMatch(/\bboot pid (\d+)\s*$/);
  });
});
