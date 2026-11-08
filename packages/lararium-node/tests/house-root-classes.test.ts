/**
 * House-root classes — the law that keeps what a re-founding clears apart from what it must never reach.
 *
 * ONE NAMED ROOT, ONE MEANING PER LEVEL. `LAR_ROOT` names the house root and nothing stands in for it; beneath it:
 *
 *   1. an unnamed or blank root refuses by name — no XDG base and no home directory answer in its place,
 *   2. the hearth holds the spirits' homes, the sensoriums, the checkpoints and the staging area,
 *   3. the library, the projections and the operator's settings stand BESIDE the hearth, never inside it, so the
 *      re-founding that clears `<root>/hearth` reaches none of them,
 *   4. a caller-supplied NAME cannot walk out of its root — the one route that defeats an address.
 *
 * A vector asserting "does not reach" passes trivially against a resolver that returns nothing, so each case
 * here also asserts the POSITIVE resolution — the exact path the code produced — and the refusals assert a
 * throw rather than an absence.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  HouseRootUnnamed, larHouseRoot, larHearthHome, larSensoriumsHome, larCheckpointsHome, larStagingHome,
  larLibraryRoot, larProjectionsHome, larConfigHome, larCacheHome, larRuntimeHome,
  larIdentityDir, larSealHome, larDataDir, larProjectionCheckpointDir, larHarvestCheckpointDir, larHarvestStagingDir,
  memorySensoriumDir, meshSensoriumDir, memeticWikitextSensoriumDir, sensoriumDir,
  scratchSensoriumInstanceDir, assertOneSegment, larLibraryHome,
} from "../src/index.js";

const KEYS = ["LAR_ROOT", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "LAR_LIBRARY", "HOME", "USERPROFILE"] as const;
const saved: Record<string, string | undefined> = {};

function set(k: string, v: string | undefined): void {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

beforeEach(() => { for (const k of KEYS) saved[k] = process.env[k]; });
afterEach(() => { for (const k of KEYS) set(k, saved[k]); });

/** Is `dir` at or beneath `root`? — segment-safe, never a bare string prefix. */
function isUnder(dir: string, root: string): boolean {
  return dir === root || dir.startsWith(root.endsWith("/") ? root : root + "/");
}

describe("an unnamed house root refuses", () => {
  test("unset LAR_ROOT refuses by name, whatever XDG and HOME hold", () => {
    set("LAR_ROOT", undefined);
    set("XDG_DATA_HOME", "/x/data");
    set("XDG_STATE_HOME", "/x/state");
    for (const r of [larHouseRoot, larDataDir, larIdentityDir, larSealHome, memorySensoriumDir, larLibraryRoot, larConfigHome, larCacheHome, larRuntimeHome]) {
      expect(r).toThrow(HouseRootUnnamed);
    }
  });

  test("a blank LAR_ROOT refuses as an unset one does", () => {
    set("LAR_ROOT", "  ");
    expect(() => larHearthHome()).toThrow(/set LAR_ROOT/);
  });
});

describe("each class stands one level below the root", () => {
  test("the hearth holds the spirits' homes, the sensoriums, the checkpoints and the staging area", () => {
    set("LAR_ROOT", "/iso");
    const hearth = join("/iso", "hearth");
    expect(larHearthHome()).toBe(hearth);
    expect(larDataDir()).toBe(join(hearth, "vessel"));
    expect(larIdentityDir()).toBe(join(hearth, "identity"));
    expect(larSealHome()).toBe(join(hearth, "nexus"));
    expect(larSensoriumsHome()).toBe(join(hearth, "sensoriums"));
    expect(memorySensoriumDir()).toBe(join(hearth, "sensoriums", "memory"));
    expect(meshSensoriumDir()).toBe(join(hearth, "sensoriums", "mesh"));
    expect(memeticWikitextSensoriumDir()).toBe(join(hearth, "sensoriums", "memetic-wikitext"));
    expect(sensoriumDir("memory")).toBe(memorySensoriumDir());     // one name, one dir
    expect(larCheckpointsHome()).toBe(join(hearth, "checkpoints"));
    expect(larProjectionCheckpointDir()).toBe(join(hearth, "checkpoints", "projection"));
    expect(larHarvestCheckpointDir()).toBe(join(hearth, "checkpoints", "harvest"));
    expect(larStagingHome()).toBe(join(hearth, "staging"));
    expect(larHarvestStagingDir()).toBe(join(hearth, "staging", "harvest"));
    expect(isUnder(larIdentityDir(), larDataDir())).toBe(false);    // beside the runtime store, never inside
  });

  test("the library, the projections, the settings, the cache and the run dir stand beside the hearth", () => {
    set("LAR_ROOT", "/iso");
    set("LAR_LIBRARY", undefined);
    const beside = { library: larLibraryRoot(), projections: larProjectionsHome(), config: larConfigHome(), cache: larCacheHome(), run: larRuntimeHome() };
    for (const [name, dir] of Object.entries(beside)) {
      expect(dir).toBe(join("/iso", name));
      expect(isUnder(dir, larHearthHome())).toBe(false);
    }
    expect(larLibraryHome()).toBe(larLibraryRoot());
    expect(new Set([...Object.values(beside), larHearthHome()]).size).toBe(6);
  });

  test("XDG variables move nothing — LAR_ROOT alone places every class", () => {
    set("LAR_ROOT", "/iso");
    set("XDG_DATA_HOME", "/x/data");
    set("XDG_STATE_HOME", "/x/state");
    set("XDG_CACHE_HOME", "/x/cache");
    for (const p of [larDataDir(), larLibraryHome(), memorySensoriumDir(), larHarvestCheckpointDir(), larCacheHome()]) {
      expect(isUnder(p, "/iso")).toBe(true);
      expect(isUnder(p, "/x")).toBe(false);
    }
  });
});

describe("the one-segment law — a name never routes out of its root", () => {
  test("a plain name passes through unchanged (the guard is not a blanket refusal)", () => {
    expect(assertOneSegment("t", "memory")).toBe("memory");
    expect(assertOneSegment("t", "memetic-wikitext")).toBe("memetic-wikitext");
    expect(assertOneSegment("t", "_")).toBe("_");                   // sensoriumsRoot() resolves through this
  });

  for (const bad of ["..", ".", "", "../abide", "a/b", "/etc", "..\\win", "../../../../library"]) {
    test(`refuses ${JSON.stringify(bad)}`, () => {
      expect(() => assertOneSegment("t", bad)).toThrow(/ONE path segment/);
    });
  }

  test("sensoriumDir refuses a traversing name rather than resolving out of the sensoriums home", () => {
    set("LAR_ROOT", "/iso");
    expect(sensoriumDir("memory")).toBe(join("/iso", "hearth", "sensoriums", "memory"));   // it RESOLVES
    expect(() => sensoriumDir("../../library")).toThrow(/ONE path segment/);               //  … and refuses
  });

  test("the scratch dissolve target refuses a traversing id — `dissolve` rmSyncs what this returns", () => {
    set("LAR_ROOT", "/iso");
    expect(scratchSensoriumInstanceDir("abc123")).toBe(join("/iso", "cache", "scratch", "sensoriums", "abc123"));
    expect(() => scratchSensoriumInstanceDir("../../../abide")).toThrow(/ONE path segment/);
  });
});
