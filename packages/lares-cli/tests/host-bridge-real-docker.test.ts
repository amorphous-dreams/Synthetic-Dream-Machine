/**
 * host-bridge, against REAL docker — opt-in (`LARES_REAL_DOCKER=1`).
 *
 * The built host `lares`, with LAR_ROOT unset, forwards through the real `tools/lares-container.sh` into a THROWAWAY
 * compose project: its own name (`lares-bridge-test-<rand>`), its own compose file (tests/fixtures/real-docker), a
 * busybox image and a stand-in `node` that reports argv, the forwarded env, and whether stdin reads a TTY. Never the
 * lares-surface project or image; the project comes down (`down -v --remove-orphans`) in afterAll.
 *
 * What it measures, beyond the fake-docker suite: that compose reads `-e NAME` from the host environment (the value
 * crosses, the name alone rides argv); that the shim's pty reading reaches the container; and the signal law — docker
 * forwards no signal to an exec'd process and a killed `compose run` client leaves its container running, so only
 * the shim's own stop leaves nothing running after a lone SIGTERM or a Ctrl+C.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "bin", "lares.mjs");
const COMPOSE = join(HERE, "fixtures", "real-docker", "compose.yml");
// Asked for and unable to run reads red, never a silent skip: the build must stand.
const enabled = process.env["LARES_REAL_DOCKER"] === "1";
const haveScript = spawnSync("script", ["--version"]).status === 0;

const PROJECT = `lares-bridge-test-${randomBytes(4).toString("hex")}`;
let dir = "";
let env: Record<string, string> = {};

function dc(...args: string[]): SpawnSyncReturns<string> {
  return spawnSync("docker", ["compose", "-p", PROJECT, "-f", COMPOSE, "--profile", "offline", ...args], { encoding: "utf8", timeout: 120_000 });
}
function lares(argv: string[], extra: Record<string, string> = {}): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [BIN, ...argv], { env: { ...env, ...extra }, encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "pipe"] });
}
const report = (out: string, tag: string): string[] =>
  out.split(/\r?\n/).flatMap((l) => { const m = new RegExp(`^${tag}\\[(.*)\\]$`).exec(l.replace(/\r$/, "")); return m ? [m[1]!] : []; });
/** Processes of the stand-in still sleeping inside the standing vessel. */
const sleepersInVessel = (): number => (dc("exec", "-T", "lares", "ps").stdout.match(/sleep 300/g) ?? []).length;
/** Containers of this project still running (the standing vessel and any run container). */
const running = (): string[] =>
  spawnSync("docker", ["ps", "--filter", `label=com.docker.compose.project=${PROJECT}`, "--format", "{{.Names}}"], { encoding: "utf8" })
    .stdout.split("\n").filter(Boolean);
const settle = async (until: () => boolean, ms = 15_000): Promise<boolean> => {
  for (let t = 0; t < ms; t += 250) { if (until()) return true; await new Promise((r) => setTimeout(r, 250)); }
  return until();
};

describe.skipIf(!enabled)("the host bridge against real docker (a throwaway compose project)", () => {
  beforeAll(() => {
    if (!existsSync(join(HERE, "..", "dist", "src", "host-bridge.js"))) throw new Error("LARES_REAL_DOCKER=1 asks a built CLI: pnpm --filter @lares/cli build");
    dir = mkdtempSync(join(tmpdir(), "host-bridge-real-"));
    const home = join(dir, "home");
    mkdirSync(join(home, ".lares"), { recursive: true });
    mkdirSync(join(dir, "workspace"), { recursive: true });
    writeFileSync(join(home, ".lares", "lares-surface.env"), `LARES_HOUSE=${join(dir, "house")}\nLARES_WORKSPACE=${join(dir, "workspace")}\n`);
    const base: Record<string, string> = {};
    for (const k of ["PATH", "DOCKER_HOST", "DOCKER_CONFIG", "DOCKER_CONTEXT"]) if (process.env[k]) base[k] = process.env[k]!;
    env = { ...base, HOME: home, LARES_COMPOSE_FILE: COMPOSE, COMPOSE_PROJECT_NAME: PROJECT };
    const up = dc("up", "-d", "lares");
    if (up.status !== 0) throw new Error(`compose up failed: ${up.stderr}`);
  }, 180_000);

  afterAll(() => {
    dc("down", "-v", "--remove-orphans", "-t", "1");
    if (dir) rmSync(dir, { recursive: true, force: true });
  }, 120_000);

  it("argv crosses exact: spaces, quotes, an empty string, `--`", () => {
    const argv = ["meme", "get", "lar:///a b", "--bag", "", "it's", "--", "--json"];
    const r = lares(argv);
    expect(r.status, r.stderr).toBe(0);
    expect(report(r.stdout, "ARG")).toEqual(argv);
  }, 60_000);

  it("NO_COLOR, TERM, COLORTERM, LARES_DEBUG cross by name WITH their host values; nothing else crosses", () => {
    const r = lares(["persona", "list"], { NO_COLOR: "1", TERM: "xterm-bridge", COLORTERM: "truecolor", LARES_DEBUG: "1", SOME_TOKEN: "s3cret" });
    expect(r.status, r.stderr).toBe(0);
    expect(report(r.stdout, "ENV").sort()).toEqual(["COLORTERM=truecolor", "LARES_DEBUG=1", "NO_COLOR=1", "TERM=xterm-bridge"]);
    const bare = lares(["persona", "list"]);
    expect(report(bare.stdout, "ENV")).toEqual([]);
  }, 60_000);

  it("the vessel's exit code returns unchanged", () => {
    expect(lares(["persona", "new", "0", "--name", "exit:7"]).status).toBe(7);
    expect(lares(["persona", "new", "0", "--name", "exit:0"]).status).toBe(0);
  }, 60_000);

  it("a piped run reads no TTY inside", () => {
    expect(report(lares(["persona", "list"]).stdout, "TTY")).toEqual(["no"]);
  }, 60_000);

  it.skipIf(!haveScript)("a pty run reads a TTY inside", () => {
    const r = spawnSync("script", ["-qec", `'${process.execPath}' '${BIN}' persona list`, "/dev/null"], { env, encoding: "utf8", timeout: 60_000 });
    expect(report(r.stdout, "TTY"), r.stdout).toEqual(["yes"]);
  }, 60_000);

  async function signalWalk(how: "pid" | "group", sig: NodeJS.Signals): Promise<void> {
    const child = spawn(process.execPath, [BIN, "persona", "new", "0", "--name", "sleep"], { env, stdio: "ignore", detached: how === "group" });
    const ended = new Promise<void>((r) => child.on("exit", () => r()));
    expect(await settle(() => sleepersInVessel() === 1), "the stand-in never began sleeping in the vessel").toBe(true);
    if (how === "pid") process.kill(child.pid!, sig);
    else process.kill(-child.pid!, sig); // this test's own child group, never -1
    await ended;
    expect(await settle(() => sleepersInVessel() === 0), "a process still sleeps inside the vessel").toBe(true);
  }

  it("a lone SIGTERM to the host node pid leaves no process running inside the vessel", async () => {
    await signalWalk("pid", "SIGTERM");
  }, 90_000);

  it("Ctrl+C (SIGINT to the group) leaves no process running inside the vessel", async () => {
    await signalWalk("group", "SIGINT");
  }, 90_000);

  it("offline door: a lone SIGTERM leaves no run container behind", async () => {
    dc("stop", "-t", "1", "lares");
    expect(await settle(() => running().length === 0)).toBe(true);
    const child = spawn(process.execPath, [BIN, "persona", "new", "0", "--name", "sleep"], { env, stdio: "ignore" });
    const ended = new Promise<void>((r) => child.on("exit", () => r()));
    expect(await settle(() => running().some((n) => n.startsWith("lares-offline-"))), "no run container stood").toBe(true);
    process.kill(child.pid!, "SIGTERM");
    await ended;
    expect(await settle(() => running().length === 0), `still running: ${running().join(", ")}`).toBe(true);
  }, 120_000);
});
