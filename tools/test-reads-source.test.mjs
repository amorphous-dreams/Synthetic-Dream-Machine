import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isTestFile, ratchet, readsSource } from "./test-reads-source.mjs";

const cli = fileURLToPath(new URL("./test-reads-source.mjs", import.meta.url));
function house(files, allow) {
  const root = mkdtempSync(join(tmpdir(), "test-reads-source-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    writeFileSync(join(root, "allow.json"), JSON.stringify(allow));
    return spawnSync(process.execPath, [cli, "--root", root, "--allowlist", join(root, "allow.json")], { encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
// Sample sources spell their calls through these joins, so this file holds no read call of its own.
const RDX = "read" + "FileSync", OP = "op" + "en";
const rd = (text) => readsSource(text.replaceAll("RD(", RDX + "(").replaceAll("OP(", OP + "("));
const reader = "const t = " + RDX + '(join(__dirname, "..", "src", "main.ts"), "utf8");\nexpect(t).toMatch(/wired/);\n';
const lawful = 'import { x } from "../src/main.js";\nexpect(x()).toBe(1);\n';

test("R1 CONTROL: a behaviour test and a listed reader leave the witness green", () => {
  const r = house({ "packages/a/tests/ok.test.ts": lawful, "packages/a/tests/old.test.ts": reader }, ["packages/a/tests/old.test.ts"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /1 test file\(s\) read source, 1 allowlisted/);
});
test("R2 RED: a new test that reads src text outside the allowlist fails by name", () => {
  const r = house({ "packages/a/tests/old.test.ts": reader, "packages/a/tests/fresh.test.ts": reader }, ["packages/a/tests/old.test.ts"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /new-reader\s+packages\/a\/tests\/fresh\.test\.ts/);
});
test("R3 RED: a listed file that stopped reading source must leave the allowlist", () => {
  const r = house({ "packages/a/tests/old.test.ts": lawful }, ["packages/a/tests/old.test.ts"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stale-allow\s+packages\/a\/tests\/old\.test\.ts/);
});
test("R4 detection: canon prose, identifier arguments and python reads count; imports, fixtures and config reads do not", () => {
  assert.ok(rd('RD(join(ROOT, "bags/lares/ha.ka.ba/lares/api/x.mem"), "utf8")'));
  assert.ok(rd('const SRC = join(here, "..", "src", "a.ts");\nconst t = RD(SRC, "utf8");'));
  assert.ok(rd('t = OP("../src/a.py").read()'));
  assert.equal(rd('import { f } from "../src/a.js";\nRD(out, "utf8");'), null);
  assert.equal(rd('writeFileSync(join(repo, "packages/a/src/x.ts"), "x"); RD(join(root, "out.txt"), "utf8");'), null);
  assert.equal(rd('RD(join(ROOT, ".github/workflows/ci.yml"), "utf8"); RD("tools/lares-container.sh");'), null);
  assert.equal(rd('RD(join(dir, "npc.mem"), "utf8")'), null);
});
test("R5 file shapes: tests/ dirs, .test.* and test_*.py are test files; production sources are not", () => {
  for (const p of ["packages/a/tests/x.ts", "tools/x.test.mjs", "pkg/test_x.py", "tests/e2e/x.test.ts"]) assert.ok(isTestFile(p), p);
  for (const p of ["packages/a/src/x.ts", "tools/x.mjs"]) assert.ok(!isTestFile(p), p);
  assert.deepEqual(ratchet([{ path: "a" }], ["a", "b"]), { fresh: [], stale: ["b"] });
});
