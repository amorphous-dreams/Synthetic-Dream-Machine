import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PACKAGES, ROOT, SMALL_PYTEST, SMALL_TOOLS, SWIFT_SECONDS, VERDICT_KIND, VESSEL, plan, readWeights, runGate, tiers, touchedPackages, touchedTests, treeTests, verdictOf } from "./bench-gate.mjs";

test("RED: a red step refuses by name and the later steps still run; CONTROL: all ok reads one green verdict line", () => {
  const ran = [];
  const steps = [{ name: "a" }, { name: "b" }, { name: "c" }];
  const lines = [];
  const r = runGate(steps, (s) => { ran.push(s.name); return s.name === "b" ? 3 : 0; }, (l) => lines.push(l));
  assert.equal(r.code, 1);
  assert.deepEqual(ran, ["a", "b", "c"], "no short-circuit past the stop steps");
  assert.match(r.line, /^BENCH GATE REFUSES: b \(exit 3\) · \d+ s$/);
  assert.match(lines.join("\n"), /\npono: \S/);
  const g = runGate(steps, () => 0, () => {}, { head: "abc1234", base: "def5678" });
  assert.equal(g.code, 0);
  assert.match(g.line, /^BENCH GATE GREEN at abc1234 over develop def5678 · 3 steps · \d+ s$/);
});

test("RED: a red merge-develop or build stops the gate: no later step reads a tree that is not the sum", () => {
  for (const stopper of ["merge-develop", "build"]) {
    const ran = [];
    const steps = [{ name: "merge-develop", stop: true }, { name: "build", stop: true }, { name: "witnesses-fast" }];
    const r = runGate(steps, (s) => { ran.push(s.name); return s.name === stopper ? 1 : 0; }, () => {});
    assert.equal(r.code, 1);
    assert.equal(ran.at(-1), stopper, `${stopper} red, yet ${ran.at(-1)} ran after it`);
    assert.match(r.line, new RegExp(`^BENCH GATE REFUSES: ${stopper} \\(exit 1\\)`));
  }
});

test("tiers: a file the table measures under the swift bound rides the bench, a file never measured rides it too, the rest wait for a touch", () => {
  const { swift, heavy } = tiers(["a", "b", "c", "d"], { a: 0.2, b: SWIFT_SECONDS, c: 40 });
  assert.deepEqual(swift, ["a", "d"]);
  assert.deepEqual(heavy, ["b", "c"]);
});

test("touchedPackages reads the diff's package dirs alone (a prefix twin never counts)", () => {
  const pk = ["packages/lararium-node", "packages/lararium-node-x", "tests"];
  assert.deepEqual(touchedPackages(["packages/lararium-node/src/a.ts", "tools/x.mjs", "tests/harness/y.test.ts", "packages/lararium-node-xy/z"], pk), ["packages/lararium-node", "tests"]);
  assert.deepEqual(touchedPackages(["bags/x.mem"], pk), []);
});

test("the live plan: the fixed steps in order, a swift step per package, the vessel self-tests left to CI", () => {
  const steps = plan({ touched: [] });
  assert.deepEqual(steps.slice(0, 5).map((s) => s.name), ["merge-develop", "build", "witnesses-fast", "carrier-pins", "tool-tests"]);
  assert.ok(steps[0].stop && steps[1].stop && !steps[2].stop);
  for (const v of VESSEL) assert.ok(existsSync(join(ROOT, "tools", v)), `the vessel roster names ${v}, which no longer stands`);
  const tools = steps.find((s) => s.name === "tool-tests").args;
  for (const v of VESSEL) assert.ok(!tools.includes(`tools/${v}`), `${v} stands a vessel, yet the bench runs it`);
  assert.ok(tools.includes("tools/bench-gate.test.mjs"), "CONTROL: the static self-tests ride the bench");
  const swift = steps.filter((s) => s.name.startsWith("swift-"));
  assert.ok(swift.length >= PACKAGES.length - 1, `only ${swift.length} swift steps for ${PACKAGES.length} packages`);
  assert.equal(steps.filter((s) => s.name.startsWith("heavy-")).length, 0, "an untouched bench runs no heavy file");
  const touched = plan({ touched: ["packages/lares-cli"] }).filter((s) => s.name.startsWith("heavy-"));
  assert.deepEqual(touched.map((s) => s.name), ["heavy-lares-cli"]);
});

test("witnesses-fast carries the typecheck and the tests ratchet, so the gate runs no second typecheck", () => {
  const r = spawnSync("bash", ["tools/witness-all.sh", "--fast", "--list"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  for (const w of ["typecheck-witness", "typecheck-tests-witness"]) assert.match(r.stdout, new RegExp(`^\\s*${w}\\b`, "m"), `witness-all --fast leaves ${w} out`);
});

// THE KEEPER'S LOCAL WITNESS (ruling 2026-11-25-web2-annotates): `--verdict <file>` runs the gate over the exact tree the kūkulu built
// and writes one verdict document the keeper names by hash. No fetch decides it: the tree IS the sum the image carries.
test("RED verdict mode: the plan holds no merge-develop (no network decides), every other fixed step stands; runGate names each step's exit", () => {
  const steps = plan({ touched: [], verdict: true });
  assert.deepEqual(steps.slice(0, 4).map((s) => s.name), ["build", "witnesses-fast", "carrier-pins", "tool-tests"]);
  assert.ok(!steps.some((s) => s.check), "a verdict run fetches nothing");
  const r = runGate([{ name: "a" }, { name: "b" }], (s) => (s.name === "b" ? 2 : 0), () => {}, { head: "abc", clock: (() => { let t = 0; return () => (t += 1000); })() });
  assert.deepEqual(r.steps.map(({ name, code }) => ({ name, code })), [{ name: "a", code: 0 }, { name: "b", code: 2 }]);
  assert.ok(r.steps.every((s) => typeof s.secs === "number"));
  assert.ok(Number.isFinite(r.secs));
});

test("RED verdictOf: one document over the revision and its tree, the gate's exit and line, each step's exit; a malformed revision throws", () => {
  const rev = "a".repeat(40), tree = "b".repeat(40);
  const green = verdictOf({ code: 0, line: "BENCH GATE GREEN at aaaaaaa over develop - · 2 steps · 3 s", steps: [{ name: "build", code: 0, secs: 1 }], secs: 3 }, { rev, tree });
  assert.deepEqual(green, { kind: VERDICT_KIND, v: 1, rev, tree, code: 0, line: "BENCH GATE GREEN at aaaaaaa over develop - · 2 steps · 3 s", steps: [{ name: "build", code: 0, secs: 1 }], secs: 3 });
  assert.deepEqual(Object.keys(green), ["kind", "v", "rev", "tree", "code", "line", "steps", "secs"], "the key order the keeper hashes stays fixed");
  assert.throws(() => verdictOf({ code: 0, line: "", steps: [], secs: 0 }, { rev: "HEAD", tree }), /40 hex/);
});

// THE ONE PLAN serves the landing door too (tools/floor-gate.mjs): `door` merges, re-renders and commits; `tier` picks the tests.
test("RED door plan: merge, build, the re-renders and commit-build each stop the gate, in that order, before witnesses-fast", () => {
  for (const tier of ["small", "whole"]) {
    const steps = plan({ tier, door: true, touched: [] });
    const head = steps.slice(0, 8).map((s) => s.name);
    assert.deepEqual(head, ["merge-develop", "build", "cli-verbs", "heleuma", "affordance-pack", "redeclare-unbaked", "commit-build", "witnesses-fast"], tier);
    assert.equal(steps[0].check, "merge", "the door MERGES develop; the bench gate only checks it");
    assert.ok(steps.slice(0, 7).every((s) => s.stop), `${tier}: a red prefix step must stop the gate`);
  }
  assert.throws(() => plan({ tier: "medium" }), /tier reads "medium"/);
});

test("RED small tier: the lane's touched test files per package, a named package whole, the door tool suites, the pytest pair; no swift sweep", () => {
  const cli = treeTests("packages/lares-cli").slice(0, 2);
  assert.ok(cli.length > 0, "CONTROL: the cli package holds test files");
  const changed = ["tools/bench-gate.test.mjs", `tools/${VESSEL[0]}`, "tools/gone.test.mjs", "packages/lares-cli/src/x.ts", "packages/lares-cli/tests/gone.test.ts", ...cli.map((f) => `packages/lares-cli/${f}`)];
  assert.deepEqual(touchedTests(changed)["packages/lares-cli"], cli, "a source file and a deleted test file never ride as touched tests");
  const steps = plan({ tier: "small", door: true, changed, whole: ["tests"], python: "py" });
  const by = Object.fromEntries(steps.map((s) => [s.name, s]));
  assert.ok(!steps.some((s) => /^(swift|heavy|carrier)/.test(s.name)), "the small tier sweeps no package");
  assert.deepEqual(by["touched-lares-cli"].args.slice(-cli.length), cli);
  assert.ok(by["whole-tests"], "whole=tests runs the harness whole");
  assert.equal(by["whole-tests"].args.filter((a) => /\.test\./.test(a)).length, 0, "a whole step names no files: the package's own test script runs whole");
  assert.deepEqual(by["tool-tests"].args, ["--test", ...[...SMALL_TOOLS, "tools/bench-gate.test.mjs"].sort()], "the vessel suite and a deleted file stay out");
  assert.equal(by.pytest.cmd, "py");
  assert.deepEqual(by.pytest.args, ["-m", "pytest", "-q", ...SMALL_PYTEST]);
});

test("whole tier with whole=: the named package's heavy files ride even untouched", () => {
  const { heavy } = tiers(treeTests("packages/lares-cli"), readWeights()["packages/lares-cli"]);
  const steps = plan({ tier: "whole", touched: [], whole: ["packages/lares-cli"] });
  assert.equal(steps.some((s) => s.name === "heavy-lares-cli"), heavy.length > 0);
});
