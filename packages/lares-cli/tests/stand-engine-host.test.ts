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
    expect(await cmdStand(parseArgs(["vessel", "stand", "--observe", "--json"])) ).toBe(0);
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
    expect(await cmdStand(parseArgs(["vessel", "stand", "--json"])) ).toBe(3);
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
    await cmdStand(parseArgs(["vessel", "stand", "--json"]));
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
    expect(await cmdStand(parseArgs(["vessel", "stand", "--json"])) ).toBe(0);
    expect(stopIncumbent).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledOnce();
  });
});

describe("a verb's own exit carries the standing verdict to the host shim", () => {
  const ASK = true;
  const readers = (alive: boolean) => ({ alive: async () => alive, marker: () => "{}", faceOnDisk: () => true });

  it("a verb that succeeded under the shim's ask names a restand verdict by its code, and says the reason", async () => {
    const { standingExit, STANDING_EXIT } = await import("../src/standing-report.js");
    const said: string[] = [];
    expect(await standingExit(0, ASK, readers(true), (line) => { said.push(line); })).toBe(STANDING_EXIT.restand);
    expect(said).toEqual(["lares: the standing asks for a re-stand: face lit after boot"]);
  });

  it("an attach verdict names its own code, so a bare 0 never passes for a reading", async () => {
    verdict = { act: "attach", reason: "steady" };
    const { standingExit, STANDING_EXIT } = await import("../src/standing-report.js");
    const said: string[] = [];
    expect(await standingExit(0, ASK, readers(true), (line) => { said.push(line); })).toBe(STANDING_EXIT.attach);
    expect(said).toEqual([]);
  });

  it("the process's own readers read the marker and the face the stand command reads", async () => {
    const { standingExit, STANDING_EXIT } = await import("../src/standing-report.js");
    expect(await standingExit(0, ASK, undefined, () => {})).toBe(STANDING_EXIT.restand);
  });

  it("no vessel answering, or a reading that throws, names no verdict", async () => {
    const { standingExit, STANDING_EXIT } = await import("../src/standing-report.js");
    expect(await standingExit(0, ASK, readers(false))).toBe(STANDING_EXIT.unread);
    expect(await standingExit(0, ASK, { ...readers(true), marker: () => { throw new Error("unreadable"); } })).toBe(STANDING_EXIT.unread);
  });

  it("the entry takes both asks off the argv, so no verb's parser meets them and no environment carries them to a child", async () => {
    const { takeEntryAsks, standingExit, STANDING_EXIT } = await import("../src/standing-report.js");
    const asks = takeEntryAsks(["tiddler", "get", "lar:///x", "--recipe", "default", "--ask-budget-ms=3500", "--standing-report"]);
    expect(asks).toEqual({ argv: ["tiddler", "get", "lar:///x", "--recipe", "default"], standing: true, budgetMs: 3500 });
    expect(await standingExit(0, asks.standing, readers(true), () => {})).toBe(STANDING_EXIT.restand);
    // The budget reads in either spelling, wherever it sits; a value that names no positive whole number declares none.
    expect(takeEntryAsks(["--ask-budget-ms", "40", "vessel", "read"])).toEqual({ argv: ["vessel", "read"], standing: false, budgetMs: 40 });
    expect(takeEntryAsks(["vessel", "read", "--ask-budget-ms=soon"])).toEqual({ argv: ["vessel", "read"], standing: false, budgetMs: null });
    // CONTROL: a call that carries neither keeps its argv whole and answers no standing.
    const plain = takeEntryAsks(["vessel", "read", "--json"]);
    expect(plain).toEqual({ argv: ["vessel", "read", "--json"], standing: false, budgetMs: null });
    expect(await standingExit(0, plain.standing, readers(true))).toBe(0);
  });

  it("no environment name asks for either: the house adds no env var for a call's own asks", async () => {
    const { standingExit } = await import("../src/standing-report.js");
    const held = { report: process.env["LARES_STANDING_REPORT"], budget: process.env["LARES_ASK_BUDGET_MS"] };
    process.env["LARES_STANDING_REPORT"] = "exit";
    process.env["LARES_ASK_BUDGET_MS"] = "1";
    try {
      const { takeEntryAsks } = await import("../src/standing-report.js");
      const asks = takeEntryAsks(["vessel", "read"]);
      expect(asks).toMatchObject({ standing: false, budgetMs: null });
      expect(await standingExit(0, asks.standing, readers(true))).toBe(0);
    } finally {
      if (held.report === undefined) delete process.env["LARES_STANDING_REPORT"]; else process.env["LARES_STANDING_REPORT"] = held.report;
      if (held.budget === undefined) delete process.env["LARES_ASK_BUDGET_MS"]; else process.env["LARES_ASK_BUDGET_MS"] = held.budget;
    }
  });

  it("CONTROL: a verb that failed keeps its own code, and no ask leaves every code as it stands", async () => {
    const { standingExit } = await import("../src/standing-report.js");
    const never = { alive: async () => { throw new Error("no reading runs"); }, marker: () => null, faceOnDisk: () => false };
    expect(await standingExit(7, ASK, never)).toBe(7);
    expect(await standingExit(0, false, never)).toBe(0);
  });
});
