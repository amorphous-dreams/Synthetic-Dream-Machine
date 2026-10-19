import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText, classify, RULES, EXCEPTIONS, CEILINGS } from "./evergreen-boundary.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "tools/evergreen-boundary.mjs");
function fixture(files, extra = []) {
  const root = mkdtempSync(join(tmpdir(), "evergreen-boundary-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return spawnSync(process.execPath, [cli, "--root", root, "--ceilings", "version=0,clock=0,narration=0", "--no-exceptions", ...extra], { encoding: "utf8" });
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
  assert.equal(new Set(EXCEPTIONS.map(e => `${e.rule}|${e.file}|${e.match}`)).size, EXCEPTIONS.length);
  const findings = EXCEPTIONS.flatMap(e => scanText(e.file, readFileSync(join(repo, e.file), "utf8")));
  assert.deepEqual(classify(findings, EXCEPTIONS).stale, []);
});
test("E10 empty corpus fails visibly", () => {
  const r = fixture({}); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /the corpus read nothing/);
});
