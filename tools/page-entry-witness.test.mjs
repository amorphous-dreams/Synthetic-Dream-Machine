import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanImports, spawnsOnly } from "./page-entry-witness.mjs";

const cli = fileURLToPath(new URL("./page-entry-witness.mjs", import.meta.url));
const ENTRY = "packages/lararium-web/src/main.ts";

// A scratch workspace: a page package, a browser package exporting `dist/index.js`, and a keyhive package.
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "page-entry-witness-"));
  const all = {
    "packages/lararium-browser/package.json": JSON.stringify({ name: "@lararium/browser", exports: { ".": { import: "./dist/index.js" }, "./glass": { import: "./dist/glass.js" } } }),
    "packages/lararium-keyhive/package.json": JSON.stringify({ name: "@lararium/keyhive", exports: { ".": { import: "./dist/src/index.js" } } }),
    "packages/lararium-keyhive/src/index.ts": "export const hive = 1;\n",
    "packages/lararium-web/package.json": JSON.stringify({ name: "@lararium/web" }),
    ...files,
  };
  for (const [rel, body] of Object.entries(all)) { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), body); }
  return root;
}
function run(files) {
  const root = tree(files);
  try { return spawnSync(process.execPath, [cli, "--root", root, "--entry", ENTRY], { encoding: "utf8" }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("RED: a page that reaches custody through a workspace package names the module and its chain", () => {
  const r = run({
    [ENTRY]: 'import { openBrowserVessel } from "@lararium/browser";\nopenBrowserVessel();\n',
    "packages/lararium-browser/src/index.ts": 'export { openBrowserVessel } from "./open.js";\n',
    "packages/lararium-browser/src/open.ts": 'import { Repo } from "@automerge/automerge-repo";\nimport "./browser-custody.js";\nexport const openBrowserVessel = () => new Repo();\n',
    "packages/lararium-browser/src/browser-custody.ts": "export {};\n",
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /reaches 2 vessel module\(s\)/);
  assert.match(r.stdout, /@automerge\/automerge-repo\n\s+packages\/lararium-web\/src\/main\.ts -> packages\/lararium-browser\/src\/index\.ts -> packages\/lararium-browser\/src\/open\.ts -> @automerge\/automerge-repo/);
  assert.match(r.stdout, /browser-custody\n\s+.*open\.ts -> packages\/lararium-browser\/src\/browser-custody\.ts/);
});

test("RED: a dynamic import still loads onto the page's main thread, and a keyhive package file counts by its package", () => {
  const r = run({
    [ENTRY]: 'const k = await import("@lararium/keyhive");\nexport const x = k;\n',
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /@lararium\/keyhive\n\s+packages\/lararium-web\/src\/main\.ts -> @lararium\/keyhive/);
});

test("CONTROL: worker URLs, type-only imports and comments reach nothing, and a clean page holds", () => {
  const r = run({
    [ENTRY]: [
      'import vesselUrl from "./workers/vessel.worker.ts?worker&url";',
      'import holderUrl from "./workers/holder.worker.ts?sharedworker&url";',
      'import type { Custody } from "../../lararium-browser/src/browser-custody.js";',
      'export type { Ward } from "../../lararium-browser/src/ward-core.js";',
      'let t: import("../../lararium-browser/src/seed-wrap-prf.js").Wrap;',
      '// import "@automerge/automerge-repo";',
      'import { paint } from "./paint.js";',
      'paint(new Worker(vesselUrl), holderUrl);',
    ].join("\n"),
    "packages/lararium-web/src/paint.ts": "export const paint = (..._a: unknown[]) => {};\n",
    "packages/lararium-web/src/workers/vessel.worker.ts": 'import "@automerge/automerge-repo";\n',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /holds — .* reaches no vessel module \(2 module\(s\) reached · 2 worker spawn\(s\) not reached\)/);
});

test("RED: an edge that resolves to no file refuses the walk by name (an unread edge could hide a reach)", () => {
  const r = run({ [ENTRY]: 'import { gone } from "./gone.js";\ngone();\n' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /1 edge\(s\) resolve to no file[\s\S]*main\.ts: \.\/gone\.js/);
});

test("RED: an entry with no edge, or no entry at all, proves nothing", () => {
  assert.equal(run({ [ENTRY]: "export const x = 1;\n" }).status, 2);
  const missing = run({});
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /stands nowhere/);
});

test("the scanner reads static, re-export, side-effect, dynamic and type edges apart", () => {
  const edges = scanImports([
    'import a, { b, type C } from "a";',
    'export { d } from "d";',
    'export * from "e";',
    'import "f";',
    'await import("g");',
    'import type { H } from "h";',
    'type I = import("i").I;',
  ].join("\n"));
  assert.deepEqual(edges.map((e) => `${e.kind}:${e.spec}`).sort(),
    ["dynamic:g", "static:a", "static:d", "static:e", "static:f", "type:h", "type:i"]);
  assert.equal(spawnsOnly("./w.ts?worker&url"), true);
  assert.equal(spawnsOnly("./w.ts?sharedworker&url"), true);
  assert.equal(spawnsOnly("./w.ts?raw"), false);
  assert.equal(spawnsOnly("./w.ts"), false);
});
