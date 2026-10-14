/**
 * charter-funnel — every test that builds a charter goes through ONE helper.
 *
 * A charter epoch's shape changes once, in one commit. This witness keeps that commit's edit to the helper
 * (`charter-fixture.ts` here, and the CLI's half `seal-rite-fixture.ts`): it reads every test, probe and
 * script source of every package, the root `tests/` tree and `tools/` (TypeScript, JavaScript, shell and
 * Python), strips comments, and refuses any file that builds a charter by hand outside the helper.
 *
 * Building by hand reads as any of:
 *   · an epoch constructor (`genesisCharterEpoch`, `rotateSealEpoch`, `mintCharterEpoch`), by any import;
 *   · a field or a flag that says how an epoch commits its successors (`nextKeyCommit`, `next-key-commit`,
 *     and the per-seat spelling `nextKeyDigests`, `nextThreshold`);
 *   · a charter doc written as a literal (`kind: NEXUS_DOC_DOMAIN`, the key quoted or bare).
 * A test that bends a doc the helper built (`{ ...charter.doc(), sealLineage: [] }`) builds none by hand, and
 * neither does one that starts from the product's own empty doc (`emptyFoundingCharterDoc()`).
 *
 * Some files stand outside the funnel, each by name and each for a stated reason:
 *   · `roll-law`: the shape of an epoch or of a roll stands as its subject, field by field;
 *   · `rite-law`: what the seat and rotate rites write and refuse stands as its subject;
 *   · `doc-law`: the charter doc's reader and writer stand as its subject, a torn doc among its vectors;
 *   · `signed-bytes`: it pins the exact bytes an act signs;
 * Every named file must still build by hand, so a file that moved into the funnel leaves this list in the same
 * commit.
 *
 * What it guards: drift. A hand that assembles a constructor's or a field's name from parts passes it, and so
 * does a doc whose `kind` arrives through a variable; a review reads those.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "../../..");

/** The helper: the only files that may say how a charter gets built. */
const HELPERS = [
  "packages/lararium-mesh/tests/charter-fixture.ts",
  "packages/lares-cli/tests/seal-rite-fixture.ts",
] as const;

type Outside = "roll-law" | "rite-law" | "doc-law" | "signed-bytes";
const OUTSIDE: Readonly<Record<string, Outside>> = {
  // The roll law, field by field; and the helper's own test, which holds the helper's bytes to the constructors'.
  "packages/lararium-mesh/tests/wax-stamp.test.ts":                     "roll-law",
  "packages/lararium-mesh/tests/charter-fixture.test.ts":               "roll-law",
  "packages/lararium-node/tests/seal-ceremony.test.ts":                 "roll-law",
  // What the seat and rotate rites write and refuse.
  "packages/lares-cli/tests/nexus-seal-lineage.test.ts":                "rite-law",
  "packages/lares-cli/tests/seal-rotate-refusal-codes.test.ts":         "rite-law",
  "packages/lararium-node/tests/seat-arming.test.ts":                   "rite-law",
  // The charter doc's reader and writer, a torn doc among the vectors.
  "packages/lararium-mesh/tests/nexus-seal-seed.test.ts":               "doc-law",
  "packages/lararium-node/tests/nexus-doc.test.ts":                     "doc-law",
  // The exact bytes a roll's signer signs.
  "packages/lararium-node/tests/sealed-acts.test.ts":                   "signed-bytes",
};

/** What building a charter by hand looks like in code. */
const BUILDS = new RegExp([
  String.raw`\b(?:genesisCharterEpoch|rotateSealEpoch|mintCharterEpoch)\b`,
  String.raw`\b(?:nextKeyCommit|nextKeyDigests|nextThreshold)\b`,
  String.raw`next-key-commit`,
  String.raw`(?:\bkind|["'\x60]kind["'\x60])\s*:\s*NEXUS_DOC_DOMAIN\b`,
].join("|"));

/** Source with its comments gone: a docblock that names a constructor builds nothing. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\x60\\])\/\/[^\n]*/g, "$1");
}

function sourcesUnder(dir: string, out: string[] = []): string[] {
  let names: string[];
  try { names = readdirSync(path.join(REPO, dir)); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) sourcesUnder(rel, out);
    else if (/\.(?:ts|tsx|mts|mjs|js|sh|py)$/.test(name)) out.push(rel);
  }
  return out;
}

function everyTestSource(): string[] {
  const out: string[] = [];
  for (const pkg of readdirSync(path.join(REPO, "packages"))) {
    sourcesUnder(`packages/${pkg}/tests`, out);
    sourcesUnder(`packages/${pkg}/probes`, out);
    sourcesUnder(`packages/${pkg}/scripts`, out);
  }
  sourcesUnder("tests", out);
  sourcesUnder("tools", out);
  return out.sort();
}

/** This witness names every token it hunts, so it never reads itself. */
const SELF = "packages/lararium-mesh/tests/charter-funnel.test.ts";

/** A shell or Python file carries no comment syntax this strip knows, and a glob there spells a fence, so it reads whole. */
const buildsIn = (source: string, rel = "x.ts"): boolean => BUILDS.test(/\.(?:sh|py)$/.test(rel) ? source : stripComments(source));
const builds = (rel: string): boolean => buildsIn(readFileSync(path.join(REPO, rel), "utf8"), rel);

describe("the charter funnel", () => {
  const sources = everyTestSource();

  test("CONTROL: the witness reads the tree, and the strip leaves code standing", () => {
    expect(sources.length).toBeGreaterThan(1000);
    for (const helper of HELPERS) expect(sources, helper).toContain(helper);
    for (const dir of ["packages/lararium-node/tests/", "packages/lares-cli/tests/", "packages/lararium-keyhive/tests/", "packages/lararium-node/probes/", "packages/lararium-node/scripts/", "tests/e2e/", "tests/harness/", "tools/"]) {
      expect(sources.some((rel) => rel.startsWith(dir)), dir).toBe(true);
    }
    // The helper itself builds: a witness that finds no constructor there reads nothing.
    for (const helper of HELPERS) expect(builds(helper), helper).toBe(true);
    expect(buildsIn("/* genesisCharterEpoch */ // rotateSealEpoch\nconst x = 1;")).toBe(false);
    expect(buildsIn("const url = \"lar://h\"; const e = genesisCharterEpoch(keys, 2, \"\");")).toBe(true);
    expect(buildsIn("import { rotateSealEpoch as roll } from \"@lararium/mesh\";")).toBe(true);
    expect(buildsIn("const forged = mintCharterEpoch({ ...head, prevEpochCid: \"forged\" });")).toBe(true);
    expect(buildsIn("const e = { epochCid, keySetHash: \"\", nextKeyCommit: \"\", prevEpochCid: null };")).toBe(true);
    expect(buildsIn("const e = { nextKeyDigests: [], nextThreshold: 1 };")).toBe(true);
    expect(buildsIn("run(args([\"seal\", \"seat\"], { \"next-key-commit\": commit }))")).toBe(true);
    expect(buildsIn("as_a nexus seal seat --next-key-commit \"$COMMIT\"", "tools/x.sh")).toBe(true);
    // A shell glob spells a comment's fences; the strip would eat the rite between two of them.
    expect(buildsIn("for d in packages/*/; do :; done\nlares nexus seal seat --next-key-commit x\nls tools/*/", "tools/x.sh")).toBe(true);
    expect(buildsIn("const doc = { kind : NEXUS_DOC_DOMAIN, threshold: 2 };")).toBe(true);
    expect(buildsIn("const doc = { \"kind\": NEXUS_DOC_DOMAIN, threshold: 2 };")).toBe(true);
    expect(buildsIn("subprocess.run(['lares', 'nexus', 'seal', 'seat', '--next-key-commit', digest])  # glob /* then */", "tools/x.py")).toBe(true);
    // Neighbouring words build nothing: a key log's own relation, a domain read off a doc, a doc the helper built.
    expect(buildsIn("nextKeyCommitted(inception, key)")).toBe(false);
    expect(buildsIn("expect(doc.kind).toBe(NEXUS_DOC_DOMAIN);")).toBe(false);
    expect(buildsIn("const torn = { ...charter.doc(), sealLineage: [] };")).toBe(false);
    expect(buildsIn("const empty = emptyFoundingCharterDoc();")).toBe(false);
    expect(buildsIn("const c = heldCharter({ keys, threshold: 2, successors: { keys: next, threshold: 2 } });")).toBe(false);
  });

  test("RED: no test, probe, harness or tool source builds a charter outside the helper and the files named outside it", () => {
    const stray = sources.filter((rel) => rel !== SELF && !(HELPERS as readonly string[]).includes(rel) && !(rel in OUTSIDE) && builds(rel));
    expect(stray, `these build a charter by hand:\n  ${stray.join("\n  ")}`).toEqual([]);
  });

  test("every file named outside the funnel still stands and still builds by hand", () => {
    for (const rel of Object.keys(OUTSIDE)) {
      expect(sources, `${rel} left the tree: drop its row`).toContain(rel);
      expect(builds(rel), `${rel} builds no charter by hand: drop its row`).toBe(true);
    }
  });
});
