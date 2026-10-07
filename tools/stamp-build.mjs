/**
 * stamp-build — record WHICH BYTES the current dist was built from.
 *
 * The fresh-build gate asks one question before it rebuilds: does the built output come from the source
 * the tree holds right now? It answers by comparing a content digest against this stamp, so a build that
 * never stamps reads as stale forever — and the gate would rebuild on the next lifecycle verb, mid-run,
 * which is precisely the disturbance the digest exists to avoid.
 *
 * So every full build stamps: the root `build` script runs this last, and the gate's own build calls the
 * TypeScript twin after it succeeds.
 *
 * ── THE TWO IMPLEMENTATIONS STAY IN LOCKSTEP ────────────────────────────────────────────────────
 * This file and `build-freshness.ts#sourceDigest` MUST compute the same digest — a build stamped by one
 * and read by the other would rebuild every time, silently, and the loop would look like nothing at all.
 * A test asserts the two agree, so a change to either fails loudly rather than drifting.
 *
 * The duplication buys the bootstrap: this runs BEFORE the CLI exists, so it cannot import from it.
 *
 * ── A SECOND STAMP, PER PACKAGE ──────────────────────────────────────────────────────────────────
 * The CLI gate above stamps ONE workspace-wide digest — exactly what it needs, since it only ever
 * rebuilds the whole tree. A parity witness asks a narrower question (is THIS package's dist built
 * from THIS package's source?), and the workspace stamp cannot answer it without false positives: any
 * in-flight edit anywhere in `packages/` would make every witness refuse, and `pnpm --filter X build`
 * never touches the global stamp, so the cure it would print would not cure.
 *
 * So each `packages/<dir>` that carries a `package.json` ALSO gets its own stamp, keyed by that dir
 * name, computed by the SAME `sourceDigest` over its own subtree only. `packageStampPath` is the one
 * path both the writer (here) and the reader (`corpus-read.mjs#assertDistFresh`) use, so the two can
 * never drift onto different files.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const REPO = resolve(process.argv[2] ?? ".");

/** The one path the workspace-wide stamp lives at, shared by every writer and every reader. */
export function globalStampPath(repo) {
  return join(resolve(repo), "node_modules", ".lares-build", "source-digest");
}

/** The one path a per-package stamp lives at, shared by every writer and every reader. */
export function packageStampPath(repo, dir) {
  return join(resolve(repo), "node_modules", ".lares-build", "pkg", dir);
}

/** Every `packages/<dir>` holding its own `package.json` — derived from the filesystem, never a hand list. */
export function workspacePackageDirs(repo) {
  const root = join(resolve(repo), "packages");
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      try { readFileSync(join(root, name, "package.json")); return true; } catch { return false; }
    })
    .sort();
}

/** Stamp one package's dist with a digest of its own source subtree. */
export function stampPackage(repo, dir) {
  const digest = sourceDigest(join(resolve(repo), "packages", dir));
  const path = packageStampPath(repo, dir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, digest);
  return digest;
}

/** Path + bytes of every source carrier, walked in a stable order. Mirrors sourceDigest in the CLI. */
export function sourceDigest(dir) {
  const h = createHash("sha256");
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      if (e.name.endsWith(".prev")) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|mts|cts|json)$/.test(e.name)) continue;
      // The path enters the digest RELATIVE to the walk root: an absolute one would fold the
      // checkout location in, so the same bytes would hash differently per machine and per cwd —
      // and a stamp that cannot travel is a stamp that always reads stale.
      try { h.update(relative(dir, full)); h.update(readFileSync(full)); } catch { /* unreadable — skip */ }
    }
  };
  walk(dir);
  return h.digest("hex");
}

// ---------------------------------------------------------------------------
// A GRAMMAR WASM IS A DIST THE DIGEST ABOVE CANNOT SEE. `sourceDigest` reads `.ts`/`.json`, and a
// tree-sitter package's wasm is compiled from `src/*.c` and `src/**/*.h` — so a scanner edit leaves
// every per-package stamp reading fresh over a wasm built from the bytes before it. The wasm stamp
// binds the two halves of one build: the C sources it came from AND the wasm bytes it produced, so a
// source edit without a rebuild, or a wasm rebuilt from other bytes, both read stale.
//
// Struck only by the explicit `--wasm <dir>` act after `build:wasm`, never by the whole-tree stamp:
// `pnpm -r build` compiles no wasm, and a stamp struck over a build that never ran is a lie.
// ---------------------------------------------------------------------------

/** The one path a grammar-wasm stamp lives at, shared by the writer here and `corpus-read.mjs#assertWasmFresh`. */
export function wasmStampPath(repo, dir) {
  return join(resolve(repo), "node_modules", ".lares-build", "wasm", dir);
}

/** Path + bytes of every C source and header under `<pkgDir>/src` — what `tree-sitter build --wasm` compiles. */
export function nativeSourceDigest(pkgDir) {
  const h = createHash("sha256");
  const root = join(pkgDir, "src");
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = join(d, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(c|h)$/.test(e.name)) continue;
      try { h.update(relative(root, full)); h.update(readFileSync(full)); } catch { /* unreadable — skip */ }
    }
  };
  walk(root);
  return h.digest("hex");
}

/** The stamp's two lines for `<repo>/packages/<dir>` holding `wasmFile` — or null when the wasm is absent. */
export function wasmStampBody(repo, dir, wasmFile) {
  const pkgDir = join(resolve(repo), "packages", dir);
  let wasm;
  try { wasm = readFileSync(join(pkgDir, wasmFile)); } catch { return null; }
  return `src ${nativeSourceDigest(pkgDir)}\nwasm ${wasmFile} ${createHash("sha256").update(wasm).digest("hex")}\n`;
}

/** Every `*.wasm` standing at the root of `packages/<dir>` — the grammar artifacts a wasm stamp covers. */
export function grammarWasms(repo, dir) {
  try {
    return readdirSync(join(resolve(repo), "packages", dir)).filter((f) => f.endsWith(".wasm")).sort();
  } catch { return []; }
}

/** Stamp one package's grammar wasm with the C sources and wasm bytes of the build that just ran. */
export function stampWasm(repo, dir) {
  const wasms = grammarWasms(repo, dir);
  if (wasms.length !== 1) throw new Error(`packages/${dir} holds ${wasms.length} root wasm files; a wasm stamp binds exactly one`);
  const body = wasmStampBody(repo, dir, wasms[0]);
  const path = wasmStampPath(repo, dir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return body;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pkgFlagAt = process.argv.indexOf("--pkg");
  const wasmFlagAt = process.argv.indexOf("--wasm");
  if (wasmFlagAt !== -1) {
    // Grammar-wasm mode: run right after `build:wasm`, binding the wasm to the C sources it came from.
    const dir = process.argv[wasmFlagAt + 1];
    if (!dir) {
      console.error("[stamp-build] --wasm requires a packages/<dir> name");
      process.exit(1);
    }
    try {
      const body = stampWasm(REPO, dir);
      console.log(`[stamp-build] ${dir} wasm ${body.split("\n")[0].slice(4, 20)}… — the grammar wasm now names the C sources it came from`);
    } catch (e) {
      console.error(`[stamp-build] ${e.message}`);
      process.exit(1);
    }
  } else if (pkgFlagAt !== -1) {
    // Single-package mode: stamp ONE package only, leaving the global workspace stamp untouched —
    // the shape a filtered `pnpm --filter X build` cure needs, since it never rebuilds the rest.
    const dir = process.argv[pkgFlagAt + 1];
    if (!dir) {
      console.error("[stamp-build] --pkg requires a packages/<dir> name");
      process.exit(1);
    }
    const digest = stampPackage(REPO, dir);
    console.log(`[stamp-build] ${dir} ${digest.slice(0, 16)}… — this package's dist now names the bytes it came from`);
  } else {
    const digest = sourceDigest(join(REPO, "packages"));
    const stampPath = globalStampPath(REPO);
    mkdirSync(dirname(stampPath), { recursive: true });
    writeFileSync(stampPath, digest);
    // The CLI gate's workspace-wide stamp stands as it always has; a per-package stamp is struck
    // alongside it for every package the tree currently holds, so a full build leaves BOTH readers
    // (the global gate and any package-scoped witness) with a fresh stamp to compare against.
    for (const dir of workspacePackageDirs(REPO)) stampPackage(REPO, dir);
    console.log(`[stamp-build] ${digest.slice(0, 16)}… — the dist now names the bytes it came from`);
  }
}
