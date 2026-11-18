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

// THE NEEDS LAW. Actions hands a job the `needs` context of its DIRECT dependencies alone: a job that reads
// `needs.<id>.outputs` (or `.result`) off a job its own `needs:` does not name reads null, quietly, and a guard built on it
// reads the wrong way on every run. Each reference must name a job the reading job lists.

/** The breaches of the needs law in one workflow text, comments dropped: each `needs.<id>` a job reads but does not list. */
export function needsBreaches(file, text) {
  const out = [];
  const lines = text.split("\n").map((l) => l.replace(/^\s*#.*$/, "").replace(/\s+#\s.*$/, ""));
  const at = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (at === -1) return out;
  let job = null;
  const close = () => {
    if (!job) return;
    for (const id of job.reads) if (!job.needs.includes(id)) out.push(`${file}: job ${job.name} reads needs.${id} but does not list ${id} in its needs`);
  };
  for (const line of lines.slice(at + 1)) {
    if (/^\S/.test(line)) break;
    const head = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (head) { close(); job = { name: head[1], needs: [], reads: new Set() }; continue; }
    if (!job) continue;
    const needs = /^ {4}needs:\s*(.+?)\s*$/.exec(line);
    if (needs) job.needs = needs[1].replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const m of line.matchAll(/\bneeds\.([A-Za-z0-9_-]+)\./g)) job.reads.add(m[1]);
  }
  close();
  return out;
}

test("WL6 RED: every job that reads needs.<id> lists <id> in its own needs, in every workflow", () => {
  const found = [];
  for (const file of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)).sort()) found.push(...needsBreaches(file, readFileSync(join(WORKFLOWS, file), "utf8")));
  assert.deepEqual(found, []);
});

test("WL6b CONTROL: a planted read of an unlisted job's outputs breaches; a listed one, a block and a comment read clean", () => {
  const planted = [
    "jobs:",
    "  s:",
    "    runs-on: ubuntu-latest",
    "  a:",
    "    needs: [s]",
    "    if: ${{ needs.s.outputs.canon != 'true' }}",
    "  b:",
    "    if: ${{ needs.s.outputs.canon != 'true' }}",
    "    # needs.q.result in a comment never counts",
    "  c:",
    "    needs: s",
    "    with:",
    "      flag: ${{ needs.s.outputs.canon == 'true' }}",
  ].join("\n");
  assert.deepEqual(needsBreaches("planted.yml", planted), ["planted.yml: job b reads needs.s but does not list s in its needs"]);
});

test("WL7 RED: the canon doorstep reads ci.yml's scope job in every job a canon-only push skips, and in the e2e doorstep input", () => {
  const text = readFileSync(join(WORKFLOWS, "ci.yml"), "utf8");
  const jobs = new Map(jobsOf(text).map((j) => [j.name, j]));
  assert.ok(jobs.has("scope"), "ci.yml carries no scope job");
  const scope = jobs.get("scope");
  assert.ok(scope.keys.some((k) => /^if: \$\{\{ github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.fork \}\}$/.test(k)), "the scope job stands on other events than the cells it feeds");
  assert.ok(!scope.keys.some((k) => k.startsWith("needs:")), "the scope job waits on another job: it must stand first");
  for (const id of ["test-cells", "test", "witness-cells", "witnesses", "e2e"]) {
    const job = jobs.get(id);
    assert.ok(job, `ci.yml lost the ${id} job`);
    const needs = job.keys.find((k) => k.startsWith("needs:")) ?? "";
    assert.match(needs, /\bscope\b/, `${id} does not list scope in its needs`);
    const reads = job.keys.filter((k) => /^(if|doorstep):/.test(k)).join("\n") + "\n" + text.slice(text.indexOf(`\n  ${id}:\n`)).split(/\n  [a-z][\w-]*:\n/)[0].match(/^ {6}doorstep: .*$/m)?.[0];
    assert.match(reads, /github\.event_name == 'push' && \([^)]*needs\.scope\.outputs\.canon == 'true'/, `${id} reads no canon doorstep off the scope job, or reads it off another event than a push`);
  }
  // The quick job stands beside the scope read, never behind it: the doorstep's one heavy job does not wait on a diff.
  assert.ok(!(jobs.get("quick").keys.find((k) => k.startsWith("needs:")) ?? "").includes("scope"), "the quick job waits on the scope read");
});

// The pinned Playwright image supplies Node 26 for the browser cells; the other jobs pin Node 24.
// The browser import boundary must keep product code compatible with Node 24.
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

// G55: package-closure witness. Overlay entries replace root-relative file contents; null removes one.
// The witness lives separately so this test file can land first.
const boundaryRoot = join(import.meta.dirname, "..");
const webManifest = "packages/lararium-web/package.json";
const fixtureDir = "packages/g55-fixture";
const fixtureName = "@g55/closure-fixture";
const originalWeb = JSON.parse(readFileSync(join(boundaryRoot, webManifest), "utf8"));
const lock = readFileSync(join(boundaryRoot, "pnpm-lock.yaml"), "utf8");
const withFixture = (range, dependency) => ({
  [webManifest]: JSON.stringify({ ...originalWeb, devDependencies: { ...originalWeb.devDependencies, [fixtureName]: "workspace:*" } }),
  [`${fixtureDir}/package.json`]: JSON.stringify({ name: fixtureName, version: "1.0.0", engines: { node: range }, dependencies: dependency ?? {} }),
});
async function boundaryWitness(overlay = {}) {
  const law = await import("./browser-node-boundary.mjs");
  return law.browserNodeBoundary({ root: boundaryRoot, overlay });
}
const refuses = (diagnostics, cell, name) => assert.ok(
  diagnostics.some((d) => d.includes(cell) && d.includes(name)),
  `expected refusal naming ${cell} and ${name}: ${JSON.stringify(diagnostics)}`,
);

test("G55 closure CONTROL: real closures and a Node 24 workspace dependency pass", async () => {
  assert.deepEqual(await boundaryWitness(), []);
  assert.deepEqual(await boundaryWitness(withFixture(">=24")), []);
});

test("G55 closure RED: a transitive workspace floor refuses by cell and package; removal restores control", async () => {
  const planted = withFixture(">=24", { "@g55/leaf": "workspace:*" });
  planted["packages/g55-leaf/package.json"] = JSON.stringify({ name: "@g55/leaf", version: "1.0.0", engines: { node: ">=26" } });
  const diagnostics = await boundaryWitness(planted);
  refuses(diagnostics, "web-tw5", "@g55/leaf");
  refuses(diagnostics, "quick", "@g55/leaf");
  assert.deepEqual(await boundaryWitness(), []);
});

test("G55 closure RED: third-party transitive floors refuse and Node 24 restores control", async () => {
  // Insert a package and a snapshot edge into an existing direct dependency's resolved snapshot.
  const manifest = JSON.parse(readFileSync(join(boundaryRoot, webManifest), "utf8"));
  const dep = Object.keys(manifest.devDependencies).find((name) => name === "vite");
  assert.ok(dep, "fixture needs a real direct third-party edge");
  const add = (minimum) => lock.replace("\npackages:\n", `\npackages:\n\n  g55-fixture@1.0.0:\n    resolution: {integrity: sha512-fixture}\n    engines: {node: '>=${minimum}'}\n`)
    .replace("\nsnapshots:\n", "\nsnapshots:\n\n  g55-fixture@1.0.0: {}\n")
    .replace(/(\n  vite@[^\n]+:\n    dependencies:\n)/, "$1      g55-fixture: 1.0.0\n");
  assert.notEqual(add(26), lock);
  refuses(await boundaryWitness({ "pnpm-lock.yaml": add(26) }), "web-tw5", "g55-fixture");
  assert.deepEqual(await boundaryWitness({ "pnpm-lock.yaml": add(24) }), []);
  assert.deepEqual(await boundaryWitness(), []);
});

test("G55 closure RED: a package held only through a peer edge refuses by cell and package", async () => {
  const peerFixture = (range) => {
    const o = withFixture(">=24");
    o[`${fixtureDir}/package.json`] = JSON.stringify({ name: fixtureName, version: "1.0.0", engines: { node: ">=24" }, peerDependencies: { "@g55/peer": "workspace:*" } });
    o["packages/g55-peer/package.json"] = JSON.stringify({ name: "@g55/peer", version: "1.0.0", engines: { node: range } });
    return o;
  };
  refuses(await boundaryWitness(peerFixture(">=26")), "web-tw5", "@g55/peer");
  refuses(await boundaryWitness(peerFixture(">=26")), "quick", "@g55/peer");
  assert.deepEqual(await boundaryWitness(peerFixture(">=24")), []);
  // the lockfile walk: a snapshot's peerDependencies edge joins the closure
  const peerLock = (minimum) => lock.replace("\npackages:\n", `\npackages:\n\n  g55-peer@1.0.0:\n    resolution: {integrity: sha512-fixture}\n    engines: {node: '>=${minimum}'}\n`)
    .replace("\nsnapshots:\n", "\nsnapshots:\n\n  g55-peer@1.0.0: {}\n")
    .replace(/(\n  vite@[^\n]+:\n)(    dependencies:\n)/, "$1    peerDependencies:\n      g55-peer: 1.0.0\n$2");
  assert.notEqual(peerLock(26), lock);
  refuses(await boundaryWitness({ "pnpm-lock.yaml": peerLock(26) }), "web-tw5", "g55-peer");
  assert.deepEqual(await boundaryWitness({ "pnpm-lock.yaml": peerLock(24) }), []);
  assert.deepEqual(await boundaryWitness(), []);
});

test("G55 closure RED: unresolvable transitive dependency names its cell and member", async () => {
  const planted = withFixture(">=24", { "@g55/missing": "workspace:*" });
  refuses(await boundaryWitness(planted), "web-tw5", "@g55/missing");
  assert.deepEqual(await boundaryWitness(), []);
});

test("G55 policy RED: workflow header and image law declare the Node exception", () => {
  const workflow = readFileSync(join(boundaryRoot, ".github/workflows/ci.yml"), "utf8").split(/^on:\s*$/m)[0];
  const law = readFileSync(join(boundaryRoot, "tools/workflow-law.test.mjs"), "utf8").split("// G55: package-closure witness.")[0];
  for (const [where, text] of [["workflow header", workflow], ["image law", law]]) {
    assert.match(text, /Node\s*26[\s\S]{0,180}(?:pinned|Playwright)[\s\S]{0,180}Node\s*24|(?:pinned|Playwright)[\s\S]{0,180}Node\s*26[\s\S]{0,180}Node\s*24/i, `${where} must declare Node 26 in the pinned Playwright image and Node 24 for the other jobs`);
    assert.match(text, /(?:other|remaining|non.browser)[\s\S]{0,80}(?:jobs|cells)|(?:jobs|cells)[\s\S]{0,80}(?:other|remaining|non.browser)/i, `${where} must identify the other jobs`);
  }
});
