/**
 * projection-roots-split — the house's disk mirrors split by ORIGIN (operator ruling, 2026-11-01: "Are those things that
 * start in bags? then they should 'end up back in bags/'. Only live edits end up in the wiki layers ... the dirs in the
 * workspace right now (and the wikis they shall compose) DO need to get written back to the main repo checkout").
 *
 *   · a bag whose source dir stands under the canon source (`LAR_BAGS`) projects back to `<canon>/<slug>`, and the wiki it
 *     composes to `<canon parent>/wikis/<slug>`;
 *   · every other bag and wiki (house-minted, a user's own) projects under the state root (`--root`);
 *   · a PRIVATE plane (the daemon, the kahua) projects under the state root even where a source dir of its name stands.
 *
 * Membership reads the source tree; no bag name is listed, save the private planes.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { projectionRoots, daemonWorkingMirror } from "../src/bag-paths.js";

let dir = "";
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ""; });

function tree(...bags: string[]): { state: string; canon: string } {
  dir = mkdtempSync(join(tmpdir(), "proj-split-"));
  const state = join(dir, "state"), canon = join(dir, "workspace", "bags");
  for (const b of bags) mkdirSync(join(canon, b), { recursive: true });
  mkdirSync(state, { recursive: true });
  return { state, canon };
}

describe("projectionRoots — the mirror root splits by origin", () => {
  test("RED: a bag present in the canon source projects back to it, and its wiki beside it", () => {
    const { state, canon } = tree("lares", "elyncia");
    const roots = projectionRoots({ stateRoot: state, canonBags: canon });
    expect(roots.bagRoot("lares")).toBe(join(canon, "lares"));
    expect(roots.bagRoot("elyncia")).toBe(join(canon, "elyncia"));
    expect(roots.wikisRootFor("elyncia")).toBe(join(dir, "workspace", "wikis"));
    expect(roots.sourcedSlugs()).toEqual(["elyncia", "lares"]);
  });
  test("CONTROL: a bag with no source dir projects under the state root", () => {
    const { state, canon } = tree("lares");
    const roots = projectionRoots({ stateRoot: state, canonBags: canon });
    expect(roots.bagRoot("notes")).toBe(join(state, "bags", "notes"));
    expect(roots.wikisRootFor("notes")).toBe(join(state, "wikis"));
  });
  test("a private plane stays under the state root even where a source dir of its name stands", () => {
    const { state, canon } = tree("daemon", "kahua");
    const roots = projectionRoots({ stateRoot: state, canonBags: canon });
    expect(roots.bagRoot("daemon")).toBe(join(state, "bags", "daemon"));
    expect(roots.wikisRootFor("kahua")).toBe(join(state, "wikis"));
    expect(roots.sourcedSlugs()).toEqual([]);
    expect(daemonWorkingMirror(state).mirrorRoot).toBe(join(state, "wikis", "daemon"));
  });
  test("an absent canon source sources nothing: every root stays under state", () => {
    dir = mkdtempSync(join(tmpdir(), "proj-split-"));
    const roots = projectionRoots({ stateRoot: dir, canonBags: join(dir, "nowhere") });
    expect(roots.sourcedSlugs()).toEqual([]);
    expect(roots.bagRoot("lares")).toBe(join(dir, "bags", "lares"));
  });
});
