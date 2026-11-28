/**
 * `lares vessel stand` where the host holds the engine (`LAR_ENGINE=host`, the container image's setting): the CLI
 * reports its standing verdict and never stops or spawns the daemon. Every collaborator of `cmdStand` rides a mock,
 * so the test reads which doors the command reached for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/parse-args.js";

const emitted: Array<Record<string, unknown>> = [];
let verdict: { act: "attach" | "restand"; reason: string } = { act: "restand", reason: "face lit after boot" };
let base = "";
const stopIncumbent = vi.fn(async () => undefined);
const spawn = vi.fn((_command: string, _args: string[], options: { stdio: [string, number, number] }) => {
  writeSync(options.stdio[1], "vessel-ready\n");
  return { pid: 123, unref: vi.fn(), once: vi.fn() };
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
// The check itself probes the machine; the verdict law (`standOk`) stays the module's own.
vi.mock("../src/integration-check.js", async (original) => ({
  ...(await original<typeof import("../src/integration-check.js")>()),
  checkMempalaceIntegration: () => ({ ok: true, standing: "integrated", checks: [] }),
}));
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
    expect(await cmdStand(parseArgs(["vessel", "stand", "observe=true", "json=true"])) ).toBe(0);
    expect(emitted.at(-1)?.data).toMatchObject({ standing: { act: "restand", reason: "face lit after boot" } });
    // CONTROL: an observing stand refuses nothing, so `ok` answers for the vessel alone.
    expect(emitted.at(-1)).toMatchObject({ ok: true });
    expect(emitted.at(-1)).not.toHaveProperty("error");
    expect(stopIncumbent).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("host engine refuses restand by name and neither stops nor spawns", async () => {
    vi.stubEnv("LAR_ENGINE", "host");
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "json=true"])) ).toBe(3);
    // The act the caller asked for did not happen: the host must perform the re-stand, so `ok` reads false
    // beside the named refusal. The standing verdict still rides the payload for the host's shim.
    expect(emitted.at(-1)).toMatchObject({
      ok: false,
      error: { code: "EngineHeldByHost", message: "face lit after boot — restart the vessel from the host: lares-container.sh vessel stand" },
      data: { standing: { act: "restand", reason: "face lit after boot" } },
    });
    expect(stopIncumbent).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("reports a child that exits before ready as exited, not starting", async () => {
    vi.stubEnv("LAR_ENGINE", "");
    vi.doMock("../src/stand-socket-wait.js", () => ({ awaitBootPhase: async () => "exited", awaitVerbSocket: vi.fn() }));
    vi.doMock("../src/vessel-condition.js", () => ({
      readVesselStanding: () => ({ state: "rising", message: "starting" }), conditionOk: () => false,
    }));
    const { cmdStand } = await import("../src/commands/stand.js");
    await cmdStand(parseArgs(["vessel", "stand", "json=true"]));
    const node = (emitted.at(-1)?.data as { node: { up: boolean; note: string } }).node;
    expect(node.up).toBe(false);
    expect(node.note).toMatch(/exited.*before.*ready/i);
    expect(node.note).not.toMatch(/starting/i);
    vi.doUnmock("../src/stand-socket-wait.js");
    vi.doUnmock("../src/vessel-condition.js");
  });

  it("CONTROL without LAR_ENGINE retains the in-container stop and spawn path", async () => {
    vi.stubEnv("LAR_ENGINE", "");
    const { cmdStand } = await import("../src/commands/stand.js");
    expect(await cmdStand(parseArgs(["vessel", "stand", "json=true"])) ).toBe(0);
    expect(stopIncumbent).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledOnce();
  });
});

describe("a verb's own process REPORTS the standing to the host shim, and never asks or changes its exit", () => {
  const TAG = "0123456789abcdef";
  const readers = (alive: boolean) => ({ alive: async () => alive, marker: () => "{}", faceOnDisk: () => true });
  const reportAt = () => join(base, "config", `standing-report.${TAG}`);
  const readReport = () => readFileSync(reportAt(), "utf8");

  it("a verb that succeeded under a shim's exec tag reports a restand verdict and its reason, one line in the config bind", async () => {
    mkdirSync(join(base, "config"));
    const { reportStanding } = await import("../src/standing-report.js");
    await reportStanding(0, TAG, readers(true));
    expect(readReport()).toBe("restand face lit after boot\n");
  });

  it("an attach verdict reports itself, so a bare success never passes for a reading", async () => {
    mkdirSync(join(base, "config"));
    verdict = { act: "attach", reason: "steady" };
    const { reportStanding } = await import("../src/standing-report.js");
    await reportStanding(0, TAG, readers(true));
    expect(readReport()).toBe("attach\n");
  });

  it("the process's own readers read the marker and the face the stand command reads", async () => {
    const { standingLine } = await import("../src/standing-report.js");
    expect(await standingLine()).toBe("restand face lit after boot");
  });

  it("no vessel answering, or a reading that throws, reports no verdict (unread)", async () => {
    const { standingLine } = await import("../src/standing-report.js");
    expect(await standingLine(readers(false))).toBe("unread");
    expect(await standingLine({ ...readers(true), marker: () => { throw new Error("unreadable"); } })).toBe("unread");
  });

  it("RED no word asks for the standing: the entry reads the budget param alone, as name=value", async () => {
    const { takeEntryAsks } = await import("../src/standing-report.js");
    expect(takeEntryAsks(["get", "title=lar:///x", "ask-budget-ms=3500"])).toEqual({ argv: ["get", "title=lar:///x"], budgetMs: 3500 });
    expect(takeEntryAsks(["ask-budget-ms=40", "vessel", "read"])).toEqual({ argv: ["vessel", "read"], budgetMs: 40 });
    expect(takeEntryAsks(["vessel", "read", "ask-budget-ms=soon"])).toEqual({ argv: ["vessel", "read"], budgetMs: null });
    expect(takeEntryAsks(["vessel", "read", "json=true"])).toEqual({ argv: ["vessel", "read", "json=true"], budgetMs: null });
    // Past a `--` every token rides the verb whole, a budget-shaped one included.
    expect(takeEntryAsks(["put", "--", "ask-budget-ms=9"])).toEqual({ argv: ["put", "--", "ask-budget-ms=9"], budgetMs: null });
    // The dash spellings burned: the entry takes neither, and the dispatcher refuses them as every dash flag (dash-flag-burned).
    expect(takeEntryAsks(["vessel", "read", "--ask-budget-ms=40"])).toEqual({ argv: ["vessel", "read", "--ask-budget-ms=40"], budgetMs: null });
    expect(takeEntryAsks(["vessel", "read", "--standing-report"])).toEqual({ argv: ["vessel", "read", "--standing-report"], budgetMs: null });
    const mod: Record<string, unknown> = await import("../src/standing-report.js");
    expect(mod["STANDING_REPORT_FLAG"]).toBeUndefined();
    expect(mod["STANDING_EXIT"]).toBeUndefined();
    expect(mod["standingExit"]).toBeUndefined();
  });

  it("CONTROL: a verb that failed, a call no shim tagged, or a house with no config bind reports nothing", async () => {
    const { reportStanding } = await import("../src/standing-report.js");
    const never = { alive: async () => { throw new Error("no reading runs"); }, marker: () => null, faceOnDisk: () => false };
    await reportStanding(0, TAG, never);
    expect(existsSync(reportAt())).toBe(false);
    mkdirSync(join(base, "config"));
    await reportStanding(7, TAG, never);
    await reportStanding(0, "", never);
    await reportStanding(0, "not-a-tag", never);
    expect(readdirSync(join(base, "config"))).toEqual([]);
  });
});
