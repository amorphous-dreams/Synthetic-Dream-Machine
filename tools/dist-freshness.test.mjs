// dist-freshness — a parity witness that imports a built dist must refuse a dist that was NOT built
// from the bytes the tree holds now. The invariant: freshness reads content, never clocks, and the
// comparison is made against the ONE digest `stamp-build.mjs#sourceDigest` already computes.
//
// Every case runs `assertDistFresh` in a CHILD PROCESS — the function itself calls `process.exit(2)`
// on a refusal, which this process cannot observe any other way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stampPackage, packageStampPath, sourceDigest, globalStampPath } from "./stamp-build.mjs";

const HERE = join(fileURLToPath(import.meta.url), "..");
const CORPUS_READ = join(HERE, "corpus-read.mjs");

/** A scratch two-package workspace: `b` depends on `a` via `workspace:*`. */
function makeScratchRepo() {
  const repo = mkdtempSync(join(tmpdir(), "dist-freshness-"));
  mkdirSync(join(repo, "packages", "a", "dist"), { recursive: true });
  mkdirSync(join(repo, "packages", "b", "dist"), { recursive: true });
  mkdirSync(join(repo, "packages", "a", "src"), { recursive: true });
  writeFileSync(join(repo, "packages", "a", "src", "x.ts"), "export const x = 1;\n");
  writeFileSync(join(repo, "packages", "a", "package.json"), JSON.stringify({ name: "scratch-a", version: "1.0.0" }));
  writeFileSync(join(repo, "packages", "a", "dist", "x.js"), "export const x = 1;\n");
  writeFileSync(
    join(repo, "packages", "b", "package.json"),
    JSON.stringify({ name: "scratch-b", version: "1.0.0", dependencies: { "scratch-a": "workspace:*" } }),
  );
  writeFileSync(join(repo, "packages", "b", "dist", "y.js"), "export const y = 1;\n");
  return repo;
}

/** Runs `assertDistFresh(repo, distPath, "dist-freshness-test")` in a fresh child process. */
function runAssertDistFresh(repo, distPath) {
  return spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import { assertDistFresh } from ${JSON.stringify(CORPUS_READ)};
    assertDistFresh(${JSON.stringify(repo)}, ${JSON.stringify(distPath)}, "dist-freshness-test");
    console.log("fresh");
    `,
  ], { encoding: "utf8" });
}

test("(i) stamped package passes", () => {
  const repo = makeScratchRepo();
  try {
    stampPackage(repo, "a");
    stampPackage(repo, "b");
    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fresh/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(ii) an edited source byte makes the child exit 2, naming the stale package", () => {
  const repo = makeScratchRepo();
  try {
    stampPackage(repo, "a");
    stampPackage(repo, "b");
    appendFileSync(join(repo, "packages", "a", "src", "x.ts"), "// touched\n");
    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /stale build/);
    assert.match(result.stderr, /scratch-a/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(iii) guarding the DEPENDENT's dist still catches the dependency's edit, via the closure", () => {
  const repo = makeScratchRepo();
  try {
    stampPackage(repo, "a");
    stampPackage(repo, "b");
    appendFileSync(join(repo, "packages", "a", "src", "x.ts"), "// touched\n");
    const result = runAssertDistFresh(repo, join(repo, "packages", "b", "dist", "y.js"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /stale build/);
    assert.match(result.stderr, /scratch-a/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(iv) no stamp at all exits 2", () => {
  const repo = makeScratchRepo();
  try {
    // deliberately never stamped
    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /stale build/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(v) --pkg mode restamps only the named package, leaving the global stamp untouched", () => {
  const repo = makeScratchRepo();
  try {
    const globalStamp = join(repo, "node_modules", ".lares-build", "source-digest");
    mkdirSync(join(repo, "node_modules", ".lares-build"), { recursive: true });
    writeFileSync(globalStamp, "sentinel-untouched");

    const stampResult = spawnSync(process.execPath, [join(HERE, "stamp-build.mjs"), repo, "--pkg", "a"], { encoding: "utf8" });
    assert.equal(stampResult.status, 0, stampResult.stderr);

    assert.equal(readFileSync(globalStamp, "utf8"), "sentinel-untouched");

    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    // `a` is now stamped; `b` never was, but `b` has no bearing on a check scoped to `a` alone.
    assert.equal(result.status, 0, result.stderr);

    const pkgStamp = readFileSync(packageStampPath(repo, "a"), "utf8");
    assert.equal(pkgStamp.length, 64); // sha256 hex digest
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(vi) a fresh GLOBAL stamp covers a package whose own per-package stamp is stale or missing", () => {
  const repo = makeScratchRepo();
  try {
    // Never stamp `a` per-package — only write the workspace-wide stamp, matching what a real
    // `pnpm -r build` leaves (build-freshness.ts#141 writes only the global stamp).
    const digest = sourceDigest(join(repo, "packages"));
    const stampPath = globalStampPath(repo);
    mkdirSync(join(repo, "node_modules", ".lares-build"), { recursive: true });
    writeFileSync(stampPath, digest);

    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fresh/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("(vii) both the global stamp and the per-package stamp are stale: exit 2, naming the package", () => {
  const repo = makeScratchRepo();
  try {
    const digest = sourceDigest(join(repo, "packages"));
    const stampPath = globalStampPath(repo);
    mkdirSync(join(repo, "node_modules", ".lares-build"), { recursive: true });
    writeFileSync(stampPath, digest);
    stampPackage(repo, "a");
    stampPackage(repo, "b");
    // Now edit source AFTER both stamps were struck, so both read stale.
    appendFileSync(join(repo, "packages", "a", "src", "x.ts"), "// touched\n");

    const result = runAssertDistFresh(repo, join(repo, "packages", "a", "dist", "x.js"));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /stale build/);
    assert.match(result.stderr, /scratch-a/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
