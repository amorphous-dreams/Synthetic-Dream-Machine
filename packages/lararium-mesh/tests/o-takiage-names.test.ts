/**
 * o-takiage-names — the o-takiage of W26: the oracle pointer retired, so no code name says "oracle" for a thing that is
 * now the flow, the floor, the release or a catalog row. Every file name and every code token (comments aside) in
 * packages, tools, tests, deploy and the workflows that carries the word must sit in a named, reasoned allowlist; a
 * name outside it is a retired relation still wearing the old word (one name, one relation).
 *
 * Two senses stay by ruling, each cited to the row that burns it down:
 *   · SLICE5  the genesis island document (`BAG_IDS.oracle`, `ORACLE_BAG`, `oracleUrl` ...) and the plane, recipe-uri and
 *             `kind` tags it persists. It still carries the floor's read-face layer of every wiki recipe, so its rename
 *             rides the slice-5 lane together with the layer change and the genesis re-bake
 *             (`lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane` #/owed).
 *   · OTHER   a sense that never meant the pointer: the divination frame `<<~ oracle>>`, a reference implementation a test
 *             compares against (`oracleTw`, `tw5-oracle.js`), and the tests that pin a retired symbol or variable absent or ignored.
 *
 * CONTROLS: a stale allowlist entry (a name no source carries) fails, so the list burns down with its lane; the new
 * flow names exist where the old ones stood.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const REPO = join(import.meta.dirname, "..", "..", "..");
const ROOTS = ["packages", "tools", "tests", "deploy", ".github"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "fixtures", "VSCode-TW5-Syntax", "tiddlers", "lararium-sensorium"]);
const CODE = /\.(ts|mjs|js|sh|yml|conf)$/;

const SLICE5 = "slice 5 (w26-floor-lane #/owed): the genesis island doc keeps its name until the floor read-face replaces its layer";
const OTHER = "a sense that never meant the pointer";

/** token -> the reason it stands. */
const TOKENS: Record<string, string> = Object.fromEntries([
  ...["ORACLE_BAG", "ORACLE_DOC_URI", "ORACLE_GENESIS_DOC_SEED", "ORACLE_ADDRESS", "ORACLE_URL", "ORACLE_RECIPE", "ORACLE", "oracle", "Oracle", "oracles",
    "oracleUrl", "oracleDocUrl", "oracleDocument", "oracleGenesisDocUrl", "oracleHandle", "oracleId", "oracleAtBoot", "oracleDaemon", "oracleBefore",
    "genesisCasCidsFromOracle", "loadOrMaterializeOracle", "hearthOracle", "leafOracle", "emptyOracle", "mutatedOracle", "onlyOracle", "withOracle",
    "oracleRec", "oracleOf", "OracleRecord", "fakeOracle", "oracleNames", "oracleWriters", "bindsOracleUrl", "registerCrossroadsInOracle",
  ].map((t) => [t, SLICE5] as const),
  ...["oracleTw", "oracleRel", "oracleReadFace", "LAR_ORACLE_ORIGIN"].map((t) => [t, OTHER] as const),
]);

const FILES: Record<string, string> = {
  "packages/lararium-mesh/tests/oracle-doc-no-writer.test.ts": SLICE5,
  "packages/lararium-node/tests/shared-oracle-doc.probe.test.ts": SLICE5,
  "packages/lararium-mesh/tests/couple-oracle.test.ts": "a recovery oracle for the coupling estimator, a test oracle",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const codeOf = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1").replace(/^\s*#.*$/gm, "");

function census() {
  const names: string[] = [];
  const tokens = new Map<string, string[]>();
  for (const root of ROOTS) {
    for (const path of walk(join(REPO, root))) {
      const rel = path.slice(REPO.length + 1);
      if (/oracle/i.test(rel.split("/").pop()!)) names.push(rel);
      if (!CODE.test(rel) || rel === "packages/lararium-mesh/tests/o-takiage-names.test.ts") continue;
      for (const t of codeOf(readFileSync(path, "utf8")).match(/[A-Za-z0-9_]*[Oo][Rr][Aa][Cc][Ll][Ee][A-Za-z0-9_]*/g) ?? []) {
        tokens.set(t, [...(tokens.get(t) ?? []), rel]);
      }
    }
  }
  return { names, tokens };
}

describe("no code name says oracle for a thing that is now the flow, the floor, the release or a catalog row", () => {
  const { names, tokens } = census();

  test("RED: every code token carrying the word sits in the reasoned allowlist", () => {
    const stray = [...tokens].filter(([t]) => !(t in TOKENS)).map(([t, where]) => `${t}  (${[...new Set(where)].slice(0, 2).join(", ")})`);
    expect(stray, "retired names still wearing the old word").toEqual([]);
  });

  test("RED: every file name carrying the word sits in the allowlist", () => {
    expect(names.filter((n) => !(n in FILES))).toEqual([]);
  });

  test("CONTROL: a stale allowlist entry fails, so each list burns down with its lane", () => {
    expect(Object.keys(TOKENS).filter((t) => !tokens.has(t))).toEqual([]);
    expect(Object.keys(FILES).filter((f) => !names.includes(f))).toEqual([]);
  });

  test("CONTROL: the flow names stand where the old ones did, and the wire route and environment carry the new word", () => {
    const read = (p: string) => readFileSync(join(REPO, p), "utf8");
    const client = read("packages/lararium-mesh/src/flow-read-client.ts");
    expect(client).toContain('FLOW_SOCKET_ROUTE  = "/flow"');
    expect(read("packages/lararium-mesh/src/hearth-floor-pins.ts")).toContain('HEARTH_FLOOR_CARD_ROUTE = "/flow"');
    expect(read("packages/lararium-node/src/lares-config.ts")).toContain("LAR_FLOW_ORIGIN");
    expect(read("packages/lararium-mesh/src/catalog-row.ts")).toContain("resolveCatalogRow");
    expect(read("packages/lararium-mesh/src/cap-tier.ts")).toContain("TierFloorSource");
  });
});
