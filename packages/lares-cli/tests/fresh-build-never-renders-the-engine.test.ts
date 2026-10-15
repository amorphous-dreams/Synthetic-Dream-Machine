/**
 * THE FRESHNESS GATE NEVER RENDERS THE ENGINE. On source drift `lares vessel stand` runs the workspace
 * build before it stands — and the vendored TW5 core blob's sha256 IS `hearthTrueName`, signed into every
 * device-delegation preimage. A workspace build that re-rendered the blob would let a comment edit move
 * the epoch every joined vessel binds to. The render stands alone as `@lararium/tw5 build:tw5-vendor`, the
 * one intentional act; the gate spawns `pnpm -r build`, and no package's `build` reaches for it.
 *
 * DERIVED, never rostered: the build the gate runs is the union of every workspace package's `build`
 * script, so this walks them all rather than remembering which one once rendered the engine.
 */
import { describe, test, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";

const VENDOR_RENDER = /build:tw5-vendor|build:vendor|build-tw5-vendor/;
const PACKAGES = join(repoRoot, "packages");

/** Every workspace package's scripts, by package name. */
function workspaceScripts(): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const dir of readdirSync(PACKAGES)) {
    const file = join(PACKAGES, dir, "package.json");
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; scripts?: Record<string, string> };
    out.set(pkg.name ?? dir, pkg.scripts ?? {});
  }
  return out;
}

describe("★ the freshness gate reads the engine, never mints it ★", () => {
  test("the gate spawns the workspace build and spells no vendor render", () => {
    const src = readFileSync(join(repoRoot, "packages", "lares-cli", "src", "build-freshness.ts"), "utf8");
    expect(src).toMatch(/\["-r", "build"\]/);
    expect(src).not.toMatch(VENDOR_RENDER);
  });

  test("no workspace package's `build` renders the engine", () => {
    const offenders = [...workspaceScripts()]
      .filter(([, scripts]) => VENDOR_RENDER.test(scripts["build"] ?? ""))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  test("CONTROL: the one intentional act still stands, under its own name, in @lararium/tw5 alone", () => {
    const holders = [...workspaceScripts()]
      .filter(([, scripts]) => Object.values(scripts).some((s) => /build-tw5-vendor/.test(s)))
      .map(([name]) => name);
    expect(holders).toEqual(["@lararium/tw5"]);
    expect(workspaceScripts().get("@lararium/tw5")?.["build:tw5-vendor"]).toMatch(/build-tw5-vendor/);
  });
});
