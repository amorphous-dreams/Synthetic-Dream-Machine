import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGES, ROOT, SWIFT_SECONDS, VESSEL, coldReadHash, coldReadOwed, parseRawZ, plan, readWeights, runGate, tiers, touchedPackages, weigh } from "./bench-gate.mjs";

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

test("weigh: planted reports read to per-package seconds under the shared checkout root, e2e aside", () => {
  const at = "/runner/work/repo/repo";
  const t = (name, secs) => ({ name: `${at}/${name}`, startTime: 1000, endTime: 1000 + secs * 1000 });
  const table = weigh([{ testResults: [t("packages/lararium-node/tests/a.test.ts", 1.23), t("tests/harness/h.test.ts", 0.4)] }, { testResults: [t("tests/e2e/walk.test.ts", 300), t("packages/lararium-node/tests/b.test.ts", 9)] }], "planted");
  assert.deepEqual(table, { _measured: "planted", "packages/lararium-node": { "tests/a.test.ts": 1.2, "tests/b.test.ts": 9 }, tests: { "harness/h.test.ts": 0.4 } });
  assert.throws(() => weigh([{ testResults: [] }], "empty"), /no timed file/);
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

test("the weights table measures every vitest package the test cells run", () => {
  const w = readWeights();
  for (const dir of PACKAGES) assert.ok(w[dir] && Object.keys(w[dir]).length > 0, `tools/unit-weights.json measures nothing of ${dir}`);
});

test("witnesses-fast carries the typecheck and the tests ratchet, so the gate runs no second typecheck", () => {
  const r = spawnSync("bash", ["tools/witness-all.sh", "--fast", "--list"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  for (const w of ["typecheck-witness", "typecheck-tests-witness"]) assert.match(r.stdout, new RegExp(`^\\s*${w}\\b`, "m"), `witness-all --fast leaves ${w} out`);
});

test("RED: a diff touching the security class adds COLD READ OWED to the one verdict line and prints the record-hash line; CONTROL: a clean diff prints neither", () => {
  const steps = [{ name: "a" }];
  const lines = [];
  const owed = [".github/ci.yml", "packages/x/package.json"];
  const hash = coldReadHash("f".repeat(40), owed);
  const g = runGate(steps, () => 0, (l) => lines.push(l), { head: "abc1234", base: "def5678", cold: owed, hash });
  assert.match(g.line, /^BENCH GATE GREEN at abc1234 over develop def5678 · 1 steps · \d+ s · COLD READ OWED: \.github\/ci\.yml, packages\/x\/package\.json$/);
  assert.equal(lines.at(-1), `cold-read: owed · head abc1234 · paths 2 · record-hash ${hash}`);
  const red = runGate(steps, () => 2, () => {}, { cold: owed, hash });
  assert.match(red.line, /^BENCH GATE REFUSES: a \(exit 2\) · \d+ s · COLD READ OWED: /, "an owed read rides a refusal too");
  const clean = [];
  const c = runGate(steps, () => 0, (l) => clean.push(l), { head: "abc1234", base: "def5678" });
  assert.ok(!/COLD READ/.test(c.line) && !clean.some((l) => l.startsWith("cold-read:")));
  assert.match(coldReadHash("a", ["p"]), /^[0-9a-f]{64}$/);
  assert.notEqual(coldReadHash("a", ["p"]), coldReadHash("b", ["p"]), "the hash binds the exact head");
});

test("parseRawZ reads every path of a --no-ff raw -z diff and no mode or sha", () => {
  const raw = ":100644 100644 aaa bbb M\0tools/a.mjs\0:000000 100644 000 ccc A\0packages/x/new.ts\0:100644 000000 ddd 000 D\0gone.txt\0";
  assert.deepEqual(parseRawZ(raw), ["tools/a.mjs", "packages/x/new.ts", "gone.txt"]);
  assert.deepEqual(parseRawZ(""), []);
});

test("coldReadOwed asks the door; a dark door falls to the module over the same list; an empty diff asks neither", () => {
  const list = JSON.stringify({ paths: [".github/**"], tokens: [] });
  const asked = [];
  assert.deepEqual(coldReadOwed(["a", ".github/x"], list, { door: (p, l) => { asked.push(["door", l]); return [".github/x"]; }, local: () => assert.fail("the door answered") }), [".github/x"]);
  assert.deepEqual(coldReadOwed(["a", ".github/x"], list, { door: () => { throw new Error("dark"); }, local: (p, l) => { asked.push(["local", l]); return [".github/x"]; } }), [".github/x"]);
  assert.deepEqual(asked.map((a) => a[1]), [list, list], "one list rides both paths, never a second");
  assert.deepEqual(coldReadOwed([], list, { door: () => assert.fail("no diff, no ask"), local: () => assert.fail("no diff, no ask") }), []);
});

test("the live list holds the familiar's wording: land-train gone, the --no-ff merge reads it", () => {
  const about = JSON.parse(readFileSync(join(ROOT, "tools/security-class-paths.json"), "utf8")).about;
  assert.ok(!/land-train/.test(about));
  assert.match(about, /COLD READ OWED/);
});
