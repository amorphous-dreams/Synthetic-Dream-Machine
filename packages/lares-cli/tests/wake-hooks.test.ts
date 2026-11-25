/**
 * The wake and compaction hooks ship as plain `.mjs` a harness runs with no build, so their laws run under
 * `node --test` (`lares-wake-core.test.mjs`: the pure parts under an injected runner; `lares-wake-hook.test.mjs`: the
 * hooks spawned whole against a stub shim). This file homes both in the CLI's suite, so a red there reads red here.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..", "..");

describe("the wake and compaction hooks (road L43)", () => {
  it("hold their node:test laws", () => {
    const env = { ...process.env };
    delete env["NODE_OPTIONS"];
    const ran = spawnSync(process.execPath, [
      "--test",
      "packages/lares-cli/tests/lares-wake-core.test.mjs",
      "packages/lares-cli/tests/lares-wake-hook.test.mjs",
      "packages/lares-cli/tests/lares-spirit-hooks.test.mjs",
    ], { cwd: REPO, env, encoding: "utf8" });
    expect(ran.status, `${ran.stdout.slice(-4000)}\n${ran.stderr.slice(-1000)}`).toBe(0);
    expect(ran.stdout).toMatch(/ℹ fail 0|# fail 0/);
  }, 90_000); // LIVENESS: one hung-read case spends the hooks' own 12-second budget; this bound names a stalled run.
});
