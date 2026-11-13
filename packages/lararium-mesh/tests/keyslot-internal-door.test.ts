/**
 * keyslot-internal-door.test — no production source reaches keyslot's internals by its source path.
 *
 * `mintKdfPort` lives in keyslot.ts and leaves by neither public door; the package's exports name no `./keyslot`, so a
 * built consumer cannot load `@lararium/mesh/keyslot`. The workspace tsconfig and the suites' vitest alias DO map that
 * path to source, so a production file importing it would typecheck and pass its suites, and fail only at load. Suites
 * may reach it (a test mints its own refusing port); production sources may not.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const packages = new URL("../../", import.meta.url).pathname;
const REACH = /from\s+["']@lararium\/mesh\/keyslot(?:\.js)?["']|import\(\s*["']@lararium\/mesh\/keyslot(?:\.js)?["']\s*\)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" || n === "dist" ? [] : sources(p);
    return /\.(m?ts|tsx|m?js)$/.test(n) ? [p] : [];
  });
}

describe("keyslot's internals stay off production imports", () => {
  test("CONTROL: the reach pattern catches a static and a dynamic import of the internal path", () => {
    expect(REACH.test(`import { mintKdfPort } from "@lararium/mesh/keyslot";`)).toBe(true);
    expect(REACH.test(`const k = await import("@lararium/mesh/keyslot.js");`)).toBe(true);
    expect(REACH.test(`import { nobleKdf } from "@lararium/mesh";`)).toBe(false);
  });

  test("no packages/*/src file imports @lararium/mesh/keyslot", () => {
    const srcDirs = readdirSync(packages).map((p) => join(packages, p, "src")).filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } });
    const files = srcDirs.flatMap(sources);
    expect(files.length).toBeGreaterThan(100);   // the walk reads the workspace, never a silent zero
    expect(files.filter((f) => REACH.test(readFileSync(f, "utf8"))).map((f) => f.slice(packages.length))).toEqual([]);
  });
});
