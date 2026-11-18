#!/usr/bin/env node
/**
 * The shared list of canon paths (tools/ci-ignored-paths.json): a push that changes only these raises no held-out run, and
 * runs CI's doorstep set alone (the scope job reads it through `scope` below).
 *
 *   node tools/ci-ignored-paths.mjs scope      on a runner: print `canon=true|false` for this push (GITHUB_OUTPUT form)
 *
 * `scope` reads the runner's own GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_SHA and the event file's `before`, never a value
 * spliced into the shell line.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

if (process.argv[1] && basename(process.argv[1]) === "ci-ignored-paths.mjs") {
  if (process.argv[2] !== "scope") {
    console.error("usage: node tools/ci-ignored-paths.mjs scope");
    process.exit(2);
  }
  const env = process.env;
  let before = null;
  try { before = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).before ?? null; } catch { /* no event file: a new ref's parent stands in */ }
  const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const r = pushScope({ event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, before, sha: env.GITHUB_SHA }, git);
  console.error(`ci-ignored-paths scope: canon=${r.canon} — ${r.why}`);
  for (const p of r.paths) console.error(`  ${p}`);
  console.log(`canon=${r.canon}`);
}
