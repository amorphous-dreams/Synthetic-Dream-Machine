/**
 * surface-check — `lares surface check`, the pool check the pre-commit hook runs, over planted breaches.
 *
 * A face pool holds that face's private planes alone (face-pools #/shape): it refuses a repo top holding an index file
 * that maps one face to another (`face-labels/`, `kahua-index.toml`, `share.tid`, `kahua-pending.json`) or another face's root; it
 * refuses any repo rooted at `projections/` or `config/`; it refuses an author email or signing key another face pool in
 * the same house already carries. It reads LOCAL config alone, and exits 1 naming each breach.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { faceRoot } from "@lararium/node";
import { cmdSurface } from "../src/commands/surface.js";
import { git, openSurfaceRig, plant, surfaceArgs, type SurfaceRig } from "./support/surface-rig.js";

let rig: SurfaceRig;
let heron: string;
beforeEach(async () => {
  rig = openSurfaceRig();
  heron = faceRoot(rig.projections, "Heron Lantern");
  expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
  rig.at(heron);
});
afterEach(() => { rig.close(); });

const check = (options: Record<string, string> = {}) => cmdSurface(surfaceArgs(["check"], options), rig.doors);

describe("lares surface check", () => {
  test("CONTROL: a freshly inited face pool passes, from its own top and from a folder inside it", async () => {
    expect(await check()).toBe(0);
    mkdirSync(join(heron, "wiki"), { recursive: true });
    rig.at(join(heron, "wiki"));
    expect(await check()).toBe(0);
  });

  test("--face N checks the named face's pool wherever the command runs", async () => {
    rig.at(rig.scratch.root);
    expect(await check({ face: "0" })).toBe(0);
  });

  test.each(["kahua-index.toml", "share.tid", "kahua-pending.json"])("★ refuses a pool top holding the index file %s ★", async (name) => {
    plant(join(heron, name), "x\n");
    expect(await check()).toBe(1);
    expect(rig.said()).toContain(name);
  });

  test("★ refuses a pool top holding face-labels/ ★", async () => {
    plant(join(heron, "face-labels", "abc.json"), "{}\n");
    expect(await check()).toBe(1);
    expect(rig.said()).toContain("face-labels");
  });

  test("★ refuses a repo that holds another face's root ★", async () => {
    rig.wear({ index: 1, petname: "Moth" });
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const faces = join(rig.projections, "faces");
    git(faces, "init", "-q");
    rig.at(faces);
    expect(await check()).toBe(1);
    expect(rig.said()).toMatch(/Moth/);
  });

  test.each(["projections", "config"])("★ refuses any repo rooted at %s/ ★", async (home) => {
    const top = home === "projections" ? rig.projections : rig.config;
    git(top, "init", "-q");
    rig.at(top);
    expect(await check()).toBe(1);
    expect(rig.said()).toContain(top);
  });

  test("refuses a repo at the house root, since it holds projections/ and config/", async () => {
    git(rig.scratch.root, "init", "-q");
    rig.at(rig.scratch.root);
    expect(await check()).toBe(1);
  });

  test("★ refuses an author email another face pool in the house carries ★", async () => {
    rig.wear({ index: 1, petname: "Moth" });
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const moth = faceRoot(rig.projections, "Moth");
    git(moth, "config", "--local", "user.email", "HERON-LANTERN@face.invalid");
    rig.at(moth);
    expect(await check()).toBe(1);
    expect(rig.said()).toMatch(/heron-lantern@face\.invalid/i);
    expect(rig.said()).toContain("Heron Lantern");
  });

  test("★ refuses a signing key another face pool in the house carries ★", async () => {
    rig.wear({ index: 1, petname: "Moth" });
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const moth = faceRoot(rig.projections, "Moth");
    git(heron, "config", "--local", "user.signingkey", "ssh-ed25519 AAAAshared");
    git(moth, "config", "--local", "user.signingkey", "ssh-ed25519 AAAAshared");
    rig.at(moth);
    expect(await check()).toBe(1);
    expect(rig.said()).toMatch(/signing key/);
  });

  test("names every breach at once", async () => {
    plant(join(heron, "kahua-index.toml"), "x\n");
    plant(join(heron, "share.tid"), "x\n");
    expect(await check()).toBe(1);
    const said = rig.said();
    expect(said).toContain("kahua-index.toml");
    expect(said).toContain("share.tid");
  });

  test("a folder no repo holds refuses by name", async () => {
    const bare = join(rig.scratch.home, "bare");
    mkdirSync(bare, { recursive: true });
    rig.at(bare);
    expect(await check()).toBe(1);
    expect(rig.said()).toMatch(/no git repository/);
  });

  test("the hook's git env names no other repo: a GIT_DIR inherited from the hook leaves the read on the pool", async () => {
    plant(join(heron, "share.tid"), "x\n");
    const prior = process.env["GIT_DIR"];
    process.env["GIT_DIR"] = join(rig.scratch.home, "elsewhere.git");
    try { expect(await check()).toBe(1); } finally { if (prior === undefined) delete process.env["GIT_DIR"]; else process.env["GIT_DIR"] = prior; }
    expect(rig.said()).toContain("share.tid");
  });
});
