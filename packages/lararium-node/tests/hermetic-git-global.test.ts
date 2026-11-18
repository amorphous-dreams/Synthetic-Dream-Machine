/**
 * The node suites read no person's git config. The vessel's display name shells `git config --global user.name`, and a
 * person's own global config would move what a suite sees, red on a person's box and green on CI. The shared setup file (`tests/support/scratch-custody-setup.ts`) points git's
 * global config at the null device, so every suite and every child it spawns reads the same empty global.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const globalEmail = (env: NodeJS.ProcessEnv): string => {
  try { return execFileSync("git", ["config", "--global", "user.email"], { env, encoding: "utf8" }).trim(); } catch { return ""; }
};

describe("hermetic git global", () => {
  test("the suite's own environment reads no global user.email", () => {
    expect(globalEmail(process.env)).toBe("");
  });

  test("CONTROL: the instrument sees a global email when one stands", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermetic-git-"));
    const file = join(dir, "gitconfig");
    writeFileSync(file, "[user]\n\temail = someone@example.test\n");
    expect(globalEmail({ ...process.env, GIT_CONFIG_GLOBAL: file })).toBe("someone@example.test");
  });
});
