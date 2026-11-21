// flush-bench's arithmetic reads a planted set before any reading trusts it (a silent zero never reads as fast).
import test from "node:test";
import assert from "node:assert/strict";
import { percentile, summarize } from "./flush-bench.mjs";

test("summarize reads a planted set by the nearest-rank rule", () => {
  const samples = Array.from({ length: 100 }, (_, i) => i + 1);   // 1..100 ms, shuffled order must not matter
  const s = summarize(samples.slice().reverse());
  assert.deepEqual([s.n, s.p50, s.p95, s.p99, s.max, s.totalMs], [100, 50, 95, 99, 100, 5050]);
  assert.equal(s.meanMs, 50.5);
});

test("CONTROL: an empty set refuses, and a single sample reads as itself", () => {
  assert.throws(() => summarize([]), /no samples/);
  assert.throws(() => percentile([], 50), /no samples/);
  const one = summarize([7]);
  assert.deepEqual([one.p50, one.p99, one.max], [7, 7, 7]);
});
