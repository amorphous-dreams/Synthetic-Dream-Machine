import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText, scanAll, scanTestText, scanUpgradeText, scanCanonText, blindClasses, classify, RULES, EXCEPTIONS, CEILINGS } from "./evergreen-boundary.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "tools/evergreen-boundary.mjs");
function fixture(files, extra = []) {
  const root = mkdtempSync(join(tmpdir(), "evergreen-boundary-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return spawnSync(process.execPath, [cli, "--root", root, "--ceilings", "version=0,clock=0,narration=0,retired-test=0,upgrade-delete=0,canon-history=0", "--no-exceptions", ...extra], { encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const one = (body) => fixture({ "packages/example/src/a.ts": body });

test("E1 CONTROL: lawful source reads files and no findings", () => {
  const r = one('// This holder waits for its own tick.\nsetTimeout(tick, 500);\nconst started = Date.now();\nconst protocolVersion = "2025-11-25";\nconst cid = "bafybeigd";\n');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /\[evergreen-boundary\] [1-9]\d* file\(s\) read/);
  assert.deepEqual(scanText("a.ts", "// This holder waits.\nconst started = Date.now();"), []);
  assert.deepEqual(scanText("a.ts", 'const word = "schemaVersion"; const sample = "Date.now() > deadline";'), []);
});
test("E2 schema field is a version finding", () => {
  const body = "const record = { schemaVersion: 1 };";
  assert.equal(scanText("a.ts", body).filter(f => f.rule === "version").length, 1);
  const r = one(body); assert.equal(r.status, 1); assert.match(r.stdout, /a\.ts:1/);
});
test("E3 clock identity is a clock finding", () => {
  const body = "const id = `req-${Date.now()}`;";
  assert.equal(scanText("a.ts", body).filter(f => f.rule === "clock").length, 1);
  for (const shape of ["const id = String(Date.now());", "const id =\n  `req-${Date.now()}`;", "const row = {\n  createdAt:\n    new Date().toISOString(),\n};"]) {
    assert.equal(scanText("a.ts", shape).filter(f => f.rule === "clock").length, 1, shape);
  }
  const r = one(body); assert.equal(r.status, 1); assert.match(r.stdout, /a\.ts:1/);
});
test("E4 a historical comment is narration", () => {
  const body = "// this used to read the old shape";
  assert.equal(scanText("a.ts", body).filter(f => f.rule === "narration").length, 1);
  const r = one(body); assert.equal(r.status, 1); assert.match(r.stdout, /a\.ts:1/);
});
test("E5 durable field, comparison, and radix identity are clock sinks", () => {
  for (const body of ["retiredAt: new Date().toISOString()", "if (Date.now() > expiresAt) return;", "const suffix = Date.now().toString(36);",
    '"requested-at": new Date().toISOString(),', "emit({ ts: Date.now() });", "const ms = Date.now().toString(32);", "const now = new Date().toISOString();"]) {
    assert.equal(scanText("a.ts", body).filter(f => f.rule === "clock").length, 1, body);
  }
});
test("E6 numbered formats and numeric version fields read; string version does not", () => {
  for (const body of ['const format = "lararium-genesis-seed/v1";', 'const format = `canon/v${gen}`;', "const record = { version: 3 }; ",
    "const cid = digest(`engine/v1\\ncore:${sha}`);", "const D = `${ROOT}/${name}/v1`;", "export const FRAME_VERSION = 0x80;", "const SESSION_SCHEMA_VERSION = 1;"]) {
    assert.equal(scanText("a.ts", body).filter(f => f.rule === "version").length, 1, body);
  }
  assert.equal(scanText("a.ts", 'const record = { version: "1.2.3" };').length, 0);
  assert.equal(scanText("a.ts", 'const url = "https://example.org/version";').length, 0);
});
test("E7 stale and empty-reason exceptions fail classification", () => {
  const findings = scanText("a.ts", "schemaVersion: 1");
  assert.equal(classify(findings, [{ rule: "version", file: "a.ts", match: "absent", reason: "This names an external format." }]).stale.length, 1);
  assert.equal(classify(findings, [{ rule: "version", file: "a.ts", match: "schemaVersion", reason: "" }]).stale.length, 1);
  // An exception allows the lines it counts and no more: a second line with the same substring reads open.
  const two = scanText("a.ts", "const a = { schemaVersion: 1 };\nconst b = { schemaVersion: 2 };");
  const once = classify(two, [{ rule: "version", file: "a.ts", match: "schemaVersion", reason: "This names an external format." }]);
  assert.deepEqual([once.excepted.length, once.open.length, once.stale.length], [1, 1, 0]);
  const twice = classify(two, [{ rule: "version", file: "a.ts", match: "schemaVersion", count: 2, reason: "This names an external format." }]);
  assert.deepEqual([twice.excepted.length, twice.open.length, twice.stale.length], [2, 0, 0]);
  assert.equal(classify(findings, [{ rule: "version", file: "a.ts", match: "schemaVersion", count: 2, reason: "This names an external format." }]).stale.length, 1);
});
test("E8 ceiling over, under, and at", () => {
  const files = { "tools/a.mjs": "const x = { schemaVersion: 1 };" };
  assert.equal(fixture(files).status, 1);
  const root = mkdtempSync(join(tmpdir(), "evergreen-ceiling-"));
  try {
    mkdirSync(join(root, "tools")); writeFileSync(join(root, "tools/a.mjs"), files["tools/a.mjs"]);
    const run = (n) => spawnSync(process.execPath, [cli, "--root", root, "--ceilings", `version=${n},clock=0,narration=0`, "--no-exceptions"], { encoding: "utf8" });
    const under = run(2); assert.equal(under.status, 0); assert.match(under.stdout, /Lower CEILINGS in tools\/evergreen-boundary\.mjs.*version/);
    const at = run(1); assert.equal(at.status, 0); assert.doesNotMatch(at.stdout, /Lower CEILINGS/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("E9 real corpus holds under its ceilings, each rule reads a known positive, and every exception has a finding", () => {
  const r = spawnSync(process.execPath, [cli], { cwd: repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // A SHRINK PASSES here as it does in the witness: another hand's cleanup never reddens this test. The planted reds
  // above prove each rule reads; here the whole tree must still read SOME debt while any ceiling stands above zero.
  let total = 0;
  for (const rule of RULES) {
    const [, open, cap] = r.stdout.match(new RegExp(`${rule} (\\d+)/(\\d+)`)) ?? [];
    assert.equal(Number(cap), CEILINGS[rule]);
    assert.ok(Number(open) <= CEILINGS[rule], `${rule} ${open} over ${CEILINGS[rule]}`);
    total += Number(open);
  }
  assert.ok(total > 0 || RULES.every(rule => CEILINGS[rule] === 0), "the tree read no debt under standing ceilings");
  // Each new class reads a known positive in the real tree too, while its ceiling stands above zero.
  for (const rule of ["retired-test", "upgrade-delete", "canon-history"]) {
    const [, open] = r.stdout.match(new RegExp(`${rule} (\\d+)/`)) ?? [];
    assert.ok(Number(open) > 0 || CEILINGS[rule] === 0, `${rule} read nothing under a standing ceiling`);
  }
  assert.equal(new Set(EXCEPTIONS.map(e => `${e.rule}|${e.file}|${e.match}`)).size, EXCEPTIONS.length);
  const findings = EXCEPTIONS.flatMap(e => scanAll(e.file, readFileSync(join(repo, e.file), "utf8")));
  assert.deepEqual(classify(findings, EXCEPTIONS).stale, []);
});
test("E10 empty corpus fails visibly", () => {
  const r = fixture({}); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /the corpus read nothing/);
});

const canon = (body) => fixture({ "bags/lares/ha.ka.ba/lares/api/pono/a.mem": body });
const tests = (body) => fixture({ "packages/example/tests/a.test.ts": body });
const upgrade = (body) => fixture({ "packages/example/src/a.ts": body });
test("E11 retired-test: a retired-name title, a mutation comment and a retired-name list read; present tests do not", () => {
  const positives = [
    'test("the old shape refuses before any write", () => {',
    'it("RED: the retired command refuses", () => {',
    'expect(await dispatch(["carrier"])).toBe(2); // the old spelling answers nothing',
    "const RETIRED = [\"init\", \"wake\"];",
  ];
  for (const body of positives) assert.equal(scanTestText("a.test.ts", body).length, 1, body);
  const r = tests(positives[0]); assert.equal(r.status, 1); assert.match(r.stdout, /retired-test +packages\/example\/tests\/a\.test\.ts:1/);
  // CONTROL: present-tense tests, a domain term and a hyphenated refusal code read nothing, and the fixture still reads its file.
  const lawful = 'test("a root rotation signs under the new key", () => {\n  expect(verify(old, c1).ok).toBe(true); // the previous key still verifies\n  expect(code).toBe("bag-retired names its cure");\n});\nconst RETIRED = "aa".repeat(32);';
  assert.deepEqual(scanTestText("a.test.ts", lawful), []);
  const c = tests(lawful); assert.equal(c.status, 0, c.stdout + c.stderr); assert.match(c.stdout, /retired-test 0\/0/); assert.match(c.stdout, /[1-9]\d* file\(s\) read/);
});
test("E12 upgrade-delete: an upgrade handler that deletes a store or a row reads; one that creates stores does not", () => {
  const red = 'req.onupgradeneeded = (e) => {\n  const db = e.target.result;\n  if (db.objectStoreNames.contains("old")) db.deleteObjectStore("old");\n};';
  assert.equal(scanUpgradeText("a.ts", red).length, 1);
  const rows = 'req.onupgradeneeded = (e) => {\n  cursor.onsuccess = () => {\n    if (at.key === "x") at.delete();\n  };\n};';
  assert.equal(scanUpgradeText("a.ts", rows).length, 1);
  const r = upgrade(red); assert.equal(r.status, 1); assert.match(r.stdout, /upgrade-delete +packages\/example\/src\/a\.ts:3/);
  // CONTROL: creation alone, and a delete outside the upgrade body, read nothing.
  const lawful = 'req.onupgradeneeded = (e) => {\n  const db = e.target.result;\n  if (!db.objectStoreNames.contains("keystore")) db.createObjectStore("keystore");\n};\nfunction forget(db) { db.deleteObjectStore("keystore"); }';
  assert.deepEqual(scanUpgradeText("a.ts", lawful), []);
  const c = upgrade(lawful); assert.equal(c.status, 0, c.stdout + c.stderr); assert.match(c.stdout, /upgrade-delete 0\/0/);
});
test("E13 canon-history: a history word in live canon reads; present canon and a record carrier do not", () => {
  assert.equal(scanCanonText("a.mem", "The island formerly held its own timer.").length, 1);
  assert.equal(scanCanonText("a.mem", "That route is no longer reachable.").length, 1);
  const r = canon("A line.\nThe gate used to read the old column.\n"); assert.equal(r.status, 1); assert.match(r.stdout, /canon-history +bags\/lares\/ha\.ka\.ba\/lares\/api\/pono\/a\.mem:2/);
  // CONTROL: present-tense canon and a hyphenated refusal code read nothing; a record carrier under docs/ stays out of the corpus.
  assert.deepEqual(scanCanonText("a.mem", "The island holds its own timer. The refusal code bag-retired names its cure."), []);
  const c = canon("The gate reads the current column.\n"); assert.equal(c.status, 0, c.stdout + c.stderr); assert.match(c.stdout, /canon-history 0\/0/);
  const record = fixture({ "bags/lares/ha.ka.ba/lares/docs/pono/a.mem": "The gate used to read the old column.\n", "tools/a.mjs": "const x = 1;" });
  assert.equal(record.status, 0, record.stdout + record.stderr);
});
test("E14 a class whose corpus holds no file reads blind", () => {
  assert.deepEqual(blindClasses(["tools/a.mjs", "packages/x/src/a.ts"]), ["retired-test", "canon-history"]);
  assert.deepEqual(blindClasses([]), ["retired-test", "upgrade-delete", "canon-history"]);
  assert.deepEqual(blindClasses(["packages/x/tests/a.test.ts", "packages/x/src/a.ts", "bags/lares/ha.ka.ba/lares/api/a.mem"]), []);
});
