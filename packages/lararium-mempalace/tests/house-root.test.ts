import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  HouseRootUnnamed, larHouseRoot, larHearthHome, larSensoriumsHome, larCheckpointsHome, larStagingHome,
  larLibraryRoot, larProjectionsHome, larConfigHome, larCacheHome, larRuntimeHome,
  mempalaceContentParent, memorySensoriumDir, memorySensoriumContentDir, memorySensoriumStructureDir,
  memorySensoriumFormDir, memorySensoriumPersistenceDir,
} from "../src/house-root.js";

/**
 * house-root reads ONE named root (`LAR_ROOT`) and lays every class beneath it; an unnamed root refuses. The
 * guest mempalace parent alone follows the operator's home, because it holds no house state.
 */
describe("house-root (the one named house root)", () => {
  const saved: Record<string, string | undefined> = {};
  const roots: string[] = [];

  function set(k: string, v: string | undefined) {
    if (!(k in saved)) saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  function freshRoot(): string {
    const r = mkdtempSync(join(tmpdir(), "house-root-"));
    roots.push(r);
    return r;
  }

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const k of Object.keys(saved)) delete saved[k];
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("an unset LAR_ROOT refuses by name, whatever XDG and HOME hold", () => {
    set("LAR_ROOT", undefined);
    set("XDG_DATA_HOME", "/xdg/data");
    expect(() => larHouseRoot()).toThrow(HouseRootUnnamed);
    expect(() => memorySensoriumDir()).toThrow(/set LAR_ROOT/);
  });

  it("a blank LAR_ROOT refuses as an unset one does", () => {
    set("LAR_ROOT", "   ");
    expect(() => larHearthHome()).toThrow(HouseRootUnnamed);
  });

  it("every class stands one level below the root, each under its own name", () => {
    set("LAR_ROOT", "/house");
    expect(larHouseRoot()).toBe("/house");
    expect(larHearthHome()).toBe(join("/house", "hearth"));
    expect(larSensoriumsHome()).toBe(join("/house", "hearth", "sensoriums"));
    expect(larCheckpointsHome()).toBe(join("/house", "hearth", "checkpoints"));
    expect(larStagingHome()).toBe(join("/house", "hearth", "staging"));
    expect(larLibraryRoot()).toBe(join("/house", "library"));
    expect(larProjectionsHome()).toBe(join("/house", "projections"));
    expect(larConfigHome()).toBe(join("/house", "config"));
    expect(larCacheHome()).toBe(join("/house", "cache"));
    expect(larRuntimeHome()).toBe(join("/house", "run"));
  });

  it("the library and the projections stand outside the hearth a re-founding clears", () => {
    set("LAR_ROOT", "/house");
    expect(larLibraryRoot().startsWith(larHearthHome())).toBe(false);
    expect(larProjectionsHome().startsWith(larHearthHome())).toBe(false);
  });

  // Both tongues name the same planes — the li planes resolve the SAME string the Python holders' defaults do
  // (structurepalace_io._default_structurepalace_dir + siblings), or capture writes one dir while recall reads another.
  it("the memory sensorium planes stand under <root>/hearth/sensoriums/memory", () => {
    set("LAR_ROOT", "/iso");
    const memory = join("/iso", "hearth", "sensoriums", "memory");
    expect(memorySensoriumDir()).toBe(memory);
    expect(memorySensoriumContentDir()).toBe(join(memory, "content"));
    expect(memorySensoriumStructureDir()).toBe(join(memory, "structure"));
    expect(memorySensoriumFormDir()).toBe(join(memory, "form"));
    expect(memorySensoriumPersistenceDir()).toBe(join(memory, "persistence"));
  });

  it("mempalaceContentParent: the guest follows the operator's home, never the house root", () => {
    const root = freshRoot();
    set("LAR_ROOT", join(root, "house"));
    set("HOME", join(root, "home"));
    set("USERPROFILE", join(root, "home"));
    expect(mempalaceContentParent()).toBe(join(root, "home", ".mempalace"));
  });

  it("mempalaceContentParent answers with no house root named (a guest comparator, not house state)", () => {
    const root = freshRoot();
    set("LAR_ROOT", undefined);
    set("HOME", join(root, "home"));
    set("USERPROFILE", join(root, "home"));
    expect(mempalaceContentParent()).toBe(join(root, "home", ".mempalace"));
  });
});
