// THE WORKFLOW LAW. A job with no `timeout-minutes` runs under the runner's 360-minute default, so a
// hung step holds a runner for six hours and reports nothing about the code. A `playwright install`
// downloads engines and runs apt for their system libraries; with no step timeout a CDN stall there
// stays uncapped, and with no version-keyed cache before it every run pays the download again.
//
// The reader works on the workflow text by indentation (jobs at two spaces, a job's keys at four, its
// steps at six), the shape every workflow under `.github/workflows/` holds. A job that calls a reusable
// workflow (`uses:` at job level) takes no `timeout-minutes`; its called jobs carry their own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = join(import.meta.dirname, "..", ".github", "workflows");

/** Each job of one workflow text: its name, its job-level lines and its steps (each a list of lines). */
export function jobsOf(text) {
  const lines = text.split("\n");
  const jobs = [];
  let inJobs = false;
  let job = null;
  let step = null;
  for (const line of lines) {
    if (/^\S/.test(line)) {
      inJobs = /^jobs:\s*$/.test(line);
      job = null;
      step = null;
      continue;
    }
    if (!inJobs) continue;
    const jobHead = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobHead) {
      job = { name: jobHead[1], keys: [], steps: [] };
      jobs.push(job);
      step = null;
      continue;
    }
    if (!job) continue;
    if (/^ {4}\S/.test(line)) {
      job.keys.push(line.trim());
      step = null;
      continue;
    }
    if (/^ {6}- /.test(line)) {
      step = [line.slice(8)];
      job.steps.push(step);
      continue;
    }
    if (step && /^ {8}\S/.test(line)) step.push(line.trim());
    else if (step && /^ {10,}\S/.test(line)) step.push(line.trim());
  }
  return jobs;
}

/** The breaches of the law in one workflow text, each named by its job. */
export function breaches(file, text) {
  const out = [];
  for (const job of jobsOf(text)) {
    const reusable = job.keys.some((k) => k.startsWith("uses:"));
    if (!reusable && !job.keys.some((k) => k.startsWith("timeout-minutes:"))) {
      out.push(`${file}: job ${job.name} carries no timeout-minutes`);
    }
    let cached = false;
    for (const step of job.steps) {
      const body = step.join("\n");
      // The key must name the Playwright version, a step output or a literal release, so a bump re-downloads.
      if (/actions\/cache@/.test(body) && /key:\s*playwright-[^\n]*(?:outputs\.version|-\d+\.\d+\.\d+)/.test(body)) cached = true;
      if (!/playwright install/.test(body)) continue;
      const name = (/^name:\s*(.*)$/m.exec(body) ?? [, "an install step"])[1];
      if (!/^timeout-minutes:/m.test(body)) out.push(`${file}: job ${job.name} step "${name}" carries no timeout-minutes`);
      if (!cached) out.push(`${file}: job ${job.name} step "${name}" runs before any version-keyed Playwright cache`);
    }
  }
  return out;
}

test("WL1 RED: every job in .github/workflows carries timeout-minutes, and every Playwright install a cache before it and its own timeout", () => {
  const found = [];
  for (const file of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    found.push(...breaches(file, readFileSync(join(WORKFLOWS, file), "utf8")));
  }
  assert.deepEqual(found, []);
});

test("WL2 CONTROL: a planted workflow without the caps reads every breach, and a lawful one reads none", () => {
  const planted = [
    "on: push",
    "jobs:",
    "  bare:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Install Playwright",
    "        run: pnpm exec playwright install --with-deps chromium",
    "  called:",
    "    uses: ./.github/workflows/other.yml",
  ].join("\n");
  assert.deepEqual(breaches("planted.yml", planted), [
    "planted.yml: job bare carries no timeout-minutes",
    'planted.yml: job bare step "Install Playwright" carries no timeout-minutes',
    'planted.yml: job bare step "Install Playwright" runs before any version-keyed Playwright cache',
  ]);
  const lawful = [
    "jobs:",
    "  capped:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 20",
    "    steps:",
    "      - name: Cache the Playwright engines",
    "        uses: actions/cache@0000000000000000000000000000000000000000 # v0",
    "        with:",
    "          path: ~/.cache/ms-playwright",
    "          key: playwright-${{ runner.os }}-1.0.0-chromium",
    "      - name: Install Playwright",
    "        timeout-minutes: 10",
    "        run: pnpm exec playwright install --with-deps chromium",
  ].join("\n");
  assert.deepEqual(breaches("lawful.yml", lawful), []);
  // A cache keyed with no version restores engines a Playwright bump no longer runs: it reads as no cache.
  const unversioned = lawful.replace("key: playwright-${{ runner.os }}-1.0.0-chromium", "key: playwright-${{ runner.os }}-chromium");
  assert.deepEqual(breaches("unversioned.yml", unversioned), ['unversioned.yml: job capped step "Install Playwright" runs before any version-keyed Playwright cache']);
  const fromStep = lawful.replace("key: playwright-${{ runner.os }}-1.0.0-chromium", "key: playwright-${{ runner.os }}-${{ steps.pw-version.outputs.version }}-chromium");
  assert.deepEqual(breaches("from-step.yml", fromStep), []);
});
