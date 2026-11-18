#!/usr/bin/env node
/**
 * land-rule — THE land rule for code into the span, judged by hand for one sha (controller-handoff#/the-seat).
 *
 *   node tools/land-rule.mjs <40-hex sha>      run from a checkout whose origin names the repository
 *
 * The rule: the sha's own CI run (the newest run of the rule's workflow that names the sha) reads `success` on every
 * required check, and the sha descends from the span's current head on GitHub. tools/land-rule.json holds the span, the
 * workflow and the required checks, the ONE list; the repository ruleset on the span names the same checks, so GitHub's
 * native merge queue only runs and orders this rule. When the queue stands dark, lands go serial by the same rule: judge
 * the lane's merge onto the span head here, and land it only on LAND. A lane push runs the Quick gates alone (ci.yml's
 * doorstep quick), so `Test` and `Witnesses` read skipped there and HOLD here: the rule reads the queue's `merge_group` run, or
 * a whole battery dispatched by hand on the sha.
 *
 * Three reads, once each (`gh run list`, `gh run view`, `gh api …/compare`); this tool never waits, polls or watches, so
 * the pace stays the caller's (POLL_FLOOR_S in tools/ci-verdict.mjs governs any read again). It prints one verdict line:
 *   LAND        every required check reads success and the sha descends from the span head
 *   HOLD        a required check reads anything else or no job carries it, or the sha does not descend from the head
 *   UNREAD      no CI run names the sha, or its run still runs: nothing measured it yet, never a LAND
 *   UNREADABLE  GitHub could not be reached (a 5xx, a timeout, a dropped network), never a LAND and never a HOLD
 * Exit: 0 LAND · 1 HOLD · 2 UNREAD or usage · 3 the reader could not read (gh absent, a 4xx) · 4 UNREADABLE.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyFailure } from "./ci-verdict.mjs";
import { ghEnv, repoOfRemote } from "./land-train.mjs";

export const RULE_PATH = join(dirname(fileURLToPath(import.meta.url)), "land-rule.json");

/** The rule as tools/land-rule.json states it: `{ span, workflow, requiredChecks }`, refused by name where malformed. */
export function readRule(path = RULE_PATH) {
  const rule = JSON.parse(readFileSync(path, "utf8"));
  const checks = rule?.requiredChecks;
  if (typeof rule?.span !== "string" || typeof rule?.workflow !== "string" || !Array.isArray(checks) || checks.length === 0
    || !checks.every((c) => typeof c === "string" && c.length > 0) || new Set(checks).size !== checks.length) {
    throw new Error(`land-rule: ${path} states no span, workflow and non-empty list of distinct required checks`);
  }
  return rule;
}

const short = (sha) => String(sha ?? "").slice(0, 9);

/**
 * Judge one sha by the rule. `ops.gh(args)` answers each read as parsed JSON (or throws). Answers
 * `{ word, code, line }`; never throws on a GitHub failure.
 */
export async function landRule({ sha, rule = readRule() }, ops) {
  const verdict = (word, code, why) => ({ word, code, line: `land-rule: ${word} ${short(sha)} — ${why}` });
  try {
    const runs = ops.gh(["run", "list", "--commit", sha, "--workflow", rule.workflow, "--json", "databaseId,status,conclusion,event", "--limit", "20"]);
    const newest = [...(Array.isArray(runs) ? runs : [])].sort((a, b) => b.databaseId - a.databaseId);
    // The queue's merge_group run reads the whole battery on the sha; a doorstep push run reads the Quick gates alone.
    const run = newest.find((r) => r.event === "merge_group") ?? newest[0];
    const holds = [];
    let unread = null;
    let read = null;
    if (!run) unread = `no ${rule.workflow} run names it`;
    else if (run.status !== "completed") unread = `${rule.workflow} run ${run.databaseId} still ${run.status}`;
    else {
      const jobs = ops.gh(["run", "view", String(run.databaseId), "--json", "jobs"])?.jobs ?? [];
      for (const check of rule.requiredChecks) {
        const job = jobs.find((j) => j.name === check);
        if (!job) holds.push(`${rule.workflow} run ${run.databaseId}: no job named ${check}`);
        else if (job.conclusion !== "success") holds.push(`${rule.workflow} run ${run.databaseId}: ${check} reads ${job.conclusion || job.status}`);
      }
      if (run.event !== "merge_group" && jobs.some((j) => rule.requiredChecks.includes(j.name) && j.conclusion === "skipped")) {
        holds.push(`run ${run.databaseId} (${run.event}): a doorstep run reads quick-only, the whole battery reads on the sha's merge_group run, or on a workflow_dispatch run`);
      }
      read = `${rule.workflow} run ${run.databaseId} reads ${rule.requiredChecks.join(", ")} success`;
    }
    const cmp = ops.gh(["api", `repos/{owner}/{repo}/compare/${rule.span}...${sha}`, "--jq", "{status: .status, base: .base_commit.sha}"]);
    const descends = cmp?.status === "ahead" || cmp?.status === "identical";
    if (!descends) holds.push(`does not descend from ${rule.span} ${short(cmp?.base)} (${cmp?.status ?? "unread"})`);
    if (holds.length) return verdict("HOLD", 1, holds.join("; "));
    if (unread) return verdict("UNREAD", 2, `${unread}; UNREAD never lands`);
    return verdict("LAND", 0, `${read}; descends from ${rule.span} ${short(cmp.base)}`);
  } catch (err) {
    const detail = String(err?.stderr || err?.message || err).trim().split("\n")[0];
    if (classifyFailure(err) === "unreadable") return verdict("UNREADABLE", 4, `GitHub could not be reached (${detail}); read again at the house pace`);
    return { word: "REFUSED", code: 3, line: `land-rule: could not read ${short(sha)} (${detail})` };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !/^[0-9a-f]{40}$/.test(argv[0])) {
    console.error("usage: land-rule.mjs <40-hex sha>  (judges the sha by tools/land-rule.json)");
    process.exit(2);
  }
  const cwd = process.cwd();
  let ghe;
  const gh = (args) => {
    ghe ??= ghEnv(process.env, userInfo().homedir,
      repoOfRemote(execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()));
    return JSON.parse(execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000, env: ghe }));
  };
  const v = await landRule({ sha: argv[0] }, { gh });
  (v.code === 3 ? console.error : console.log)(v.line);
  process.exit(v.code);
}
