/**
 * meme check --format=problems — a refusal reaches the editor's Problems panel through a matcher.
 *
 * The files on disk serve as an operator surface (the tideline ruling's seam): a torn frame, a stale
 * seal, a body fault must surface where the operator edits. The door speaks
 * `path:line:col: severity: code: message`, one line per diagnostic, and a `tasks.json` problem matcher
 * reads it. These goldens pin the exact lines and their 1-based positions over fixture carriers
 * (fixtures/problems/golden.ts) and pin the default human output byte for byte.
 *
 * DRIVEN THROUGH THE BUILT BINARY: the flag's accept row lives in bin/lares.ts, so only the composed
 * command answers whether `--format` parses at all.
 */
import { describe, test, expect, beforeAll, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { positionOf, problemLine } from "../src/problems.js";
import { GOLDEN, HUMAN, NAMES, fixtureText } from "./fixtures/problems/golden.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const REPO = path.resolve(new URL("../../..", import.meta.url).pathname);
const BIN = path.join(REPO, "packages/lares-cli/dist/src/bin/lares.js");
const FIXTURES = path.join(REPO, "packages/lares-cli/tests/fixtures/problems");

let dir: string;
let house: string;

/** Run the built door from the scratch dir (no git tree, so no unnamed-dirty reading), under a scratch house. */
function lares(args: readonly string[]): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("node", [BIN, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, LAR_ROOT: house, LAR_BAGS: "" },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 1 };
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "lares-problems-"));
  house = mkdtempSync(path.join(tmpdir(), "lares-problems-house-"));
  const clean = readFileSync(path.join(FIXTURES, "clean.mem"), "utf8");
  for (const n of NAMES) writeFileSync(path.join(dir, `${n}.mem`), fixtureText(n, clean));
});

describe("meme check --format=problems — the goldens", () => {
  for (const n of NAMES) {
    test(`${n}: the exact lines, 1-based, and the exit the human seat gives`, () => {
      const r = lares(["meme", "check", "--format=problems", `${n}.mem`]);
      expect(r.stderr).toBe("");
      expect(r.stdout).toBe(GOLDEN[n].lines.map((l) => `${l}\n`).join(""));
      expect(r.code).toBe(GOLDEN[n].code);
    });
  }

  test("one run over every fixture prints each file's lines in the order named, and nothing for the clean one", () => {
    const r = lares(["meme", "check", "--format=problems", ...NAMES.map((n) => `${n}.mem`)]);
    expect(r.stdout).toBe(NAMES.flatMap((n) => GOLDEN[n].lines).map((l) => `${l}\n`).join(""));
    expect(r.code).toBe(1);
  });

  test("the spaced spelling `--format problems` reads the same", () => {
    const r = lares(["meme", "check", "--format", "problems", "torn.mem"]);
    expect(r.stdout).toBe(GOLDEN.torn.lines.map((l) => `${l}\n`).join(""));
  });

  test("an unknown format refuses as usage, naming the one it reads", () => {
    const r = lares(["meme", "check", "--format=json", "torn.mem"]);
    expect(r.code).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/--format=problems/);
  });

  test("beside a sibling reading, or on normalize, the format refuses as usage", () => {
    expect(lares(["meme", "check", "--format=problems", "--gradient", "torn.mem"]).code).toBe(2);
    expect(lares(["meme", "normalize", "--format=problems", "torn.mem"]).code).toBe(2);
  });
});

describe("meme check — the default output never changes", () => {
  for (const n of NAMES) {
    test(`${n}: byte for byte`, () => {
      const r = lares(["meme", "check", `${n}.mem`]);
      expect(r.stdout).toBe(HUMAN[n]);
      expect(r.code).toBe(GOLDEN[n].code);
    });
  }
});

describe("the problems line — positions against the file's own text", () => {
  test("an offset counts lines and columns from 1; no offset reads 1:1", () => {
    const text = "ab\ncd\r\nef";
    expect(positionOf(text, 0)).toEqual({ line: 1, col: 1 });
    expect(positionOf(text, 3)).toEqual({ line: 2, col: 1 });
    expect(positionOf(text, 4)).toEqual({ line: 2, col: 2 });
    expect(positionOf(text, 7)).toEqual({ line: 3, col: 1 });
    expect(positionOf(text, null)).toEqual({ line: 1, col: 1 });
    expect(problemLine("x.mem", text, null, "warning", "flag", "a reading")).toBe("x.mem:1:1: warning: flag: a reading");
  });

  test("a message holding a newline folds onto one line, so the matcher reads one problem per line", () => {
    expect(problemLine("x.mem", "", null, "error", "stage", "one\n  two")).toBe("x.mem:1:1: error: stage: one two");
  });
});
