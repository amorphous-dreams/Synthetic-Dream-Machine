/**
 * region-paths — BUILD LOCATION NEVER MOVES BYTES (course parity-reads-a-fresh-build). The bundler writes a `//#region <path>`
 * comment per inlined module, relative to this package. A build in a nested worktree that borrows the main checkout's
 * node_modules resolves the store through it and writes `../../../../node_modules/…` where a bench with its own store writes
 * `../../node_modules/…` (Seed-Prober, 2026-11-25: 43b32392 vs 2de1fb60 on clean develop fafa26e01). The pipeline normalizes
 * every store region to the package's own spelling, so one source packs one byte stream wherever it builds.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeRegionPaths } from "../plugin-build/region-paths.js";

describe("the bundle's region comments read one spelling wherever it builds", () => {
  test("RED: a borrowed store's deeper path folds to the package's own ../../node_modules/", () => {
    const borrowed = "//#region ../../../../node_modules/.pnpm/smol-toml@1.3.1/node_modules/smol-toml/dist/index.js\nvar x = 1;\n//#endregion\n";
    expect(normalizeRegionPaths(borrowed)).toBe("//#region ../../node_modules/.pnpm/smol-toml@1.3.1/node_modules/smol-toml/dist/index.js\nvar x = 1;\n//#endregion\n");
    expect(normalizeRegionPaths("//#region ../../../../../../node_modules/a/b.js")).toBe("//#region ../../node_modules/a/b.js");
  });
  test("CONTROL: the package's own spelling, its sources and the sibling packages' sources pass unchanged; code that names node_modules outside a region comment stays", () => {
    for (const line of ["//#region ../../node_modules/a/b.js", "//#region src/toml-ast.ts", "//#region ../lararium-mesh/src/crypto.ts", 'const p = "../../../../node_modules/x";']) {
      expect(normalizeRegionPaths(line), line).toBe(line);
    }
  });
  test("every tracked skin bundle already reads normalized (the fold moves no byte of a bench-built pack)", () => {
    for (const name of ["lares-lararium.json", "lares-memetic-wikitext.json"]) {
      const text = readFileSync(join(import.meta.dirname, "..", "plugins", name), "utf8");
      expect(text.includes("//#region ../../node_modules/"), name).toBe(true);
      expect(/\/\/#region (?:\.\.\/){3,}node_modules\//.test(text), name).toBe(false);
    }
  });
});
