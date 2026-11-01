// e2e-shard-partition.test.mjs — the e2e shards split by MEASURED duration, never by vitest's path hash.
// `vitest --shard=k/n` deals files out by a hash of their path, so a set's heaviest files can all land
// in one shard (measured: 21.6 min against 11.9 min beside it). `shardFiles` deals them by weight instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { E2E_SETS, shardFiles, trackedE2eFiles } from "./e2e-shards.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEIGHTS = JSON.parse(readFileSync(new URL("./e2e-shard-weights.json", import.meta.url), "utf8"));
const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");

const load = (files, weights, shards, fallback) => Array.from({ length: shards }, (_, i) =>
  shardFiles({ files, weights, shards, shard: i + 1 }).reduce((sum, f) => sum + (weights[f.split("e2e/").pop()] ?? fallback), 0));

test("P1 RED: the shards partition the files exactly once, and the heavy files part company", () => {
  const files = ["a", "b", "c", "d", "e", "f"].map((n) => `tests/e2e/${n}.test.ts`);
  const weights = { "a.test.ts": 300, "b.test.ts": 290, "c.test.ts": 100, "d.test.ts": 90, "e.test.ts": 10, "f.test.ts": 10 };
  const dealt = [1, 2].map((shard) => shardFiles({ files, weights, shards: 2, shard }));
  assert.deepEqual([...dealt[0], ...dealt[1]].sort(), [...files].sort());
  assert.equal(dealt[0].filter((f) => dealt[1].includes(f)).length, 0);
  assert.notEqual(dealt[0].includes(files[0]), dealt[0].includes(files[1]), "the two heaviest files rode one shard");
  const [x, y] = load(files, weights, 2, 0);
  assert.ok(Math.abs(x - y) <= 290, `the shards' loads read ${x} against ${y}`);
});

test("P2 RED: the deal reads the same from any file order, and a file with no weight takes the median", () => {
  const files = ["a", "b", "c", "d"].map((n) => `tests/e2e/${n}.test.ts`);
  const weights = { "a.test.ts": 100, "b.test.ts": 50, "c.test.ts": 50 };
  const first = [1, 2].map((shard) => shardFiles({ files, weights, shards: 2, shard }));
  const again = [1, 2].map((shard) => shardFiles({ files: [...files].reverse(), weights, shards: 2, shard }));
  assert.deepEqual(first, again);
  // d carries no weight: it reads as 50 (the median of 100, 50, 50), so it takes a lawful seat, once.
  assert.equal(first.flat().filter((f) => f === "tests/e2e/d.test.ts").length, 1);
  assert.deepEqual(first.flat().sort(), [...files].sort());
});

test("P3 CONTROL: the real weights deal every tracked e2e file once, within 15% of an even load", () => {
  for (const set of E2E_SETS) {
    const tracked = trackedE2eFiles(ROOT, set.trackedGlob);
    assert.ok(tracked.length > 0, `set ${set.name} tracks no e2e file`);
    const dealt = Array.from({ length: set.shards }, (_, i) => shardFiles({ files: tracked, weights: WEIGHTS[set.name] ?? {}, shards: set.shards, shard: i + 1 }));
    assert.deepEqual(dealt.flat().sort(), [...tracked].sort(), `set ${set.name}: the shards do not deal the tracked files exactly once`);
    if (set.shards === 1) continue;
    const w = WEIGHTS[set.name] ?? {};
    const fallback = [...Object.values(w)].sort((p, q) => p - q)[Math.floor(Object.values(w).length / 2)] ?? 60;
    const loads = dealt.map((s) => s.reduce((sum, f) => sum + (w[f.split("e2e/").pop()] ?? fallback), 0));
    const mean = loads.reduce((p, q) => p + q, 0) / loads.length;
    assert.ok(Math.max(...loads) <= mean * 1.15, `set ${set.name}: loads ${loads.join(" / ")} stray past 15% of ${Math.round(mean)}`);
  }
});

test("P4 RED: the weights name only tracked files (a stale row would weigh nothing)", () => {
  for (const [name, rows] of Object.entries(WEIGHTS)) {
    if (name.startsWith("_") || name === "node-unit") continue; // node-unit weighs the node package's unit suites (tools/ci-node-deal.test.mjs)
    const set = E2E_SETS.find((s) => s.name === name);
    assert.ok(set, `weights name the set ${name}, which E2E_SETS does not carry`);
    const tracked = new Set(trackedE2eFiles(ROOT, set.trackedGlob).map((f) => f.split("e2e/").pop()));
    for (const file of Object.keys(rows)) assert.ok(tracked.has(file), `set ${name}: weight row ${file} names no tracked file`);
  }
});

test("P5 RED: e2e-shards.yml deals the files through shardFiles, and leaves vitest's hash shard unused", () => {
  const yml = read("e2e-shards.yml");
  assert.match(yml, /e2e-shards\.mjs shard-files/, "the shard step never asks the table for its files");
  assert.doesNotMatch(yml.replace(/^\s*#.*$/gm, ""), /--shard=/, "a vitest --shard flag still deals the files by path hash");
});
