/**
 * surface-init — `lares surface init` makes the worn (or named) face's root a git working tree, once.
 *
 * Witnessed on a scratch house: `.git` stands inside `projections/faces/<pet name>/` at 0700; `.git/info/exclude` carries
 * the house's one ignore list (`HOUSE_IGNORED`, a personal layer's view state among it) and never the pointer carriers
 * (`.meta`, `.kapae`, `.mem`, `.tid`); the
 * author reads `<pet name> <slug>@face.invalid` from LOCAL config with signing off, and nothing reaches a global config;
 * a pre-commit hook runs `lares surface check`; a second init changes nothing and says "already".
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { faceRoot, houseExcludeLines, HOUSE_IGNORED } from "@lararium/node";
import { cmdSurface, faceEmailSlug } from "../src/commands/surface.js";
import { git, openSurfaceRig, plant, surfaceArgs, type SurfaceRig } from "./support/surface-rig.js";

let rig: SurfaceRig;
beforeEach(() => { rig = openSurfaceRig(); });
afterEach(() => { rig.close(); });

describe("lares surface init", () => {
  test("★ makes the worn face's root a repo: .git at 0700, local author, signing off, the pool-check hook ★", async () => {
    const root = faceRoot(rig.projections, "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    expect(statSync(join(root, ".git")).isDirectory()).toBe(true);
    expect(statSync(join(root, ".git")).mode & 0o777).toBe(0o700);
    expect(git(root, "config", "--local", "--get", "user.name").out.trim()).toBe("Heron Lantern");
    expect(git(root, "config", "--local", "--get", "user.email").out.trim()).toBe("heron-lantern@face.invalid");
    expect(git(root, "config", "--local", "--get", "commit.gpgsign").out.trim()).toBe("false");
    const hook = join(root, ".git", "hooks", "pre-commit");
    expect(readFileSync(hook, "utf8")).toMatch(/lares surface check/);
    expect(statSync(hook).mode & 0o111).not.toBe(0);
  });

  test("never writes a global config: the scratch's global file stays absent and git ran with none", async () => {
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    expect(existsSync(join(rig.scratch.home, ".gitconfig"))).toBe(false);
    expect(existsSync(join(rig.scratch.root, ".gitconfig"))).toBe(false);
  });

  test("--face N inits the named face's root", async () => {
    rig.wear({ index: 2, petname: "Moth" });
    expect(await cmdSurface(surfaceArgs(["init"], { face: "2" }), rig.doors)).toBe(0);
    expect(existsSync(join(faceRoot(rig.projections, "Moth"), ".git"))).toBe(true);
  });

  test("★ the exclude rules come from HOUSE_IGNORED, and every pointer carrier stays committable ★", async () => {
    const root = faceRoot(rig.projections, "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const exclude = readFileSync(join(root, ".git", "info", "exclude"), "utf8");
    for (const line of houseExcludeLines()) expect(exclude).toContain(line);
    for (const dir of HOUSE_IGNORED.topDirs.filter((d) => d !== ".git")) expect(exclude).toContain(`${dir}/`);
    plant(join(root, "wiki", "Room 4.tid"), "title: Room 4\n\nbody\n");
    plant(join(root, "wiki", "Room 4.tid.meta"), "tags: x\n");
    plant(join(root, "canon", "note.mem"), "a meme\n");
    plant(join(root, "wiki", "gone.kapae"), "kapae\n");
    plant(join(root, "wiki", "temp", "scratch.tid"), "temp\n");
    plant(join(root, "wiki", "family.orphans", "slot.mem"), "orphan\n");
    plant(join(root, "wiki", `Room 4.tid.${process.pid}.tmp`), "atomic\n");
    plant(join(root, "wiki", `Room 4.tid.${process.pid}.0123abcd-0123-4567-89ab-0123456789ab.tmp`), "atomic\n");
    plant(join(root, "personal", "lares", "$__StoryList.tid"), "title: $:/StoryList\n\n");
    plant(join(root, "personal", "lares", "$__HistoryList.tid"), "title: $:/HistoryList\n\n");
    plant(join(root, "personal", "lares", "$__state_folded_Room 4.tid"), "title: $:/state/folded/Room 4\n\n");
    plant(join(root, "canon", "$__config_lares_ProjectionFilter.tid"), "title: $:/config/lares/ProjectionFilter\n\n");
    const listed = git(root, "ls-files", "--others", "--exclude-standard").out.split("\n").filter(Boolean).sort();
    expect(listed).toEqual(["canon/$__config_lares_ProjectionFilter.tid", "canon/note.mem", "wiki/Room 4.tid", "wiki/Room 4.tid.meta", "wiki/gone.kapae"]);
  });

  test("★ a second init changes nothing and says already ★", async () => {
    const root = faceRoot(rig.projections, "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const before = ["info/exclude", "config", "hooks/pre-commit"].map((p) => readFileSync(join(root, ".git", p), "utf8"));
    const said = rig.said().length;
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    expect(rig.said().slice(said)).toMatch(/already/);
    expect(["info/exclude", "config", "hooks/pre-commit"].map((p) => readFileSync(join(root, ".git", p), "utf8"))).toEqual(before);
  });

  test("an init over a repo that drifted mends only what drifted, and keeps the operator's own exclude lines", async () => {
    const root = faceRoot(rig.projections, "Heron Lantern");
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    const exclude = join(root, ".git", "info", "exclude");
    writeFileSync(exclude, readFileSync(exclude, "utf8") + "my-own-notes/\n");
    git(root, "config", "--local", "user.email", "someone@example.com");
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    expect(git(root, "config", "--local", "--get", "user.email").out.trim()).toBe("heron-lantern@face.invalid");
    expect(readFileSync(exclude, "utf8")).toContain("my-own-notes/");
    expect(rig.said()).toMatch(/user\.email/);
  });

  test("a pre-commit hook of another hand stands where it stood, named", async () => {
    const root = faceRoot(rig.projections, "Heron Lantern");
    mkdirSync(join(root, ".git", "hooks"), { recursive: true });
    git(root, "init", "-q");
    writeFileSync(join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho mine\n", { mode: 0o755 });
    expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
    expect(readFileSync(join(root, ".git", "hooks", "pre-commit"), "utf8")).toBe("#!/bin/sh\necho mine\n");
    expect(rig.said()).toMatch(/pre-commit/);
  });
});

describe("the face's author email slug", () => {
  test("folds case, spaces and marks; a name with no Latin letters takes a stable digest", () => {
    expect(faceEmailSlug("Heron Lantern")).toBe("heron-lantern");
    expect(faceEmailSlug("Kōlea")).toBe("kolea");
    expect(faceEmailSlug("  Moth!! ")).toBe("moth");
    const kana = faceEmailSlug("ほたる");
    expect(kana).toMatch(/^face-[0-9a-f]{8}$/);
    expect(faceEmailSlug("ほたる")).toBe(kana);
    expect(faceEmailSlug("かえる")).not.toBe(kana);
  });
});
