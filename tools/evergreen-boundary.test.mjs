import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText, scanAll, scanTestText, scanUpgradeText, scanCanonText, scanCanonDatedText, scanConfigText, isConfigFile, blindClasses, classify, RULES, EXCEPTIONS, CEILINGS } from "./evergreen-boundary.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "tools/evergreen-boundary.mjs");
function fixture(files, extra = []) {
  const root = mkdtempSync(join(tmpdir(), "evergreen-boundary-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return spawnSync(process.execPath, [cli, "--root", root, "--ceilings", "version=0,clock=0,narration=0,old-shape=0,retired-test=0,upgrade-delete=0,canon-history=0,canon-dated-history=0", "--no-exceptions", ...extra], { encoding: "utf8" });
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
test("E1b old-shape names and readings fail while current refusals read clean", () => {
  for (const body of ['class LegacyXRefused extends Error {}', 'const reading = "old-shape";', 'const reading = "old-shape-inception";', '// retired spelling refuses here']) {
    assert.equal(scanText("a.ts", body).filter(f => f.rule === "old-shape").length, 1, body);
    const red = one(body); assert.equal(red.status, 1); assert.match(red.stdout, /old-shape +packages\/example\/src\/a\.ts:1/);
  }
  const lawful = 'class FacelessKeyhiveRefused extends Error {}\nconst reading = "face-locked";';
  assert.equal(scanText("a.ts", lawful).filter(f => f.rule === "old-shape").length, 0);
  const green = one(lawful); assert.equal(green.status, 0, green.stdout + green.stderr);
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
  for (const rule of ["retired-test", "upgrade-delete", "canon-history", "canon-dated-history"]) {
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
  assert.deepEqual(blindClasses(["tools/a.mjs", "packages/x/src/a.ts"]), ["retired-test", "canon-history", "canon-dated-history"]);
  assert.deepEqual(blindClasses([]), ["old-shape", "retired-test", "upgrade-delete", "canon-history", "canon-dated-history"]);
  assert.deepEqual(blindClasses(["packages/x/tests/a.test.ts", "packages/x/src/a.ts", "bags/lares/ha.ka.ba/lares/api/a.mem"]), []);
});
test("E15 a comment that names its lane, wave or slice is narration; the lowercase domain words are not", () => {
  for (const body of ["// Wave C swaps the face in here.", "/* the seed (slice 2: genesis is data) */", "// since this lane touches only one file", "// Slice 5 lands the act.", "// This lane runs the e2e sets alone."]) {
    assert.equal(scanText("a.ts", body).filter(f => f.rule === "narration").length, 1, body);
  }
  const r = one("// Wave B carries the holder.\nconst x = 1;"); assert.equal(r.status, 1); assert.match(r.stdout, /narration +packages\/example\/src\/a\.ts:1/);
  // CONTROL: a wave of edits, a byte slice and a string that names a lane read nothing.
  assert.deepEqual(scanText("a.ts", '// a wave a watcher settled; take a slice of the buffer.\nconst s = buf.slice(2);\nconst name = "this lane";'), []);
});
test("E16 workflow, Dockerfile and compose comments join the narration corpus; their code does not", () => {
  assert.equal(isConfigFile(".github/workflows/ci.yml"), true);
  assert.equal(isConfigFile("docker-compose.surface.yml"), true);
  assert.equal(isConfigFile("Dockerfile"), true);
  assert.equal(isConfigFile("Dockerfile.dockerignore"), false);
  assert.equal(isConfigFile("packages/x/docker-compose.yml"), false);
  assert.equal(scanConfigText("ci.yml", "      # A CDN stall used to hold a runner.").length, 1);
  assert.equal(scanConfigText("ci.yml", "    # the red this lane exists to surface").length, 1);
  const r = fixture({ ".github/workflows/ci.yml": "jobs:\n  # the old job ran here\n  test:\n" }); assert.equal(r.status, 1); assert.match(r.stdout, /narration +\.github\/workflows\/ci\.yml:2/);
  // CONTROL: a present comment, and a `#` inside a value (an anchor, a color), read nothing.
  assert.deepEqual(scanConfigText("ci.yml", "      # The engine directory restores by the pinned version.\n        key: a#used to\n"), []);
  const c = fixture({ ".github/workflows/ci.yml": "jobs:\n  # The test job runs every suite.\n  test:\n" }); assert.equal(c.status, 0, c.stdout + c.stderr);
});
test("E17 canon-dated-history: a history verb beside an ISO date reads in live canon; a ruling or correction marker beside the date and a record carrier do not", () => {
  for (const body of ["The engine landed 2026-07-02.", "(collisions removed 2026-06-04)", "the attribute form retired 2026-06-12.", "2026-09-18: the fork was cured."]) {
    assert.equal(scanCanonDatedText("a.mem", body).length, 1, body);
  }
  const r = canon("A line.\nThe engine landed 2026-07-02.\n"); assert.equal(r.status, 1); assert.match(r.stdout, /canon-dated-history +bags\/lares\/ha\.ka\.ba\/lares\/api\/pono\/a\.mem:2/);
  // THE MARKER EXEMPTION. A date beside a ruling or correction marker (`RULED`, `ruling`, `CORRECTION`, `CORRECTED`)
  // carries provenance, so it reads nothing even where a history verb sits beside it; the same line without the
  // marker reads red. A date far from any history verb, and a record carrier under docs/, read nothing.
  for (const marked of ["RULED (2026-11-02): the old door was retired.", "''Recursive o-takiage'' (operator ruling, 2026-10-16). A witness that catches burned names lives one commit.",
    "CORRECTION (neg-entropy swarm 2026-06-23): the earlier claim was wrong.", "CORRECTED 2026-08-09 against the code, replacing an over-claim that was wrong."]) {
    assert.deepEqual(scanCanonDatedText("a.mem", marked), [], marked);
  }
  for (const bare of ["On 2026-11-02 the old door was retired.", "(swarm 2026-06-23): the earlier claim was wrong."]) {
    assert.equal(scanCanonDatedText("a.mem", bare).length, 1, bare);
  }
  // A marker near ONE date never covers a second, unmarked date on the same line.
  assert.equal(scanCanonDatedText("a.mem", "RULED (2026-09-18). Elsewhere the engine landed 2026-07-02.").length, 1);
  assert.deepEqual(scanCanonDatedText("a.mem", "The lease holds its own causal clock (2026-09-18) and never reads a wall."), []);
  const c = canon("The identity model stands RULED (operator, 2026-06-24).\n"); assert.equal(c.status, 0, c.stdout + c.stderr); assert.match(c.stdout, /canon-dated-history 0\/0/);
  const record = fixture({ "bags/lares/ha.ka.ba/lares/docs/pono/a.mem": "The engine landed 2026-07-02.\n", "tools/a.mjs": "const x = 1;" });
  assert.equal(record.status, 0, record.stdout + record.stderr);
});
