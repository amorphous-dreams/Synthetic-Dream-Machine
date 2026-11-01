import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "packages/lares-cli/dist/src/bin/lares.js");

function run(root, args, extraEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, LAR_ROOT: root, ...extraEnv },
  });
}

test("a scratch root founds on the build's shipped genesis with no hand copy, and reads without starting a daemon", () => {
  const root = mkdtempSync(join(tmpdir(), "lares-staged-found-"));
  const unseeded = mkdtempSync(join(tmpdir(), "lares-staged-unseeded-"));
  try {
    const stageDoor = (target) => {
      for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
        const result = spawnSync(process.execPath, [join(repo, "tools", script), target], { encoding: "utf8" });
        assert.equal(result.status, 0, `${script}: ${result.stderr}`);
      }
    };
    stageDoor(unseeded);
    // A declared genesis dir holding no seed never falls back to the shipped one, so the refusal stays reachable.
    const refusal = run(unseeded, ["vessel", "found", "--root", unseeded, "--skip-build"], { LAR_GENESIS: join(unseeded, "no-genesis") });
    assert.notEqual(refusal.status, 0);
    assert.match(refusal.stderr, /hearth true-name \(engine CID\) absent/);

    stageDoor(root);
    assert.ok(existsSync(join(repo, "genesis", "seed.json")));
    assert.ok(!existsSync(join(root, "genesis", "seed.json")), "the staged root holds no seed of its own");

    const found = run(root, ["vessel", "found", "--root", root, "--skip-build"]);
    assert.equal(found.status, 0, found.stderr);
    assert.match(found.stdout + found.stderr, /genesis: shipped seed [0-9a-f]{64} at /);

    const read = run(root, ["vessel", "read", "--root", root, "--skip-build"]);
    assert.equal(read.status, 0, read.stderr);
    assert.equal(JSON.parse(read.stdout).data.bootstrap, "present");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(unseeded, { recursive: true, force: true });
  }
});
