#!/usr/bin/env node
/**
 * lane-pick — carry a lane's commits onto the branch the checkout stands on, one cherry-pick per commit, resolving the
 * conflict shapes the house resolves by law and stopping by name on any other (controller-handoff#/the-lane-law).
 *
 *   node tools/lane-pick.mjs [--repo <dir>] <base>..<lane>     (a bare <sha> picks that one commit)
 *
 * The laws, read per conflicted path:
 *   generated   a generated artifact (GENERATED below) takes the span's side; the receipt names it under `rebuildOwed`,
 *               since the span's bundle carries the lane's source change only after a rebuild.
 *   reseal      a `.mem` carrier whose every conflict hunk holds one `bcc=` seal line a side takes the span's line, then
 *               re-seals with `lares meme normalize <file>` (LARES_BIN names another `lares`).
 *   evergreen   `tools/evergreen-boundary.mjs`, when the lane's own diff touches only its CEILINGS line and its EXCEPTIONS
 *               block, takes the span's side; the receipt names the lane's intended ceilings and exception count, which
 *               the lane re-earns against the span's evergreen run.
 *   empty       a commit that lands no change (empty, or empty once the laws took the span's side) skips.
 * Any other conflict stops: the law-resolved paths stay staged, the rest stay conflicted, and the cherry-pick stays open
 * for a hand (`git cherry-pick --continue` or `--abort`).
 *
 * Output: one JSON receipt on stdout { range, picked[{sha, onto, subject, resolved[{path, law}]}], skipped[{sha, subject,
 * why}], rebuildOwed[path], evergreen[{sha, subject, ceilings, exceptions}], stopped: null | {sha, subject, paths[{path,
 * why}]} }. Exit 0 the range picked whole · 1 stopped for a hand · 2 usage, a dirty tree or a pick already open.
 * It never pushes; the span push stays its own gated step (tools/span-push.mjs).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The generated artifacts: each rebuilds from source, so its conflict carries no hand-made bytes. */
export const GENERATED = [
  "genesis/unbaked.json",
  "packages/lararium-tw5/plugins/lares-memetic-wikitext.json",
  "packages/lararium-tw5/plugins/standalone/lares-memetic-wikitext.attestation.json",
  "packages/lararium-tw5/plugins/standalone/lares-memetic-wikitext.tid",
  "packages/lararium-tw5/src/plugin-tiddler.generated.ts",
];
export const EVERGREEN = "tools/evergreen-boundary.mjs";

const HUNK = /<<<<<<< [^\n]*\n([\s\S]*?)(?:\|\|\|\|\|\|\| [^\n]*\n[\s\S]*?)?=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g;

/** True where every conflict hunk holds exactly one line a side and each carries a `bcc=` seal. */
export function sealOnly(text) {
  const hunks = [...text.matchAll(HUNK)];
  const one = (side) => side.split("\n").length === 2 && side.includes("bcc=");
  return hunks.length > 0 && hunks.every(([, ours, theirs]) => one(ours) && one(theirs));
}
/** The text with every conflict hunk replaced by its ours side. */
export const takeOurs = (text) => text.replace(HUNK, (_, ours) => ours);

/** The 1-based line spans of the CEILINGS line and the EXCEPTIONS block in an evergreen-boundary source. */
export function boundaryRegions(text) {
  const lines = text.split("\n");
  const ceil = lines.findIndex((l) => /^export const CEILINGS = /.test(l));
  const start = lines.findIndex((l) => /^export const EXCEPTIONS = \[/.test(l));
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && /^\];/.test(l));
  const regions = [];
  if (ceil >= 0) regions.push([ceil + 1, ceil + 1]);
  if (start >= 0 && end > start) regions.push([start + 1, end + 1]);
  return regions;
}
/** True where each `-U0` hunk header of a diff touches only lines inside the regions (an insertion lands inside a block). */
export function hunksInside(diff, regions) {
  const heads = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? /gm)];
  return heads.length > 0 && heads.every(([, a, b]) => {
    const from = Number(a), count = b === undefined ? 1 : Number(b);
    if (count === 0) return regions.some(([s, e]) => from >= s && from < e);
    return regions.some(([s, e]) => from >= s && from + count - 1 <= e);
  });
}
/** The ceilings and the exception count an evergreen-boundary source declares. */
export function boundaryCounts(text) {
  const line = /^export const CEILINGS = \{([^\n]*)\};/m.exec(text)?.[1] ?? "";
  const ceilings = Object.fromEntries([...line.matchAll(/"?([\w-]+)"?\s*:\s*(\d+)/g)].map(([, k, v]) => [k, Number(v)]));
  const block = /^export const EXCEPTIONS = \[\n([\s\S]*?)^\];/m.exec(text)?.[1] ?? "";
  return { ceilings, exceptions: block.split("\n").filter((l) => /^\s*\{ rule:/.test(l)).length };
}

export function lanePick({ repo, range, lares = process.env.LARES_BIN || "lares" }) {
  const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_EDITOR: "true", ...env } });
  const git = (...args) => run("git", args);
  const out = (...args) => { const r = git(...args); if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`); return r.stdout.trim(); };
  const picking = () => git("rev-parse", "-q", "--verify", "CHERRY_PICK_HEAD").status === 0;
  const receipt = { range, picked: [], skipped: [], rebuildOwed: [], evergreen: [], stopped: null };

  if (picking()) return { code: 2, refusal: "a cherry-pick already stands open; finish or abort it first" };
  if (out("status", "--porcelain", "--untracked-files=no")) return { code: 2, refusal: "the tree is dirty; commit or set the changes aside first" };
  const shas = range.includes("..") ? out("rev-list", "--reverse", range).split("\n").filter(Boolean) : [out("rev-parse", "--verify", `${range}^{commit}`)];

  for (const sha of shas) {
    const subject = out("log", "-1", "--format=%s", sha);
    const resolved = [];
    const r = git("cherry-pick", sha);
    if (r.status !== 0) {
      if (!picking()) { receipt.stopped = { sha, subject, paths: [{ path: "", why: `cherry-pick failed: ${(r.stderr || r.stdout).trim()}` }] }; return { code: 1, receipt }; }
      const unmerged = out("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
      const stuck = [];
      for (const path of unmerged) {
        const why = resolvePath({ path, sha, subject, git, out, run, lares, repo, receipt });
        if (why) stuck.push({ path, why }); else resolved.push({ path, law: lawOf(path) });
      }
      if (stuck.length) { receipt.stopped = { sha, subject, paths: stuck, resolved }; if (!resolved.length) delete receipt.stopped.resolved; return { code: 1, receipt }; }
      if (git("diff", "--cached", "--quiet").status === 0) {
        out("cherry-pick", "--skip");
        receipt.skipped.push({ sha, subject, why: resolved.length ? "empty once the laws took the span's side" : "empty" });
        continue;
      }
      const c = git("cherry-pick", "--continue");
      if (c.status !== 0) { receipt.stopped = { sha, subject, paths: [{ path: "", why: `cherry-pick --continue failed: ${(c.stderr || c.stdout).trim()}` }] }; return { code: 1, receipt }; }
    }
    receipt.picked.push({ sha, onto: out("rev-parse", "HEAD"), subject, resolved });
  }
  return { code: 0, receipt };
}

function lawOf(path) {
  if (GENERATED.includes(path)) return "generated";
  if (path === EVERGREEN) return "evergreen";
  return "reseal";
}

/** Resolves one conflicted path by its law and stages it; answers null, or why no law resolves it. */
function resolvePath({ path, sha, subject, git, out, run, lares, repo, receipt }) {
  const file = join(repo, path);
  const stage = (n) => git("show", `:${n}:${path}`);
  if (stage(2).status !== 0 || stage(3).status !== 0) return "deleted on one side";
  if (GENERATED.includes(path)) {
    out("checkout", "--ours", "--", path); out("add", "--", path);
    if (!receipt.rebuildOwed.includes(path)) receipt.rebuildOwed.push(path);
    return null;
  }
  if (path === EVERGREEN) {
    const base = stage(1);
    if (base.status !== 0) return "no base for the evergreen boundary";
    const diff = out("diff", "-U0", `${sha}^`, sha, "--", path);
    if (!hunksInside(diff, boundaryRegions(base.stdout))) return "evergreen change outside CEILINGS and EXCEPTIONS";
    const intended = boundaryCounts(stage(3).stdout);
    out("checkout", "--ours", "--", path); out("add", "--", path);
    receipt.evergreen.push({ subject, sha, ...intended });
    return null;
  }
  if (path.endsWith(".mem")) {
    const text = readFileSync(file, "utf8");
    if (!sealOnly(text)) return "text conflict in a meme";
    writeFileSync(file, takeOurs(text));
    const seal = run(lares, ["meme", "normalize", path]);
    if (seal.status !== 0) return `lares meme normalize failed: ${(seal.stderr || seal.stdout || seal.error?.message || "").trim()}`;
    out("add", "--", path);
    return null;
  }
  return "no law resolves it";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  let repo = process.cwd();
  const i = argv.indexOf("--repo");
  if (i >= 0) { repo = resolve(argv[i + 1] ?? ""); argv.splice(i, 2); }
  if (argv.length !== 1 || argv[0].startsWith("-")) { console.error("usage: lane-pick.mjs [--repo <dir>] <base>..<lane> | <sha>"); process.exit(2); }
  const { code, receipt, refusal } = lanePick({ repo, range: argv[0] });
  if (refusal) console.error(`lane-pick: REFUSED, ${refusal}`);
  if (receipt) console.log(JSON.stringify(receipt, null, 2));
  process.exit(code);
}
