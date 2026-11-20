/**
 * surface-host — `lares surface` runs where the face pools rest: on the host of a containerized house.
 *
 * The operator's host shell names no LAR_ROOT; `~/.lares/lares-surface.env` names LARES_HOUSE, whose projections the
 * vessel reads at /lar/projections. `surface` stays on the host there: `open` prints (and launches) host paths, the
 * pre-commit hook's `lares surface check` runs host-side from the pool with no vessel, and `commit` stages by the synced
 * base the vessel recorded under its own spelling (/lar/projections/...). The vessel answers only the face lookup, and a
 * face the labels on disk already name asks it nothing. A house whose LAR_ROOT names the root keeps today's doors.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { carrierHash } from "@lararium/mesh";
import { ensureRealmLabel, faceRoot, syncedTreeDir, syncedTreeKey, SyncedTree, writeFaceLabel } from "@lararium/node";
import { cmdSurface, liveSurfaceDoors, surfaceHouse, vesselSpelling, type SurfaceDoors } from "../src/commands/surface.js";
import { commandScope, decideRoute } from "../src/host-bridge.js";
import { git, openSurfaceRig, plant, surfaceArgs, type SurfaceRig } from "./support/surface-rig.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "bin", "lares.mjs");
const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
const HERON = "11111111-2222-4333-8444-555555555555";
const OWL = "66666666-7777-4888-9999-aaaaaaaaaaaa";

let rig: SurfaceRig;
/** The host's house root (LARES_HOUSE), the host's HOME, and the env the host shell carries: no LAR_ROOT. */
let house: string;
let home: string;
let env: Record<string, string | undefined>;
let asked: string[][];
const ask = (answer: { code: number; out: string }) => (argv: readonly string[]) => { asked.push([...argv]); return answer; };
const refuseAsk = ask({ code: 1, out: "" });

beforeEach(() => {
  rig = openSurfaceRig();
  house = rig.scratch.root;
  home = join(rig.scratch.home, "host-home");
  mkdirSync(join(home, ".lares"), { recursive: true });
  writeFileSync(join(home, ".lares", "lares-surface.env"), `LARES_HOUSE=${house}\nLARES_WORKSPACE=/w\n`);
  env = { HOME: home, PATH: process.env["PATH"] };
  asked = [];
  writeFaceLabel({ relation: HERON, petname: "Heron Lantern", handleIndex: 0 }, join(house, "projections"));
});
afterEach(() => { rig.close(); });

/** The host doors, the working directory and launch recorded. */
function hostDoors(answer = refuseAsk, at?: string): SurfaceDoors {
  const doors = liveSurfaceDoors(env, answer);
  return { ...doors, cwd: () => at ?? house, launch: (argv) => { rig.launched.push([...argv]); return 0; } };
}

describe("where `lares surface` finds its house", () => {
  test("★ no LAR_ROOT and the env file naming LARES_HOUSE: the host house, its projections on this disk ★", () => {
    expect(surfaceHouse(env)).toEqual({ kind: "host", house });
    const doors = liveSurfaceDoors(env, refuseAsk);
    expect(doors.projections()).toBe(join(house, "projections"));
    expect(doors.config()).toBe(join(house, "config"));
  });

  test("LAR_ROOT names the root (a dev or scratch house, the vessel itself): today's doors", () => {
    expect(surfaceHouse({ ...env, LAR_ROOT: house })).toEqual({ kind: "root" });
    expect(surfaceHouse({ LAR_ROOT: "/lar", LARES_IN_CONTAINER: "1" })).toEqual({ kind: "root" });
  });

  test("neither a root nor a container house: refuses by name", async () => {
    const bare = { HOME: join(rig.scratch.home, "nobody") };
    expect(() => surfaceHouse(bare)).toThrow(/surface-house-unnamed/);
    expect(await cmdSurface(surfaceArgs(["open"]), liveSurfaceDoors(bare, refuseAsk))).toBe(1);
    expect(rig.said()).toMatch(/surface-house-unnamed/);
  });

  test("★ the route keeps `surface` on the host: no LAR_ROOT, the container house standing, nothing forwards ★", () => {
    const shim = "/checkout/tools/lares-container.sh";
    const envFile = join(home, ".lares", "lares-surface.env");
    for (const argv of [["surface", "check"], ["surface", "open", "--launch"], ["surface", "commit", "-m", "x"], ["surface", "init", "--face", "1"]]) {
      expect(decideRoute({ argv, env, fsProbe: { exists: (p) => p === envFile || p === shim }, tty: false, shim, commands: ["surface"] }), argv.join(" ")).toBe("local");
    }
    expect(commandScope("surface")).toBe("host");
  });
});

describe("the face, as the host reads it", () => {
  test("★ the labels on disk name the face: the vessel is asked nothing ★", async () => {
    const doors = hostDoors();
    expect(await doors.face(surfaceArgs(["open"]))).toEqual({ index: 0, petname: "Heron Lantern" });
    expect(await doors.face(surfaceArgs(["open"], { face: "0" }))).toEqual({ index: 0, petname: "Heron Lantern" });
    expect(asked).toEqual([]);
  });

  test("several faces labelled and none named: the vessel resolves it through the forwarded door", async () => {
    writeFaceLabel({ relation: OWL, petname: "Owl Ember", handleIndex: 1 }, join(house, "projections"));
    const doors = hostDoors(ask({ code: 0, out: `${JSON.stringify({ ok: true, data: { face: 1, petname: "Owl Ember" } })}\n` }));
    expect(await doors.face(surfaceArgs(["open"]))).toEqual({ index: 1, petname: "Owl Ember" });
    expect(asked).toEqual([["surface", "face", "--json"]]);
    expect(await doors.face(surfaceArgs(["open"], { face: "1" }))).toEqual({ index: 1, petname: "Owl Ember" });
    expect(asked).toHaveLength(1);
  });

  test("a face no label names, with the vessel down: refuses by name", async () => {
    expect(await cmdSurface(surfaceArgs(["open"], { face: "2" }), hostDoors())).toBe(1);
    expect(asked).toEqual([["surface", "face", "--json", "--face", "2"]]);
    expect(rig.said()).toMatch(/surface-face-unanswered/);
  });
});

describe("lares surface open, on the host", () => {
  test("★ prints the host paths under LARES_HOUSE, and --launch runs `code` here ★", async () => {
    const root = faceRoot(join(house, "projections"), "Heron Lantern");
    mkdirSync(join(root, "personal", "lore"), { recursive: true });
    ensureRealmLabel(join(house, "projections"), "lore", null);
    mkdirSync(join(house, "projections", "realms", "lore", "wikis", "lore"), { recursive: true });
    expect(await cmdSurface(surfaceArgs(["open"]), hostDoors())).toBe(0);
    expect(rig.said()).toContain(`code -n '${root}' ${join(house, "projections", "realms", "lore", "wikis", "lore")}`);
    expect(rig.said()).not.toContain("/lar/");
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), hostDoors())).toBe(0);
    expect(rig.launched).toEqual([["code", "-n", root, join(house, "projections", "realms", "lore", "wikis", "lore")]]);
  });
});

describe("lares surface commit, on the host", () => {
  test("★ stages by the synced base the vessel spelled under /lar, read off the host's hearth ★", async () => {
    const root = faceRoot(join(house, "projections"), "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), hostDoors())).toBe(0);
    // Hand-made hooks stay out of this test: the hook's own run reads below.
    writeFileSync(join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
    const tree = new SyncedTree(syncedTreeDir(join(house, "hearth", "checkpoints", "projection")));
    const agreed = plant(join(root, "wiki", "Room 4.tid"), "title: Room 4\n\nbody\n");
    const drifted = plant(join(root, "wiki", "Drifted.tid"), "title: Drifted\n\nhand edit\n");
    const hash = (t: string) => carrierHash(t, undefined);
    expect(vesselSpelling(house, agreed)).toBe("/lar/projections/faces/Heron Lantern/wiki/Room 4.tid");
    tree.set(syncedTreeKey(BAG, "Room 4"), vesselSpelling(house, agreed), hash("title: Room 4\n\nbody\n"), hash("title: Room 4\n\nbody\n"));
    tree.set(syncedTreeKey(BAG, "Drifted"), vesselSpelling(house, drifted), hash("house words\n"), hash("house words\n"));
    expect(await cmdSurface(surfaceArgs(["commit"]), hostDoors())).toBe(0);
    expect(git(root, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("wiki/Room 4.tid");
    expect(git(root, "status", "--porcelain").out).toContain("?? wiki/Drifted.tid");
    expect(asked).toEqual([]);
  });
});

// ── the hook, run by git on the host, through the built `lares` ─────────────────────────────────────────

const built = existsSync(join(HERE, "..", "dist", "src", "commands", "surface.js"));

describe.skipIf(!built)("the pre-commit hook on the host", () => {
  test("★ git runs the hook in the pool, `lares surface check` answers host-side with no LAR_ROOT and no vessel ★", async () => {
    const root = faceRoot(join(house, "projections"), "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), hostDoors())).toBe(0);
    expect(readFileSync(join(root, ".git", "hooks", "pre-commit"), "utf8")).toMatch(/lares surface check/);
    // The host's `lares`: the checkout's bin, as ~/.local/bin/lares links it. No docker stands on this PATH.
    const bin = join(rig.scratch.home, "host-bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "lares"), `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`);
    chmodSync(join(bin, "lares"), 0o755);
    const hostEnv: Record<string, string> = { HOME: home, PATH: `${bin}:/usr/bin:/bin`, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
    const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: root, env: hostEnv, encoding: "utf8" });

    const direct = run("lares", ["surface", "check", "--no-json"]);
    expect(direct.status, direct.stderr).toBe(0);
    expect(direct.stdout).toContain(resolve(root));

    plant(join(root, "wiki", "Room 4.tid"), "title: Room 4\n\nbody\n");
    expect(run("git", ["add", "-A"]).status).toBe(0);
    const clean = run("git", ["commit", "-q", "-m", "a sitting"]);
    expect(clean.status, clean.stderr).toBe(0);

    // A pet-name map passes: a pet name binds nothing.
    plant(join(root, "share.tid"), "x\n");
    expect(run("git", ["add", "-A"]).status).toBe(0);
    const mapped = run("git", ["commit", "-q", "-m", "an index file"]);
    expect(mapped.status, mapped.stderr).toBe(0);

    // A signing key another face pool carries refuses: a signing key is a crypto identity.
    const moth = join(root, "..", "Moth");
    mkdirSync(moth, { recursive: true });
    expect(run("git", ["-C", moth, "init", "-q"]).status).toBe(0);
    expect(run("git", ["config", "--local", "user.signingkey", "ssh-ed25519 AAAAshared"]).status).toBe(0);
    expect(run("git", ["-C", moth, "config", "--local", "user.signingkey", "ssh-ed25519 AAAAshared"]).status).toBe(0);
    plant(join(root, "wiki", "Room 5.tid"), "title: Room 5\n\nbody\n");
    expect(run("git", ["add", "-A"]).status).toBe(0);
    const refused = run("git", ["commit", "-q", "-m", "a shared key"]);
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toMatch(/signing key/);
    expect(refused.stderr).not.toMatch(/LAR_ROOT names no house root|no house root/);
  });
});
