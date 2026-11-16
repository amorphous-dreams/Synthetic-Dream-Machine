/**
 * rite-tree — the vessel derives the head's tree from git itself (road L45d, operator ruling 2026-11-15): a rite's return rests
 * on the receipt standing for the head's tree, and the caller never names that tree.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SwarmRefused } from "@lararium/mesh";
import { gitTreeOf, riteTreeOf } from "../src/commands/rite.js";

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

test("RED: a keep's head names a carry bundle by its id, and that id reads as its own tree with no checkout asked; CONTROL: a keep head that spells no bundle id refuses, and every other rite still derives its tree from git", async () => {
  const bundle = "c".repeat(64);
  const asked: string[] = [];
  const git0 = async (head: string): Promise<string> => { asked.push(head); return gitTreeOf(head, [dir]); };
  expect(await riteTreeOf("keep", bundle, git0)).toBe(bundle);
  expect(asked).toEqual([]);
  for (const head of [git("rev-parse", "HEAD"), "C".repeat(64), `${bundle}0`, "", "--help"]) {
    await expect(riteTreeOf("keep", head, git0), head).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
  }
  expect(asked).toEqual([]);
  const head = git("rev-parse", "HEAD");
  expect(await riteTreeOf("kukulu", head, git0)).toBe(git("rev-parse", "HEAD^{tree}"));
  expect(await riteTreeOf("push", head, git0)).toBe(git("rev-parse", "HEAD^{tree}"));
  // A bundle id handed to a git rite names no commit.
  await expect(riteTreeOf("kukulu", bundle, git0)).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
});
