// tree-clean-witness.test.mjs — the witness reads a run that dirties the tracked tree as RED, and a clean run
// as clean. The control is the known positive: without it, a green witness could be a blind one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WITNESS = join(ROOT, "tools", "tree-clean-witness.sh");
const run = (...args) => spawnSync("bash", [WITNESS, ...args], { cwd: ROOT, encoding: "utf8" });
/** A run whose vitest report lands inside `base`, so removing the planted set removes everything it wrote. */
const runIn = (base, ...args) =>
  spawnSync("bash", [WITNESS, ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, LAR_E2E_RUN_DIR: join(base, "run") } });
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

// ── THE DEFAULT RUN MEASURES EVERY E2E SET ──────────────────────────────────────────────────────────
// The repo carries two e2e sets: `tests/` (the main set) and each package's own `vitest.e2e.config.*`. The
// list is DERIVED from the tree, so a set added later reds here until the witness measures it.
const e2eConfigs = () => [
  "tests/vitest.config.ts",
  ...readdirSync(join(ROOT, "packages"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    .flatMap((p) => readdirSync(join(ROOT, "packages", p)).filter((f) => /^vitest\.e2e\.config\./.test(f)).map((f) => `packages/${p}/${f}`)),
];

test("the default run's plan names every e2e config the repo carries", () => {
  const r = run("--plan");
  assert.equal(r.status, 0, r.stderr);
  const planned = r.stdout.trim().split("\n").map((l) => l.split(" ")[1]);
  const wanted = e2eConfigs();
  assert.ok(wanted.length >= 2, `found ${wanted.length} e2e configs — the derivation measures nothing`);
  for (const config of wanted) assert.ok(planned.includes(config), `the default run never measures ${config}:\n${r.stdout}`);
});

/** A one-file e2e set planted under `tests/`, outside the config's own `e2e/**` include, so no other run meets it. */
function plantSet(body) {
  const base = join(ROOT, "tests", `.scratch-tree-clean-${process.pid}`);
  mkdirSync(join(base, "e2e"), { recursive: true });
  writeFileSync(join(base, "e2e", "planted.test.ts"), body);
  return base;
}

test("a main-set e2e file that writes into bags/ reads RED, and names the write", () => {
  const probe = join(ROOT, "bags", `.tree-clean-witness-probe-e2e-${process.pid}`);
  const base = plantSet(
    `import { test } from "vitest";\nimport { writeFileSync } from "node:fs";\n` +
    `test("writes into the tracked tree", () => { writeFileSync(${JSON.stringify(probe)}, "x"); });\n`);
  try {
    const r = runIn(base, "--set", "tests", "--dir", base);
    assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stderr, /tree-clean-witness-probe-e2e/);
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(probe, { force: true });
  }
});

test("CONTROL: a main-set e2e file that writes nothing tracked reads clean", () => {
  const base = plantSet(`import { test, expect } from "vitest";\ntest("touches nothing", () => { expect(1).toBe(1); });\n`);
  try {
    const r = runIn(base, "--set", "tests", "--dir", base);
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /clean/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
