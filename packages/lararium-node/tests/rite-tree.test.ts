/**
 * rite-tree — the vessel derives the head's tree from git itself (road L45d, operator ruling 2026-11-15): a rite's return rests
 * on the receipt standing for the head's tree, and the caller never names that tree.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SwarmRefused } from "@lararium/mesh";
import { gitTreeOf, keepStagedTree, riteTreeOf } from "../src/commands/rite.js";
import { BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, bundleIdOf, sealRedeclare, sha256Hex, zeroCounts } from "../src/bundle-manifest.js";

let dir: string;
const git = (...args: string[]): string => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rite-tree-"));
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, "a.txt"), "one\n");
  git("add", "a.txt"); git("commit", "-q", "-m", "one");
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("RED: the tree comes off the head through git, in the checkout the vessel names; CONTROL: a second commit names another tree", async () => {
  const head = git("rev-parse", "HEAD");
  expect(await gitTreeOf(head, [dir])).toBe(git("rev-parse", "HEAD^{tree}"));
  writeFileSync(join(dir, "a.txt"), "two\n");
  git("commit", "-q", "-am", "two");
  expect(await gitTreeOf(git("rev-parse", "HEAD"), [dir])).not.toBe(await gitTreeOf(head, [dir]));
});

test("RED: a head git holds no commit for, a head that reads as no object name, and a place that holds no checkout each refuse `rite-tree-unreadable`; none reaches git as an option", async () => {
  for (const [head, dirs] of [["f".repeat(40), [dir]], ["--help", [dir]], ["HEAD", [dir]], [git("rev-parse", "HEAD"), [join(dir, "absent")]], [git("rev-parse", "HEAD"), []]] as const) {
    await expect(gitTreeOf(head, [...dirs]), head).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
  }
});

test("RED: a keep's head names a house bundle by its id, and the id the vessel derives from the staged tree stands as the tree with no checkout asked; CONTROL: a keep head that spells no bundle id, or a keep that names no staged tree, refuses, and every other rite still derives its tree from git", async () => {
  const bundle = "c".repeat(64);
  const asked: string[] = [];
  const git0 = async (head: string): Promise<string> => { asked.push(head); return gitTreeOf(head, [dir]); };
  expect(await riteTreeOf("keep", bundle, git0, () => bundle)).toBe(bundle);
  expect(asked).toEqual([]);
  for (const head of [git("rev-parse", "HEAD"), "C".repeat(64), `${bundle}0`, "", "--help"]) {
    await expect(riteTreeOf("keep", head, git0, () => bundle), head).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
  }
  await expect(riteTreeOf("keep", bundle, git0)).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
  expect(asked).toEqual([]);
  const head = git("rev-parse", "HEAD");
  expect(await riteTreeOf("kukulu", head, git0)).toBe(git("rev-parse", "HEAD^{tree}"));
  expect(await riteTreeOf("push", head, git0)).toBe(git("rev-parse", "HEAD^{tree}"));
  // A bundle id handed to a git rite names no commit.
  await expect(riteTreeOf("kukulu", bundle, git0)).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
});

/** A whole, small bundle at `dest`, as an export leaves one; answers its id. */
function stageBundle(dest: string, text: string): string {
  const rel = "faces/f0/working/heron.tid";
  mkdirSync(join(dest, "faces", "f0", "working"), { recursive: true });
  writeFileSync(join(dest, rel), text);
  const redeclare = sealRedeclare(new Uint8Array(32).fill(7), { schema: BUNDLE_SCHEMA, faces: [{ face: "f0", handleIndex: 0, petname: "steward", handle: null, seat: false, chair: null }] });
  writeFileSync(join(dest, REDECLARE_FILE), redeclare);
  const files = [{ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) }, { path: REDECLARE_FILE, sha256: sha256Hex(redeclare), bytes: Buffer.byteLength(redeclare) }].sort((x, y) => (x.path < y.path ? -1 : 1));
  const bundleId = bundleIdOf(files);
  writeFileSync(join(dest, MANIFEST_FILE), JSON.stringify({ schema: BUNDLE_SCHEMA, bundleId, faces: [{ key: "f0" }], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] }));
  return bundleId;
}

test("RED: a keep whose handed-in receipt names a bundle id the staged tree does not derive refuses `rite-tree-differs`; CONTROL: the id the staged tree derives begins", async () => {
  const home = join(dir, "workspaces");
  const staged = ".house.keep-0a1b2c";
  const derived = stageBundle(join(home, "backup", staged), "remember the heron\n");
  const heard = "d".repeat(64);   // the id a seat handed in as the receipt's tree and the begin's head
  await expect(riteTreeOf("keep", heard, gitTreeOf, () => keepStagedTree("backup", staged, home))).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-differs");
  expect(await riteTreeOf("keep", derived, gitTreeOf, () => keepStagedTree("backup", staged, home))).toBe(derived);
  // A byte flipped after the cut: the tree reads unwhole, and nothing begins.
  writeFileSync(join(home, "backup", staged, "faces", "f0", "working", "heron.tid"), "remember the herons\n");
  await expect(riteTreeOf("keep", derived, gitTreeOf, () => keepStagedTree("backup", staged, home))).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
});

test("RED: a staged path that escapes its workspace, a workspace the grammar refuses, and a place with no bundle each refuse `rite-tree-unreadable`", () => {
  const home = join(dir, "workspaces");
  stageBundle(join(home, "backup", ".house.keep-1"), "x\n");
  stageBundle(join(home, "other", "house"), "y\n");
  for (const [branch, staged] of [["backup", "../other/house"], ["backup", "/etc"], ["backup", ""], ["Back Up", ".house.keep-1"], ["..", "backup/.house.keep-1"], ["backup", "absent"]] as const) {
    expect(() => keepStagedTree(branch, staged, home), `${branch} ${staged}`).toThrow(expect.objectContaining({ code: "rite-tree-unreadable" }));
  }
  expect(keepStagedTree("backup", ".house.keep-1", home)).toMatch(/^[0-9a-f]{64}$/);
});
