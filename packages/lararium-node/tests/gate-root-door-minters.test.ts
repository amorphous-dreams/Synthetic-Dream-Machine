/**
 * gate-root-door-minters — ONLY A SEAT MINTS A GATE'S ROOT DOOR.
 *
 * A gate bundle's root takes a door of its own tier, and a door's type and mint say which tier. Both say only
 * what the minter claimed: `floorKeyDoor(x)` brands whatever derive it wraps. So the law rests on WHO mints, and
 * this weld holds each mint's NAME to the files that own it. It scans every package's `src`, `tools/` and
 * `tests/harness`: there the word `floorKeyDoor` stands in three files alone (the bundle that defines it, the
 * barrel that names it, and the vessel identity that reads the floor key), and `custodyRootDoor` in the bundle,
 * the barrel and the custody seat. An alias, a namespace call or a re-export in a scanned file spells the word
 * and reds the weld; the hand that adds one answers here for which root its door derives from.
 *
 * What the weld leaves open, stated: a file outside the scanned roots (a package's own tests, a script
 * elsewhere), a name assembled from parts so the whole word never appears, and a wrapper around a SEAT's own
 * door function. No scan reads intent; this one catches the accident.
 *
 * CONTROL: the scan finds a name many files hold, so an empty scan never reads as a clean tree.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repo = resolve(new URL(".", import.meta.url).pathname, "../../..");

function sources(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name === "tests" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(?:ts|tsx|mts|js|mjs|sh)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** The seed census names every raw-seed door it polices, so its own files stand outside the weld. */
const WITNESS_FILES = new Set(["tools/seed-census.mjs", "tools/seed-census.test.mjs"]);

/** Every file that holds the word `name`: under any package's `src`, under `tools`, and under the test harness. */
function holders(name: string): string[] {
  const word = new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`);
  const roots = [
    ...readdirSync(join(repo, "packages")).map((pkg) => join(repo, "packages", pkg, "src")),
    join(repo, "tools"), join(repo, "tests", "harness"),
  ];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of sources(root)) {
      if (WITNESS_FILES.has(relative(repo, file))) continue;
      if (word.test(readFileSync(file, "utf8"))) hits.push(relative(repo, file));
    }
  }
  return hits.sort();
}

describe("the gate's root doors", () => {
  test("WELD: each mint's name stands in its bundle, the barrel and its ONE seat, and nowhere else", () => {
    expect(holders("floorKeyDoor")).toEqual([
      "packages/lararium-mesh/src/gate-bundle.ts", "packages/lararium-mesh/src/index.ts", "packages/lararium-node/src/node-vessel-identity.ts",
    ]);
    expect(holders("custodyRootDoor")).toEqual([
      "packages/lararium-mesh/src/gate-bundle.ts", "packages/lararium-mesh/src/index.ts", "packages/lararium-node/src/custody-seat.ts",
    ]);
  });

  test("CONTROL: the scan reads source, tools and the harness", () => {
    expect(holders("createHash").length).toBeGreaterThan(3);
    expect(holders("createHash").some((f) => f.startsWith("tools/"))).toBe(true);
  });
});
