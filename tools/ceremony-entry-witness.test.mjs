import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { brokerFaults, headerFaults, policyFaults } from "./ceremony-entry-witness.mjs";

const cli = fileURLToPath(new URL("./ceremony-entry-witness.mjs", import.meta.url));
const repo = fileURLToPath(new URL("../", import.meta.url));
const ENTRY = "packages/lararium-web/src/ceremony/ceremony.ts";
const POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'";
const ADAPTER = `export const CEREMONY_POLICY = "${POLICY}; frame-ancestors 'none'";\n`;
const doc = (policy = POLICY, body = '<script type="module" src="/src/ceremony/ceremony.ts"></script>') =>
  `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}" /></head><body>${body}</body></html>`;

function run(files) {
  const root = mkdtempSync(join(tmpdir(), "ceremony-entry-witness-"));
  const all = {
    "packages/lararium-tw5/package.json": JSON.stringify({ name: "@lararium/tw5", exports: { ".": { import: "./dist/index.js" } } }),
    "packages/lararium-tw5/src/index.ts": "export const tw = 1;\n",
    "packages/lararium-web/package.json": JSON.stringify({ name: "@lararium/web" }),
    "packages/lararium-web/ceremony.html": doc(),
    "packages/lararium-web/public/ceremony-broker.js": "self.addEventListener('message', () => {});\n",
    "packages/lararium-web/src/ceremony/ceremony-core.ts": "export const core = 1;\n",
    "packages/lararium-node/src/pronaos-adapter.ts": ADAPTER,
    ...files,
  };
  for (const [rel, body] of Object.entries(all)) { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), body); }
  try { return spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("RED-FIRST: the house's own ceremony document stands clean (its reach, its policy, its broker)", () => {
  const r = spawnSync(process.execPath, [cli, "--root", repo], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ceremony-entry: holds/);
});

test("RED: a ceremony that reaches TW5 through a workspace package, or the page's mirror by path, names each reach and its chain", () => {
  const r = run({
    [ENTRY]: 'import { core } from "./ceremony-core.js";\nimport { tw } from "@lararium/tw5";\nimport { mirror } from "../page-mirror.js";\nexport const x = [core, tw, mirror];\n',
    "packages/lararium-web/src/page-mirror.ts": "export const mirror = 1;\n",
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /reach @lararium\/tw5\n\s+packages\/lararium-web\/src\/ceremony\/ceremony\.ts -> @lararium\/tw5/);
  assert.match(r.stdout, /reach packages\/lararium-web\/src\/page-mirror\.ts\n\s+packages\/lararium-web\/src\/ceremony\/ceremony\.ts -> packages\/lararium-web\/src\/page-mirror\.ts/);
});

test("RED: a dynamic import of keyhive or any external package reaches by name", () => {
  const r = run({ [ENTRY]: 'import "./ceremony-core.js";\nconst k = await import("@lararium/keyhive");\nconst p = await import("tiddlywiki");\nexport { k, p };\n' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /reach @lararium\/keyhive/);
  assert.match(r.stdout, /reach tiddlywiki/);
});

test("CONTROL: type-only imports, comments and the ceremony's own modules reach nothing, and the clean document holds", () => {
  const r = run({ [ENTRY]: 'import type { K } from "@lararium/keyhive";\n// import "@lararium/tw5";\nimport { core } from "./ceremony-core.js";\nexport const x: K | number = core;\n' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /holds — the ceremony reaches 2 module\(s\) of its own/);
});

test("RED: the policy refuses an unsafe source, an inline script, an inline handler and a foreign script", () => {
  assert.deepEqual(policyFaults(doc()), []);
  assert.ok(policyFaults(doc(POLICY.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"))).some((f) => /script-src|unsafe/.test(f)));
  assert.ok(policyFaults(doc(POLICY.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"))).some((f) => /unsafe/.test(f)));
  assert.ok(policyFaults(doc(POLICY, '<script type="module" src="/src/ceremony/ceremony.ts"></script><script>steal()</script>')).some((f) => /inline script/.test(f)));
  assert.ok(policyFaults(doc(POLICY, '<button onclick="steal()">x</button><script type="module" src="/src/ceremony/ceremony.ts"></script>')).some((f) => /handler/.test(f)));
  assert.ok(policyFaults(doc(POLICY, '<script type="module" src="/src/main.ts"></script>')).some((f) => /not the ceremony's own/.test(f)));
  assert.deepEqual(policyFaults("<html></html>"), ["no Content-Security-Policy meta stands"]);
});

test("RED: the hearth's header welds to the meta policy and adds frame-ancestors 'none'; a header that frames or drifts reads red", () => {
  assert.deepEqual(headerFaults(doc(), ADAPTER), []);
  assert.equal(headerFaults(doc(), ADAPTER.replace("frame-ancestors 'none'", "frame-ancestors 'self'")).length, 1);
  assert.equal(headerFaults(doc(), ADAPTER.replace("; frame-ancestors 'none'", "")).length, 1);
  assert.equal(headerFaults(doc(POLICY.replace("style-src 'self'", "style-src 'self' data:")), ADAPTER).length, 1);
  assert.deepEqual(headerFaults(doc(), "export {};\n"), ["the hearth names no CEREMONY_POLICY header"]);
});

test("RED: a broker that imports code or handles fetch reads red; CONTROL: a comment naming both reads clean", () => {
  assert.deepEqual(brokerFaults("// it imports nothing and handles no fetch\nself.addEventListener('message', () => {});\n"), []);
  assert.ok(brokerFaults("importScripts('/x.js');\n").length > 0);
  assert.ok(brokerFaults("self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));\n").length > 0);
});

test("RED: a missing entry proves nothing (exit 2)", () => {
  assert.equal(run({}).status, 2);
});
