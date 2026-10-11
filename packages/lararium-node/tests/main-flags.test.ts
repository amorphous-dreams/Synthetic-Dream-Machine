/**
 * THE BOOT READS `--k=v` LIKE `--k v`, AND REFUSES A FLAG IT NEVER READS.
 *
 * `main.js --root=/x` used to read as no flag at all, so a vessel booted on the wrong root with no word.
 * A token beginning `--` that no `get` names now exits 2 BEFORE anything binds. Runs the built entry; the
 * refusal fires at argument reading, ahead of every store, socket and port.
 */
import { describe, test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = join(dirname(fileURLToPath(import.meta.url)), "../dist/src/main.js");
const run = (...argv: string[]) => spawnSync(process.execPath, [MAIN, ...argv], { encoding: "utf8", timeout: 20_000, env: { ...process.env, LAR_ROOT: "/nonexistent-lar-root" } });

describe.skipIf(!existsSync(MAIN))("main.js flag reading", () => {
  test("★ an unknown flag exits 2 and names itself ★", () => {
    const r = run("--bogus=1");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--bogus");
  });
  test("★ a misspelt `--roott` refuses in the space form too ★", () => {
    const r = run("--roott", "/x");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--roott");
  });
});
