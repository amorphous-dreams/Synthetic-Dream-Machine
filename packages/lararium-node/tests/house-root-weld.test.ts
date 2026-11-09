/**
 * house-root-weld — the ONE house table, read from both tongues and held equal.
 *
 * No module crosses the language seam: `@lararium/mempalace/house-root` + `vessel-paths.ts` spell the table in
 * TypeScript, `packages/lararium-sensorium/scripts/house_root.py` spells it in Python, and agreement alone joins
 * them. This suite reads every entry from both and asserts them equal, and it asserts the layout itself, so a move
 * on one side reds here until the other side moves with it. An unnamed root refuses in both.
 */
import { afterEach, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
  HouseRootUnnamed, larHouseRoot, larHearthHome, larDataDir, larIdentityDir, larSealHome, larSensoriumsHome,
  larCheckpointsHome, larStagingHome, larProjectionCheckpointDir, larHarvestCheckpointDir, larHarvestStagingDir,
  larLibraryRoot, larProjectionsHome, larConfigHome, larCacheHome, larRuntimeHome, larBootstrapPath,
  memorySensoriumDir, sensoriumDir, meshSensoriumDir, memeticWikitextSensoriumDir, scratchSensoriumDir,
} from "../src/vessel-paths.js";
import { laresConfigPath } from "../src/lares-config.js";
import { repoRegistryPath, bagHomeRoots } from "../src/bag-declare.js";
import { larLibraryHome } from "../src/library-store.js";

const PYTHONPATH = resolve(process.cwd(), "../lararium-sensorium/scripts");
const PYTHON = process.env["LARES_PYTHON"] || "python3";

const saved = { LAR_ROOT: process.env["LAR_ROOT"], LAR_LIBRARY: process.env["LAR_LIBRARY"] };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Run a Python expression against the scripts dir with `env`, and parse its JSON answer. */
function python(expr: string, env: Record<string, string | undefined>): { status: number | null; out: unknown; err: string } {
  const r = spawnSync(PYTHON, ["-c", `import json, house_root, lares_uds, guest_harvest\nprint(json.dumps(${expr}))`], {
    env: { ...process.env, ...env, PYTHONPATH }, encoding: "utf8",
  });
  return { status: r.status, out: r.status === 0 ? JSON.parse(r.stdout) : null, err: r.stderr };
}

/** Every entry by its TS resolver name — the shape `house_root.table()` answers in Python. */
function tsTable(): Record<string, string> {
  return {
    larHouseRoot: larHouseRoot(),
    larHearthHome: larHearthHome(),
    larDataDir: larDataDir(),
    larIdentityDir: larIdentityDir(),
    larSealHome: larSealHome(),
    larSensoriumsHome: larSensoriumsHome(),
    larCheckpointsHome: larCheckpointsHome(),
    larStagingHome: larStagingHome(),
    larProjectionCheckpointDir: larProjectionCheckpointDir(),
    larHarvestCheckpointDir: larHarvestCheckpointDir(),
    larHarvestStagingDir: larHarvestStagingDir(),
    larLibraryRoot: larLibraryRoot(),
    larProjectionsHome: larProjectionsHome(),
    larConfigHome: larConfigHome(),
    larCacheHome: larCacheHome(),
    larRuntimeHome: larRuntimeHome(),
  };
}

describe("an unnamed house root refuses in both tongues", () => {
  for (const value of [undefined, "", "   "]) {
    test(`LAR_ROOT=${JSON.stringify(value)} refuses by name, in TypeScript`, () => {
      if (value === undefined) delete process.env["LAR_ROOT"];
      else process.env["LAR_ROOT"] = value;
      for (const resolveIt of [larDataDir, larIdentityDir, larSealHome, larLibraryRoot, larProjectionsHome, laresConfigPath, repoRegistryPath, memorySensoriumDir]) {
        expect(resolveIt).toThrow(HouseRootUnnamed);
        expect(resolveIt).toThrow(/set LAR_ROOT/);
      }
    });
  }

  test("an unset LAR_ROOT refuses by name, in Python, with the same message", () => {
    const r = spawnSync(PYTHON, ["-c", "import lares_uds; lares_uds.data_dir()"], {
      env: { ...process.env, LAR_ROOT: "", PYTHONPATH }, encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("HouseRootUnnamed");
    expect(r.stderr).toContain(new HouseRootUnnamed().message);
  });
});

describe("the house table, welded", () => {
  test("Python and TypeScript resolve every table entry to the same path", () => {
    process.env["LAR_ROOT"] = "/scratch/house";
    const py = python("house_root.table()", { LAR_ROOT: "/scratch/house" });
    expect(py.status, py.err).toBe(0);
    expect(py.out).toEqual(tsTable());
  });

  test("the callers on both sides land on the welded entries", () => {
    process.env["LAR_ROOT"] = "/scratch/house";
    // meta_io (the `<config>/meta.json` reader) imports the vendored mempalace, so test_house_root.py pins it on
    // the Python side against the same `house_root.config_home()` this table welds.
    const py = python("[lares_uds.data_dir(), lares_uds.identity_dir(), guest_harvest.default_stage_root()]", { LAR_ROOT: "/scratch/house" });
    expect(py.status, py.err).toBe(0);
    expect(py.out).toEqual([larDataDir(), larIdentityDir(), join(larHarvestStagingDir(), "mempalace")]);
  });

  test("the table lays every class one level below the root, and nothing that outlives a re-founding inside the hearth", () => {
    process.env["LAR_ROOT"] = "/scratch/house";
    delete process.env["LAR_LIBRARY"];
    const r = "/scratch/house";
    expect(tsTable()).toEqual({
      larHouseRoot: r,
      larHearthHome: join(r, "hearth"),
      larDataDir: join(r, "hearth", "vessel"),
      larIdentityDir: join(r, "hearth", "identity"),
      larSealHome: join(r, "hearth", "nexus"),
      larSensoriumsHome: join(r, "sensoriums"),
      larCheckpointsHome: join(r, "hearth", "checkpoints"),
      larStagingHome: join(r, "hearth", "staging"),
      larProjectionCheckpointDir: join(r, "hearth", "checkpoints", "projection"),
      larHarvestCheckpointDir: join(r, "hearth", "checkpoints", "harvest"),
      larHarvestStagingDir: join(r, "hearth", "staging", "harvest"),
      larLibraryRoot: join(r, "library"),
      larProjectionsHome: join(r, "projections"),
      larConfigHome: join(r, "config"),
      larCacheHome: join(r, "cache"),
      larRuntimeHome: join(r, "run"),
    });
    // The feeds: what each broad resolver hands its consumers.
    expect(larBootstrapPath()).toBe(join(r, "hearth", "vessel", "social-bootstrap.json"));
    expect(memorySensoriumDir()).toBe(join(r, "sensoriums", "memory"));
    expect(sensoriumDir("ai-sessions")).toBe(join(r, "sensoriums", "ai-sessions"));
    expect(meshSensoriumDir()).toBe(join(r, "sensoriums", "mesh"));
    expect(memeticWikitextSensoriumDir()).toBe(join(r, "sensoriums", "memetic-wikitext"));
    expect(scratchSensoriumDir()).toBe(join(r, "cache", "scratch", "sensoriums"));
    expect(laresConfigPath()).toBe(join(r, "config", "config.json"));
    expect(repoRegistryPath()).toBe(join(r, "config", "repos.json"));
    expect(bagHomeRoots().hearth).toBe(join(r, "projections", "bags"));
    expect(larLibraryHome()).toBe(join(r, "library"));
  });
});
