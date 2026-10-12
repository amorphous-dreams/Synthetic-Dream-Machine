/**
 * Where the host holds the engine (`LAR_ENGINE=host`), the one door every daemon-stopping command walks through
 * refuses by name before it probes a port or sends a signal.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { EngineHeldByHost, engineHeldByHost, stopIncumbent } from "../src/port-control.js";

afterEach(() => { vi.unstubAllEnvs(); });

describe("the host holds the engine", () => {
  it("reads the setting from the environment it gets handed", () => {
    expect(engineHeldByHost({ LAR_ENGINE: "host" })).toBe(true);
    expect(engineHeldByHost({ LAR_ENGINE: "" })).toBe(false);
    expect(engineHeldByHost({})).toBe(false);
  });

  it("stopIncumbent refuses EngineHeldByHost and reaches for no probe, no pid table and no signal", async () => {
    vi.stubEnv("LAR_ENGINE", "host");
    const probe = vi.fn(async () => true), holderPids = vi.fn(() => [4321]), kill = vi.fn();
    await expect(stopIncumbent(4321, { onPastGrace: () => {}, probe, holderPids, kill })).rejects.toBeInstanceOf(EngineHeldByHost);
    expect(probe).not.toHaveBeenCalled();
    expect(holderPids).not.toHaveBeenCalled();
    expect(kill).not.toHaveBeenCalled();
  });

  it("the foreground and with-web stands boot nothing and refuse by name", async () => {
    vi.stubEnv("LAR_ENGINE", "host");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cmdStandForeground, cmdStandWithWeb } = await import("../src/commands/scripted.js");
    const { parseArgs } = await import("../src/parse-args.js");
    expect(await cmdStandForeground(parseArgs(["vessel", "stand", "--foreground"]))).toBe(3);
    expect(await cmdStandWithWeb(parseArgs(["vessel", "stand", "--with-web"]))).toBe(3);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/EngineHeldByHost: vessel stand --foreground[\s\S]*EngineHeldByHost: vessel stand --with-web/);
    err.mockRestore();
  });

  it("CONTROL without the setting the door runs: a free port answers stopped false and signals nobody", async () => {
    vi.stubEnv("LAR_ENGINE", "");
    const kill = vi.fn();
    const r = await stopIncumbent(4321, { onPastGrace: () => {}, probe: async () => false, holderPids: () => [], kill });
    expect(r.stopped).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
});
