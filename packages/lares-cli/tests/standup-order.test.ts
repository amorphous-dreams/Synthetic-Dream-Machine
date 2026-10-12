/**
 * standup-order — `vessel stand --install` founds before it reaches outside LAR_ROOT,
 * and the mempalace sidecar keeps its own door.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/parse-args.js";

const log: string[] = [];
let foundCode = 0;
let installSteps: Array<{ step: string; ran: boolean; ok: boolean; detail: string }> = [];
let root = "";

function mockAll(): void {
  vi.doMock("../src/commands/found.js", () => ({ cmdFound: vi.fn(async () => { log.push("cmdFound"); return foundCode; }) }));
  vi.doMock("../src/commands/scripted.js", () => ({ cmdBake: vi.fn(async () => { log.push("cmdBake"); return 0; }) }));
  vi.doMock("../src/link-bin.js", () => ({
    linkLaresGlobal: vi.fn(() => { log.push("linkLaresGlobal"); return { ok: true, detail: "linked" }; }),
    linkMempalaceBins: vi.fn(() => { log.push("linkMempalaceBins"); return [{ ok: true, detail: "linked mempalace" }]; }),
  }));
  vi.doMock("../src/integration-check.js", () => ({
    checkMempalaceIntegration: vi.fn(() => ({ ok: false })),
    installMempalaceIntegration: vi.fn(() => { log.push("installMempalaceIntegration"); return installSteps; }),
  }));
  vi.doMock("../src/spawn.js", () => ({ runCommand: vi.fn(async () => { log.push("runCommand"); return 0; }) }));
}

beforeEach(() => {
  vi.resetModules();
  log.length = 0;
  foundCode = 0;
  installSteps = [{ step: "pip", ran: true, ok: true, detail: "ok" }];
  root = mkdtempSync(join(tmpdir(), "standup-order-"));
  mockAll();
});
afterEach(() => {
  for (const m of ["found", "scripted"]) vi.doUnmock(`../src/commands/${m}.js`);
  for (const m of ["link-bin", "integration-check", "spawn"]) vi.doUnmock(`../src/${m}.js`);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("foundIfAbsent — the founding runs first, the link runs last", () => {
  it("★ a refused init stops before genesis and every outside reach ★", async () => {
    foundCode = 1;
    const { foundIfAbsent } = await import("../src/standup.js");
    const steps = await foundIfAbsent(parseArgs(["vessel", "stand", "--install"]), { root, bootstrap: join(root, "vessel") });
    expect(log).not.toContain("linkLaresGlobal");
    expect(log).not.toContain("linkMempalaceBins");
    expect(log).not.toContain("installMempalaceIntegration");
    expect(log).not.toContain("cmdBake");
    expect(steps[steps.length - 1]).toMatchObject({ step: "init", action: "failed" });
  });

  it("★ a founded init runs init, genesis, then the lares link; the mempalace never appears ★", async () => {
    const { foundIfAbsent } = await import("../src/standup.js");
    await foundIfAbsent(parseArgs(["vessel", "stand", "--install"]), { root, bootstrap: join(root, "vessel") });
    expect(log.filter((l) => ["cmdFound", "cmdBake", "linkLaresGlobal"].includes(l))).toEqual(["cmdFound", "cmdBake", "linkLaresGlobal"]);
    expect(log).not.toContain("linkMempalaceBins");
    expect(log).not.toContain("installMempalaceIntegration");
  });

  it("CONTROL: a bootstrap and genesis already present skip both and the link still runs", async () => {
    mkdirSync(join(root, "genesis"), { recursive: true });
    writeFileSync(join(root, "genesis", "seed.json"), "{}");
    writeFileSync(join(root, "vessel"), "x");
    const { foundIfAbsent } = await import("../src/standup.js");
    const steps = await foundIfAbsent(parseArgs(["vessel", "stand", "--install"]), { root, bootstrap: join(root, "vessel") });
    expect(steps.find((s) => s.step === "init")?.action).toBe("skip");
    expect(steps.find((s) => s.step === "genesis")?.action).toBe("skip");
    expect(log).toEqual(["linkLaresGlobal"]);
  });

  it("planFounding names no mempalace step", async () => {
    const { planFounding } = await import("../src/standup.js");
    expect(planFounding({ root, bootstrap: join(root, "vessel") }).map((p) => p.step)).toEqual(["build", "init", "genesis"]);
  });
});

describe("lares mempalace install — the sidecar's own door links its bins", () => {
  it("installs, then links the console scripts, reporting the link as a step", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { cmdMempalaceInstall } = await import("../src/commands/mempalace.js");
    expect(cmdMempalaceInstall(parseArgs(["mempalace", "install", "--json"]))).toBe(0);
    expect(log).toEqual(["installMempalaceIntegration", "linkMempalaceBins"]);
  });

  it("CONTROL: a failed install skips the link and exits 1", async () => {
    installSteps = [{ step: "pip", ran: true, ok: false, detail: "boom" }];
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { cmdMempalaceInstall } = await import("../src/commands/mempalace.js");
    expect(cmdMempalaceInstall(parseArgs(["mempalace", "install", "--json"]))).toBe(1);
    expect(log).toEqual(["installMempalaceIntegration"]);
  });
});
