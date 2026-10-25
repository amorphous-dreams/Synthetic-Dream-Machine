import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanText, classify, ALLOWANCES, CEILING } from "./barrier-witness.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const cli = join(repo, "tools/barrier-witness.mjs");
const fx = (name) => readFileSync(join(repo, "tools/barrier-witness-fixtures", name), "utf8");
function corpus(files, extra = []) {
  const root = mkdtempSync(join(tmpdir(), "barrier-witness-"));
  try {
    for (const [rel, body] of Object.entries(files)) { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), body); }
    return spawnSync(process.execPath, [cli, "--root", root, "--ceiling", "0", "--no-allowances", ...extra], { encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("B1 RED: W4 as the span stood reads an absence with no far-side barrier", () => {
  const found = scanText("w4.e2e.test.ts", fx("w4-before-cure.fixture.txt"));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].rule, "holds");
  assert.match(found[0].text, /expect\(await story\(\)\)\.toEqual\(\[ALPHA\]\)/);
  const r = corpus({ "packages/web/tests/e2e/w4.e2e.test.ts": fx("w4-before-cure.fixture.txt") });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /backlog 1\/0/);
  assert.match(r.stdout, /holds\s+packages\/web\/tests\/e2e\/w4\.e2e\.test\.ts:\d+\s+\[W4 —/);
});
test("B2 CONTROL: the same test with a sentinel act before its assertion reads clean", () => {
  assert.deepEqual(scanText("w4.e2e.test.ts", fx("w4-with-sentinel.fixture.txt")), []);
  const r = corpus({ "packages/web/tests/e2e/w4.e2e.test.ts": fx("w4-with-sentinel.fixture.txt") });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /1 file\(s\) read · backlog 0\/0/);
});
test("B3 CONTROL: an unchanged-state assertion after a waitForFunction on the island's answer, or a poll on the same value, reads clean", () => {
  assert.deepEqual(scanText("a.e2e.test.ts", fx("unchanged-after-wait.fixture.txt")), []);
});
test("B4 RED: a bare or vague barrier marker names nothing and reads red", () => {
  const found = scanText("a.e2e.test.ts", fx("bare-marker.fixture.txt"));
  assert.deepEqual(found.map((f) => f.rule).sort(), ["bare-marker", "bare-marker", "holds", "not"]);
  const r = corpus({ "tests/e2e/a.test.ts": fx("bare-marker.fixture.txt") });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /bare-marker\s+tests\/e2e\/a\.test\.ts:\d+/);
});
test("B5 a named marker bars the assertions after the act; a marker above the act bars nothing", () => {
  const found = scanText("a.e2e.test.ts", fx("marker-named.fixture.txt"));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].rule, "zero");
  assert.equal(found[0].test, "a barrier above the act bars nothing");
});
test("B6 the three absence forms each read red alone, and a point read of an exit code or a boolean reads nothing", () => {
  const body = (line, name = "the thing holds") => `test("${name}", async () => {\n  await page.click("x");\n  ${line}\n});`;
  assert.equal(scanText("a.ts", body("expect(log).not.toContain(\"boom\");"))[0]?.rule, "not");
  assert.equal(scanText("a.ts", body("expect(rows).toHaveLength(0);"))[0]?.rule, "zero");
  assert.equal(scanText("a.ts", body("expect(count).toBe(0);"))[0]?.rule, "zero");
  assert.equal(scanText("a.ts", body("expect(state).toEqual([A]);"))[0]?.rule, "holds");
  assert.deepEqual(scanText("a.ts", body("expect(r.code).toBe(0);")), []);
  assert.deepEqual(scanText("a.ts", body("expect(state).toEqual([A]);", "the thing changes")), []);
  assert.deepEqual(scanText("a.ts", body("expect(flag).toBe(false);")), []);
  assert.deepEqual(scanText("a.ts", "test(\"no act\", async () => {\n  expect(rows).toHaveLength(0);\n});"), []);
});
test("B7 a poll on a near-shore event bars nothing about a far shore", () => {
  const near = 'test("the story holds", async () => {\n  await a.click();\n  await expect.poll(() => opened.length).toBe(1);\n  expect(await story()).toEqual([A]);\n});';
  assert.equal(scanText("a.ts", near).length, 1);
  const far = near.replace("opened.length", "story()");
  assert.deepEqual(scanText("a.ts", far), []);
});
test("B8 allowances: a bare one reads red, a stale one reads red, a matching one allows its finding", () => {
  const f = scanText("w4.e2e.test.ts", fx("w4-before-cure.fixture.txt"));
  const good = { file: "w4.e2e.test.ts", test: "W4 —", owner: "dreamdom-rest-before-reload", reason: "the lane cures it" };
  assert.equal(classify(f, [good]).open.length, 0);
  assert.equal(classify(f, [{ ...good, owner: "" }]).invalid.length, 1);
  assert.equal(classify(f, [{ ...good, reason: " " }]).invalid.length, 1);
  assert.equal(classify(f, [{ ...good, test: "W9" }]).stale.length, 1);
  assert.equal(classify([], [good]).stale.length, 1);
});
test("B9 an empty corpus fails: a zero from no reading proves nothing", () => {
  const r = corpus({ "README.md": "x" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /read nothing/);
});
test("B10 the span stands at its ceiling: every named allowance carries a reason and an owner, and none stands once its lane lands", () => {
  for (const a of ALLOWANCES) { assert.ok(a.reason.trim() && a.owner.trim() && a.file && a.test, JSON.stringify(a)); }
  assert.equal(CEILING, 0, "the golden's three absence reads each stand behind a sentinel act: the ceiling reads zero");
  assert.equal(ALLOWANCES.length, 0, "the rest-before-reload lane cured W4 with a sentinel, so its allowance is gone");
  const r = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`backlog ${CEILING}/${CEILING} · allowed ${ALLOWANCES.length}`));
});
