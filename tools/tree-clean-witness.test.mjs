// tree-clean-witness.test.mjs — the witness reads a run that dirties the tracked tree as RED, and a clean run
// as clean. The control is the known positive: without it, a green witness could be a blind one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WITNESS = join(ROOT, "tools", "tree-clean-witness.sh");
const run = (...args) => spawnSync("bash", [WITNESS, ...args], { cwd: ROOT, encoding: "utf8" });
const probes = () => readdirSync(join(ROOT, "bags")).filter((f) => f.startsWith(".tree-clean-witness-probe"));

test("CONTROL: the known positive — a planted file under bags/ — reads red, and the probe is removed", () => {
  const r = run("--control");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /RED — the run added to the tracked tree/);
  assert.deepEqual(probes(), []);
});

test("a run that adds a file under bags/ exits 1 and names it", () => {
  const probe = join("bags", `.tree-clean-witness-probe-direct-${process.pid}`);
  try {
    const r = run("--", "sh", "-c", `printf x > '${probe}'`);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /tree-clean-witness-probe-direct/);
  } finally {
    if (existsSync(join(ROOT, probe))) spawnSync("rm", ["-f", join(ROOT, probe)]);
  }
});

test("a run that touches nothing reads clean", () => {
  const r = run("--", "true");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("a run that fails but stays clean exits 2, never green", () => {
  assert.equal(run("--", "false").status, 2);
});
