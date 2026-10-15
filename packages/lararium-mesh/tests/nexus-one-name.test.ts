/**
 * nexus-one-name — a Nexus answers to ONE name: `nexus-` and 64 hex, the content address of its charter's genesis
 * epoch (`sealEpochCidOf`). The earlier genesis prefix names nothing any more, so no source spells it.
 *
 * The witness reads every source of every package (`src`, `tests`, `probes`, `scripts`), the root `tests/` tree and
 * `tools/`, and refuses any file that holds the earlier prefix. It names the token it hunts, so it skips itself.
 *
 *   W1  CONTROL: the witness reads the tree, and a planted positive reads as a hit.
 *   W2  RED: no source spells the earlier genesis prefix.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");
const SELF = "packages/lararium-mesh/tests/nexus-one-name.test.ts";
/** The earlier genesis prefix: `epoch0-`. */
const EARLIER = /\bepoch0-/;

function sourcesUnder(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(path.join(REPO, dir)); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name === "dist-plugin" || name.startsWith(".")) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) sourcesUnder(rel, out);
    else if (/\.(?:ts|tsx|mts|mjs|js|sh|py)$/.test(name)) out.push(rel);
  }
  return out;
}

function everySource(): string[] {
  const out: string[] = [];
  for (const pkg of readdirSync(path.join(REPO, "packages"))) {
    for (const sub of ["src", "tests", "probes", "scripts"]) sourcesUnder(`packages/${pkg}/${sub}`, out);
  }
  sourcesUnder("tests", out);
  sourcesUnder("tools", out);
  return out.sort();
}

describe("a Nexus answers to one name", () => {
  const sources = everySource();

  test("W1 — CONTROL: the witness reads the tree, and a planted positive reads as a hit", () => {
    expect(sources.length).toBeGreaterThan(1000);
    for (const dir of ["packages/lararium-mesh/src/", "packages/lararium-node/tests/", "packages/lares-cli/src/", "tests/e2e/", "tools/"]) {
      expect(sources.some((rel) => rel.startsWith(dir)), dir).toBe(true);
    }
    expect(sources).toContain(SELF);
    expect(EARLIER.test(`const GENESIS = \`${"epoch"}0-\${"c".repeat(64)}\`;`)).toBe(true);
    expect(EARLIER.test("const AID = `nexus-${\"c\".repeat(64)}`; const later = `epoch-${d}`;")).toBe(false);
  });

  test("W2 — RED: no source spells the earlier genesis prefix", () => {
    const stray = sources.filter((rel) => rel !== SELF && EARLIER.test(readFileSync(path.join(REPO, rel), "utf8")));
    expect(stray, `these still spell the earlier genesis prefix:\n  ${stray.join("\n  ")}`).toEqual([]);
  });
});
