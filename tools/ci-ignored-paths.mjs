#!/usr/bin/env node
/**
 * The shared list of canon paths (tools/ci-ignored-paths.json): a push that changes only these raises no held-out run, and
 * runs CI's doorstep set alone (the scope job reads it through `scope` below).
 *
 *   node tools/ci-ignored-paths.mjs scope      on a runner: print `canon`, `packages`, `cells` and `witnesses` for this push
 *                                              (GITHUB_OUTPUT form; a lane push runs what it touches, see `laneScope`)
 *
 * `scope` reads the runner's own GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_SHA and the event file's `before`, never a value
 * spliced into the shell line.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_CELLS } from "./ci-cells.mjs";

export const IGNORED_PATHS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ci-ignored-paths.json"), "utf8")).paths;

/** A GitHub Actions path glob as a RegExp: `*` stays inside a segment, `**` crosses segments, `**` + `/` may match no directory. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
    } else if (ch === "*") out += "[^/]*";
    else out += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}
const MATCHERS = IGNORED_PATHS.map(globToRegExp);

export const isIgnoredPath = (path) => MATCHERS.some((re) => re.test(path));
/** True when the change names at least one path and every path is ignored; an empty change reads nothing ignored. */
export const onlyIgnoredPaths = (paths) => paths.length > 0 && paths.every(isIgnoredPath);

/** develop and main read a push against its own `before`; every other branch (a lane, a feature span) against its merge base with develop. */
const SPAN_REF = /^refs\/heads\/(develop|main)$/;
const NO_SHA = /^0*$/;

/**
 * Whether one push changes canon alone: `{ canon, base, paths, why }`. `git(args)` runs git in the checkout and returns its
 * stdout (it throws on a fault). Any event but a push, any git fault and an empty change read `canon: false`, so the run
 * falls back to the full battery (or a lane's doorstep), never to less.
 *   develop/main — the push's `before`: the parent of a one-commit push, and every commit of a longer one; a new ref with
 *                  no `before` reads against the commit's parent.
 *   other branch — the merge base with develop: everything the branch carries.
 */
export function pushScope({ event, ref, before, sha }, git) {
  if (event !== "push") return { canon: false, base: null, paths: [], why: `${event} runs on its own law, never the canon doorstep` };
  let base;
  try {
    if (SPAN_REF.test(ref ?? "")) {
      if (before && !NO_SHA.test(before)) {
        git(["fetch", "--no-tags", "--filter=blob:none", "--depth=1", "origin", before]);
        base = before;
      } else {
        git(["fetch", "--no-tags", "--filter=blob:none", "--depth=2", "origin", sha]);
        base = git(["rev-parse", `${sha}^`]).trim();
      }
    } else {
      git(["fetch", "--no-tags", "--filter=blob:none", "--unshallow", "origin", "develop"]);
      base = git(["merge-base", "FETCH_HEAD", sha]).trim();
    }
    const paths = git(["diff", "--no-renames", "--name-only", "-z", base, sha]).split("\0").filter(Boolean);
    const canon = onlyIgnoredPaths(paths);
    return { canon, base, paths, why: canon ? `${paths.length} canon paths alone since ${base}` : paths.length ? `code changed since ${base}` : `no change since ${base}` };
  } catch (err) {
    return { canon: false, base: base ?? null, paths: [], why: `the push could not be read (${String(err?.stderr || err?.message || err).trim().split("\n")[0]}): it runs as code` };
  }
}

// ── a lane runs what it touches ─────────────────────────────────────────────────────────────────────
const LANE_REF = /^refs\/heads\/(develop--|lane\/)/;
/** The dirs a package suite stands in: one workspace package each. Any other path (tools/, .github/, root files) reads unmapped. */
const PACKAGE_DIR = /^(packages\/[^/]+|tests|TiddlyWiki5)(?:\/|$)/;
/** A name the cells' run lines carry: a package name of the workspace's own shape, nothing a shell would read. */
const SAFE_NAME = /^[@a-z0-9][\w.\/-]*$/i;
const ALL_CELLS = TEST_CELLS.map((c) => c.cell);
const full = (r, why) => ({ ...r, packages: "all", cells: ALL_CELLS, witnesses: true, why });

/** The workspace graph at `sha`: `{ dir: { name, deps } }`, read through git (the scope's sparse checkout holds tools/ alone). */
function readWorkspace(sha, git) {
  const dirs = new Set(TEST_CELLS.flatMap((c) => c.packages.map((p) => p.dir)));
  for (const d of git(["ls-tree", "--name-only", sha, "packages/"]).split("\n").map((s) => s.trim()).filter(Boolean)) dirs.add(d);
  const known = Object.fromEntries(TEST_CELLS.flatMap((c) => c.packages.map((p) => [p.dir, p.name])));
  const graph = {};
  for (const dir of dirs) {
    let pkg = null;
    try { pkg = JSON.parse(git(["show", `${sha}:${dir}/package.json`])); } catch { /* a submodule or a dir with no manifest */ }
    const name = pkg?.name ?? known[dir];
    if (!name) continue;
    const deps = Object.entries({ ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies, ...pkg?.optionalDependencies })
      .filter(([, v]) => String(v).startsWith("workspace:")).map(([k]) => k);
    graph[dir] = { name, deps };
  }
  return graph;
}

/**
 * What one push runs: pushScope's canon answer, plus `packages` (`all`, `none`, or the names a lane's cells run), `cells` (the
 * test cells holding one of them) and `witnesses` (whether the witness cells run). Only a lane push (`develop--*`, `lane/*`)
 * narrows: its diff's packages, closed over every in-repo package that depends on them. A path outside a package dir
 * (tools/, the workflows, the root manifest or lockfile, a non-meme file under bags/), a package no test cell runs, an
 * unread graph and every other event select the full battery: the selection fails open to more cells, never fewer.
 * Canon moved beside code runs the witness cells too; canon alone keeps the doorstep.
 */
export function laneScope(ctx, git) {
  const r = pushScope(ctx, git);
  if (r.canon) return { ...r, packages: "none", cells: [], witnesses: false };
  if (ctx.event !== "push" || !LANE_REF.test(ctx.ref ?? "")) return full(r, `${r.why}; the full battery (no lane push)`);
  if (r.paths.length === 0) return full(r, `${r.why}; the full battery (no diff read)`);
  const code = r.paths.filter((p) => !isIgnoredPath(p));
  const stray = code.find((p) => !PACKAGE_DIR.test(p));
  if (stray) return full(r, `${r.why}; the full battery (${stray} sits outside every package)`);
  let graph;
  try { graph = readWorkspace(ctx.sha, git); } catch (err) { return full(r, `${r.why}; the full battery (the workspace graph could not be read: ${String(err?.message ?? err).split("\n")[0]})`); }
  const touched = new Set();
  for (const p of code) {
    const dir = PACKAGE_DIR.exec(p)[1];
    if (!graph[dir]) return full(r, `${r.why}; the full battery (${dir} names no workspace package)`);
    touched.add(graph[dir].name);
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const { name, deps } of Object.values(graph)) if (!touched.has(name) && deps.some((d) => touched.has(d))) { touched.add(name); grew = true; }
  }
  const packages = [...touched].sort();
  const tested = new Set(TEST_CELLS.flatMap((c) => c.packages.map((p) => p.name)));
  const untested = packages.find((n) => !tested.has(n));
  if (untested) return full(r, `${r.why}; the full battery (${untested} rides no test cell)`);
  if (!packages.every((n) => SAFE_NAME.test(n))) return full(r, `${r.why}; the full battery (a package name the run line cannot carry)`);
  const cells = TEST_CELLS.filter((c) => c.packages.some((p) => touched.has(p.name))).map((c) => c.cell);
  const witnesses = code.length < r.paths.length;
  return { ...r, packages, cells, witnesses, why: `${r.why}; the lane runs ${packages.join(" ")} in ${cells.join(" ")}${witnesses ? " and the witness cells (canon moved)" : ""}` };
}

/** The GITHUB_OUTPUT lines: `packages` comma-joined (or `all`/`none`), `cells` space-joined. */
export const scopeLines = (s) => [
  `canon=${s.canon}`, `packages=${Array.isArray(s.packages) ? s.packages.join(",") : s.packages}`, `cells=${s.cells.join(" ")}`, `witnesses=${s.witnesses}`,
].join("\n");

if (process.argv[1] && basename(process.argv[1]) === "ci-ignored-paths.mjs") {
  if (process.argv[2] !== "scope") {
    console.error("usage: node tools/ci-ignored-paths.mjs scope");
    process.exit(2);
  }
  const env = process.env;
  let before = null;
  try { before = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).before ?? null; } catch { /* no event file: a new ref's parent stands in */ }
  const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const r = laneScope({ event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, before, sha: env.GITHUB_SHA }, git);
  console.error(`ci-ignored-paths scope: canon=${r.canon} — ${r.why}`);
  for (const p of r.paths) console.error(`  ${p}`);
  console.log(scopeLines(r));
}
