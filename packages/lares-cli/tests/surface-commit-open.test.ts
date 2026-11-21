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
import { ensureRealmLabel, faceRoot, kapaeShadowBody, syncedTreeKey } from "@lararium/node";
import { cmdSurface, LIVE_SURFACE_DOORS, SURFACE_EDITOR_FILE, SURFACE_EDITOR_TITLE } from "../src/commands/surface.js";
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

  test("a removal already staged in the index (plain delete) commits clean, never a pathspec refusal", async () => {
    const gone = carrier("wiki/Gone.tid", "Gone", "title: Gone\n\ng\n");
    const stays = carrier("wiki/Stays.tid", "Stays", "title: Stays\n\ns\n");
    expect(await commit()).toBe(0);
    expect(git(heron, "rm", "-q", "--", "wiki/Gone.tid").code).toBe(0);   // the index already holds the removal
    rig.tree.deleteAt(syncedTreeKey(BAG, "Gone"), resolve(gone));
    expect(existsSync(stays)).toBe(true);
    expect(await commit(["-m", "after-delete"])).toBe(0);
    expect(git(heron, "show", "--name-status", "--format=", "HEAD").out.trim()).toBe("D\twiki/Gone.tid");
    expect(git(heron, "status", "--porcelain").out.trim()).toBe("");
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

  test("the pre-commit hook runs the pool check, and a refusing check commits nothing", async () => {
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

  test("★ a kāpae shadow stages where its bytes equal the house's own write; a hand's shadow and a moved one stand apart; the lowering removes ★", async () => {
    /** Plant a shadow; `house` records the house's write of it (over `wrote`, the planted bytes by default). */
    const shadow = (rel: string, title: string, opts: { house?: boolean; wrote?: string } = {}): string => {
      const body = kapaeShadowBody(title);
      const file = plant(join(heron, rel), body);
      if (opts.house !== false) rig.tree.shadows().set(syncedTreeKey(BAG, title), resolve(file), carrierHash(opts.wrote ?? body));
      return file;
    };
    const worn = shadow("wiki/ha.ka.ba/lares/docs/pono/the-worn-house.kapae", "lar:///ha.ka.ba/lares/docs/pono/the-worn-house");
    const kept = shadow("wiki/Kept.kapae", "Kept");
    shadow("wiki/Hand.kapae", "Hand", { house: false });
    shadow("wiki/Moved.kapae", "Moved", { wrote: kapaeShadowBody("Elsewhere") });
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-only", "--format=", "HEAD").out.split("\n").filter(Boolean).sort())
      .toEqual(["wiki/Kept.kapae", "wiki/ha.ka.ba/lares/docs/pono/the-worn-house.kapae"]);
    expect(lastMessage()).toContain("Kapae: lar:///ha.ka.ba/lares/docs/pono/the-worn-house");
    const status = git(heron, "status", "--porcelain").out;
    expect(status).toContain("?? wiki/Hand.kapae");
    expect(status).toContain("?? wiki/Moved.kapae");
    // The house lowers one (its row leaves with the file); a hand removes the other while the house's write still stands.
    rmSync(worn);
    rig.tree.shadows().deleteAt(syncedTreeKey(BAG, "lar:///ha.ka.ba/lares/docs/pono/the-worn-house"), resolve(worn));
    rmSync(kept);
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-status", "--format=", "HEAD").out.trim()).toBe("D\twiki/ha.ka.ba/lares/docs/pono/the-worn-house.kapae");
    expect(git(heron, "status", "--porcelain").out).toContain(" D wiki/Kept.kapae");
  });

  test("a pointer the house wrote as its `.meta` alone stages that sidecar", async () => {
    const file = join(heron, "wiki", "doc.pdf");
    const meta = "title: doc.pdf\ntype: application/pdf\n_canonical_uri: cid:x\n";
    plant(`${file}.meta`, meta);
    const hash = carrierHash("", meta);
    rig.tree.set(syncedTreeKey(BAG, "doc.pdf"), resolve(file), hash, hash);
    expect(await commit()).toBe(0);
    expect(git(heron, "show", "--name-only", "--format=", "HEAD").out.trim()).toBe("wiki/doc.pdf.meta");
  });
});

describe("lares surface open", () => {
  test("★ prints `code -n` over the worn face's root and the realm roots it belongs to, and writes no workspace file ★", async () => {
    plant(join(heron, "personal", "garden", "Mine.tid"), "title: Mine\n\nm\n");
    ensureRealmLabel(rig.projections, "garden", null);   // the realm's default pet name: its slug
    plant(join(rig.projections, "realms", "garden", "wikis", "garden", "Shared.tid"), "title: Shared\n\ns\n");
    plant(join(heron, "personal", "unwoven", "x.tid"), "x\n");    // a personal layer whose realm pool stands nowhere names no root
    const before = readdirSync(heron).sort();
    expect(await cmdSurface(surfaceArgs(["open"]), rig.doors)).toBe(0);
    const said = rig.said();
    expect(said).toContain("code -n");
    expect(said).toContain(heron);
    expect(said).toContain(join(rig.projections, "realms", "garden"));
    expect(said).not.toContain(join(rig.projections, "realms", "garden", "wikis"));
    expect(said).not.toContain("unwoven");
    expect(rig.launched).toEqual([]);
    expect(readdirSync(heron).sort()).toEqual(before);
    expect(readdirSync(rig.projections).some((n) => n.endsWith(".code-workspace"))).toBe(false);
  });

  test("--launch runs that one line", async () => {
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors)).toBe(0);
    expect(rig.launched).toEqual([["code", "-n", heron]]);
  });

  test("★ RED: the editor reads from the house config tiddler `$:/config/lares/surface/Editor`; `code` where none stands ★", async () => {
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors)).toBe(0);
    expect(rig.launched).toEqual([["code", "-n", heron]]);
    writeFileSync(join(rig.config, SURFACE_EDITOR_FILE), `title: ${SURFACE_EDITOR_TITLE}\ntype: text/plain\n\ncode-insiders\n`);
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors)).toBe(0);
    expect(rig.launched.at(-1)).toEqual(["code-insiders", "-n", heron]);
    expect(rig.said()).toContain(`code-insiders -n '${heron}'`);
  });

  test("★ RED: the editor stands off the PATH: `code-insiders` where only it stands; a both-stand PATH follows the shell's own server; neither names both ★", async () => {
    rig.path.stands = ["code-insiders"];
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors)).toBe(0);
    expect(rig.launched.at(-1)).toEqual(["code-insiders", "-n", heron]);
    rig.path.stands = ["code", "code-insiders"];
    rig.path.shell = "/usr/bin";
    await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors);
    expect(rig.launched.at(-1)![0]).toBe("code");
    rig.path.shell = "/home/x/.vscode-server-insiders/bin/abc/bin/remote-cli:/usr/bin";
    await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), rig.doors);
    expect(rig.launched.at(-1)![0]).toBe("code-insiders");
    rig.path.stands = [];
    await cmdSurface(surfaceArgs(["open"]), rig.doors);
    expect(rig.said()).toMatch(/neither `code` nor `code-insiders`/);
  });

  test("★ RED: every realm root the face reaches opens once: a labelled realm whose face folder stands empty, and a realm root holding its own .git ★", async () => {
    ensureRealmLabel(rig.projections, "notes", null);
    plant(join(rig.projections, "realms", "notes", "wikis", "notes", "A.tid"), "title: A\n\na\n");
    ensureRealmLabel(rig.projections, "garden", null);
    plant(join(rig.projections, "realms", "garden", "wikis", "garden", "B.tid"), "title: B\n\nb\n");
    plant(join(heron, "personal", "garden", ".keep"), "");
    plant(join(rig.projections, "realms", "bare", ".git", "HEAD"), "ref: refs/heads/main\n");
    expect(await cmdSurface(surfaceArgs(["open"]), rig.doors)).toBe(0);
    const line = rig.said().split("\n").find((l) => l.startsWith("code -n"))!;
    for (const r of ["notes", "garden", "bare"]) expect(line.split(join(rig.projections, "realms", r)).length - 1).toBe(1);
  });

  test("RED: an editor this machine holds no binary for refuses by name, naming the tiddler to set", async () => {
    writeFileSync(join(rig.config, SURFACE_EDITOR_FILE), `title: ${SURFACE_EDITOR_TITLE}\ntype: text/plain\n\nno-such-editor-here\n`);
    const doors = { ...rig.doors, launch: LIVE_SURFACE_DOORS.launch };
    expect(await cmdSurface(surfaceArgs(["open"], {}, { launch: true }), doors)).toBe(1);
    const said = rig.said();
    expect(said).toContain("no-such-editor-here");
    expect(said).toContain(SURFACE_EDITOR_TITLE);
    expect(said).toContain(join(rig.config, SURFACE_EDITOR_FILE));
  });

  test("a face whose root stands nowhere yet names `surface init`", async () => {
    rig.wear({ index: 3, petname: "Wren" });
    expect(await cmdSurface(surfaceArgs(["open"]), rig.doors)).toBe(1);
    expect(rig.said()).toMatch(/surface init/);
    expect(existsSync(faceRoot(rig.projections, "Wren"))).toBe(false);
  });
});
