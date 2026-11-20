/**
 * surface-realm — `lares surface` over a REALM pool: one disk copy per shared document (face-pools #/one-copy).
 *
 * A wiki several of the operator's own faces share (a cabal of one) rests ONCE, in its realm's folder, named by the realm's local
 * pet name (operator ruling 2026-11-19): `projections/realms/<realm pet name>/wikis/<slug>/`, or the workspace its share row names.
 * `init --realm <realm pet name>` makes EACH wiki folder the realm holds its own git working tree (`.git` at the folder's top,
 * never one tree over the realm) under the wiki's identity (`<slug> <slug>@realm.invalid`), never a face's; `check` run from one
 * refuses a face root inside it and a repo spanning the realm; an index file, an author naming a face and a remote
 * pass (a pet name binds nothing); `commit --realm <realm pet name>` stages each by the synced base as the face commit does.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { carrierHash, serializeShareFile, type ShareEntry } from "@lararium/mesh";
import { faceRoot, nameRealm, placeInRealm, realmRoot, syncedTreeDir, syncedTreeKey, SyncedTree, writeFaceLabel } from "@lararium/node";
import { cmdSurface, liveSurfaceDoors, type SurfaceDoors } from "../src/commands/surface.js";
import { git, openSurfaceRig, plant, stubLaresOnPath, surfaceArgs, type SurfaceRig } from "./support/surface-rig.js";

const NOTES_BAG = "lar:///ha.ka.ba/wikis/notes/working";
let rig: SurfaceRig;
let notes: string;
let works: string;
let stub: ReturnType<typeof stubLaresOnPath>;

const run = (positional: string[], options: Record<string, string> = {}) => cmdSurface(surfaceArgs(positional, options), rig.doors);
const shares = (rows: ShareEntry[]) => writeFileSync(join(rig.config, "share.tid"), serializeShareFile(rows));

beforeEach(() => {
  rig = openSurfaceRig();
  stub = stubLaresOnPath(0);
  // THE REALM "Garden" holds two wikis; `notes` stands on disk, `works` lays at its first mount.
  nameRealm(rig.projections, "Garden");
  placeInRealm(rig.projections, "Garden", { slug: "notes", id: null });
  placeInRealm(rig.projections, "Garden", { slug: "works", id: null });
  notes = join(realmRoot(rig.projections, "Garden"), "wikis", "notes");
  works = join(realmRoot(rig.projections, "Garden"), "wikis", "works");
  mkdirSync(notes, { recursive: true });
});
afterEach(() => { stub.restore(); rig.close(); });

describe("lares surface init --realm", () => {
  test("★ makes the realm's standing wiki folder a pool under the wiki's identity, and a second run says already ★", async () => {
    expect(await run(["init"], { realm: "Garden" })).toBe(0);
    expect(statSync(join(notes, ".git")).mode & 0o777).toBe(0o700);
    expect(git(notes, "config", "--local", "user.name").out.trim()).toBe("notes");
    expect(git(notes, "config", "--local", "user.email").out.trim()).toBe("notes@realm.invalid");
    expect(git(notes, "config", "--local", "commit.gpgsign").out.trim()).toBe("false");
    const exclude = readFileSync(join(notes, ".git", "info", "exclude"), "utf8");
    for (const line of [".shore/", "temp/", "*.orphans/", "/recovery/", "/temp/"]) expect(exclude.split("\n"), line).toContain(line);
    expect(readFileSync(join(notes, ".git", "hooks", "pre-commit"), "utf8")).toMatch(/exec lares surface check/);
    expect(existsSync(join(rig.projections, "faces"))).toBe(false);

    expect(await cmdSurface(surfaceArgs(["init"], { realm: "Garden" }, { json: true }), rig.doors)).toBe(0);
    expect(rig.said()).toMatch(/"already":\s*true/);
  });

  test("★ a realm with two wikis: each wiki folder takes its own tree, never one over the realm ★", async () => {
    mkdirSync(works, { recursive: true });
    expect(await run(["init"], { realm: "Garden" })).toBe(0);
    for (const [dir, slug] of [[notes, "notes"], [works, "works"]] as const) {
      expect(existsSync(join(dir, ".git", "HEAD")), slug).toBe(true);
      expect(git(dir, "config", "--local", "user.email").out.trim()).toBe(`${slug}@realm.invalid`);
    }
    expect(existsSync(join(realmRoot(rig.projections, "Garden"), ".git"))).toBe(false);
    expect(existsSync(join(realmRoot(rig.projections, "Garden"), "wikis", ".git"))).toBe(false);
    // A repo spanning the realm refuses.
    git(realmRoot(rig.projections, "Garden"), "init", "-q");
    rig.at(realmRoot(rig.projections, "Garden"));
    expect(await run(["check"])).toBe(1);
    expect(rig.said()).toMatch(/surface-realm-tree/);
  });

  test("a wiki whose folder stands nowhere yet is named and left; the standing one still inits", async () => {
    expect(await cmdSurface(surfaceArgs(["init"], { realm: "Garden" }, { json: true }), rig.doors)).toBe(0);
    expect(rig.said()).toMatch(/"unlaid":\s*\["works"\]/);
    expect(existsSync(works)).toBe(false);
  });

  test("a share row naming a workspace: the pool rests in that workspace, not under the realm's folder", async () => {
    const ws = join(rig.scratch.root, "workspaces", "works-bench");
    mkdirSync(ws, { recursive: true });
    shares([{ slug: "works", kind: "wiki", read: "[[Heron Lantern]]", write: "[[Heron Lantern]]", workspace: "works-bench" }]);
    expect(await run(["init"], { realm: "Garden" })).toBe(0);
    expect(existsSync(join(ws, ".git", "HEAD"))).toBe(true);
    expect(existsSync(works)).toBe(false);
    expect(git(ws, "config", "--local", "user.email").out.trim()).toBe("works@realm.invalid");
  });

  test("refuses a realm no label names, and one whose wikis all stand nowhere, by name, making nothing", async () => {
    expect(await run(["init"], { realm: "Elsewhere" })).toBe(1);
    expect(rig.said()).toMatch(/surface-realm-unnamed/);
    nameRealm(rig.projections, "Forge");
    placeInRealm(rig.projections, "Forge", { slug: "lore", id: null });
    expect(await run(["init"], { realm: "Forge" })).toBe(1);
    expect(rig.said()).toMatch(/surface-realm-unlaid/);
    expect(existsSync(realmRoot(rig.projections, "Forge"))).toBe(false);
  });

  test("a malformed pet name, or --realm beside --face, refuses as usage", async () => {
    expect(await run(["init"], { realm: "../faces" })).toBe(2);
    expect(await run(["init"], { realm: "Garden", face: "0" })).toBe(2);
    expect(existsSync(join(notes, ".git"))).toBe(false);
  });
});

describe("lares surface check, from a realm pool", () => {
  beforeEach(async () => {
    expect(await run(["init"])).toBe(0); // the worn face's pool: Heron Lantern
    expect(await run(["init"], { realm: "Garden" })).toBe(0);
    rig.at(notes);
  });

  test("CONTROL: a freshly inited realm pool passes, from its top, from a folder inside it, and by --realm", async () => {
    expect(await run(["check"])).toBe(0);
    mkdirSync(join(notes, "Journal"), { recursive: true });
    rig.at(join(notes, "Journal"));
    expect(await run(["check"])).toBe(0);
    rig.at(rig.scratch.root);
    expect(await run(["check"], { realm: "Garden" })).toBe(0);
  });

  test.each(["kahua-index.toml", "share.tid", "kahua-pending.json", "face-labels/abc.json"])("★ a realm pool top holding the pet-name map %s passes ★", async (name) => {
    plant(join(notes, name), "x\n");
    expect(await run(["check"])).toBe(0);
  });

  test("★ refuses a face root inside the realm pool ★", async () => {
    plant(join(notes, "faces", "Moth", "wiki", "Room.tid"), "title: Room\n\nx\n");
    expect(await run(["check"])).toBe(1);
    expect(rig.said()).toMatch(/surface-realm-face-root/);
  });

  test("★ an author naming a face's pet name, or at face.invalid, passes with a remote: a pet name binds nothing ★", async () => {
    git(notes, "config", "--local", "user.name", "Heron Lantern");
    git(notes, "config", "--local", "user.email", "heron-lantern@face.invalid");
    git(notes, "remote", "add", "origin", "git@example.invalid:notes.git");
    expect(await run(["check"])).toBe(0);
  });

  test("★ a remote passes on a realm no share row opens past the house, and on a cabal of one's ★", async () => {
    git(notes, "remote", "add", "origin", "git@example.invalid:notes.git");
    expect(await run(["check"])).toBe(0);
    rig.wear({ index: 1, petname: "Moth" });
    expect(await run(["init"])).toBe(0);
    shares([{ slug: "notes", kind: "wiki", read: "[[Heron Lantern]] *", write: "Moth" }]);
    expect(await run(["check"])).toBe(0);
    shares([{ slug: "notes", kind: "wiki", read: "[[Heron Lantern]] Stranger", write: "[[Heron Lantern]]" }]);
    expect(await run(["check"])).toBe(0);
  });

  test("CONTROL: the face pool's own check still passes beside the realm pool", async () => {
    rig.at(faceRoot(rig.projections, "Heron Lantern"));
    expect(await run(["check"])).toBe(0);
  });
});

describe("lares surface commit --realm", () => {
  beforeEach(async () => {
    expect(await run(["init"])).toBe(0);
    expect(await run(["init"], { realm: "Garden" })).toBe(0);
  });

  test("★ stages by the synced base, under the realm's author and a subject naming no face ★", async () => {
    const agreed = plant(join(notes, "Journal.tid"), "title: Journal\n\nday one\n");
    const drifted = plant(join(notes, "Drifted.tid"), "title: Drifted\n\nhand edit\n");
    const hash = (t: string) => carrierHash(t, undefined);
    rig.tree.set(syncedTreeKey(NOTES_BAG, "Journal"), resolve(agreed), hash("title: Journal\n\nday one\n"), hash("title: Journal\n\nday one\n"));
    rig.tree.set(syncedTreeKey(NOTES_BAG, "Drifted"), resolve(drifted), hash("house words\n"), hash("house words\n"));
    expect(await run(["commit"], { realm: "Garden" })).toBe(0);
    expect(git(notes, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("Journal.tid");
    expect(git(notes, "status", "--porcelain").out).toContain("?? Drifted.tid");
    const message = git(notes, "log", "-1", "--format=%an <%ae>%n%B").out;
    expect(message).toContain("notes <notes@realm.invalid>");
    expect(message).toContain("lar:///surface.keeps.the-sitting/by-hand — 1 carriers");
    expect(message).not.toMatch(/Heron|face\.invalid/);
    expect(readFileSync(stub.seen, "utf8")).toContain("surface check");
  });

  test("a realm wiki folder standing with no pool refuses by name", async () => {
    mkdirSync(works, { recursive: true });
    expect(await run(["commit"], { realm: "Garden" })).toBe(1);
    expect(rig.said()).toMatch(/surface-no-pool/);
  });
});

// ── the host route: no LAR_ROOT, LARES_HOUSE from the env file ──────────────────────────────────────────

describe("realm pools on the host", () => {
  let house: string;
  let env: Record<string, string | undefined>;
  let envFile: string;
  const hostDoors = (at?: string): SurfaceDoors => {
    const doors = liveSurfaceDoors(env, () => ({ code: 1, out: "" }));
    return { ...doors, cwd: () => at ?? house };
  };
  beforeEach(() => {
    house = rig.scratch.root;
    const home = join(rig.scratch.home, "host-home");
    mkdirSync(join(home, ".lares"), { recursive: true });
    envFile = join(home, ".lares", "lares-surface.env");
    writeFileSync(envFile, `LARES_HOUSE=${house}\n`);
    env = { HOME: home, PATH: process.env["PATH"] };
    writeFaceLabel({ relation: "11111111-2222-4333-8444-555555555555", petname: "Heron Lantern", handleIndex: 0 }, join(house, "projections"));
  });

  test("★ init, check and commit --realm read the host's house, the bases spelled under /lar/projections ★", async () => {
    expect(await cmdSurface(surfaceArgs(["init"], { realm: "Garden" }), hostDoors())).toBe(0);
    expect(git(notes, "config", "--local", "user.email").out.trim()).toBe("notes@realm.invalid");
    expect(await cmdSurface(surfaceArgs(["check"]), hostDoors(notes))).toBe(0);
    const tree = new SyncedTree(syncedTreeDir(join(house, "hearth", "checkpoints", "projection")));
    const text = "title: Journal\n\nday one\n";
    plant(join(notes, "Journal.tid"), text);
    tree.set(syncedTreeKey(NOTES_BAG, "Journal"), "/lar/projections/realms/Garden/wikis/notes/Journal.tid", carrierHash(text, undefined), carrierHash(text, undefined));
    expect(await cmdSurface(surfaceArgs(["commit"], { realm: "Garden" }), hostDoors())).toBe(0);
    expect(git(notes, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("Journal.tid");
  });

  test("★ a share row's workspace resolves through LARES_WORKSPACES, its bases spelled under /lar/workspaces ★", async () => {
    const ws = join(rig.scratch.home, "works-clone");
    mkdirSync(ws, { recursive: true });
    writeFileSync(envFile, `LARES_HOUSE=${house}\nLARES_WORKSPACES=works-bench=${ws}\n`);
    shares([{ slug: "works", kind: "wiki", read: "[[Heron Lantern]]", write: "[[Heron Lantern]]", workspace: "works-bench" }]);
    expect(await cmdSurface(surfaceArgs(["init"], { realm: "Garden" }), hostDoors())).toBe(0);
    expect(existsSync(join(ws, ".git", "HEAD"))).toBe(true);
    expect(await cmdSurface(surfaceArgs(["check"]), hostDoors(ws))).toBe(0);
    const tree = new SyncedTree(syncedTreeDir(join(house, "hearth", "checkpoints", "projection")));
    const text = "title: Draft\n\nbody\n";
    plant(join(ws, "Draft.tid"), text);
    tree.set(syncedTreeKey("lar:///ha.ka.ba/wikis/works/working", "Draft"), "/lar/workspaces/works-bench/Draft.tid", carrierHash(text, undefined), carrierHash(text, undefined));
    expect(await cmdSurface(surfaceArgs(["commit"], { realm: "Garden" }), hostDoors())).toBe(0);
    expect(git(ws, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("Draft.tid");
  });
});
