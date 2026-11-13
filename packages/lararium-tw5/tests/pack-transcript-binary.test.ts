/**
 * G15 — the pack transcript names the binary the build actually READ.
 *
 * The transcript used to carry a FIXED logical path (`TiddlyWiki5/tiddlywiki.js`) built with no filesystem call, so a
 * build that resolved a different tiddlywiki binary still attested the submodule's. The transcript now records the
 * resolved binary's LOGICAL path: the realpath of what the build ran, expressed under the repo (a checkout whose
 * submodule sits behind a symlink still reads the submodule's own logical location, so checkouts agree). A resolved
 * binary that differs from the fixed submodule path reads a MISMATCH.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  TW5_BIN_FIXED_LOGICAL_PATH,
  resolveTw5BinLogicalPath,
  tw5BinMismatch,
} from "../plugin-build/tw5-bin-path.js";

function repoWith(layout: (root: string) => void): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "g15-bin-")));
  layout(root);
  return root;
}
const touch = (p: string): void => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, "#!/usr/bin/env node\n"); };

describe("★ the transcript names the binary the build read ★", () => {
  test("★ POSITIVE: a binary inside the submodule records the submodule's logical path ★", () => {
    const root = repoWith((r) => touch(path.join(r, "TiddlyWiki5", "tiddlywiki.js")));
    try {
      const logical = resolveTw5BinLogicalPath({ resolvedBin: path.join(root, "TiddlyWiki5", "tiddlywiki.js"), repoRoot: root });
      expect(logical).toBe(TW5_BIN_FIXED_LOGICAL_PATH);
      expect(tw5BinMismatch(logical)).toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("★ a submodule that sits behind a symlink elsewhere still records the SAME logical path (checkouts agree) ★", () => {
    const elsewhere = repoWith((r) => touch(path.join(r, "tiddlywiki.js")));
    const root = repoWith(() => {});
    try {
      symlinkSync(elsewhere, path.join(root, "TiddlyWiki5"));
      const viaLink = path.join(root, "node_modules", "tiddlywiki");
      mkdirSync(path.dirname(viaLink), { recursive: true });
      symlinkSync(path.join(root, "TiddlyWiki5"), viaLink);
      const real = realpathSync(path.join(viaLink, "tiddlywiki.js"));
      expect(real.startsWith(root)).toBe(false);
      expect(resolveTw5BinLogicalPath({ resolvedBin: real, repoRoot: root })).toBe(TW5_BIN_FIXED_LOGICAL_PATH);
    } finally { rmSync(root, { recursive: true, force: true }); rmSync(elsewhere, { recursive: true, force: true }); }
  });

  test("★ RED: a build whose resolved binary differs from the fixed path reads a MISMATCH ★", () => {
    const root = repoWith((r) => { touch(path.join(r, "TiddlyWiki5", "tiddlywiki.js")); touch(path.join(r, "node_modules", "tiddlywiki", "tiddlywiki.js")); });
    try {
      const logical = resolveTw5BinLogicalPath({ resolvedBin: path.join(root, "node_modules", "tiddlywiki", "tiddlywiki.js"), repoRoot: root });
      expect(logical).toBe("node_modules/tiddlywiki/tiddlywiki.js");
      expect(logical).not.toBe(TW5_BIN_FIXED_LOGICAL_PATH);
      expect(tw5BinMismatch(logical)).toMatch(/node_modules\/tiddlywiki\/tiddlywiki\.js.*TiddlyWiki5\/tiddlywiki\.js/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("a binary outside the repo names no logical path and refuses", () => {
    const root = repoWith((r) => touch(path.join(r, "TiddlyWiki5", "tiddlywiki.js")));
    const outside = repoWith((r) => touch(path.join(r, "tiddlywiki.js")));
    try {
      expect(() => resolveTw5BinLogicalPath({ resolvedBin: path.join(outside, "tiddlywiki.js"), repoRoot: root })).toThrow(/outside the repo/);
    } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
  });

  test("the fixed path stays the submodule's logical location", () => {
    expect(TW5_BIN_FIXED_LOGICAL_PATH).toBe("TiddlyWiki5/tiddlywiki.js");
  });

  test("★ the build script records the RESOLVED logical path, never a constant it built without reading the binary ★", () => {
    const src = readFileSync(new URL("../scripts/build-plugin-tiddler.ts", import.meta.url), "utf8");
    expect(src).toMatch(/resolveTw5BinLogicalPath\(\{ resolvedBin: TW5_BIN, repoRoot: REPO_ROOT \}\)/);
    expect(src).toMatch(/tw5BinPath: TW5_BIN_LOGICAL,/);
    expect(src, "the fixed no-filesystem join retires").not.toMatch(/path\.join\(REPO_ROOT, "TiddlyWiki5", "tiddlywiki\.js"\)/);
  });
});
