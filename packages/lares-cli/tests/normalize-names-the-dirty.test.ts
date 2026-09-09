/**
 * normalize names what it did NOT stamp — the parallel-writer guard.
 *
 * STAMPING SEALS A CARRIER'S BYTES. Doing it while OTHER carriers sit dirty and unread is how one
 * hand seals another hand's half-finished work: the check goes over whatever stands, and afterwards
 * nothing distinguishes a body its author finished from a body someone else caught mid-edit.
 *
 * The gesture already refuses a glob and takes named files only, which stops a blanket sweep. It said
 * nothing about the carriers it passed over — so a caller naming two files while a third stood dirty
 * got a clean run and no reason to look. Measured live: two carriers stamped through this door while
 * a third sat dirty and unnamed, and the door reported success.
 *
 * A dirty carrier nobody named reads two ways — yours and forgotten, or nobody's — and the door
 * cannot tell which. So it names them and carries on: a warning a caller can weigh, never a refusal
 * that would block a legitimate partial sweep.
 *
 * DRIVEN THROUGH THE BUILT BINARY in a real git tree, because the guard reads `git diff` and a helper
 * test would pass on a door that never calls it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = path.resolve(new URL("../../..", import.meta.url).pathname);
const BIN = path.join(REPO, "packages/lares-cli/dist/src/bin/lares.js");
const SOURCE = path.join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/prism.mem");

const skip = !existsSync(BIN) || !existsSync(SOURCE);
const note = skip ? " [SKIPPED: no built binary — run: pnpm --filter @lares/cli build]" : "";

describe.skipIf(skip)(`normalize names the dirty it did not stamp${note}`, () => {
  let tree: string;
  let named: string;
  let unnamed: string;

  beforeAll(() => {
    // A REAL GIT TREE. The guard asks git which carriers stand dirty, so a bare tmpdir would answer
    // "none" and the law would pass over a door that never looked.
    tree = mkdtempSync(path.join(tmpdir(), "lares-normalize-guard-"));
    mkdirSync(path.join(tree, "bags/lares/x"), { recursive: true });
    named   = path.join(tree, "bags/lares/x/named.mem");
    unnamed = path.join(tree, "bags/lares/x/unnamed.mem");
    copyFileSync(SOURCE, named);
    copyFileSync(SOURCE, unnamed);
    const git = (...a: string[]) => execFileSync("git", a, { cwd: tree, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "t@t"); git("config", "user.name", "t");
    git("add", "-A"); git("commit", "-qm", "seed");
    // Both drift; only one gets named on the run.
    // THE DRIFT MUST LAND INSIDE THE CHECKED SPAN. Text before STX moves no check, and the door would
    // read the carrier as canonical — a fixture that proves nothing while looking like it does.
    for (const f of [named, unnamed]) {
      const t = readFileSync(f, "utf8");
      writeFileSync(f, t.replace("<<~ ahu", "drifted here\n\n<<~ ahu"));
    }
  });

  const run = (...args: string[]) => {
    try {
      return execFileSync("node", [BIN, "carrier", "normalize", ...args], { cwd: tree, encoding: "utf8" });
    } catch (e) { return (e as { stdout?: string }).stdout ?? ""; }
  };

  test("CONTROL — the door still stamps the carrier it was given", () => {
    const out = run(named);
    expect(out).toContain("normalized:");
  });

  test("★ it names the dirty carrier nobody asked it about ★", () => {
    const out = run("--check", named);
    expect(out, "a carrier stood dirty and unnamed and the door said nothing").toContain("unnamed.mem");
  });

  test("★ and says nothing when every dirty carrier was named ★", () => {
    const out = run("--check", named, unnamed);
    expect(out).not.toMatch(/dirty and NOT named/);
  });
});
