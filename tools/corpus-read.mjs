// corpus-read — read a carrier the enumeration named, tolerating one that left between the two.
//
// THE WALK AND THE READ ARE TWO MOMENTS. `carrierFiles` enumerates from `git ls-files` and reads each
// candidate under its own try/catch, so the list it returns holds only files that read cleanly AT THAT
// INSTANT. Every consumer then re-reads those paths — and on a tree another agent is committing to, a
// path can be gone by the second read. An unguarded `readFileSync` there throws ENOENT and takes the
// whole witness down.
//
// A WITNESS THAT CRASHES REPORTS RED FOR A REASON THAT IS NOT ABOUT THE CORPUS. That is the instrument
// lying: the operator reads a failing gate and goes looking for a malformed carrier that does not exist.
// Measured 2026-09-12: `frame-shape` died on `bags/lares-history/.../AUTH-ATPROTO.mem` mid-run and passed
// clean seconds later, the corpus never having held a fault.
//
// SKIPPING IS NOT ENOUGH — a silent skip trades a false red for a false green, and a gate that quietly
// stops checking N carriers is worse than one that crashes. So the skip is COUNTED, and every summary
// line says so when the count is non-zero. The honest reading is "I checked 733 of 734; one left the
// tree while I walked it."
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { sourceDigest, packageStampPath, workspacePackageDirs } from "./stamp-build.mjs";

let vanished = 0;

/** A carrier's text, or `null` when it left the tree between the enumeration and this read. */
export function readCarrier(repo, rel) {
  try {
    return readFileSync(join(repo, rel), "utf8");
  } catch {
    vanished++;
    return null;
  }
}

/** How many carriers left the tree mid-walk. Zero on any quiet tree. */
export function vanishedCount() {
  return vanished;
}

/** ` · N left the tree mid-walk` for a summary line, or the empty string when none did. */
export function vanishedNote() {
  return vanished === 0 ? "" : ` · ${vanished} left the tree mid-walk (a parallel commit; re-run to check them)`;
}

// ---------------------------------------------------------------------------
// Dist-shore boot — eleven tools repeated this existsSync-then-import block by hand, each phrasing
// the cure line itself; one drifted the moment a twelfth was added with a typo in the package name.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dist freshness — a witness reads only a dist BUILT FROM the tree's bytes; freshness reads content,
// never clocks. `assertDistFresh` is the one door every dist-shore boot above passes through before
// it imports: it resolves the dist's OWNING package, walks that package's workspace dependency
// closure, and refuses (exit 2, naming the stale package and its cure) the moment any member of that
// closure carries a dist whose per-package stamp disagrees with what its source reads right now.
//
// REUSES THE ONE DIGEST. `sourceDigest` and `packageStampPath` come from `stamp-build.mjs` — the
// same function that WRITES a package's stamp is the function that reads it back here, so the two
// can never name different bytes "the same build".
// ---------------------------------------------------------------------------

/**
 * `{ repo, dir }` for the `packages/<dir>` that holds `distPath`, derived from the path ITSELF by
 * finding its last `packages` segment — never from a caller-supplied repo root, which some callers
 * (`distModule`, `bootTW5Engine`) pass as the package's own `dist/` dir rather than the repo's. Null
 * when the path carries no `packages` segment at all (nothing here owns a stamp to compare against).
 */
function owningPackage(distPath) {
  const parts = resolve(distPath).split(/[\\/]/);
  const at = parts.lastIndexOf("packages");
  if (at === -1 || at + 1 >= parts.length) return null;
  return { repo: parts.slice(0, at).join("/") || "/", dir: parts[at + 1] };
}

/** `{ packageName → dir }`, derived from every workspace package's own `package.json#name` — never a hand list. */
function packageNameToDir(repo) {
  const map = new Map();
  for (const dir of workspacePackageDirs(repo)) {
    try {
      const pkg = JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8"));
      if (pkg.name) map.set(pkg.name, dir);
    } catch { /* unreadable package.json — excluded from the closure */ }
  }
  return map;
}

/** `dir`'s own `package.json#dependencies` entries that read `"workspace:…"`, as `{ name → dir }`. */
function workspaceDepDirs(repo, dir, nameToDir) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8")); }
  catch { return []; }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.entries(deps)
    .filter(([, version]) => typeof version === "string" && version.startsWith("workspace:"))
    .map(([name]) => nameToDir.get(name))
    .filter((d) => d !== undefined);
}

/** `dir` plus every workspace dependency it reaches, transitively — the set a stale LEAF can taint. */
function workspaceClosure(repo, dir, nameToDir, seen = new Set()) {
  if (seen.has(dir)) return seen;
  seen.add(dir);
  for (const dep of workspaceDepDirs(repo, dir, nameToDir)) workspaceClosure(repo, dep, nameToDir, seen);
  return seen;
}

// MEMOIZED PER PROCESS — a witness calls this once per dist it opens, and the same package can sit
// in several closures within one run; digesting its source twice would cost real wall-clock for an
// answer that cannot have changed between the two calls.
const freshnessCache = new Map();

function packageFreshness(repo, dir) {
  if (freshnessCache.has(dir)) return freshnessCache.get(dir);
  const distDir = join(repo, "packages", dir, "dist");
  let result;
  if (!existsSync(distDir)) {
    // No dist to go stale — a package the closure reaches but which builds nothing (or has not been
    // built yet) is the missing-dist case the direct `existsSync` cures above already own.
    result = { stale: false };
  } else {
    const digest = sourceDigest(join(repo, "packages", dir));
    let stamped = null;
    try { stamped = readFileSync(packageStampPath(repo, dir), "utf8").trim(); } catch { stamped = null; }
    result = { stale: stamped !== digest };
  }
  freshnessCache.set(dir, result);
  return result;
}

/**
 * Refuse (exit 2) when `distPath`'s owning package, or any workspace package it depends on, carries
 * a dist whose stamp disagrees with the source the tree holds right now. A no-op when `distPath`
 * runs outside `packages/` — nothing here owns a per-package stamp to compare against. `repo` is
 * accepted for callers that already hold it, but the package root is always DERIVED from `distPath`
 * itself (see `owningPackage`), since several callers pass a dist-local root, not the repo's.
 */
export function assertDistFresh(repo, distPath, toolName) {
  const owning = owningPackage(distPath);
  if (!owning) return;
  const absRepo = resolve(owning.repo);
  const dir = owning.dir;
  const nameToDir = packageNameToDir(absRepo);
  for (const d of workspaceClosure(absRepo, dir, nameToDir)) {
    if (!packageFreshness(absRepo, d).stale) continue;
    let name = d;
    try { name = JSON.parse(readFileSync(join(absRepo, "packages", d, "package.json"), "utf8")).name ?? d; } catch { /* fall back to dir */ }
    console.error(`[${toolName}] stale build: ${name} dist was not built from the current source\n  cure: pnpm --filter ${name} build && node tools/stamp-build.mjs . --pkg ${d}`);
    process.exit(2);
  }
}

/**
 * THE ONE FINDER of the corpus, loaded from the built shore. A hardcoded glob answers a question
 * about PATHS; the law asks about DECLARATIONS, and the two disagreed on the runtime kernel face for
 * three rulings — so every witness walks from here, never from its own `find`/glob.
 *
 * Exits loudly (2), naming the exact cure, when the dist a caller needs has never been built — the
 * absence NAMES its cure rather than reading clean over an unbuilt tree.
 */
export async function distCarrierFiles(repo, toolName) {
  const distCarriers = join(repo, "packages/lararium-tw5/dist/carrier-files.js");
  if (!existsSync(distCarriers)) {
    console.error(`[${toolName}] no built shore at ${distCarriers}\n  cure: pnpm --filter @lararium/tw5 build`);
    process.exit(2);
  }
  assertDistFresh(repo, distCarriers, toolName);
  return import(distCarriers);
}

/**
 * Any other built module beneath `dist` (or an absolute path, e.g. the frame package's shore) a tool
 * needs before it can run — same loud exit, same cure line, so a witness that forgets to build one
 * dependency reads the same way whichever dependency it forgot.
 */
export async function distModule(dist, relOrAbs, toolName, cure = "pnpm --filter @lararium/tw5 build") {
  const at = relOrAbs.startsWith("/") ? relOrAbs : join(dist, relOrAbs);
  if (!existsSync(at)) {
    console.error(`[${toolName}] no built shore at ${at}\n  cure: ${cure}`);
    process.exit(2);
  }
  assertDistFresh(dist, at, toolName);
  return import(at);
}

/**
 * Boots a vanilla TW5 engine from the built shore — the oracle three witnesses (head-parity,
 * sigil-parity, quote-positionals) each booted by hand, identically. Holds no grammar on purpose: its
 * wiki serves as the parse ORACLE these witnesses measure their own reading against.
 */
export async function bootTW5Engine(dist, toolName) {
  const { TW5Engine } = await distModule(dist, "tw5-vm.js", toolName);
  const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await distModule(dist, "generated-tw5-version.js", toolName);
  const core = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
  if (!existsSync(core)) {
    console.error(`[${toolName}] no TW5 core blob at ${core}\n  cure: pnpm --filter @lararium/tw5 build:tw5-vendor`);
    process.exit(2);
  }
  const engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(core)));
  const wiki = engine.wiki ?? engine._tw?.wiki;
  return { engine, wiki };
}

// ---------------------------------------------------------------------------
// CLI preflight — a shell witness that imports a dist by its own inline `node -e`, rather than through
// `distModule`, cannot call `assertDistFresh` as a function. This gives it a process to call instead:
// one dist path per argument, same refusal, same exit code, no pipe needed to read it.
//
//   node tools/corpus-read.mjs --assert-fresh <dist-path> [<dist-path> …]
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const flagAt = process.argv.indexOf("--assert-fresh");
  if (flagAt === -1) {
    console.error("usage: node tools/corpus-read.mjs --assert-fresh <dist-path> [<dist-path> …]");
    process.exit(1);
  }
  const paths = process.argv.slice(flagAt + 1);
  for (const p of paths) assertDistFresh(process.cwd(), p, "corpus-read");
}
