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
  // A cache keyed with no version restores engines a Playwright bump does not run: it reads as no cache.
  const unversioned = lawful.replace("key: playwright-${{ runner.os }}-1.0.0-chromium", "key: playwright-${{ runner.os }}-chromium");
  assert.deepEqual(breaches("unversioned.yml", unversioned), ['unversioned.yml: job capped step "Install Playwright" runs before any version-keyed Playwright cache']);
  const fromStep = lawful.replace("key: playwright-${{ runner.os }}-1.0.0-chromium", "key: playwright-${{ runner.os }}-${{ steps.pw-version.outputs.version }}-chromium");
  assert.deepEqual(breaches("from-step.yml", fromStep), []);
});

// THE BROWSER LIBRARIES COME IN THE IMAGE. `playwright install-deps` is an apt step; on a hosted runner it timed out at its five
// minutes in the browser cells at least six times in one day. The pinned official image carries the libraries and the engines,
// so no workflow runs the install, and EVERY image-bearing field in every workflow EQUALS the one pin the capability probe holds,
// at the version the repo's `playwright` package resolves to. The check reads fields, never a lucky string shape: an unpinned tag,
// a changed digest or a second image has no shape to match and still fails.
const PIN = /mcr\.microsoft\.com\/playwright:v([0-9.]+)-noble@sha256:[0-9a-f]{64}/;
// The values a field may carry instead of the literal: each one names a field this same law reads (the matrix row's `container`,
// the workflow `env`, or a shell variable the step set from them).
const BY_REFERENCE = /^(\$\{\{\s*(matrix\.container|env\.PLAYWRIGHT_IMAGE)\s*\}\}|\$\{?(PLAYWRIGHT_IMAGE|PW_IMAGE|WELD_PW_IMAGE)\}?|"\$\{?(PLAYWRIGHT_IMAGE|PW_IMAGE|WELD_PW_IMAGE|image)\}?")$/;
const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, "$2");

/** Every image-bearing field of one workflow text, comments dropped: `{ line, field, value }`. */
export function imageFields(text) {
  const fields = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/(^|\s)#.*$/, "");
    if (line.trim() === "") return;
    const add = (field, value) => fields.push({ line: i + 1, field, value: unquote(value) });
    for (const m of line.matchAll(/\bimage:\s*("[^"]*"|'[^']*'|[^\s,}]+)/g)) add("image", m[1]);
    const scalar = /^\s*container:\s*(?!\{)(\S.*)$/.exec(line);
    if (scalar) add("container", scalar[1]);
    for (const m of line.matchAll(/\b(PLAYWRIGHT_IMAGE|PW_IMAGE|WELD_PW_IMAGE)[:=]\s*("[^"]*"|\$\{\{[^}]*\}\}|[^\s"']+)/g)) add(m[1], m[2]);
    for (const m of line.matchAll(/\bdocker\s+(?:run|pull|create)\b[^\n]*/g)) {
      const named = [...m[0].matchAll(/mcr\.microsoft\.com\/\S+|"\$\{?\w*IMAGE\w*\}?"|\$\{?\w*IMAGE\w*\}?|\$image\b/g)].map((x) => x[0]);
      if (named.length === 0) add("docker", m[0]); else for (const v of named) add("docker", v);
    }
    for (const m of line.matchAll(/mcr\.microsoft\.com\/[^\s"'`,}]+/g)) {
      if (!fields.some((f) => f.line === i + 1 && f.value === m[0])) add("registry", m[0]);
    }
  });
  return fields;
}

/** The breaches of the image law in one workflow text, against the capability probe's pin. */
export function imageBreaches(file, text, pin) {
  const out = [];
  for (const f of imageFields(text)) {
    if (f.value === pin || BY_REFERENCE.test(f.value)) continue;
    out.push(`${file}:${f.line} ${f.field} names ${JSON.stringify(f.value)}, which is not the capability probe's pin`);
  }
  for (const line of text.split("\n")) {
    if (!/^\s*#/.test(line) && /playwright (install|install-deps)\b|--with-deps/.test(line)) out.push(`${file}: a Playwright install runs apt again: ${line.trim()}`);
  }
  return out;
}

const readPin = (root) => {
  const m = PIN.exec(readFileSync(join(root, "docker-compose.capability-probe.yml"), "utf8"));
  assert.ok(m, "CONTROL: the capability probe pins the image by tag and digest");
  return m;
};

test("WL3 RED: no workflow installs Playwright, and every image field of every workflow equals the capability probe's pin", () => {
  const root = join(import.meta.dirname, "..");
  const pin = readPin(root);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pin[1], pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright, "the image tag names the release the repo's playwright package pins");
  assert.match(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"), new RegExp(`playwright@${pin[1].replaceAll(".", "\\.")}`), "CONTROL: the lockfile resolves that same release");
  let literal = 0;
  const found = [];
  for (const file of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const text = readFileSync(join(WORKFLOWS, file), "utf8");
    found.push(...imageBreaches(file, text, pin[0]));
    literal += imageFields(text).filter((f) => f.value === pin[0]).length;
  }
  assert.deepEqual(found, []);
  assert.ok(literal >= 4, "CONTROL: the browser cells name the pin (ci.yml env and two matrix rows, held-out env)");
});

test("WL4 CONTROL: an unpinned reference, a changed digest, a second image, a docker run and an install each fail; comments never count", () => {
  const pin = "mcr.microsoft.com/playwright:v1.64.1-noble@sha256:" + "a".repeat(64);
  const lawful = ["jobs:", "  a:", "    container: { image: \"" + pin + "\", options: \"--init\" }", "    steps:", "      - run: docker run --rm \"$PW_IMAGE\" node -v"].join("\n");
  assert.deepEqual(imageBreaches("lawful.yml", lawful, pin), [], "CONTROL: the lawful workflow reads clean");
  const swap = (from, to) => lawful.replace(from, to);
  const unpinned = swap(pin, "mcr.microsoft.com/playwright:v1.64.1-noble");
  assert.equal(imageBreaches("unpinned.yml", unpinned, pin).length, 1, "an unpinned tag has no digest shape and still fails");
  assert.equal(imageBreaches("digest.yml", swap(pin, pin.replace("a".repeat(64), "b".repeat(64))), pin).length, 1, "a changed digest fails");
  assert.equal(imageBreaches("second.yml", swap("      - run:", "    services:\n      redis:\n        image: redis:7\n      - run:"), pin).length, 1, "a second image fails");
  assert.equal(imageBreaches("scalar.yml", swap("container: { image: \"" + pin + "\", options: \"--init\" }", "container: node:24"), pin).length, 1, "a scalar container fails");
  assert.equal(imageBreaches("run.yml", swap('"$PW_IMAGE"', "ubuntu:24.04 echo mcr.microsoft.com/playwright:v9"), pin).length >= 1, true, "a docker run of another image fails");
  assert.equal(imageBreaches("install.yml", swap("node -v", "pnpm exec playwright install-deps chromium"), pin).length, 1, "an install fails");
  assert.deepEqual(imageBreaches("comment.yml", lawful + "\n      # image: redis:7 and docker run ubuntu and playwright install-deps", pin), [], "a comment never counts");
});

test("WL5 RED: pw-container.sh refuses every image but the capability probe's pin, before docker runs", async () => {
  const { spawnSync } = await import("node:child_process");
  const root = join(import.meta.dirname, "..");
  const pin = readPin(root)[0];
  const run = (image) => spawnSync("bash", [join(root, "tools", "pw-container.sh"), "true"], { cwd: root, env: { PATH: process.env.PATH, PW_IMAGE: image }, encoding: "utf8" });
  for (const bad of [pin.split("@")[0], pin.replace(/[0-9a-f]$/, (c) => (c === "0" ? "1" : "0")), "ubuntu:24.04"]) {
    const r = run(bad);
    assert.equal(r.status, 2, `${bad} refuses`);
    assert.match(r.stderr, /refusing PW_IMAGE/);
  }
});

// G55: The same pure boundary witness must inspect the live checkout and an overlay of it.
// Overlay keys name root-relative files; null removes a file. No overlaid module may execute.
// Product floors use package.json engines.node, including the synthetic packages below.
const boundaryRoot = join(import.meta.dirname, "..");
const boundaryEntry = "packages/lararium-web/tests/g55-boundary.test.ts";
const productDir = "packages/g55-synthetic-product";
const productName = "@g55/synthetic-product";
const boundaryOverlay = (minimum, entry) => ({
  [`${productDir}/package.json`]: JSON.stringify({ name: productName, private: true, type: "module", engines: { node: `>=${minimum}` } }),
  [`${productDir}/index.mjs`]: 'throw new Error("G55 product must never execute");\n',
  [boundaryEntry]: entry,
});
const direct = 'import "../../g55-synthetic-product/index.mjs";\n';
const bridge = 'import "./g55-bridge.mjs";\n';
const bridgePath = "packages/lararium-web/tests/g55-bridge.mjs";
const throughBridge = 'export * from "../../g55-synthetic-product/index.mjs";\n';

async function boundaryWitness(overlay = {}) {
  const law = await import(import.meta.url);
  assert.equal(typeof law.browserNodeBoundary, "function", "G55: image law must export browserNodeBoundary({ root, overlay }) and inspect browser-cell imports without executing them");
  // Return [] for a clean boundary, otherwise diagnostic strings that name the cell and edge.
  return law.browserNodeBoundary({ root: boundaryRoot, overlay });
}

test("G55 boundary CONTROL: live inputs and a Node 24 product stay clean", async () => {
  assert.deepEqual(await boundaryWitness(), [], "live browser-cell inputs must pass the dependency boundary");
  assert.deepEqual(await boundaryWitness(boundaryOverlay(24, direct)), [], "a browser-cell import of a Node 24 product must pass");
});

test("G55 boundary RED: direct and transitive Node 26 product imports refuse, removal restores control", async () => {
  for (const overlay of [boundaryOverlay(26, direct), { ...boundaryOverlay(26, bridge), [bridgePath]: throughBridge }]) {
    const diagnostics = await boundaryWitness(overlay);
    assert.ok(diagnostics.some((d) => /web-tw5/.test(d) && /@g55\/synthetic-product/.test(d)), `expected refusal naming web-tw5 and ${productName}: ${JSON.stringify(diagnostics)}`);
    assert.deepEqual(await boundaryWitness({ ...overlay, [boundaryEntry]: null, [bridgePath]: null }), [], "removing the planted import restores the clean boundary");
  }
});

test("G55 boundary RED: unresolved and nonliteral import edges refuse by cell", async () => {
  for (const source of ['import "./g55-missing.mjs";\n', 'const part = "g55"; import(`./${part}.mjs`);\n']) {
    const diagnostics = await boundaryWitness(boundaryOverlay(24, source));
    assert.ok(diagnostics.some((d) => /web-tw5/.test(d) && /unresolved|unsupported/i.test(d)), `expected a named unresolved or unsupported edge: ${JSON.stringify(diagnostics)}`);
  }
});

test("G55 policy RED: workflow header and image law declare the Node exception", () => {
  const workflow = readFileSync(join(boundaryRoot, ".github/workflows/ci.yml"), "utf8").split(/^on:\s*$/m)[0];
  const law = readFileSync(join(boundaryRoot, "tools/workflow-law.test.mjs"), "utf8").split("// G55: The same pure boundary witness")[0];
  for (const [where, text] of [["workflow header", workflow], ["image law", law]]) {
    assert.match(text, /Node\s*26[\s\S]{0,180}(?:pinned|Playwright)[\s\S]{0,180}Node\s*24|(?:pinned|Playwright)[\s\S]{0,180}Node\s*26[\s\S]{0,180}Node\s*24/i, `${where} must declare Node 26 in the pinned Playwright image and Node 24 for the other jobs`);
    assert.match(text, /(?:other|remaining|non.browser)[\s\S]{0,80}(?:jobs|cells)|(?:jobs|cells)[\s\S]{0,80}(?:other|remaining|non.browser)/i, `${where} must identify the other jobs`);
  }
});
