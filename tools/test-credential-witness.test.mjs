// test-credential-witness.test — the witness reads red on a carrier quoting a test credential, green on a clean one,
// and red (exit 2) on a source that names no literal (silent zero).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CREDENTIAL_SOURCES, literalsIn, run } from "./test-credential-witness.mjs";

function repo(carrier, sources = true) {
  const root = mkdtempSync(join(tmpdir(), "test-credential-witness-"));
  for (const src of CREDENTIAL_SOURCES) {
    mkdirSync(join(root, src, ".."), { recursive: true });
    writeFileSync(join(root, src), sources ? `export const TEST_PASSPHRASE = "planted-route-passphrase";\n` : "// none here\n");
  }
  mkdirSync(join(root, "bags/lares"), { recursive: true });
  writeFileSync(join(root, "bags/lares/a.mem"), carrier);
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "add", "."]);
  return root;
}

test("literals parse off a source: the export and the passphrase field", () => {
  assert.deepEqual(literalsIn(`export const TEST_PASSPHRASE = "aaaa-bbbb-cccc";\n{ passphrase: "dddd-eeee-ffff" }`).sort(), ["aaaa-bbbb-cccc", "dddd-eeee-ffff"]);
});
test("RED: a carrier that quotes a test credential names its line", () => {
  const out = run(repo("a line\nquotes planted-route-passphrase here\n"));
  assert.equal(out.code, 1);
  assert.match(out.message, /bags\/lares\/a\.mem:2/);
});
test("CONTROL: a clean carrier holds", () => {
  assert.equal(run(repo("names the route by its constant, TEST_PASSPHRASE\n")).code, 0);
});
test("SILENT ZERO: a source that names no literal reads red", () => {
  assert.equal(run(repo("clean\n", false)).code, 2);
});
test("the live tree holds", () => {
  assert.equal(run(join(import.meta.dirname, "..")).code, 0);
});
