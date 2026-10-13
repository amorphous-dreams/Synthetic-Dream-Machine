/**
 * gate-root-door-minters — ONLY A SEAT MINTS A GATE'S ROOT DOOR.
 *
 * A gate bundle's root takes a door of its own tier, and a door's type and mint say which tier. Both say only
 * what the minter claimed: `floorKeyDoor(x)` brands whatever derive it wraps. So the law rests on WHO mints.
 * Across every package's source, `floorKeyDoor(` gets called in one file, the vessel identity that reads the
 * floor key, and `custodyRootDoor(` in one file, the custody seat. A second minter anywhere reds this weld, and
 * the hand that adds one answers here for which root its door derives from.
 *
 * CONTROL: the scan finds each minter where it stands, so an empty scan never reads as a clean tree.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const packages = resolve(new URL(".", import.meta.url).pathname, "../..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "tests") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(?:ts|tsx|mts|js|mjs)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** Every source file, under any package's `src`, that CALLS `name` (a definition `name = (` never counts). */
function callers(name: string): string[] {
  const call = new RegExp(`(?<![A-Za-z0-9_$.])${name}\\(`);
  const hits: string[] = [];
  for (const pkg of readdirSync(packages)) {
    const src = join(packages, pkg, "src");
    try { if (!statSync(src).isDirectory()) continue; } catch { continue; }
    for (const file of sources(src)) {
      if (call.test(readFileSync(file, "utf8"))) hits.push(relative(packages, file));
    }
  }
  return hits.sort();
}

describe("the gate's root doors", () => {
  test("WELD: the vessel identity alone mints the floor key's door, and the custody seat alone mints the custody root's", () => {
    expect(callers("floorKeyDoor")).toEqual(["lararium-node/src/node-vessel-identity.ts"]);
    expect(callers("custodyRootDoor")).toEqual(["lararium-node/src/custody-seat.ts"]);
  });

  test("CONTROL: the scan reads source (it finds a name every package calls)", () => {
    expect(callers("deriveGateBundle").length + callers("hkdfSync").length).toBeGreaterThan(0);
  });
});
