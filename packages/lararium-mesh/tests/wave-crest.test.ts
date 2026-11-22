/**
 * THE CREST NEVER CUTS A FAMILY, AND IT BOUNDS EVERY AXIS IT WEIGHS.
 *
 * `takeCrest` lifts the landing queue's slice rule (whole families up to the quota; a family larger than the quota rides
 * alone) so an INGEST wave crests the same way, bounded by carriers, encoded bytes and estimated objects at once.
 * `adaptDepth` lifts the accumulate servo's shrink (`adaptGate`): a wave that ran slow shrinks the next one.
 */
import { describe, expect, test } from "vitest";
import { adaptDepth, adaptGate, PONO_FLUSH_GATE, takeCrest, type WaveWeight } from "../src/index.js";

interface Fam { readonly id: string; readonly w: WaveWeight }
const fam = (id: string, count: number, bytes = 0, ops = 0): Fam => ({ id, w: { count, bytes, ops } });
const weigh = (f: Fam): WaveWeight => f.w;
const crests = (queue: Fam[], limits: { count: number; bytes: number; ops: number }): string[][] => {
  const out: string[][] = [];
  while (queue.length) out.push(takeCrest(queue, weigh, limits).map((f) => f.id));
  return out;
};
const wide = { count: 1_000, bytes: 1_000_000, ops: 1_000_000 };

describe("takeCrest — the nalu slice rule, every axis", () => {
  test("whole families up to the count quota; the next family opens the next crest", () => {
    expect(crests([fam("a", 150), fam("b", 40), fam("c", 30)], { ...wide, count: 200 })).toEqual([["a", "b"], ["c"]]);
  });

  test("bytes bound a crest though the count still has room", () => {
    expect(crests([fam("a", 1, 600), fam("b", 1, 600), fam("c", 1, 300)], { ...wide, bytes: 1_000 })).toEqual([["a"], ["b", "c"]]);
  });

  test("estimated objects bound a crest though count and bytes still have room", () => {
    expect(crests([fam("a", 1, 1, 70), fam("b", 1, 1, 40), fam("c", 1, 1, 20)], { ...wide, ops: 100 })).toEqual([["a"], ["b", "c"]]);
  });

  test("a family heavier than every limit rides alone, whole, and the queue moves on", () => {
    expect(crests([fam("big", 5, 5_000, 5_000), fam("after", 1, 1, 1)], { count: 2, bytes: 10, ops: 10 })).toEqual([["big"], ["after"]]);
  });

  test("order holds: a light family never jumps ahead of the heavy one that blocks it", () => {
    expect(crests([fam("a", 1, 0, 90), fam("b", 1, 0, 90), fam("c", 1, 0, 5)], { ...wide, ops: 100 })).toEqual([["a"], ["b", "c"]]);
  });
});

describe("adaptDepth — the accumulate servo's shrink, lifted", () => {
  test("a wave slower than its target shrinks the next depth, by at most the step", () => {
    expect(adaptDepth(48, 40_000, 10_000)).toBe(36);
    expect(adaptDepth(48, 12_000, 10_000)).toBe(38);
  });

  test("a fast wave grows it back by at most the step; the depth never falls below one", () => {
    expect(adaptDepth(36, 1_000, 10_000)).toBe(45);
    expect(adaptDepth(1, 99_000, 10_000)).toBe(1);
  });

  test("adaptGate reads the same servo: one shrink rule, two engines", () => {
    expect(adaptGate(PONO_FLUSH_GATE, 4_000, 2_000).depth).toBe(adaptDepth(PONO_FLUSH_GATE.depth, 4_000, 2_000));
  });
});
