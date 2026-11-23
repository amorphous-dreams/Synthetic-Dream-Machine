import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "tools/engine-retention-witness.mjs");

// A stand-in engine with the API the witness drives: plain objects, JSON bytes, and one wasm memory it grows by
// `grow` pages (64 KiB each) on every change. `grow: 0` holds its memory still.
const fakeEngine = (grow) => `
const bytes = new Uint8Array([0,97,115,109,1,0,0,0,5,3,1,0,1,7,10,1,6,109,101,109,111,114,121,2,0]);
const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), {});
const clone = (x) => JSON.parse(JSON.stringify(x));
export class ImmutableString { constructor(v) { this.val = v; } toJSON() { return this.val; } }
export class Counter { constructor(v) { this.value = v; } increment(n) { this.value += n; } toJSON() { return this.value; } }
export const init = () => ({});
export const from = (x) => clone(x);
export const change = (d, a, b) => { const fn = typeof a === "function" ? a : b; fn(d); inst.exports.memory.grow(${grow}); return d; };
export const save = (d) => new TextEncoder().encode(JSON.stringify(d));
export const load = (b) => JSON.parse(new TextDecoder().decode(b));
export const splice = () => {};
export const getAllChanges = () => [];
`;

function runAgainst(grow) {
  const dir = mkdtempSync(join(tmpdir(), "engine-retention-"));
  try {
    const engine = join(dir, "engine.mjs");
    writeFileSync(engine, fakeEngine(grow));
    return spawnSync(process.execPath, [cli, "--engine", engine], { encoding: "utf8" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("RED: an engine whose memory climbs on every edit of a loaded document reads red past the bound", () => {
  const r = runAgainst(4); // 50 edits x 256 KiB = 12.5 MB, past the 8 MB bound
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /✗ retention: 4000 records x 2000 B loaded, 50 overwrites: wasm [\d.]+ -> [\d.]+ MB \(\+12\.5, bound 8\)/);
});

test("RED: an engine that writes other bytes than the stock engine reads red on the byte reading, even when its memory holds", () => {
  const r = runAgainst(0);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /✗ bytes: the fixed sequence hashes [0-9a-f]{64}; the stock engine's reads [0-9a-f]{64}/);
  assert.doesNotMatch(r.stdout, /✗ retention/);
  assert.match(r.stdout, /\[engine-retention\] retention: .*\(\+0\.0, bound 8\)/);
});


test("RED: the resolved engine's wasm must match the vendored digest", () => {
  const dir = mkdtempSync(join(tmpdir(), "engine-pin-"));
  try {
    for (const part of ["tools", "packages/lararium-mesh", "third-party/automerge", "node_modules/@automerge"]) mkdirSync(join(dir, part), { recursive: true });
    cpSync(cli, join(dir, "tools/engine-retention-witness.mjs"));
    cpSync(join(repo, "pnpm-workspace.yaml"), join(dir, "pnpm-workspace.yaml"));
    cpSync(join(repo, "third-party/automerge"), join(dir, "third-party/automerge"), { recursive: true });
    const require = createRequire(join(repo, "packages/lararium-mesh/package.json"));
    const entry = require.resolve("@automerge/automerge");
    const packageDir = dirname(dirname(dirname(entry)));
    const target = join(dir, "node_modules/@automerge/automerge");
    cpSync(packageDir, target, { recursive: true });
    const wasm = join(target, "dist/cjs/automerge_wasm_bg.wasm");
    const bytes = readFileSync(wasm); bytes[bytes.length - 1] ^= 1; writeFileSync(wasm, bytes);
    const r = spawnSync(process.execPath, [join(dir, "tools/engine-retention-witness.mjs")], { encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /pin: resolved wasm hashes [0-9a-f]{64}; WASM_SHA256 records/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
