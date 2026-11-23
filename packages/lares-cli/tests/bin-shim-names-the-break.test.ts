/**
 * bin-shim-names-the-break — the committed bin shim tells "not built yet" apart from "a workspace link broke".
 *
 * `bin/lares.mjs` loads `dist/src/bin/lares.js`. A missing dist entry means the tree never built; a dist entry that
 * stands but imports a package the workspace no longer links means `pnpm install` owes the checkout a relink. Both
 * throw ERR_MODULE_NOT_FOUND, so the shim reads which file went missing before it names a cure: telling an operator
 * to rebuild a tree that already built sends them around the loop the broken link never leaves.
 */
import { describe, test, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SHIM = fileURLToPath(new URL("../bin/lares.mjs", import.meta.url));

/** A scratch package root holding the shim, with `dist` shaped by `seed`. */
function stage(seed: (root: string) => void): { code: number | null; err: string } {
  const root = mkdtempSync(join(tmpdir(), "lares-shim-"));
  try {
    mkdirSync(join(root, "bin"));
    copyFileSync(SHIM, join(root, "bin", "lares.mjs"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    seed(root);
    const r = spawnSync(process.execPath, [join(root, "bin", "lares.mjs"), "help"], { encoding: "utf8" });
    return { code: r.status, err: r.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("the bin shim names which piece went missing", () => {
  test("RED: a missing dist entry reads as not built yet", () => {
    const r = stage(() => {});
    expect(r.code).toBe(1);
    expect(r.err).toContain("not built yet");
    expect(r.err).not.toContain("workspace link");
  });

  test("RED: a built entry that imports an unlinked package names the module and the relink, never 'not built yet'", () => {
    const r = stage((root) => {
      mkdirSync(join(root, "dist", "src", "bin"), { recursive: true });
      writeFileSync(join(root, "dist", "src", "bin", "lares.js"), `import "@lararium/no-such-link-anywhere";\nexport function runCli() {}\n`);
    });
    expect(r.code).toBe(1);
    expect(r.err).not.toContain("not built yet");
    expect(r.err).toContain("@lararium/no-such-link-anywhere");
    expect(r.err).toContain("a workspace link broke: run `pnpm install` in this checkout");
  });

  test("RED: a built entry that imports a missing dist file names a stale or partial build, never a relink", () => {
    const r = stage((root) => {
      mkdirSync(join(root, "dist", "src", "bin"), { recursive: true });
      writeFileSync(join(root, "dist", "src", "bin", "lares.js"), `import "../no-such-module.js";\nexport function runCli() {}\n`);
    });
    expect(r.code).toBe(1);
    expect(r.err).toContain("no-such-module.js");
    expect(r.err).toContain("stale or partial");
    expect(r.err).toContain("`pnpm -r build`");
    expect(r.err).not.toContain("pnpm install");
    expect(r.err).not.toContain("not built yet");
  });
});
