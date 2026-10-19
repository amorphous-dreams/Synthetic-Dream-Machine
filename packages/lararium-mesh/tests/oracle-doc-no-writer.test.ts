/** The deterministic oracle document holds seed material only; vessel registries own every pointer write. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test, expect } from "vitest";

const REPO = join(import.meta.dirname, "..", "..", "..");
const PACKAGES = ["lararium-mesh", "lararium-node", "lararium-tw5", "lararium-keyhive", "lararium-browser", "lares-cli"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

/** Find direct writes and handle-passing calls on names that identify the oracle plane. */
export function oracleWriters(path: string, source: string): string[] {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const lines = code.split("\n");
  const oracleNames = new Set(["islandHandle", "oracleHandle", "laraiumHandle", "oracle"]);
  const writerNames = /\b(?:mintLaresIfAbsent|mintLarariumIfAbsent|reconcileWellKnownTiddlers|registerCrossroadsInOracle|registerCrossroadsPointer|writeRealmStanding|writeRealmBagRegistration)\s*\(/;
  lines.forEach((line) => {
    const bindsOracleUrl = /oracleGenesisDocUrl\s*\(/.test(line);
    const bindsIsland = /\b(?:islandHandle|oracleHandle|laraiumHandle)\b/.test(line)
      && /(?:=\s*(?:await\s+)?(?:materializeGenesisIsland|loadOrMaterializeOracle|repo\.find)|:\s*DocHandle)/.test(line);
    if (bindsOracleUrl) {
      for (const name of line.matchAll(/\b(?:const|let|var)\s+(\w+)/g)) oracleNames.add(name[1]!);
    }
    if (bindsIsland) {
      const name = /\b(?:const|let|var)\s+(\w+)/.exec(line)?.[1];
      if (name) oracleNames.add(name);
    }
  });
  const escaped = [...oracleNames].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const handle = new RegExp(`\\b(?:${escaped.join("|")})\\b`);
  const found: string[] = [];
  lines.forEach((line, index) => {
    if (new RegExp(`\\b(?:${escaped.join("|")})\\s*\\.\\s*change\\s*\\(`).test(line)) found.push(`${path}:${index + 1}: oracle handle .change()`);
  });
  const writerCall = new RegExp(`${writerNames.source}[^)]*\\b(?:${escaped.join("|")})\\b`, "gs");
  for (const match of code.matchAll(writerCall)) {
    const line = code.slice(0, match.index).split("\n").length;
    found.push(`${path}:${line}: writer receives oracle handle`);
  }
  return found;
}

function sourceFiles(): string[] {
  return PACKAGES.flatMap((pkg) => walk(join(REPO, "packages", pkg, "src"))).map((file) => relative(REPO, file)).sort();
}

describe("the census of oracle document writers", () => {
  test("every source tree stands in the census", () => {
    const files = sourceFiles();
    for (const pkg of PACKAGES) expect(files.some((file) => file.startsWith(`packages/${pkg}/src/`)), pkg).toBe(true);
    expect(files).toContain("packages/lararium-mesh/src/genesis-intake.ts");
  });

  test("no vessel writes the oracle document after genesis materialization", () => {
    const hits = sourceFiles().flatMap((file) => oracleWriters(file, readFileSync(join(REPO, file), "utf8")));
    expect(hits).toEqual([]);
  });

  test("CONTROL: a planted oracle writer is named by file and line", () => {
    const planted = `const islandHandle = await materializeGenesisIsland(repo, seed, "planted");\nislandHandle.change((doc) => { doc.tiddlers[key] = row; });`;
    expect(oracleWriters("fixture/planted.ts", planted)).toEqual(["fixture/planted.ts:2: oracle handle .change()"]);
  });
});
