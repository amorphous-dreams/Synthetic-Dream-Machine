/**
 * gate-dial-funnel — every test dials a gate through ONE helper.
 *
 * The socket speaks one handshake: the Noise IK flight, a sealed presentation and the gate's signed verdict. Every test
 * dials a gate through ONE helper (`gate-dial-fixture.ts`, here and in the node package), which holds the real dialer
 * and a real gate. The node package's helper is the mesh helper itself, re-exported, so the two can never drift apart.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import * as helper from "./gate-dial-fixture.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");

/** The helper: the files every suite dials a gate through. */
const HELPERS = [
  "packages/lararium-mesh/tests/gate-dial-fixture.ts",
  "packages/lararium-node/tests/gate-dial-fixture.ts",
] as const;

function sourcesUnder(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(path.join(REPO, dir)); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) sourcesUnder(rel, out);
    else if (/\.(?:ts|tsx|mts|mjs|js)$/.test(name)) out.push(rel);
  }
  return out;
}

function everyTestSource(): string[] {
  const out: string[] = [];
  for (const pkg of readdirSync(path.join(REPO, "packages"))) {
    sourcesUnder(`packages/${pkg}/tests`, out);
    sourcesUnder(`packages/${pkg}/probes`, out);
  }
  sourcesUnder("tests/e2e", out);
  sourcesUnder("tests/harness", out);
  return out.sort();
}

describe("the one-handshake funnel", () => {
  test("both helpers stand among the test sources", () => {
    const sources = everyTestSource();
    expect(sources.length).toBeGreaterThan(300);
    for (const rel of HELPERS) expect(sources, rel).toContain(rel);
  });

  test("the mesh helper holds the real dialer, a real gate and the rig", () => {
    for (const name of ["dialGate", "gateOver", "dialSocketTo", "faceGateRig"] as const) expect(typeof helper[name], name).toBe("function");
    const mesh = readFileSync(path.join(REPO, HELPERS[0]), "utf8");
    expect(mesh).toMatch(/export function dialGate\(options: LarWSClientOptions\): LarWSClientAdapter \{\n\s+return new LarWSClientAdapter\(options\);/);
  });

  test("the node helper is the mesh helper, re-exported", () => {
    const node = readFileSync(path.join(REPO, HELPERS[1]), "utf8");
    expect(node).toMatch(/^export \* from "\.\.\/\.\.\/lararium-mesh\/tests\/gate-dial-fixture\.js";$/m);
  });
});
