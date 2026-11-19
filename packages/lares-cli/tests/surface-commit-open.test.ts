/**
 * surface-commit-open — `lares surface commit` keeps the sitting, and `lares surface open` names the window.
 *
 * commit stages only the paths whose disk bytes equal the synced base (the house already agrees with them); a path that
 * stands off reads apart by name and stays unstaged; the subject reads `lar:///surface.keeps.the-sitting/<seam> — N
 * carriers` and names no face, the carrier URIs ride the body, the author comes from the pool's local config, and nothing
 * pushes. open prints `code -n <face root> <realm pools>` (and runs it under --launch) and writes no workspace file.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { ensureRealmLabel, faceRoot, syncedTreeKey } from "@lararium/node";
import { cmdSurface } from "../src/commands/surface.js";
import { git, openSurfaceRig, plant, stubLaresOnPath, surfaceArgs, type SurfaceRig } from "./support/surface-rig.js";

const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
let rig: SurfaceRig;
let heron: string;
let stub: ReturnType<typeof stubLaresOnPath>;

/** Plant a carrier (and its `.meta`) and record the base the house agreed on, over the bytes `agreed` (the planted ones by default). */
function carrier(rel: string, uri: string, text: string, opts: { meta?: string; agreed?: string } = {}): string {
  const file = plant(join(heron, rel), text);
  if (opts.meta !== undefined) plant(`${file}.meta`, opts.meta);
  const hash = carrierHash(opts.agreed ?? text, opts.meta);
  rig.tree.set(syncedTreeKey(BAG, uri), resolve(file), hash, hash);
  return file;
}

const commit = (positional: string[] = []) => cmdSurface(surfaceArgs(["commit", ...positional]), rig.doors);
const lastMessage = () => git(heron, "log", "-1", "--format=%B").out;

beforeEach(async () => {
  rig = openSurfaceRig();
  heron = faceRoot(rig.projections, "Heron Lantern");
  stub = stubLaresOnPath(0);
  expect(await cmdSurface(surfaceArgs(["init"]), rig.doors)).toBe(0);
});
afterEach(() => { stub.restore(); rig.close(); });

describe("lares surface commit", () => {
  test("★ stages only what the house agrees with; a stand-off reads apart by name and stays unstaged ★", async () => {
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n", { meta: "tags: x\n" });
    carrier("canon/note.mem", "lar:///ha.ka.ba/notes/one", "a meme\n");
    carrier("wiki/Drifted.tid", "Drifted", "title: Drifted\n\nhand edit\n", { agreed: "title: Drifted\n\nhouse words\n" });
    plant(join(heron, "wiki", "Stranger.tid"), "title: Stranger\n\nno base\n");
    expect(await commit()).toBe(0);
    const files = git(heron, "show", "--name-only", "--format=", "HEAD").out.split("\n").filter(Boolean).sort();
    expect(files).toEqual(["canon/note.mem", "wiki/Room 4.tid", "wiki/Room 4.tid.meta"]);
    const status = git(heron, "status", "--porcelain").out;
    expect(status).toContain("?? wiki/Drifted.tid");
    expect(status).toContain("?? wiki/Stranger.tid");
    expect(rig.said()).toContain("wiki/Drifted.tid");
    expect(rig.said()).toContain("wiki/Stranger.tid");
  });

  test("★ the subject names the seam and the count, never the face; the carrier URIs ride the body ★", async () => {
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    carrier("canon/note.mem", "lar:///ha.ka.ba/notes/one", "a meme\n");
    expect(await commit()).toBe(0);
    const message = lastMessage();
    const [subject] = message.split("\n");
    expect(subject).toBe("lar:///surface.keeps.the-sitting/by-hand — 2 carriers");
    expect(subject).not.toMatch(/heron/i);
    expect(message).toContain("Room 4");
    expect(message).toContain("lar:///ha.ka.ba/notes/one");
  });

  test("-m names the seam; a seam that names no slug refuses before anything stages", async () => {
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    expect(await commit(["-m", "Not A Slug"])).toBe(2);
    expect(git(heron, "rev-parse", "--verify", "-q", "HEAD").code).not.toBe(0);
    expect(await commit(["-m", "sitting-close"])).toBe(0);
    expect(lastMessage().split("\n")[0]).toBe("lar:///surface.keeps.the-sitting/sitting-close — 1 carriers");
  });

  test("★ the author comes from the pool's local config ★", async () => {
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    const prior = { n: process.env["GIT_AUTHOR_NAME"], e: process.env["GIT_AUTHOR_EMAIL"] };
    process.env["GIT_AUTHOR_NAME"] = "Ambient Person";
    process.env["GIT_AUTHOR_EMAIL"] = "ambient@example.com";
    try { expect(await commit()).toBe(0); }
    finally {
      if (prior.n === undefined) delete process.env["GIT_AUTHOR_NAME"]; else process.env["GIT_AUTHOR_NAME"] = prior.n;
      if (prior.e === undefined) delete process.env["GIT_AUTHOR_EMAIL"]; else process.env["GIT_AUTHOR_EMAIL"] = prior.e;
    }
    expect(git(heron, "log", "-1", "--format=%an <%ae>").out.trim()).toBe("Heron Lantern <heron-lantern@face.invalid>");
  });

  test("nothing the house agrees with commits nothing, and says so", async () => {
    carrier("wiki/Drifted.tid", "Drifted", "title: Drifted\n\nhand edit\n", { agreed: "title: Drifted\n\nhouse words\n" });
    expect(await commit()).toBe(0);
    expect(git(heron, "rev-parse", "--verify", "-q", "HEAD").code).not.toBe(0);
    expect(rig.said()).toMatch(/nothing/);
  });

  test("a removal the house already made stages; a file vanished where a base still stands stays apart", async () => {
    const kept = carrier("wiki/Kept.tid", "Kept", "title: Kept\n\nk\n");
    const left = carrier("wiki/Left.tid", "Left", "title: Left\n\nl\n");
    expect(await commit()).toBe(0);
    rmSync(kept);                                            // vanished by hand: its base stands, so the shore holds it
    rmSync(left);
    rig.tree.deleteAt(syncedTreeKey(BAG, "Left"), resolve(left)); // removed by the projector: no base stands
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-status", "--format=", "HEAD").out.trim()).toBe("D\twiki/Left.tid");
    expect(git(heron, "status", "--porcelain").out).toContain(" D wiki/Kept.tid");
    expect(rig.said()).toContain("wiki/Kept.tid");
  });

  test("a path the operator staged by hand that stands off stays out of the commit", async () => {
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    plant(join(heron, "wiki", "Hand.tid"), "title: Hand\n\nby hand\n");
    git(heron, "add", "wiki/Hand.tid");
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-only", "--format=", "HEAD").out.split("\n").filter(Boolean)).toEqual(["wiki/Room 4.tid"]);
    expect(git(heron, "status", "--porcelain").out).toContain("A  wiki/Hand.tid");
  });

  test("★ never pushes: a remote standing beside the pool receives nothing ★", async () => {
    const remote = join(rig.scratch.home, "remote.git");
    git(rig.scratch.home, "init", "-q", "--bare", remote);
    git(heron, "remote", "add", "origin", remote);
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    expect(await commit()).toBe(0);
    expect(git(remote, "for-each-ref").out.trim()).toBe("");
  });

  test("the pre-commit hook runs the roster check, and a refusing check commits nothing", async () => {
    stub.restore();
    stub = stubLaresOnPath(1);
    carrier("wiki/Room 4.tid", "Room 4", "title: Room 4\n\nbody\n");
    expect(await commit()).toBe(1);
    expect(readFileSync(stub.seen, "utf8")).toContain("surface check");
    expect(git(heron, "rev-parse", "--verify", "-q", "HEAD").code).not.toBe(0);
  });

  test("a binary carrier compares as the gesture reads it (base64), so an untouched image stages", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x01]);
    const file = join(heron, "wiki", "pic.png");
    plant(file, "");
    writeFileSync(file, bytes);
    const hash = carrierHash(bytes.toString("base64"), undefined);
    rig.tree.set(syncedTreeKey(BAG, "pic.png"), resolve(file), hash, hash);
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("wiki/pic.png");
  });
});

describe("lares surface open", () => {
  test("★ prints `code -n` over the worn face's root and the realm pools it belongs to, and writes no workspace file ★", async () => {
    plant(join(heron, "margins", "garden", "Mine.tid"), "title: Mine\n\nm\n");
    ensureRealmLabel(rig.projections, "garden", null);   // the realm's default pet name: its slug
    plant(join(rig.projections, "realms", "garden", "wikis", "garden", "Shared.tid"), "title: Shared\n\ns\n");
    plant(join(heron, "margins", "unwoven", "x.tid"), "x\n");    // a margin whose realm pool stands nowhere names no root
    const before = readdirSync(heron).sort();
    expect(await cmdSurface(surfaceArgs(["open"]), rig.doors)).toBe(0);
    const said = rig.said();
    expect(said).toContain("code -n");
    expect(said).toContain(heron);
    expect(said).toContain(join(rig.projections, "realms", "garden", "wikis", "garden"));
    expect(said).not.toContain("unwoven");
    expect(rig.launched).toEqual([]);
    expect(readdirSync(heron).sort()).toEqual(before);
    expect(readdirSync(rig.projections).some((n) => n.endsWith(".code-workspace"))).toBe(false);
  });

  test("--launch runs that one line", async () => {
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors)).toBe(0);
    expect(rig.launched).toEqual([["code", "-n", heron]]);
  });

  test("a face whose root stands nowhere yet names `surface init`", async () => {
    rig.wear({ index: 3, petname: "Wren" });
    expect(await cmdSurface(surfaceArgs(["open"]), rig.doors)).toBe(1);
    expect(rig.said()).toMatch(/surface init/);
    expect(existsSync(faceRoot(rig.projections, "Wren"))).toBe(false);
  });
});
