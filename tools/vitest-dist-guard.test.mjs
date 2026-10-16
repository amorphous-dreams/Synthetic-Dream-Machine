import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stampPackage } from "./stamp-build.mjs";
import { checkDistDependencies, ownDistTestLiteral, setup } from "./vitest-dist-guard.mjs";

function scratch(foreign = false) {
  const repo = mkdtempSync(join(tmpdir(), "vitest-dist-guard-"));
  const other = foreign ? mkdtempSync(join(tmpdir(), "vitest-foreign-")) : null;
  for (const root of [repo, other].filter(Boolean)) {
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    for (const dir of ["app", "dep"]) mkdirSync(join(root, "packages", dir, "dist"), { recursive: true });
    mkdirSync(join(root, "packages", "dep", "src"), { recursive: true });
    mkdirSync(join(root, "packages", "app", "node_modules", "@lararium"), { recursive: true });
    writeFileSync(join(root, "packages", "app", "package.json"), JSON.stringify({ name: "@lararium/app", dependencies: { "@lararium/dep": "workspace:*" } }));
    writeFileSync(join(root, "packages", "dep", "package.json"), JSON.stringify({ name: "@lararium/dep" }));
    writeFileSync(join(root, "packages", "dep", "src", "index.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "packages", "dep", "dist", "index.js"), "export const value = 1;\n");
    writeFileSync(join(root, "packages", "app", "dist", "index.js"), "export const app = 1;\n");
    stampPackage(root, "app");
    stampPackage(root, "dep");
  }
  const link = join(repo, "packages", "app", "node_modules", "@lararium", "dep");
  symlinkSync(join(other ?? repo, "packages", "dep"), link, "dir");
  return { repo, other, link, cleanup() { rmSync(repo, { recursive: true, force: true }); if (other) rmSync(other, { recursive: true, force: true }); } };
}

test("RED stale dependency names its cure", () => {
  const s = scratch();
  try {
    appendFileSync(join(s.repo, "packages", "dep", "src", "index.ts"), "export const changed = 2;\n");
    assert.throws(() => checkDistDependencies(s.repo, "app"), /@lararium\/dep.*stale build[\s\S]*cure: pnpm --filter @lararium\/dep build && node tools\/stamp-build\.mjs \. --pkg dep/);
  } finally { s.cleanup(); }
});

test("RED foreign dependency names both paths and relink cure", () => {
  const s = scratch(true);
  try {
    assert.throws(() => checkDistDependencies(s.repo, "app"), (error) => {
      assert.match(error.message, /@lararium\/dep/);
      assert.ok(error.message.includes(s.repo));
      assert.ok(error.message.includes(s.other));
      assert.match(error.message, /relink node_modules|tools\/provision-worktree\.mjs/);
      return true;
    });
  } finally { s.cleanup(); }
});

test("CONTROL fresh local dependency passes", () => {
  const s = scratch();
  try { assert.doesNotThrow(() => checkDistDependencies(s.repo, "app")); } finally { s.cleanup(); }
});

test("CONTROL source alias exempts stale dist", () => {
  const s = scratch();
  try {
    appendFileSync(join(s.repo, "packages", "dep", "src", "index.ts"), "export const changed = 2;\n");
    assert.doesNotThrow(() => checkDistDependencies(s.repo, "app", [{ find: "@lararium/dep", replacement: join(s.repo, "packages", "dep", "src", "index.ts") }]));
  } finally { s.cleanup(); }
});

test("RED setup from a package root reads resolved aliases and checks its own dist", () => {
  const s = scratch(true);
  try {
    mkdirSync(join(s.repo, "packages", "app", "tests"));
    writeFileSync(join(s.repo, "packages", "app", "tests", "built.test.ts"), 'import "../dist/index.js";\n');
    appendFileSync(join(s.repo, "packages", "app", "package.json"), " ");
    const alias = [{ find: "@lararium/dep", replacement: join(s.repo, "packages", "dep", "src", "index.ts") }];
    assert.throws(() => setup({ config: { root: join(s.repo, "packages", "app") }, viteConfig: { resolve: { alias } } }), /@lararium\/app stale build/);
  } finally { s.cleanup(); }
});

test("RED setup from tests root checks the CLI workspace closure", () => {
  const s = scratch(true);
  try {
    mkdirSync(join(s.repo, "tests"));
    mkdirSync(join(s.repo, "packages", "lares-cli", "dist"), { recursive: true });
    writeFileSync(join(s.repo, "packages", "lares-cli", "package.json"), JSON.stringify({ name: "@lares/cli", dependencies: { "@lararium/dep": "workspace:*" } }));
    writeFileSync(join(s.repo, "packages", "lares-cli", "dist", "index.js"), "export const cli = 1;\n");
    stampPackage(s.repo, "lares-cli");
    mkdirSync(join(s.repo, "packages", "lares-cli", "node_modules", "@lararium"), { recursive: true });
    symlinkSync(join(s.other, "packages", "dep"), join(s.repo, "packages", "lares-cli", "node_modules", "@lararium", "dep"), "dir");
    assert.throws(() => setup({ config: { root: join(s.repo, "tests") }, viteConfig: { resolve: { alias: [] } } }), /foreign build: @lararium\/dep/);
  } finally { s.cleanup(); }
});

test("RED package's own stale dist refuses before its dependencies pass", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.repo, "packages", "app", "tests"));
    writeFileSync(join(s.repo, "packages", "app", "tests", "built.test.ts"), 'import "../dist/src/x.js";\n');
    appendFileSync(join(s.repo, "packages", "app", "package.json"), " ");
    assert.throws(() => checkDistDependencies(s.repo, "app"), /@lararium\/app stale build/);
  } finally { s.cleanup(); }
});

test("CONTROL stale own dist passes when tests never name built output", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.repo, "packages", "app", "tests"));
    writeFileSync(join(s.repo, "packages", "app", "tests", "source.test.ts"), 'import "../src/index.js";\n');
    appendFileSync(join(s.repo, "packages", "app", "package.json"), " ");
    assert.doesNotThrow(() => checkDistDependencies(s.repo, "app"));
  } finally { s.cleanup(); }
});

test("CONTROL a dist path in a line comment does not require own dist", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.repo, "packages", "app", "tests"));
    writeFileSync(join(s.repo, "packages", "app", "tests", "comment.test.ts"), '// import "../dist/src/x.js";\n');
    appendFileSync(join(s.repo, "packages", "app", "package.json"), " ");
    assert.doesNotThrow(() => checkDistDependencies(s.repo, "app"));
  } finally { s.cleanup(); }
});

test("CONTROL the scan ignores block comments and non-segment names, then finds nested .mts paths", () => {
  const s = scratch();
  try {
    const tests = join(s.repo, "packages", "app", "tests");
    mkdirSync(join(tests, "nested"), { recursive: true });
    writeFileSync(join(tests, "comment.test.js"), '/* "../dist/src/x.js" */\nconst other = "../nodist/src/x.js";\n');
    assert.equal(ownDistTestLiteral(s.repo, "app"), null);
    writeFileSync(join(tests, "nested", "built.test.mts"), 'import "..\\\\dist\\\\src\\\\x.js";\n');
    assert.match(ownDistTestLiteral(s.repo, "app").literal, /dist/);
  } finally { s.cleanup(); }
});

test("RED the tests root still requires the CLI dist", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.repo, "tests"));
    mkdirSync(join(s.repo, "packages", "lares-cli"));
    writeFileSync(join(s.repo, "packages", "lares-cli", "package.json"), JSON.stringify({ name: "@lares/cli" }));
    assert.throws(() => setup({ config: { root: join(s.repo, "tests") }, viteConfig: { resolve: { alias: [] } } }), /@lares\/cli stale build: dist is missing/);
  } finally { s.cleanup(); }
});

test("CONTROL package without dist may run source tests", () => {
  const s = scratch();
  try {
    rmSync(join(s.repo, "packages", "app", "dist"), { recursive: true });
    assert.doesNotThrow(() => checkDistDependencies(s.repo, "app"));
  } finally { s.cleanup(); }
});
