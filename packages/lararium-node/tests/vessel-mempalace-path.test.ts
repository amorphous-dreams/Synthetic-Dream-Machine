import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { larMempalaceDir } from "../src/vessel-paths.js";

/**
 * `larMempalaceDir` (node) and mempalace's `defaultPalacePath` derive the store parent from ONE
 * cycle-free source (`@lararium/mempalace/house-root`), so the vessel view and the mempalace chroma dir
 * always agree. The guest follows the operator's home and never the house root.
 */
describe("larMempalaceDir (derives from the shared house-root)", () => {
  const saved: Record<string, string | undefined> = {};
  const roots: string[] = [];

  function set(k: string, v: string | undefined) {
    if (!(k in saved)) saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  function freshRoot(): string {
    const r = mkdtempSync(join(tmpdir(), "vessel-mp-"));
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

  it("MEMPALACE_PALACE_PATH override is taken verbatim as the parent", () => {
    const root = freshRoot();
    set("MEMPALACE_PALACE_PATH", join(root, "custom"));
    expect(larMempalaceDir()).toBe(join(root, "custom"));
  });

  it("unset → the upstream-default ~/.mempalace (== mempalace defaultPalacePath parent)", () => {
    // content-cap-home ruling: the content cap stays EXTERNAL at the vendored mempalace's own default,
    // never strangled into our sensorium tree; the memory-sensorium `#has` it by ABSOLUTE reference.
    const root = freshRoot();
    set("MEMPALACE_PALACE_PATH", undefined);
    set("LAR_ROOT", undefined);                       // the guest needs no house root named
    set("HOME", join(root, "home"));
    set("USERPROFILE", join(root, "home"));
    expect(larMempalaceDir()).toBe(join(root, "home", ".mempalace"));
  });

  it("the sensorium tree does NOT relocate content (upstream-external boundary)", () => {
    const root = freshRoot();
    set("MEMPALACE_PALACE_PATH", undefined);
    set("LAR_ROOT", join(root, "house"));
    set("HOME", join(root, "home"));
    set("USERPROFILE", join(root, "home"));
    // even with the consolidated content dir present in the house, content stays external at ~/.mempalace.
    mkdirSync(join(root, "house", "hearth", "sensoriums", "memory", "content"), { recursive: true });
    expect(larMempalaceDir()).toBe(join(root, "home", ".mempalace"));
  });
});
