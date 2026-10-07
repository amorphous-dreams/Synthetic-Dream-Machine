/**
 * herm-boot-custody — a herm-standing boot keeps origin custody with a present keeper.
 *
 * The boot runs from source in a child with a scratch `LAR_ROOT` (so `~/.lares` and the repo tree stay
 * untouched) and reads its standing from `--recipe`. A herm handed a Web origin or a Pronaos input refuses
 * before listen with the waystone message; the CONTROL lararium handed the same Web origin passes custody
 * and refuses only for its own undeclared read origin. A herm with no origin declaration at all reaches
 * listen: it composes no Web origin, and it composes no origin it never reads at boot.
 *
 * THE CHILD LINKS WHAT THE SUITE READS, AND A LINK FAULT NAMES ITSELF. These children are the only place the unit
 * suite links `main.ts`'s whole graph under NATIVE ESM. Vitest's module runner turns a named import into a property
 * read, so a graph with an absent export still loads there; Node refuses it at link time, before main runs, and every
 * assert in this file reds at once while the suite around it stays green. Two states of a shared tree produce that:
 * a sibling lane's edit caught mid-flight (an export cut before its importers move), and a workspace package whose
 * built `dist/` trails its source — `tsx` seats a package on source only through the tsconfig `paths`, and the base
 * config leaves `@lararium/keyhive`, `@lararium/mempalace` and `@lararium/sensorium` to their dist. So the child boots
 * under a tsconfig that seats every workspace package export on its source twin (derived from each package.json),
 * the listen boot carries a resolve trace that pins it (no workspace `dist/` module loads), and every boot first
 * asserts it linked: a child that never reached main fails naming the link error, never as a custody verdict.
 */
import { afterEach, describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const ORIGIN_ENV = ["LAR_WEB_ORIGIN", "LAR_ORACLE_ORIGIN", "LAR_SAME_ORIGIN", "LAR_PUBLIC_URL", "LAR_RECIPE"];

const REPO = resolve(process.cwd(), "../..");

/**
 * A tsconfig for the child: the node package's own, with `paths` seating every workspace package export on its
 * source twin. The base config's entries stand as written; a package it leaves out gets one entry per export,
 * `./dist/(src/)?<m>.js` → `packages/<dir>/src/<m>.ts`, read off its package.json.
 */
function sourceTsconfig(dir: string): string {
  const base = JSON.parse(readFileSync(join(REPO, "tsconfig.base.json"), "utf8")) as { compilerOptions: { paths?: Record<string, string[]> } };
  const paths: Record<string, string[]> = { ...(base.compilerOptions.paths ?? {}) };
  for (const pkgDir of readdirSync(join(REPO, "packages"))) {
    const manifest = join(REPO, "packages", pkgDir, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; exports?: Record<string, string | { import?: string }> };
    if (!pkg.name || paths[pkg.name]) continue;
    for (const [key, target] of Object.entries(pkg.exports ?? {})) {
      const dist = typeof target === "string" ? target : target.import;
      const m = dist ? /^\.\/dist\/(?:src\/)?(.+)\.js$/.exec(dist) : null;
      const src = m ? join("packages", pkgDir, "src", `${m[1]}.ts`) : null;
      if (src && existsSync(join(REPO, src))) paths[key === "." ? pkg.name : `${pkg.name}/${key.slice(2)}`] = [src];
    }
  }
  const at = join(dir, "tsconfig.source.json");
  writeFileSync(at, JSON.stringify({
    extends: join(process.cwd(), "tsconfig.json"),
    compilerOptions: { baseUrl: REPO, paths },
  }));
  return at;
}

/** A resolve hook that records every module URL under `packages/` the child links. */
function resolveTrace(dir: string): { hook: string; log: string } {
  const hook = join(dir, "resolve-trace.mjs");
  const log = join(dir, "resolved.log");
  writeFileSync(hook, [
    'import { registerHooks } from "node:module";',
    'import { appendFileSync } from "node:fs";',
    `const LOG = ${JSON.stringify(log)};`,
    "registerHooks({ resolve(spec, ctx, next) {",
    "  const r = next(spec, ctx);",
    '  if (r.url && r.url.includes("/packages/")) appendFileSync(LOG, r.url + "\\n");',
    "  return r;",
    "} });",
  ].join("\n"));
  return { hook, log };
}

/** The child's module-link refusal, or null when its graph linked and main ran. */
function linkFault(stderr: string): string | null {
  return stderr.split("\n").find((l) => /does not provide an export named|ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/.test(l)) ?? null;
}

const ARGS = (recipe: "herm" | "lararium", preload: string[] = []): string[] =>
  [...preload.flatMap((p) => ["--import", p]), "--import", "tsx", "src/main.ts", "--recipe", recipe, "--port", "0"];

/** A child env under a fresh scratch root, scrubbed of every ambient origin and Pronaos input. */
function scratchEnv(extra: Record<string, string>, root = mkdtempSync(join(tmpdir(), "herm-boot-custody-"))): Record<string, string | undefined> {
  if (!roots.includes(root)) roots.push(root);
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("LAR_PRONAOS_") || ORIGIN_ENV.includes(key)) delete env[key];
  return Object.assign(env, { LAR_ROOT: root, LAR_BAGS: join(root, "bags"), HOME: root, TSX_TSCONFIG_PATH: sourceTsconfig(root), ...extra });
}

/** Boot `src/main.ts` in a child under a scratch root; the boot under test exits before listen. */
function boot(recipe: "herm" | "lararium", extra: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ARGS(recipe), {
    cwd: process.cwd(), env: scratchEnv(extra), encoding: "utf8", timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Boot a herm until its listen line prints (or the child exits), then stop it and wait for the exit. */
async function bootUntilListen(extra: Record<string, string>): Promise<{ listened: boolean; stdout: string; stderr: string; resolved: string[] }> {
  const root = mkdtempSync(join(tmpdir(), "herm-boot-custody-"));
  const trace = resolveTrace(root);
  const child = spawn(process.execPath, ARGS("herm", [trace.hook]), { cwd: process.cwd(), env: scratchEnv(extra, root), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const listened = await new Promise<boolean>((resolve) => {
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.includes("WS relay on")) resolve(true);
    });
    child.once("exit", () => resolve(false));
  });
  child.kill("SIGKILL");
  await exited;
  const resolved = existsSync(trace.log) ? readFileSync(trace.log, "utf8").split("\n").filter(Boolean) : [];
  return { listened, stdout, stderr, resolved };
}

const WAYSTONE = /a waystone serves no arrival page; light a Pronaos on a lararium/;
const LINKED = "the child never reached main: the tree it boots from does not link";

describe("a herm-standing boot refuses origin custody before listen", () => {
  test("a herm handed LAR_WEB_ORIGIN refuses with the waystone message and never listens", () => {
    const run = boot("herm", { LAR_WEB_ORIGIN: "http://web.local" });
    expect(linkFault(run.stderr), LINKED).toBeNull();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/LAR_WEB_ORIGIN \/ origins\.web/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);

  test("a herm handed a Pronaos input refuses with the waystone message and never listens", () => {
    const run = boot("herm", { LAR_SAME_ORIGIN: "true", LAR_PRONAOS_WEB_ROOT: "/srv/web", LAR_PRONAOS_ARTIFACT_RECORD: "/srv/r.json" });
    expect(linkFault(run.stderr), LINKED).toBeNull();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/LAR_PRONAOS_ARTIFACT_RECORD, LAR_PRONAOS_WEB_ROOT/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);

  test("CONTROL: a lararium handed the same Web origin passes custody and refuses only its undeclared read origin", () => {
    const run = boot("lararium", { LAR_WEB_ORIGIN: "http://web.local" });
    expect(linkFault(run.stderr), LINKED).toBeNull();
    expect(run.status).not.toBe(0);
    expect(run.stderr).not.toMatch(WAYSTONE);
    expect(run.stderr).toMatch(/oracle origin must be declared/);
    expect(run.stdout).not.toContain("WS relay on");
  }, 90_000);

  test("a herm with no origin declaration reaches listen with no Web origin", async () => {
    const run = await bootUntilListen({});
    expect(linkFault(run.stderr), LINKED).toBeNull();
    expect(run.stderr).not.toMatch(/origin composition refused|Web origin|oracle origin/);
    expect(run.listened).toBe(true);
    // The boot links the workspace from source alone: a sibling build rewriting a dist cannot reach it.
    expect(run.resolved.some((url) => url.includes("/packages/lararium-keyhive/src/")), "the trace saw the keyhive source link").toBe(true);
    expect(run.resolved.filter((url) => url.startsWith(`file://${REPO}/packages/`) && /\/packages\/[^/]+\/dist\//.test(url))).toEqual([]);
  }, 90_000);

  test("CONTROL: a graph with an absent named export refuses at native link, and the guard names it", () => {
    const root = mkdtempSync(join(tmpdir(), "herm-boot-custody-link-")); roots.push(root);
    // `.mts` holds the scratch graph to ESM, as the package's `"type": "module"` holds `main.ts`.
    writeFileSync(join(root, "b.mts"), "export const present = 1;\n");
    writeFileSync(join(root, "a.mts"), 'import { absent } from "./b.mts";\nconsole.log("main ran", absent);\n');
    const run = spawnSync(process.execPath, ["--import", "tsx", join(root, "a.mts")], { cwd: process.cwd(), encoding: "utf8", timeout: 60_000 });
    expect(run.status).not.toBe(0);
    expect(run.stdout).not.toContain("main ran");
    expect(linkFault(run.stderr)).toMatch(/does not provide an export named 'absent'/);
  }, 90_000);
});
