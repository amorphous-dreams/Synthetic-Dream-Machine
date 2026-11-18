// land-rule.test — the land rule for code into the span, judged through injected hands and one stand-in `gh` on PATH: no
// test reads GitHub. The required-check list lives in tools/land-rule.json alone; a weld holds each check to a job the CI
// workflow raises, so the list cannot name a check no run carries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { landRule, readRule, RULE_PATH } from "./land-rule.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SHA = "a".repeat(40);
const SPAN_HEAD = "b".repeat(40);
const RULE = readRule();

/** A green job list over every required check, with one row moved by `patch`. */
const jobs = (patch = {}) => [
  ...RULE.requiredChecks.map((name) => ({ name, status: "completed", conclusion: "success", ...(patch[name] ?? {}) })).filter((j) => !j.drop),
  { name: "Test cell unit", status: "completed", conclusion: "success" },
];

/** Hands that answer each gh read from data (or throw `error`) and record every call. */
function hands({ runs = [{ databaseId: 42, status: "completed", conclusion: "success", event: "merge_group" }], view = { jobs: jobs() },
  compare = { status: "ahead", base: SPAN_HEAD }, error = null } = {}) {
  const calls = [];
  return {
    calls,
    gh: (args) => {
      calls.push(args.join(" "));
      if (error) throw error;
      if (args[0] === "run" && args[1] === "list") return runs;
      if (args[0] === "run" && args[1] === "view") return view;
      if (args[0] === "api") return compare;
      throw new Error(`unscripted gh ${args.join(" ")}`);
    },
  };
}

test("the rule names one span, one workflow and the four required checks, in one file", () => {
  assert.equal(RULE_PATH, join(HERE, "land-rule.json"));
  assert.equal(RULE.span, "develop");
  assert.equal(RULE.workflow, "CI");
  assert.deepEqual(RULE.requiredChecks, ["Quick gates", "Test", "Witnesses", "E2E / Merge shard reports"]);
});

test("WELD: every required check names a job the CI workflow raises (a `Caller / Called` check through the called workflow)", () => {
  const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  /** The display names of a workflow's top-level jobs, each with the workflow it calls (if any). */
  const jobsOf = (text) => {
    const out = [];
    for (const block of text.split(/^ {2}(?=[A-Za-z0-9_-]+:\s*$)/m).slice(1)) {
      const name = /^ {4}name:\s*(.+?)\s*$/m.exec(block)?.[1];
      const uses = /^ {4}uses:\s*\.\/(\.github\/workflows\/[^\s]+)\s*$/m.exec(block)?.[1];
      if (name) out.push({ name, uses });
    }
    return out;
  };
  const top = jobsOf(ci.slice(ci.search(/^jobs:\s*$/m)));
  for (const check of RULE.requiredChecks) {
    const [caller, called] = check.split(" / ");
    const job = top.find((j) => j.name === caller);
    assert.ok(job, `no job of ci.yml carries the display name "${caller}" (required check "${check}")`);
    if (called === undefined) { assert.equal(job.uses, undefined, `"${check}" names a caller job; the check reads "${caller} / <called job>"`); continue; }
    assert.ok(job.uses, `"${caller}" calls no workflow, so no check reads "${check}"`);
    const inner = readFileSync(join(ROOT, job.uses), "utf8");
    assert.ok(jobsOf(inner.slice(inner.search(/^jobs:\s*$/m))).some((j) => j.name === called), `${job.uses} raises no job named "${called}"`);
  }
});

test("CONTROL: every required check reads success on the sha's CI run and the sha descends from the span head: LAND, exit 0", async () => {
  const h = hands();
  const v = await landRule({ sha: SHA }, h);
  assert.equal(v.word, "LAND");
  assert.equal(v.code, 0);
  assert.equal(v.line, `land-rule: LAND ${SHA.slice(0, 9)} — CI run 42 reads Quick gates, Test, Witnesses, E2E / Merge shard reports success; descends from develop ${SPAN_HEAD.slice(0, 9)}`);
  assert.deepEqual(h.calls, [
    `run list --commit ${SHA} --workflow CI --json databaseId,status,conclusion,event --limit 20`,
    "run view 42 --json jobs",
    `api repos/{owner}/{repo}/compare/develop...${SHA} --jq {status: .status, base: .base_commit.sha}`,
  ]);
});

test("the newest CI run decides: an older green run beside a newer red one holds", async () => {
  const runs = [{ databaseId: 41, status: "completed", conclusion: "success" }, { databaseId: 43, status: "completed", conclusion: "failure" }];
  const h = hands({ runs, view: { jobs: jobs({ Witnesses: { conclusion: "failure" } }) } });
  const v = await landRule({ sha: SHA }, h);
  assert.equal(v.word, "HOLD");
  assert.equal(v.code, 1);
  assert.match(v.line, /CI run 43: Witnesses reads failure/);
  assert.ok(h.calls.includes("run view 43 --json jobs"));
});

test("a required check that fails, skips or never ran holds by name (exit 1); a non-required job's failure decides nothing", async () => {
  for (const [patch, said] of [
    [{ Test: { conclusion: "failure" } }, /Test reads failure/],
    [{ "Quick gates": { conclusion: "skipped" } }, /Quick gates reads skipped/],
    // A lane push runs the Quick gates alone (doorstep quick): Test and Witnesses report skipped, which GitHub's queue reads as passing and this rule never does.
    [{ Test: { conclusion: "skipped" }, Witnesses: { conclusion: "skipped" } }, /Test reads skipped; .*Witnesses reads skipped/],
    [{ "E2E / Merge shard reports": { drop: true } }, /no job named E2E \/ Merge shard reports/],
  ]) {
    const v = await landRule({ sha: SHA }, hands({ view: { jobs: jobs(patch) } }));
    assert.equal(v.word, "HOLD", JSON.stringify(patch));
    assert.equal(v.code, 1);
    assert.match(v.line, said);
  }
  const extra = { jobs: [...jobs(), { name: "Witness cell canon", status: "completed", conclusion: "failure" }] };
  assert.equal((await landRule({ sha: SHA }, hands({ view: extra }))).word, "LAND");
});

test("a sha that does not descend from the span head holds, naming the head and the relation", async () => {
  for (const status of ["behind", "diverged"]) {
    const v = await landRule({ sha: SHA }, hands({ compare: { status, base: SPAN_HEAD } }));
    assert.equal(v.word, "HOLD");
    assert.match(v.line, new RegExp(`does not descend from develop ${SPAN_HEAD.slice(0, 9)} \\(${status}\\)`));
  }
  assert.equal((await landRule({ sha: SHA }, hands({ compare: { status: "identical", base: SHA } }))).word, "LAND");
});

test("no CI run names the sha, or its run still runs: UNREAD (exit 2), never LAND; a hold the ancestry reads still holds", async () => {
  const none = await landRule({ sha: SHA }, hands({ runs: [] }));
  assert.equal(none.word, "UNREAD");
  assert.equal(none.code, 2);
  assert.match(none.line, /no CI run names it/);
  const running = await landRule({ sha: SHA }, hands({ runs: [{ databaseId: 44, status: "in_progress", conclusion: "" }] }));
  assert.equal(running.word, "UNREAD");
  assert.match(running.line, /CI run 44 still in_progress/);
  const behind = await landRule({ sha: SHA }, hands({ runs: [], compare: { status: "diverged", base: SPAN_HEAD } }));
  assert.equal(behind.word, "HOLD");
});

test("GitHub unreachable reads UNREADABLE (exit 4); a hard gh failure exits 3; neither reads LAND", async () => {
  const dark = await landRule({ sha: SHA }, hands({ error: Object.assign(new Error("HTTP 502: Bad Gateway"), { stderr: "HTTP 502" }) }));
  assert.equal(dark.word, "UNREADABLE");
  assert.equal(dark.code, 4);
  const hard = await landRule({ sha: SHA }, hands({ error: Object.assign(new Error("HTTP 404: Not Found"), { stderr: "HTTP 404" }) }));
  assert.equal(hard.code, 3);
  assert.match(hard.line, /land-rule: could not read/);
});

test("the door: a short or absent sha refuses as usage (exit 2) before any read; a stand-in gh on PATH judges a whole sha", () => {
  const dir = mkdtempSync(join(tmpdir(), "land-rule-gh-"));
  try {
    const queried = join(dir, "queried");
    writeFileSync(join(dir, "gh"), [
      "#!/bin/sh",
      'printf "%s\\n" "$*" >> "$TEST_QUERIED"',
      'case "$1 $2" in',
      `  "run list") printf '[{"databaseId":7,"status":"completed","conclusion":"success","event":"push"}]\\n' ;;`,
      `  "run view") printf '{"jobs":[${RULE.requiredChecks.map((n) => `{"name":"${n}","status":"completed","conclusion":"success"}`).join(",")}]}\\n' ;;`,
      `  *) printf '{"status":"ahead","base":"${SPAN_HEAD}"}\\n' ;;`,
      "esac",
    ].join("\n"));
    chmodSync(join(dir, "gh"), 0o755);
    const run = (...args) => spawnSync(process.execPath, [join(HERE, "land-rule.mjs"), ...args], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_QUERIED: queried },
    });
    for (const bad of [[], ["abc123"], ["--x"]]) {
      const r = run(...bad);
      assert.equal(r.status, 2, `${JSON.stringify(bad)}: ${r.stderr}`);
      assert.match(r.stderr, /usage: land-rule\.mjs <40-hex sha>/);
    }
    assert.throws(() => readFileSync(queried), "a usage refusal reads nothing");
    const r = run(SHA);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), `land-rule: LAND ${SHA.slice(0, 9)} — CI run 7 reads Quick gates, Test, Witnesses, E2E / Merge shard reports success; descends from develop ${SPAN_HEAD.slice(0, 9)}`);
    assert.equal(readFileSync(queried, "utf8").trim().split("\n").length, 3, "three reads, once each: no poll, no wait");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WELD: the rule's checks read exactly the ci-graph REQUIRED_CHECKS the ruleset names", async () => {
  const { REQUIRED_CHECKS } = await import("./ci-graph.mjs");
  assert.deepEqual(RULE.requiredChecks, REQUIRED_CHECKS);
});

test("a sha's merge_group run decides over a newer lane or doorstep run of the same sha", async () => {
  const runs = [
    { databaseId: 42, status: "completed", conclusion: "success", event: "merge_group" },
    { databaseId: 44, status: "completed", conclusion: "success", event: "push" },
  ];
  const h = hands({ runs });
  const v = await landRule({ sha: SHA }, h);
  assert.equal(v.word, "LAND");
  assert.ok(h.calls.includes("run view 42 --json jobs"));
});

test("a doorstep run (a push, Test and Witnesses skipped) holds and says plainly that its green reads quick-only", async () => {
  const runs = [{ databaseId: 44, status: "completed", conclusion: "success", event: "push" }];
  const v = await landRule({ sha: SHA }, hands({ runs, view: { jobs: jobs({ Test: { conclusion: "skipped" }, Witnesses: { conclusion: "skipped" } }) } }));
  assert.equal(v.word, "HOLD");
  assert.equal(v.code, 1);
  assert.match(v.line, /doorstep run reads quick-only/);
  assert.match(v.line, /merge_group/);
});
