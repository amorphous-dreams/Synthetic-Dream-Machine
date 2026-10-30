import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BLOCK_CLOSE, BLOCK_OPEN, LINK, SCOUTS, SEED, faultsOf, importsOf, install, project, projectScout, scoutPath, seedAtTokens, withBlock,
} from "./seed-seat.mjs";

const ROOT = join(import.meta.dirname, "..");
const SEED_TEXT = readFileSync(join(ROOT, SEED), "utf8");

function cpTools(dir) {
  mkdirSync(join(dir, "tools"), { recursive: true });
  for (const f of ["seed-seat.mjs", "seed-seat-staged.sh"]) copyFileSync(join(ROOT, "tools", f), join(dir, "tools", f));
  chmodSync(join(dir, "tools/seed-seat-staged.sh"), 0o755);
}

/** A scratch clone carrying the seed, a CLAUDE.md that imports the link, the link, and the scouts. */
function seatedClone() {
  const dir = mkdtempSync(join(tmpdir(), "seed-seat-test-"));
  mkdirSync(join(dir, "bags/lares/ha.ka.ba/lares/api"), { recursive: true });
  writeFileSync(join(dir, SEED), SEED_TEXT);
  writeFileSync(join(dir, "CLAUDE.md"), `@${LINK}\n\n## Claude Adapter Surface\n`);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  symlinkSync("../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", join(dir, LINK));
  project(dir);
  return dir;
}

test("CONTROL: a seated clone reads no fault", () => {
  assert.deepEqual(faultsOf(seatedClone()), []);
});

test("the live tree's seat stands", () => {
  assert.deepEqual(faultsOf(ROOT), []);
});

test("a link that reads as a regular file names itself", () => {
  const dir = seatedClone();
  execFileSync("rm", [join(dir, LINK)]);
  writeFileSync(join(dir, LINK), "../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
  assert.match(faultsOf(dir).join("\n"), /a regular file, not a link/);
});

test("an absolute link and a dangling link each name themselves", () => {
  const abs = seatedClone();
  execFileSync("rm", [join(abs, LINK)]);
  symlinkSync(join(abs, SEED), join(abs, LINK));
  assert.match(faultsOf(abs).join("\n"), /links by absolute path/);
  const dangling = seatedClone();
  execFileSync("rm", [join(dangling, LINK)]);
  symlinkSync("../nowhere.mem", join(dangling, LINK));
  assert.match(faultsOf(dangling).join("\n"), /dangles/);
});

test("an import naming a .mem reads as the silent import it lands as", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, "CLAUDE.md"), `@${LINK}\n\n@${SEED}\n`);
  assert.match(faultsOf(dir).join("\n"), /names a \.mem file, which an import never loads/);
});

test("a CLAUDE.md without the link's import names the gap", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, "CLAUDE.md"), "## Claude Adapter Surface\n");
  assert.match(faultsOf(dir).join("\n"), /carries no @\.claude\/noosphere-boot import/);
});

test("imports inside a fence never count", () => {
  assert.deepEqual(importsOf("```\n@inside.md\n```\n@outside.md\n"), ["outside.md"]);
});

test("a scout edited by hand parts from the projection, and project restores it", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, scoutPath(SCOUTS[0])), "hand edit\n");
  assert.match(faultsOf(dir).join("\n"), /Explore\.md: parts from the seed's projection/);
  assert.deepEqual(project(dir), [scoutPath(SCOUTS[0])]);
  assert.deepEqual(faultsOf(dir), []);
});

test("project converges: a second run writes nothing", () => {
  const dir = seatedClone();
  assert.deepEqual(project(dir), []);
});

test("a seed edit moves every scout's projection", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, SEED), `${SEED_TEXT}\nmore\n`);
  assert.equal(faultsOf(dir).filter((f) => /parts from the seed's projection/.test(f)).length, SCOUTS.length);
});

test("every scout reads and never writes, and carries the seed's bytes whole", () => {
  for (const scout of SCOUTS) {
    const text = projectScout(SEED_TEXT, scout);
    assert.match(text, /^disallowedTools: .*\bEdit\b.*\bWrite\b/m);
    assert.match(text, /^disallowedTools: .*\bAgent\b/m);
    assert.ok(text.includes(SEED_TEXT), `${scout.name} carries the seed verbatim`);
    assert.match(text, new RegExp(`^name: ${scout.name}$`, "m"));
  }
});

test("a seed @-token that resolves to a file names itself", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, SEED), `${SEED_TEXT}\nsee @stray.txt here\n`);
  writeFileSync(join(dir, "stray.txt"), "x");
  project(dir);
  assert.match(faultsOf(dir).join("\n"), /@stray\.txt resolves to a file/);
  assert.ok(seedAtTokens("a @b c\n@d").includes("d"));
});

test("--index reads what the commit carries, not the working tree", () => {
  const dir = seatedClone();
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  writeFileSync(join(dir, scoutPath(SCOUTS[1])), "unstaged hand edit\n");
  assert.deepEqual(faultsOf(dir, { index: true }), []);
  assert.match(faultsOf(dir).join("\n"), /Plan\.md: parts/);
});

test("install seats the region once, leads with it, and keeps the operator's bytes", () => {
  const home = mkdtempSync(join(tmpdir(), "seed-seat-home-"));
  const clone = seatedClone();
  mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".claude/CLAUDE.md"), "my own line\n");
  assert.equal(install({ home, clone }).changed, true);
  const once = readFileSync(join(home, ".claude/CLAUDE.md"), "utf8");
  assert.ok(once.startsWith(`${BLOCK_OPEN}\n@${join(clone, LINK)}\n${BLOCK_CLOSE}\n\n`));
  assert.ok(once.endsWith("my own line\n"));
  assert.equal(install({ home, clone }).changed, false);
  assert.equal(readFileSync(join(home, ".claude/CLAUDE.md"), "utf8"), once);
});

test("install re-points the region in place when the clone moves", () => {
  const home = mkdtempSync(join(tmpdir(), "seed-seat-home-"));
  const a = seatedClone();
  const b = seatedClone();
  install({ home, clone: a });
  install({ home, clone: b });
  const text = readFileSync(join(home, ".claude/CLAUDE.md"), "utf8");
  assert.equal(text.split(BLOCK_OPEN).length - 1, 1);
  assert.ok(text.includes(`@${join(b, LINK)}`) && !text.includes(`@${join(a, LINK)}`));
});

test("uninstall lifts the region and leaves the operator's bytes as they stood", () => {
  const home = mkdtempSync(join(tmpdir(), "seed-seat-home-"));
  const clone = seatedClone();
  mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".claude/CLAUDE.md"), "my own line\n");
  install({ home, clone });
  assert.equal(install({ home, clone, uninstall: true }).changed, true);
  assert.equal(readFileSync(join(home, ".claude/CLAUDE.md"), "utf8"), "my own line\n");
  assert.equal(install({ home, clone, uninstall: true }).changed, false);
});

test("install into an absent CLAUDE.md writes the region alone", () => {
  const home = mkdtempSync(join(tmpdir(), "seed-seat-home-"));
  const clone = seatedClone();
  install({ home, clone });
  assert.equal(readFileSync(join(home, ".claude/CLAUDE.md"), "utf8"), `${BLOCK_OPEN}\n@${join(clone, LINK)}\n${BLOCK_CLOSE}\n`);
});

test("install refuses a region it cannot bound, and a clone with no seat", () => {
  assert.throws(() => withBlock(`${BLOCK_OPEN}\nhalf`, "x"), /bounds one region or none/);
  assert.throws(() => withBlock(`${BLOCK_CLOSE}\n${BLOCK_OPEN}\n`, "x"), /before the opening one/);
  const home = mkdtempSync(join(tmpdir(), "seed-seat-home-"));
  assert.throws(() => install({ home, clone: mkdtempSync(join(tmpdir(), "no-seat-")) }), /carries no seat/);
});

test("the witness reads its own control red", () => {
  const out = execFileSync(join(ROOT, "tools/seed-seat-witness.sh"), ["--control"], { encoding: "utf8" });
  assert.match(out, /the control read red/);
});

test("the root build projects the scouts", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts.build, /node tools\/seed-seat\.mjs project/);
});


test("the staged gate refuses a seed staged ahead of its scouts, and passes once they follow", () => {
  const dir = seatedClone();
  cpTools(dir);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  writeFileSync(join(dir, SEED), `${SEED_TEXT}\nmore\n`);
  execFileSync("git", ["-C", dir, "add", SEED]);
  const gate = join(dir, "tools/seed-seat-staged.sh");
  assert.throws(() => execFileSync(gate, { cwd: dir, stdio: "pipe" }), (e) => /REFUSED/.test(String(e.stderr)) && /Explore\.md: parts/.test(String(e.stderr)));
  project(dir);
  execFileSync("git", ["-C", dir, "add", ".claude/agents"]);
  execFileSync(gate, { cwd: dir, stdio: "pipe" });
});

test("the staged gate stays silent on a commit that leaves the seat alone", () => {
  const dir = seatedClone();
  cpTools(dir);
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, "other.txt"), "x");
  execFileSync("git", ["-C", dir, "add", "other.txt"]);
  execFileSync(join(dir, "tools/seed-seat-staged.sh"), { cwd: dir, stdio: "pipe" });
});

test("the pre-commit hook runs the seat gate", () => {
  assert.match(readFileSync(join(ROOT, ".githooks/pre-commit"), "utf8"), /^run_gate seed-seat-staged\.sh$/m);
});
