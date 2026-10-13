/**
 * A TREE THAT ARRIVED BUILT NEVER READS STALE. The product image holds each package's `dist` and no `tools/`: it
 * carries no source to drift from and no chain to rebuild with. The freshness reading there answers fresh, so a
 * vessel sub-door (`seed`, `stand`, `rite`) reaches its handler. Before this reading, the gate imported the stamp
 * tool the image never held and died `ERR_MODULE_NOT_FOUND` ahead of every such handler.
 * A tree that holds source and lost its stamp tool cannot prove its dist and reads stale.
 * CONTROL: a tree that carries the stamp tool keeps the whole reading: no built bin reads stale, a digest
 * that differs from its stamp reads stale, a matching stamp reads fresh.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { isWorkspaceStale, treeArrivedBuilt, sourceDigest } from "../src/build-freshness.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

function put(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** A tree shaped like the image: a built CLI bin and a package's dist, no `tools/`, no source. */
function builtTree(): string {
  root = mkdtempSync(join(tmpdir(), "fresh-build-built-tree-"));
  put(join(root, "packages", "lares-cli", "dist", "src", "bin", "lares.js"), "// built\n");
  put(join(root, "packages", "lares-cli", "package.json"), "{}\n");
  return root;
}

describe("★ a tree that arrived built never reads stale ★", () => {
  test("no stamp tool and no source: the tree arrived built and reads fresh (the image's shape)", async () => {
    const r = builtTree();
    expect(treeArrivedBuilt(r)).toBe(true);
    expect(await isWorkspaceStale(r)).toBe(false);
  });

  test("a tree that holds the CLI's source and lost its stamp tool never reads as arrived built: it reads stale", async () => {
    // A sparse or partial checkout: source its dist may trail, and no tool to prove the dist by.
    const r = builtTree();
    put(join(r, "packages", "lares-cli", "src", "a.ts"), "export const a = 1;\n");
    expect(treeArrivedBuilt(r)).toBe(false);
    expect(await isWorkspaceStale(r)).toBe(true);
  });

  test("CONTROL: a tree that carries the stamp tool keeps the whole reading", async () => {
    const r = builtTree();
    mkdirSync(join(r, "tools"), { recursive: true });
    copyFileSync(join(repoRoot, "tools", "stamp-build.mjs"), join(r, "tools", "stamp-build.mjs"));
    put(join(r, "packages", "lares-cli", "src", "a.ts"), "export const a = 1;\n");
    expect(treeArrivedBuilt(r)).toBe(false);
    // No stamp yet: stale.
    expect(await isWorkspaceStale(r)).toBe(true);
    // A stamp that equals the tree's digest: fresh.
    put(join(r, "node_modules", ".lares-build", "source-digest"), await sourceDigest(join(r, "packages"), r));
    expect(await isWorkspaceStale(r)).toBe(false);
    // A source byte moves: stale again.
    put(join(r, "packages", "lares-cli", "src", "a.ts"), "export const a = 2;\n");
    expect(await isWorkspaceStale(r)).toBe(true);
  });

  test("CONTROL: a checkout with the stamp tool and no built bin reads stale", async () => {
    root = mkdtempSync(join(tmpdir(), "fresh-build-built-tree-"));
    mkdirSync(join(root, "tools"), { recursive: true });
    copyFileSync(join(repoRoot, "tools", "stamp-build.mjs"), join(root, "tools", "stamp-build.mjs"));
    expect(await isWorkspaceStale(root)).toBe(true);
  });
});
