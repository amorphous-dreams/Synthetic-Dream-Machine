import { afterEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatch } from "../src/bin/lares.js";
import { VESSEL_SUBS } from "../src/commands/vessel.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { cmdRiteRefresh } from "../src/commands/scripted.js";

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

describe("vessel surfaces", () => {
  test("read reports the store without changing it", async () => {
    quiet();
    const root = scratch();
    const store = join(root, "data", "lares", "vessel");
    mkdirSync(store, { recursive: true });
    const marker = join(store, "marker.txt");
    writeFileSync(marker, "kept");
    const before = treeHash(store);
    process.env["LAR_ROOT"] = root;

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
    expect(readFileSync(marker, "utf8")).toBe("kept");
    expect(treeHash(store)).toBe(before);
  });

  test("refresh runs build · stop · stand in order and preserves the store", async () => {
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
    expect(vesselSource).toContain('refresh:  { composes: "build · stop · stand"');
    expect(vesselSource).toContain('rebuild:  { composes: "re-derive · stand"');
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await cmdVessel({ command: "vessel", positional: ["rite"], options: {}, flags: {} });
    expect(err.mock.calls.flat().join("\n")).toContain("refresh   build · stop · stand");
    expect(err.mock.calls.flat().join("\n")).toContain("rebuild   re-derive · stand");
  });

  test("the vessel surface table names its live doors", () => {
    expect(VESSEL_SUBS).toEqual(expect.arrayContaining(["found", "stand", "stop", "seed", "read", "rite"]));
  });
});
