import { afterEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatch, COMMANDS, unknownFlags } from "../src/bin/lares.js";
import { parseArgs } from "../src/parse-args.js";
import { VESSEL_SUBS } from "../src/commands/vessel.js";
import { posturePlan } from "../src/commands/posture-plan.js";
import { COMMAND_HELP } from "../src/command-help.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdRiteRefresh } from "../src/commands/scripted.js";
import * as portControl from "../src/port-control.js";

const roots: string[] = [];
const savedRoot = process.env["LAR_ROOT"];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  if (savedRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = savedRoot;
});

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), "lares-vessel-door-"));
  roots.push(root);
  return root;
}

function treeHash(root: string): string {
  const hash = createHash("sha256");
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = path.slice(root.length + 1);
      const stat = statSync(path);
      hash.update(`${stat.isDirectory() ? "d" : "f"}:${rel}\0`);
      if (stat.isDirectory()) walk(path);
      else hash.update(readFileSync(path));
    }
  };
  walk(root);
  return hash.digest("hex");
}

const quiet = (): void => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
};

describe("vessel wipe surfaces", () => {
  test("F-1 clear refuses as an unknown sub-door and preserves a store marker; read remains available", async () => {
    quiet();
    const root = scratch();
    const store = join(root, "data", "lares", "vessel");
    mkdirSync(store, { recursive: true });
    const marker = join(store, "marker.txt");
    writeFileSync(marker, "kept");
    const before = treeHash(store);
    process.env["LAR_ROOT"] = root;

    expect(await dispatch(["vessel", "clear", "--root", root, "--force", "--skip-build"])).toBe(2);
    expect(readFileSync(marker, "utf8")).toBe("kept");
    expect(treeHash(store)).toBe(before);
    let output = "";
    const stdoutWrite = process.stdout.write;
    process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof process.stdout.write;
    try {
      expect(await dispatch(["vessel", "read", "--root", root, "--json", "--skip-build"])).toBe(0);
    } finally {
      process.stdout.write = stdoutWrite;
    }
    const read = JSON.parse(output);
    expect(read.data.storage).toMatch(/1 files?/);
  });

  test("F-2 rebirth is an unknown rite and is absent from the printed rite list", async () => {
    const root = scratch();
    process.env["LAR_ROOT"] = root;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["vessel", "rite", "rebirth", "--skip-build"])).toBe(2);
    expect(VESSEL_SUBS).toContain("rite");
    expect(VESSEL_SUBS).not.toContain("rebirth");
    expect(err.mock.calls.flat().join("\n")).not.toMatch(/^\s*rebirth\b/m);
  });

  test("F-3 --clear refuses before restart reaches port control; --restart alone remains a posture", async () => {
    const vessel = COMMANDS.find((c) => c.name === "vessel")!;
    const parsed = parseArgs(["vessel", "stand", "--restart", "--clear"]);
    expect(unknownFlags(vessel, parsed).map((x) => x.name)).toContain("clear");
    expect(posturePlan(["restart"]).posture).toBe("restart");
    const stop = vi.spyOn(portControl, "stopIncumbent");
    quiet();
    const root = scratch();
    expect(await dispatch(["vessel", "stand", "--restart", "--clear", "--root", root, "--skip-build"])).toBe(2);
    expect(stop).not.toHaveBeenCalled();
  });

  test("F-4 refresh runs build · stop · stand in order and preserves the store", async () => {
    const root = scratch();
    const store = join(root, "data", "lares", "vessel");
    mkdirSync(store, { recursive: true });
    const marker = join(store, "marker.txt");
    writeFileSync(marker, "refresh-store");
    const before = readFileSync(marker);
    const beforeTree = treeHash(store);
    const calls: string[] = [];
    const build = vi.fn(async () => { calls.push("build"); return 0; });
    const stop = vi.fn(async () => { calls.push("stop"); return 0; });
    const stand = vi.fn(async () => { calls.push("stand"); return 0; });
    const code = await cmdRiteRefresh({ command: "vessel", positional: [], options: {}, flags: {} }, {
      build, stop, stand,
    });
    expect(code).toBe(0);
    expect(calls).toEqual(["build", "stop", "stand"]);
    expect(build).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(stand).toHaveBeenCalledOnce();
    expect(readFileSync(marker)).toEqual(before);
    expect(treeHash(store)).toBe(beforeTree);
    calls.length = 0;
    const stopAfterBuildRefusal = vi.fn(async () => { calls.push("stop"); return 0; });
    const standAfterBuildRefusal = vi.fn(async () => { calls.push("stand"); return 0; });
    const refusedBuild = await cmdRiteRefresh({ command: "vessel", positional: [], options: {}, flags: {} }, {
      build: vi.fn(async () => { calls.push("build"); return 7; }),
      stop: stopAfterBuildRefusal,
      stand: standAfterBuildRefusal,
    });
    expect(refusedBuild).toBe(7);
    expect(calls).toEqual(["build"]);
    expect(stopAfterBuildRefusal).not.toHaveBeenCalled();
    expect(standAfterBuildRefusal).not.toHaveBeenCalled();
    expect(treeHash(store)).toBe(beforeTree);

    const vesselSource = readFileSync(fileURLToPath(new URL("../src/commands/vessel.ts", import.meta.url)), "utf8");
    const scriptedSource = readFileSync(fileURLToPath(new URL("../src/commands/scripted.ts", import.meta.url)), "utf8");
    expect(vesselSource).toContain('refresh:  { composes: "build · stop · stand"');
    expect(vesselSource).toContain('rebuild:  { composes: "re-derive · stand"');
    expect(scriptedSource).not.toMatch(/cmdRiteRefresh[\s\S]*?fresh:\s*true/);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await cmdVessel({ command: "vessel", positional: ["rite"], options: {}, flags: {} });
    expect(err.mock.calls.flat().join("\n")).toContain("refresh   build · stop · stand");
    expect(err.mock.calls.flat().join("\n")).toContain("rebuild   re-derive · stand");
    expect(err.mock.calls.flat().join("\n")).not.toMatch(/refresh.*clear/);
  });

  test("F-5 the vessel help and surface table name neither removed rite nor verb", async () => {
    expect(VESSEL_SUBS).toEqual(expect.arrayContaining(["found", "stand", "stop", "seed", "read", "rite"]));
    expect(VESSEL_SUBS).not.toContain("clear");
    expect(VESSEL_SUBS).not.toContain("rebirth");
    const help = JSON.stringify(COMMAND_HELP.vessel);
    expect(help).not.toMatch(/\bclear\b|\brebirth\b/);
    quiet();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdVessel({ command: "vessel", positional: ["help"], options: {}, flags: {} });
    expect(log.mock.calls.flat().join("\n")).not.toMatch(/\bclear\b|\brebirth\b/);
  });
});
