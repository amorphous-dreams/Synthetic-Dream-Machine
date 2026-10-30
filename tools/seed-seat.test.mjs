import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  CODEX_LINK, LINK, RULE_EXCLUDE, SCOUTS, SEED, faultsOf, importsOf, project, projectScout, scoutPath, seedAtTokens,
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
  writeFileSync(join(dir, ".claude/settings.json"), JSON.stringify({ claudeMdExcludes: [RULE_EXCLUDE] }));
  symlinkSync("bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem", join(dir, CODEX_LINK));
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/config.toml"), "project_doc_max_bytes = 65536\n");
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

test("a clone whose settings drop the rule's exclude names the double seat", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, ".claude/settings.json"), "{}\n");
  assert.match(faultsOf(dir).join("\n"), /claudeMdExcludes carries no \*\*\/\.claude\/rules\/lares-seed-seat\.md/);
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

test("the staged gate passes a commit over a seated index", () => {
  const dir = seatedClone();
  cpTools(dir);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "-c", "user.email=w@x.invalid", "-c", "user.name=w", "commit", "-q", "-m", "seat", "--no-verify"]);
  writeFileSync(join(dir, "other.txt"), "x");
  execFileSync("git", ["-C", dir, "add", "other.txt"]);
  execFileSync(join(dir, "tools/seed-seat-staged.sh"), { cwd: dir, stdio: "pipe" });
});

test("the pre-commit hook runs the seat gate", () => {
  assert.match(readFileSync(join(ROOT, ".githooks/pre-commit"), "utf8"), /^run_gate seed-seat-staged\.sh$/m);
});

test("the Codex link reads as a link to the seed, or names itself", () => {
  const dir = seatedClone();
  execFileSync("rm", [join(dir, CODEX_LINK)]);
  writeFileSync(join(dir, CODEX_LINK), "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
  assert.match(faultsOf(dir).join("\n"), /AGENTS\.override\.md: a regular file, not a link/);
});

test("a Codex cap below the seed's bytes names the silent tail cut", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, ".codex/config.toml"), "project_doc_max_bytes = 32768\n");
  assert.match(faultsOf(dir).join("\n"), /project_doc_max_bytes 32768 holds less than the seed's/);
  writeFileSync(join(dir, ".codex/config.toml"), "");
  assert.match(faultsOf(dir).join("\n"), /project_doc_max_bytes unset/);
});

test("AGENTS.md or Copilot's file carrying the seed or a pointer to it names the double seat", () => {
  for (const surface of ["AGENTS.md", ".github/copilot-instructions.md"]) {
    const dir = seatedClone();
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, surface), "-> [noosphere-boot.mem](bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem)\n");
    assert.match(faultsOf(dir).join("\n"), new RegExp(`${surface.replace(/\./g, "\\.")}: carries the seed or a pointer`));
    writeFileSync(join(dir, surface), SEED_TEXT);
    assert.match(faultsOf(dir).join("\n"), /carries the seed or a pointer/);
  }
});

test("--index reads a staged link's target, not its mode alone", () => {
  const dir = seatedClone();
  execFileSync("rm", [join(dir, CODEX_LINK)]);
  symlinkSync("CLAUDE.md", join(dir, CODEX_LINK));
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  assert.match(faultsOf(dir, { index: true }).join("\n"), /AGENTS\.override\.md: the index links to CLAUDE\.md/);
});

test("--index reads a seed @-token against the index, not the working tree", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, SEED), `${SEED_TEXT}\nsee @staged.md here\n`);
  writeFileSync(join(dir, "staged.md"), "x");
  project(dir);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("rm", [join(dir, "staged.md")]);
  assert.match(faultsOf(dir, { index: true }).join("\n"), /@staged\.md resolves to a file/);
});

test("prose that mentions the seed's file name reads as prose, never as a pointer", () => {
  const dir = seatedClone();
  writeFileSync(join(dir, "AGENTS.md"), "## Surface\n\n- never hand-edit noosphere-boot.mem; the memegraph writes it\n");
  assert.deepEqual(faultsOf(dir), []);
});

test("the staged gate reads every commit, so a seeded file outside any list never lands", () => {
  const dir = seatedClone();
  cpTools(dir);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "-c", "user.email=w@x.invalid", "-c", "user.name=w", "commit", "-q", "-m", "seat", "--no-verify"]);
  writeFileSync(join(dir, "copilot-instructions.md"), `-> [noosphere-boot.mem](${SEED})\n`);
  execFileSync("git", ["-C", dir, "add", "copilot-instructions.md"]);
  assert.throws(() => execFileSync(join(dir, "tools/seed-seat-staged.sh"), { cwd: dir, stdio: "pipe" }), (e) => /REFUSED/.test(String(e.stderr)));
});
