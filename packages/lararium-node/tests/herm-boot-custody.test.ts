/**
 * herm-boot-custody — a herm-standing boot keeps origin custody with a present keeper.
 *
 * The boot runs from source in a child with a scratch `LAR_ROOT` (so `~/.lares` and the repo tree stay
 * untouched) and reads its standing from `--recipe`. A herm handed a Web origin or a Pronaos input refuses
 * before listen with the waystone message; the CONTROL lararium handed the same Web origin passes custody
 * and refuses only for its own undeclared read origin.
 */
import { afterEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const ORIGIN_ENV = ["LAR_WEB_ORIGIN", "LAR_ORACLE_ORIGIN", "LAR_SAME_ORIGIN", "LAR_PUBLIC_URL", "LAR_RECIPE"];

/** Boot `src/main.ts` in a child under a scratch root; the boot under test exits before listen. */
function boot(recipe: "herm" | "lararium", extra: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const root = mkdtempSync(join(tmpdir(), "herm-boot-custody-")); roots.push(root);
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("LAR_PRONAOS_") || ORIGIN_ENV.includes(key)) delete env[key];
  Object.assign(env, { LAR_ROOT: root, LAR_BAGS: join(root, "bags"), HOME: root, ...extra });
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/main.ts", "--recipe", recipe, "--port", "0"], {
    cwd: process.cwd(), env, encoding: "utf8", timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const WAYSTONE = /a waystone serves no arrival page; light a Pronaos on a lararium/;

describe("a herm-standing boot refuses origin custody before listen", () => {
  test("a herm handed LAR_WEB_ORIGIN refuses with the waystone message and never listens", () => {
    const run = boot("herm", { LAR_WEB_ORIGIN: "http://web.local" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/LAR_WEB_ORIGIN \/ origins\.web/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);

  test("a herm handed a Pronaos input refuses with the waystone message and never listens", () => {
    const run = boot("herm", { LAR_SAME_ORIGIN: "true", LAR_PRONAOS_WEB_ROOT: "/srv/web", LAR_PRONAOS_ARTIFACT_RECORD: "/srv/r.json" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/LAR_PRONAOS_ARTIFACT_RECORD, LAR_PRONAOS_WEB_ROOT/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);

  test("CONTROL: a lararium handed the same Web origin passes custody and refuses only its undeclared read origin", () => {
    const run = boot("lararium", { LAR_WEB_ORIGIN: "http://web.local" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).not.toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/oracle origin must be declared/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);
});
