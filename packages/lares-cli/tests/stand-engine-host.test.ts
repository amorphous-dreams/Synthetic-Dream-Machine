/**
 * `lares vessel stand` where the host holds the engine (`LAR_ENGINE=host`, the container image's setting): the CLI
 * reports its standing verdict and never stops or spawns the daemon. Every collaborator of `cmdStand` rides a mock,
 * so the test reads which doors the command reached for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/parse-args.js";

const emitted: Array<Record<string, unknown>> = [];
let verdict: { act: "attach" | "restand"; reason: string } = { act: "restand", reason: "face lit after boot" };
let base = "";
const stopIncumbent = vi.fn(async () => undefined);
const spawn = vi.fn((_command: string, _args: string[], options: { stdio: [string, number, number] }) => {
  writeSync(options.stdio[1], "vessel-ready\n");
  return { pid: 123, unref: vi.fn() };
});

vi.mock("@lararium/mesh/node", () => ({ get repoRoot() { return base; } }));
vi.mock("@lararium/node", () => ({ fatalLine: () => null }));
vi.mock("../src/floor-cure.js", () => ({ faceStandsOnDisk: () => true }));
vi.mock("@lararium/mesh/rendezvous-path", () => ({ standingPath: () => join(base, "marker"), standingVerdict: () => verdict }));
vi.mock("../src/env.js", () => ({
  larRoot: () => base,
  larBootstrapPath: () => join(base, "bootstrap"),
  larDataDir: () => join(base, "data"),
  larCasDir: () => join(base, "cas"),
  vesselDid: async () => { throw new Error("no identity"); },
}));
vi.mock("../src/local-connector.js", () => ({ udsAlive: async () => true }));
vi.mock("../src/vessel-condition.js", () => ({
  readVesselStanding: () => ({ state: "ready", message: "ready" }), conditionOk: () => true,
}));
vi.mock("../src/render.js", () => ({ emit: (_args: unknown, payload: Record<string, unknown>) => { emitted.push(payload); } }));
vi.mock("../src/verb-result.js", () => ({ summaryOutput: () => ({}) }));
vi.mock("../src/verb-call.js", () => ({ runVerb: vi.fn() }));
vi.mock("../src/integration-check.js", () => ({ checkMempalaceIntegration: () => ({ ok: true, checks: [] }) }));
vi.mock("../src/standup.js", () => ({ foundIfAbsent: vi.fn(), }));
vi.mock("../src/commands/wire.js", () => ({ tendSurfaces: vi.fn(), SURFACES: [] }));
vi.mock("node:child_process", () => ({ spawn }));
vi.mock("../src/port-control.js", () => ({ stopIncumbent, engineHeldByHost: () => process.env["LAR_ENGINE"] === "host" }));

beforeEach(() => {
  vi.resetModules();
  emitted.length = 0;
  verdict = { act: "restand", reason: "face lit after boot" };
  stopIncumbent.mockClear();
  spawn.mockClear();
  base = mkdtempSync(join(tmpdir(), "stand-engine-host-"));
  mkdirSync(join(base, "data"), { recursive: true });
  mkdirSync(join(base, "packages/lararium-node/dist/src"), { recursive: true });
  writeFileSync(join(base, "packages/lararium-node/dist/src/main.js"), "");
  writeFileSync(join(base, "bootstrap"), "{}");
  writeFileSync(join(base, "marker"), JSON.stringify({ pid: process.pid }));
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("vessel stand and the host-held engine", () => {
  it("observe carries the standing verdict without acting", async () => {
    vi.stubEnv("LAR_ENGINE", "host");
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "--observe", "--json"])) ).toBe(0);
    expect(emitted.at(-1)?.data).toMatchObject({ standing: { act: "restand", reason: "face lit after boot" } });
    expect(stopIncumbent).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("host engine refuses restand by name and neither stops nor spawns", async () => {
    vi.stubEnv("LAR_ENGINE", "host");
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "--json"])) ).toBe(3);
    expect(emitted.at(-1)).toMatchObject({
      error: { code: "EngineHeldByHost", message: "face lit after boot — restart the vessel from the host: lares-container.sh vessel stand" },
      data: { standing: { act: "restand", reason: "face lit after boot" } },
    });
    expect(stopIncumbent).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("CONTROL without LAR_ENGINE retains the in-container stop and spawn path", async () => {
    vi.stubEnv("LAR_ENGINE", "");
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "--json"])) ).toBe(0);
    expect(stopIncumbent).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledOnce();
  });
});
