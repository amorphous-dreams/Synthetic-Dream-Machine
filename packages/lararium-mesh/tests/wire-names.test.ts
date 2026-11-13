/**
 * wire-names — the names our wire shapes answer by stand in ONE module that imports nothing, so a main-thread page reads
 * them without the mesh, and each producer re-exports its own name from it (one owner per name).
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import * as names from "../src/wire-names.js";
import { GENESIS_SEED_FORMAT } from "../src/genesis-doc.js";
import { FLOOR_MANIFEST_FORMAT } from "../src/floor-manifest.js";
import { FLOOR_ANSWER_FORMAT } from "../src/floor-answer.js";
import { FLOOR_PIN_KIND } from "../src/floor-pin.js";
import { FLOOR_ANNOUNCEMENT_KIND } from "../src/floor-announcement.js";

describe("the wire names", () => {
  test("the module imports nothing: a page loads it without loading the mesh", () => {
    const source = readFileSync(new URL("../src/wire-names.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/\brequire\(/);
  });

  test("each producer's name IS the wire-names binding (one owner), and no name carries a counter", () => {
    expect(GENESIS_SEED_FORMAT).toBe(names.GENESIS_SEED_FORMAT);
    expect(FLOOR_MANIFEST_FORMAT).toBe(names.FLOOR_MANIFEST_FORMAT);
    expect(FLOOR_ANSWER_FORMAT).toBe(names.FLOOR_ANSWER_FORMAT);
    expect(FLOOR_PIN_KIND).toBe(names.FLOOR_PIN_KIND);
    expect(FLOOR_ANNOUNCEMENT_KIND).toBe(names.FLOOR_ANNOUNCEMENT_KIND);
    for (const value of Object.values(names)) expect(value).not.toMatch(/(?:^|[-_.])v?\d+$/);
  });

  test("the package exports the subpath", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { exports: Record<string, unknown> };
    expect(pkg.exports["./wire-names"]).toEqual({ import: "./dist/wire-names.js", types: "./dist/wire-names.d.ts" });
  });
});
