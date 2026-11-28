/**
 * lares-keep-hook — the SessionEnd hook the house seats in the operator's Claude settings (`lares home tend`,
 * lar:///ha.ka.ba/lares/cli/reality-tunnel): each session's end runs `lares rite keep if-due=true`.
 *
 *   KHK1  the hook starts this checkout's `lares rite keep if-due=true --no-json` and exits 0 at once, never waiting on the keep:
 *         a SessionEnd hook holds a short budget, and a keep cuts, commits and pushes;
 *   KHK2  the keep's own lines land in the state home's log (`$XDG_STATE_HOME/lares/keep-hook.log`), so a keep that refused
 *         (no return left, a secret-shaped string) leaves its reading where the operator finds it;
 *   KHK3  a checkout with no CLI standing exits 0 and names the fault in the log: a session's end never stops for the house.
 *
 * A scratch tree and a scratch HOME; the `lares` the hook runs here is a recorder.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = join(import.meta.dirname, "..", ".claude-plugin", "hooks", "lares-keep-hook.mjs");
let scratch: string;
beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), "lar-keep-hook-")); });
afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

/** The hook in a scratch checkout, run to its exit under a scratch HOME; the answer names how long it held the session. */
function run(withCli: string | null): { status: number | null; ms: number; log: string; seen: string } {
  const hooks = join(scratch, "packages/lares-cli/.claude-plugin/hooks"), bin = join(scratch, "packages/lares-cli/bin"), home = join(scratch, "home");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  copyFileSync(HOOK, join(hooks, "lares-keep-hook.mjs"));
  if (withCli !== null) writeFileSync(join(bin, "lares.mjs"), withCli);
  const env: NodeJS.ProcessEnv = { PATH: process.env["PATH"] ?? "", HOME: home, SEEN: join(scratch, "seen") };
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(hooks, "lares-keep-hook.mjs")], { env, input: JSON.stringify({ hook_event_name: "SessionEnd", reason: "exit" }), encoding: "utf8", timeout: 10_000 });
  const ms = Date.now() - t0;
  const log = join(home, ".local/state/lares/keep-hook.log"), seen = join(scratch, "seen");
  // The keep outlives the hook: wait for the recorder's own mark, inside a bound.
  const until = Date.now() + 8000;
  while (withCli !== null && !existsSync(seen) && Date.now() < until) spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 50)"]);
  return { status: r.status, ms, log: existsSync(log) ? readFileSync(log, "utf8") : "", seen: existsSync(seen) ? readFileSync(seen, "utf8") : "" };
}

describe("the keep hook at a session's end", () => {
  test("KHK1 KHK2 RED: the hook starts `lares rite keep if-due=true --no-json`, exits 0 without waiting on it, and the keep's lines land in the log", () => {
    // A keep that takes a second and a half: the hook returns long before it ends.
    const out = run('import { writeFileSync } from "node:fs";\nconsole.error("keep: no keep lei holds a return");\nsetTimeout(() => writeFileSync(process.env.SEEN, JSON.stringify(process.argv.slice(2))), 1500);\n');
    expect(out.status).toBe(0);
    expect(out.ms).toBeLessThan(1400);
    expect(JSON.parse(out.seen)).toEqual(["rite", "keep", "if-due=true", "--no-json"]);
    expect(out.log).toMatch(/^keep hook: session end \(exit\); lares rite keep if-due=true\n/);
    expect(out.log).toContain("keep: no keep lei holds a return");
  });

  test("KHK3 RED: a checkout with no CLI standing exits 0 and names the fault in the log", () => {
    const out = run(null);
    expect(out.status).toBe(0);
    expect(out.log).toMatch(/keep hook: .*lares\.mjs stands absent; nothing kept/);
  });
});
