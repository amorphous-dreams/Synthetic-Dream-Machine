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
const STAMP = join(REPO, "node_modules", ".lares-build", "source-digest");

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const pkgFlagAt = process.argv.indexOf("--pkg");
  if (pkgFlagAt !== -1) {
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
    mkdirSync(dirname(STAMP), { recursive: true });
    writeFileSync(STAMP, digest);
    // The CLI gate's workspace-wide stamp stands as it always has; a per-package stamp is struck
    // alongside it for every package the tree currently holds, so a full build leaves BOTH readers
    // (the global gate and any package-scoped witness) with a fresh stamp to compare against.
    for (const dir of workspacePackageDirs(REPO)) stampPackage(REPO, dir);
    console.log(`[stamp-build] ${digest.slice(0, 16)}… — the dist now names the bytes it came from`);
  }
}
