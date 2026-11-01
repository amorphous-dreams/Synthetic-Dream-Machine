#!/usr/bin/env node
/**
 * security-read-status — the merge queue's security-read gate, and the controller's door that opens it.
 *
 * ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────
 * The span lands through GitHub's merge queue. A queued pull request that touches a SECURITY-CLASS path (the one table
 * below) lands only after the controller read it: the controller posts the commit status `security-read: success` on the
 * PR head after a SHIP (`post`). The `security-read-gate` job of ci.yml runs on the queue's merge-group run, finds the PRs
 * that group carries, reads each head's statuses, and fails by PR number on any security-class PR whose newest
 * `security-read` status on its head reads anything but success. A PR touching no security-class path needs no status.
 * The gate is a verifier: `evaluateGroup` is pure, so the tests plant each refusal without a run.
 *
 * The status sits on the PR HEAD, never on the group commit (a new sha no status can pre-exist on). A push to the PR after
 * its read moves the head and leaves the new head unread: the gate refuses it until the controller reads again.
 *
 * Usage:
 *   security-read-status.mjs post --pr <n> [--state success|failure|pending] [--description <text>] [--repo <owner/repo>]
 *   security-read-status.mjs gate        (in the merge_group run: GITHUB_REPOSITORY GITHUB_REF GITHUB_SHA BASE_SHA GH_TOKEN)
 *   security-read-status.mjs paths       print the table
 */
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTEXT = "security-read";

/**
 * THE SECURITY-CLASS PATHS — the one list the controller and the gate both read. A glob reads as GitHub's do: `**` crosses
 * directories, `*` stays inside one. Each row names why a change there needs the controller's read before it lands. A test
 * holds every row to at least one tracked file, so a rename cannot empty a row quietly.
 */
export const SECURITY_CLASS_PATHS = Object.freeze([
  { glob: ".github/workflows/**", why: "CI law: a workflow edit changes what every later change must pass" },
  { glob: ".github/CODEOWNERS", why: "ownership: who must read a change" },
  { glob: ".claude/settings.json", why: "the agents' own permissions" },
  { glob: "tools/land-train.mjs", why: "the landing instrument" },
  { glob: "tools/ci-verdict.mjs", why: "the verdict every land reads" },
  { glob: "tools/ci-cells.mjs", why: "the test and witness gates" },
  { glob: "tools/e2e-shards.mjs", why: "the e2e merge gate" },
  { glob: "tools/security-read-status.mjs", why: "this gate" },
  { glob: "tools/witness-all.sh", why: "the witness roster" },
  { glob: "packages/*/src/**/*custody*", why: "key custody" },
  { glob: "packages/*/src/**/*sealed*", why: "sealed carriers" },
  { glob: "packages/*/src/**/*vault*", why: "the vault" },
  { glob: "packages/*/src/**/*crypto*", why: "cryptography" },
  { glob: "packages/*/src/**/*face-gate*", why: "the face gate" },
  { glob: "packages/*/src/**/*admit*", why: "admission" },
  { glob: "packages/lararium-keyhive/**", why: "the keyhive capability layer" },
]);

/** One GitHub glob as a RegExp over a whole path. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}
export const matchesGlob = (glob, path) => globToRegExp(glob).test(path);
export const isSecurityClassPath = (path) => SECURITY_CLASS_PATHS.some((r) => matchesGlob(r.glob, path));

/** The tracked files, for the test that holds every table row to a real file. */
export function trackedFiles(root = ROOT) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
}

/**
 * The PR numbers a merge group carries: the one its queue ref names (`gh-readonly-queue/<base>/pr-<n>-<sha>`) and every
 * `#<n>` of the merge subjects between the base and the group. Sorted, each once.
 */
export function queuePrNumbers({ ref, subjects = [] }) {
  const m = /^(?:refs\/heads\/)?gh-readonly-queue\/.+\/pr-(\d+)-[0-9a-f]+$/.exec(ref ?? "");
  if (!m) throw new Error(`security-read: ${JSON.stringify(ref)} is no queue ref (gh-readonly-queue/<base>/pr-<n>-<sha>)`);
  const found = new Set([Number(m[1])]);
  for (const s of subjects) for (const hit of s.matchAll(/Merge pull request #(\d+)\b/g)) found.add(Number(hit[1]));
  return [...found].sort((a, b) => a - b);
}

/**
 * The gate's whole law. `prs` is `[{ number, headSha, files, statuses }]`, `statuses` oldest first (`{ context, state }`).
 * Returns `{ ok, problems, reads }`: `reads` counts the PRs that needed the controller's read.
 */
export function evaluateGroup({ prs }) {
  const problems = [];
  let reads = 0;
  if (!Array.isArray(prs) || prs.length === 0) problems.push("empty group: the gate found no pull request in the merge group, so it measured nothing");
  for (const p of prs ?? []) {
    if (!Array.isArray(p.files) || p.files.length === 0) { problems.push(`unread files: PR #${p.number} came with no file list, so the gate cannot call it plain`); continue; }
    const touched = p.files.filter(isSecurityClassPath);
    if (touched.length === 0) continue;
    reads++;
    const mine = (p.statuses ?? []).filter((s) => s.context === CONTEXT);
    const newest = mine.at(-1)?.state ?? null;
    if (newest !== "success") {
      problems.push(`unread: PR #${p.number} (head ${String(p.headSha).slice(0, 9)}) touches ${touched.length} security-class path(s), e.g. ${touched[0]}, and its newest ${CONTEXT} status reads ${newest ?? "absent"}`);
    }
  }
  return { ok: problems.length === 0, problems, reads };
}

/** The `gh` arguments that post the status on one sha. */
export function postStatusArgs({ repo, sha, state, description = "security-read: the controller read this head" }) {
  if (!["success", "failure", "pending", "error"].includes(state)) throw new Error(`security-read: state ${JSON.stringify(state)} is none of success, failure, pending, error`);
  if (!/^[0-9a-f]{7,40}$/.test(String(sha))) throw new Error(`security-read: sha ${JSON.stringify(sha)} is no commit sha`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo))) throw new Error(`security-read: repo ${JSON.stringify(repo)} is no owner/name`);
  return ["api", `repos/${repo}/statuses/${sha}`, "-f", `state=${state}`, "-f", `context=${CONTEXT}`, "-f", `description=${description.slice(0, 140)}`];
}

// ── the doors ────────────────────────────────────────────────────────────────────────────────────

const gh = (args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const flag = (args, name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };

function repoName(args) {
  return flag(args, "--repo") ?? process.env.GITHUB_REPOSITORY ?? JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
}

function cliPost(args) {
  const repo = repoName(args);
  const n = Number(flag(args, "--pr"));
  if (!Number.isInteger(n) || n < 1) throw new Error("usage: security-read-status.mjs post --pr <n> [--state success|failure|pending] [--description <text>]");
  // The sha comes from the PR itself, never from the caller: the status lands on the head the gate will read.
  const sha = JSON.parse(gh(["api", `repos/${repo}/pulls/${n}`])).head.sha;
  gh(postStatusArgs({ repo, sha, state: flag(args, "--state") ?? "success", description: flag(args, "--description") }));
  console.log(`security-read: posted ${flag(args, "--state") ?? "success"} on PR #${n} head ${sha}`);
}

function cliGate() {
  const repo = process.env.GITHUB_REPOSITORY;
  const ref = process.env.GITHUB_REF;
  const base = process.env.BASE_SHA;
  if (!repo || !ref || !base) throw new Error("security-read gate: GITHUB_REPOSITORY, GITHUB_REF and BASE_SHA must be set");
  const subjects = execFileSync("git", ["log", "--first-parent", "--format=%s", `${base}..${process.env.GITHUB_SHA ?? "HEAD"}`], { encoding: "utf8" }).split("\n").filter(Boolean);
  const prs = queuePrNumbers({ ref, subjects }).map((number) => {
    const head = JSON.parse(gh(["api", `repos/${repo}/pulls/${number}`])).head.sha;
    const files = gh(["api", "--paginate", `repos/${repo}/pulls/${number}/files`, "--jq", ".[].filename"]).split("\n").filter(Boolean);
    // The API lists a context's statuses newest first; the law reads oldest first.
    const statuses = JSON.parse(gh(["api", `repos/${repo}/commits/${head}/statuses?per_page=100`])).map((s) => ({ context: s.context, state: s.state })).reverse();
    return { number, headSha: head, files, statuses };
  });
  const verdict = evaluateGroup({ prs });
  console.log(`SECURITY-READ-GATE: ok=${verdict.ok} prs=${prs.map((p) => `#${p.number}`).join(",")} needingRead=${verdict.reads}`);
  for (const p of verdict.problems) console.error(`SECURITY-READ-GATE problem: ${p}`);
  process.exitCode = verdict.ok ? 0 : 1;
}

if (process.argv[1] && basename(process.argv[1]) === "security-read-status.mjs") {
  const [sub, ...rest] = process.argv.slice(2);
  try {
    if (sub === "post") cliPost(rest);
    else if (sub === "gate") cliGate();
    else if (sub === "paths") for (const r of SECURITY_CLASS_PATHS) console.log(`${r.glob}\t${r.why}`);
    else { console.error("usage: security-read-status.mjs post|gate|paths"); process.exitCode = 2; }
  } catch (err) {
    console.error(`security-read-status: ${err.message}`);
    process.exitCode = 1;
  }
}
