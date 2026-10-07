/**
 * ahu-pair-parity can fail — every red it owes, planted, and the controls that keep a green honest.
 *
 * Each planted case is a scratch git tree holding one declared carrier under `bags/`, swept through the
 * witness's own process with `REPO` pointed at it; the shores (tw5's dist, the grammar wasm) load from
 * this checkout, exactly as the real run loads them. The wasm-freshness door runs against a scratch
 * package, in a child process, since a refusal calls `process.exit(2)`.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { stampWasm } from "./stamp-build.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const WITNESS = join(ROOT, "tools/ahu-pair-parity.mjs");
const CORPUS_READ = join(ROOT, "tools/corpus-read.mjs");
const HEAD = `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>\n\n`;

function sweep(env = {}) {
  return spawnSync(process.execPath, [WITNESS], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
}

/** A scratch git tree holding `bags/planted.mem` = HEAD + body, swept by the witness. */
function plant(body) {
  const repo = mkdtempSync(join(tmpdir(), "ahu-pair-parity-"));
  try {
    mkdirSync(join(repo, "bags"), { recursive: true });
    writeFileSync(join(repo, "bags", "planted.mem"), HEAD + body);
    const git = (...a) => assert.equal(spawnSync("git", a, { cwd: repo }).status, 0, `git ${a.join(" ")}`);
    git("init", "-q");
    git("add", "bags/planted.mem");
    return sweep({ REPO: repo });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

const OFFSET = HEAD.length;

await test("CONTROL: the real corpus reads green, with a counted positive on both sides", () => {
  const run = sweep({ REPO: ROOT });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const m = /scanAhu pairs (\d+) · the grammar reproduces (\d+) of (\d+)/.exec(run.stdout);
  assert.ok(m, run.stdout);
  assert.ok(Number(m[1]) > 1000, `a real sweep reads thousands of pairs, read ${m[1]}`);
  assert.equal(m[2], m[1]);
  const only = /grammar-only pairs [^:]*: (\d+)/.exec(run.stdout);
  assert.ok(only && Number(only[1]) > 0, "the grammar-only asymmetry stays visible — a zero here would mean the report went blind");
});

await test("CONTROL: a planted balanced pair reads green — 1 of 1, so the scratch sweep is not a silent zero", () => {
  const run = plant("<<~ ahu #/a>>\nx\n<<~/ahu>>\n");
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /1 carriers · scanAhu pairs 1 · the grammar reproduces 1 of 1/);
});

await test("a planted unpaired close mid-line reads red: scanAhu closes on it, the grammar does not", () => {
  const run = plant("<<~ ahu #/a>>\ntext <<~/ahu>> more\n<<~/ahu>>\n");
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(`MISPLACED bags/planted\\.mem:${OFFSET} \\(line 3\\)`));
  assert.match(run.stdout, /balance faults \(cut no pair — reported\): 1/);
});

await test("a planted mismatched pair reads red: an ahu opener closed by `<</fragment>>`", () => {
  const run = plant("<<~ ahu #/a>>\nx\n<</fragment>>\n");
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(`MISSING  bags/planted\\.mem:${OFFSET} \\(line 3\\)`));
});

await test("a carrier the grammar parses in error reads red, even holding no pair the two dispute", () => {
  const run = plant("<<~ ahu #/a>>\nx\n<<~/ahu>>\n\n```\nunclosed fence\n");
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /ERROR    bags\/planted\.mem:\d+ \(line \d+\) the grammar failed to parse/);
});

await test("grammar-only pairs are reported by name and never refused", () => {
  const run = plant("<<~ ahu #/a>>\nx\n<<~/ahu>>\n<<~ kue>>\ndissent\n<<~/kue>>\n");
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /grammar-only pairs [^:]*: 1 — kue 1/);
});

await test("a tree holding no pair at all refuses rather than reading green", () => {
  const run = plant("no sigils here\n");
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.match(run.stderr, /nothing to compare/);
});

// ── the wasm door ───────────────────────────────────────────────────────────────────────────────

function wasmDoor(repo) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { assertWasmFresh } from ${JSON.stringify(CORPUS_READ)};
    assertWasmFresh(${JSON.stringify(repo)}, "g", "g.wasm", "wasm-door-test");
    console.log("fresh");
  `], { encoding: "utf8" });
}

await test("the grammar wasm door: fresh holds; a missing wasm, no stamp, a C edit, a swapped wasm each refuse", () => {
  const repo = mkdtempSync(join(tmpdir(), "ahu-pair-wasm-"));
  try {
    const pkg = join(repo, "packages", "g");
    mkdirSync(join(pkg, "src", "tree_sitter"), { recursive: true });
    writeFileSync(join(pkg, "package.json"), "{}");
    writeFileSync(join(pkg, "src", "scanner.c"), "int x;\n");
    writeFileSync(join(pkg, "src", "tree_sitter", "parser.h"), "#pragma once\n");

    let run = wasmDoor(repo);
    assert.equal(run.status, 2, "a missing wasm refuses");
    assert.match(run.stderr, /no built grammar/);

    writeFileSync(join(pkg, "g.wasm"), "wasm-bytes");
    run = wasmDoor(repo);
    assert.equal(run.status, 2, "an unstamped wasm refuses");
    assert.match(run.stderr, /stale build/);

    stampWasm(repo, "g");
    run = wasmDoor(repo);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /fresh/);

    appendFileSync(join(pkg, "src", "tree_sitter", "parser.h"), "// edit\n");
    run = wasmDoor(repo);
    assert.equal(run.status, 2, "a header edit without a rebuild refuses");
    assert.match(run.stderr, /cure: pnpm --filter \.\/packages\/g build:wasm && node tools\/stamp-build\.mjs \. --wasm g/);

    stampWasm(repo, "g");
    writeFileSync(join(pkg, "g.wasm"), "other-wasm-bytes");
    run = wasmDoor(repo);
    assert.equal(run.status, 2, "a wasm swapped after the stamp refuses");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
