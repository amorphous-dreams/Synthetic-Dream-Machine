/**
 * git-tree-reader — the vessel reads a head's tree out of a checkout's object store with no git binary (road L45d).
 *
 * The vessel's image carries no git, so the reader opens the store itself: a loose object, or a packed one through its index,
 * a delta resolved against its base, each object's bytes hashed back to the name asked for. A scratch repository built with
 * the dev box's git gives the answers to compare; the reader under test spawns nothing.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SwarmRefused } from "@lararium/mesh";
import { readGitObject, treeOfHead } from "../src/git-tree-reader.js";
import { gitTreeOf } from "../src/commands/rite.js";

let dir: string;
const git = (...args: string[]): string => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
/** A repository of `n` commits, each rewriting one long file by a line, so a repack finds deltas. */
function commits(n: number): string[] {
  const body = Array.from({ length: 400 }, (_, i) => `line ${i} of a file long enough to delta well`).join("\n");
  const heads: string[] = [];
  for (let i = 0; i < n; i++) {
    writeFileSync(join(dir, "a.txt"), `${body}\nrevision ${i}\n`);
    git("add", "a.txt"); git("commit", "-q", "-m", `revision ${i} ${"with a long shared message body ".repeat(20)}`);
    heads.push(git("rev-parse", "HEAD"));
  }
  return heads;
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "git-tree-reader-"));
  execFileSync("git", ["init", "-q", dir]);
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("vessel-reads-the-tree-without-git", () => {
  test("RED: the reader names the tree of every head from loose objects, as git names it; CONTROL: the module spawns no process", async () => {
    const heads = commits(4);
    for (const head of heads) expect(await treeOfHead(head, [dir]), head).toBe(git("rev-parse", `${head}^{tree}`));
    const source = readFileSync(join(import.meta.dirname, "..", "src", "git-tree-reader.ts"), "utf8");
    expect(source).not.toMatch(/child_process|execFile|spawn\(/);
  });

  test("RED: after a repack every head reads out of the pack through its index, deltas resolved; CONTROL: no loose object stays, and at least one object read crossed a delta", async () => {
    const heads = commits(30);
    git("repack", "-a", "-d", "-f", "--depth=50", "--window=50");
    git("prune-packed");
    expect(readdirSync(join(dir, ".git", "objects")).filter((n) => /^[0-9a-f]{2}$/.test(n))).toEqual([]);
    let deltas = 0;
    for (const head of heads) {
      expect(await treeOfHead(head, [dir]), head).toBe(git("rev-parse", `${head}^{tree}`));
      // Blobs delta where commits may not: read each head's blob too, by the name git gives it.
      deltas += (await readGitObject(join(dir, ".git"), git("rev-parse", `${head}:a.txt`))).deltas;
    }
    expect(deltas).toBeGreaterThan(0);
  });

  test("RED: a linked worktree's `.git` file leads the reader to the store it shares; a head held by no store, a head that reads as no name, and an object whose bytes hash to another name each refuse `rite-tree-unreadable`", async () => {
    const [head] = commits(1);
    const linked = join(dir, "..", `${dir.split("/").at(-1)}-linked`);
    git("worktree", "add", "-q", "--detach", linked, head!);
    try {
      expect(await treeOfHead(head!, [linked])).toBe(git("rev-parse", `${head}^{tree}`));
    } finally { rmSync(linked, { recursive: true, force: true }); }
    const refuses = (p: Promise<unknown>) => expect(p).rejects.toSatisfy((e: unknown) => e instanceof SwarmRefused && e.code === "rite-tree-unreadable");
    await refuses(treeOfHead("f".repeat(40), [dir]));
    await refuses(treeOfHead("HEAD", [dir]));
    await refuses(treeOfHead(head!, [join(dir, "absent")]));
    await refuses(treeOfHead(head!, []));
    // The object's bytes move under a name they never hash to: the reader refuses what git itself would call corrupt.
    const other = "0".repeat(40);
    mkdirSync(join(dir, ".git", "objects", other.slice(0, 2)), { recursive: true });
    writeFileSync(join(dir, ".git", "objects", other.slice(0, 2), other.slice(2)), readFileSync(join(dir, ".git", "objects", head!.slice(0, 2), head!.slice(2))));
    await refuses(treeOfHead(other, [dir]));
  });

  test("RED: the rite's own tree port reads through this reader; CONTROL: it answers as git answers", async () => {
    const [head] = commits(1);
    expect(await gitTreeOf(head!, [dir])).toBe(git("rev-parse", `${head}^{tree}`));
    expect(readFileSync(join(import.meta.dirname, "..", "src", "commands", "rite.ts"), "utf8")).not.toMatch(/child_process|execFile/);
  });
});
