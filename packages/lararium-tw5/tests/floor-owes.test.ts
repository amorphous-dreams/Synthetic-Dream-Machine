/**
 * floor-owes — the floor's ticket rule folds inside the wiki (research/corpus-seams): a touched path maps to its seams, a
 * seam owes its guards, trunk seams and hubs owe whole sets, a path in no seam refuses, an unread fact owes more, and the
 * house skin classes the operator. RED-FIRST: written by floor-owes#1, run by the familiar.
 */
import { describe, expect, test } from "vitest";
import { FLOOR_SEAMS, censusOf, floorOwesRows, owedOf, readOwes, refusalOf, seamsOfPath, sha256Hex, tableDigestOf } from "../src/floor-owes.js";
import { floorOwes } from "../src/filters/floor-owes.js";
import { LARARIUM_MODULES, skinOfModule } from "../plugin-build/skins.js";

const TABLE = [
  "# a planted table",
  "HUB 3",
  "WIDE 3",
  "SWIFT 5",
  "PKG n packages/node",
  "PKG c packages/cli",
  "FREE **/*.md tools/*.sh",
  "CONFIG packages/*/package.json packages/*/src/index.ts package.json",
  "VESSEL tools/stands-a-house.test.mjs",
  "DARK packages/web/tests/e2e/**",
  "SEAM boot trunk",
  "MOVES boot n open-vessel* island-*",
  "GUARDS boot e2e smoke",
  "GUARDS boot tool stands-a-house",
  "SEAM doors whole=packages/cli",
  "MOVES doors c verb-table* commands/tiddler*",
  "GUARDS doors node-e2e door-walk",
  "GUARDS doors witness law-mutants-witness",
  "SEAM shore",
  "MOVES shore n shore-*",
  "MOVES shore path packages/web/src/**",
  "GUARDS shore path packages/cli/tests/shore-*.test.ts packages/cli/tests/ingest-settles.test.ts packages/web/tests/e2e/shore.e2e.test.ts",
  "BOTH boot doors e2e-root",
].join("\n");
const rows = (facts: string[], view = "runs"): string[] => floorOwesRows(`${TABLE}\n${facts.join("\n")}`, view);

describe("the fold", () => {
  test("RED 1 (R2): a touched path owes its seam's guards, by tier; CONTROL: a FREE path owes nothing", () => {
    const out = rows(["TOUCH packages/node/src/shore-verb.ts"]);
    expect(out[0]).toBe(`OWES facts=1 table=${tableDigestOf(TABLE)} touched=1 seams=1 refuse=0 sets=0 globs=1 files=2`);
    expect(out).toContain("GLOB packages/cli/tests/shore-*.test.ts · seam:shore");
    expect(out).toContain("FILE heavy packages/cli/tests/ingest-settles.test.ts · seam:shore");
    expect(out).toContain("FILE dark packages/web/tests/e2e/shore.e2e.test.ts · seam:shore");
    expect(rows(["TOUCH docs/notes.md"])).toEqual([`OWES facts=1 table=${tableDigestOf(TABLE)} touched=1 seams=0 refuse=0 sets=0 globs=0 files=0`]);
  });

  test("RED 2 (R1): an edge test rides with its measured tier; a touched test owes itself; a GONE test owes nothing", () => {
    const out = rows([
      "TOUCH packages/node/src/shore-verb.ts", "TOUCH packages/node/tests/a.test.ts", "TOUCH packages/node/tests/gone.test.ts", "GONE packages/node/tests/gone.test.ts",
      "EDGE packages/node/tests/quick.test.ts packages/node/src/shore-verb.ts secs=0.4", "EDGE packages/node/tests/slow.test.ts packages/node/src/shore-verb.ts secs=41",
      "EDGE packages/node/tests/e2e/walk.test.ts packages/node/src/shore-verb.ts",
    ]);
    expect(out).toContain("FILE swift packages/node/tests/quick.test.ts · edge:packages/node/src/shore-verb.ts");
    expect(out).toContain("FILE heavy packages/node/tests/slow.test.ts · edge:packages/node/src/shore-verb.ts");
    expect(out).toContain("FILE vessel packages/node/tests/e2e/walk.test.ts · edge:packages/node/src/shore-verb.ts");
    expect(out).toContain("FILE heavy packages/node/tests/a.test.ts · itself");
    expect(out.some((r) => r.includes("gone.test.ts"))).toBe(false);
  });

  test("RED 3 (R3): a trunk seam owes the node e2e set; a whole= seam its package; both hit owes the root set; a VESSEL tool test reads vessel", () => {
    const out = rows(["TOUCH packages/node/src/open-vessel.ts", "TOUCH packages/cli/src/commands/tiddler.ts"]);
    expect(out).toContain("SET e2e-node · trunk:boot");
    expect(out).toContain("SET pkg:packages/cli · whole:doors");
    expect(out).toContain("SET e2e-root · both:boot+doors");
    expect(out).toContain("SET witness:law-mutants-witness · seam:doors");
    expect(out).toContain("FILE vessel tools/stands-a-house.test.mjs · seam:boot");
    expect(out).toContain("FILE vessel tests/e2e/smoke.test.ts · seam:boot");
    expect(out).toContain("FILE vessel packages/lararium-node/tests/e2e/door-walk.test.ts · seam:doors");
    // CONTROL: one of the two seams alone owes no root set.
    expect(rows(["TOUCH packages/node/src/open-vessel.ts"], "sets")).toEqual(["e2e-node"]);
  });

  test("RED 4 (R3): a hub (fan-in at the HUB row) and a barrel or config owe the package whole and the node e2e set; a root config owes all", () => {
    const edge = (n: number) => `EDGE packages/node/tests/t${n}.test.ts packages/node/src/shore-verb.ts`;
    expect(rows(["TOUCH packages/node/src/shore-verb.ts", edge(1), edge(2)], "sets")).toEqual([]);
    expect(rows(["TOUCH packages/node/src/shore-verb.ts", edge(1), edge(2), edge(3)], "sets")).toEqual(["e2e-node", "pkg:packages/node"]);
    expect(rows(["TOUCH packages/node/src/index.ts"], "sets")).toEqual(["e2e-node", "pkg:packages/node"]);
    expect(rows(["TOUCH packages/cli/package.json"], "sets")).toEqual(["e2e-node", "pkg:packages/cli"]);
    expect(rows(["TOUCH package.json"], "sets")).toEqual(["all", "e2e-node"]);
  });

  test("RED 5 (R3): seams hit at the WIDE row owe every touched package whole", () => {
    const out = rows(["TOUCH packages/node/src/open-vessel.ts", "TOUCH packages/cli/src/verb-table.ts", "TOUCH packages/node/src/shore-verb.ts", "TOUCH packages/web/tests/helper.md"], "sets");
    expect(out).toContain("pkg:packages/node");
    expect(out).toContain("pkg:packages/cli");
    expect(out).toContain("pkg:packages/web");
  });

  test("RED 6 (R4): a touched source path in no seam refuses the ticket, naming the path; CONTROL: a test file needs no seam", () => {
    const out = rows(["TOUCH packages/node/src/brand-new.ts", "TOUCH packages/node/tests/brand-new.test.ts"]);
    expect(out).toContain(`REFUSE packages/node/src/brand-new.ts · ${refusalOf("packages/node/src/brand-new.ts")}`);
    expect(refusalOf("x")).toBe("floor-owes: x stands in no seam; add a MOVES row to the seam table, then ask again");
    expect(rows(["TOUCH packages/node/src/brand-new.ts", "TOUCH packages/node/tests/brand-new.test.ts"], "refuse")).toEqual(["packages/node/src/brand-new.ts"]);
    expect(rows(["TOUCH packages/node/tests/brand-new.test.ts"], "refuse")).toEqual([]);
  });

  test("RED 7: an unread fact owes MORE (all, and the node e2e set); unread weights leave every owed file heavy and widen nothing", () => {
    expect(rows(["UNREAD diff"], "sets")).toEqual(["all", "e2e-node"]);
    expect(rows(["TOUCH packages/node/src/shore-verb.ts", "UNREAD edges"], "sets")).toEqual(["all", "e2e-node"]);
    expect(rows(["TOUCH packages/node/src/shore-verb.ts", "UNREAD weights"], "sets")).toEqual([]);
  });

  test("RED 8: a line no grammar reads throws (a dropped GUARDS row would owe less in silence); so do an undeclared seam, a twice-declared seam and an unknown view", () => {
    expect(() => floorOwesRows(`${TABLE}\nGARDS boot e2e smoke`)).toThrow(/line 24 carries no row the grammar reads/);
    expect(() => floorOwesRows("MOVES nowhere path x/**")).toThrow(/names the seam "nowhere"/);
    expect(() => floorOwesRows("SEAM a\nSEAM a")).toThrow(/a second time/);
    expect(() => floorOwesRows("SEAM a sturdy")).toThrow(/flags: trunk · root · whole=<dir>/);
    expect(() => rows([], "rnus")).toThrow(/names no view/);
  });

  test("RED 9: duplicate fact lines fold once (the header counts unique lines); a path holding a space rides percent-encoded", () => {
    const out = rows(["TOUCH packages/node/src/shore-verb.ts", "TOUCH packages/node/src/shore-verb.ts", "TOUCH docs/a%20b.md"]);
    expect(out[0]).toContain("facts=2 touched=2");
    expect(readOwes(`${TABLE}\nTOUCH docs/a%20b.md`).facts.touched).toEqual(["docs/a b.md"]);
  });

  test("RED 10: stem globs read the basename, deep globs the path under src, and a path glob the repo path", () => {
    const { table } = readOwes(TABLE);
    expect(seamsOfPath(table, "packages/node/src/deep/island-pool.ts")).toEqual(["boot"]);
    expect(seamsOfPath(table, "packages/cli/src/commands/tiddler.ts")).toEqual(["doors"]);
    expect(seamsOfPath(table, "packages/cli/src/tiddler.ts")).toEqual([]);
    expect(seamsOfPath(table, "packages/node/tests/island-x.ts")).toEqual([]);
    expect(seamsOfPath(table, "packages/web/src/a/b.tsx")).toEqual(["shore"]);
  });

  test("RED 11: the census names unmapped paths, undeclared vessel files and dead guards; CONTROL: a covered tree reads clean", () => {
    const tree = [
      "packages/node/src/open-vessel.ts", "tests/e2e/smoke.test.ts", "tools/stands-a-house.test.mjs", "packages/lararium-node/tests/e2e/door-walk.test.ts",
      "packages/cli/tests/shore-a.test.ts", "packages/cli/tests/ingest-settles.test.ts", "packages/web/tests/e2e/shore.e2e.test.ts", "tools/law-mutants-witness.sh",
    ];
    const read = (paths: string[]) => { const { table, facts } = readOwes(`${TABLE}\n${paths.map((p) => `TOUCH ${p}`).join("\n")}`); return censusOf(table, facts); };
    expect(read(tree)).toEqual({ unmapped: [], undeclared: [], dead: [] });
    const c = read([...tree.filter((p) => p !== "tests/e2e/smoke.test.ts"), "packages/node/src/stray.ts", "tests/e2e/unowned.test.ts", "packages/web/tests/e2e/dim.e2e.test.ts"]);
    expect(c.unmapped).toEqual(["packages/node/src/stray.ts"]);
    expect(c.undeclared).toEqual(["tests/e2e/unowned.test.ts"]);
    expect(c.dead).toEqual(["boot tests/e2e/smoke.test.ts"]);
    expect(rows(tree.map((p) => `TOUCH ${p}`), "census")).toEqual(["CENSUS files=8 unmapped=0 undeclared=0 dead=0"]);
  });

  test("RED 14: the table names itself by its bytes: the digest reads the table rows alone, moves with any row, and holds through blank lines and facts", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930855e0644e59c94fca4f2e8a4ed91a3b54d4ae7c");
    const digest = tableDigestOf(TABLE);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(tableDigestOf(`\n  ${TABLE.split("\n").join("  \n\n")}\nTOUCH a\nEDGE t a\nUNREAD diff`)).toBe(digest);
    expect(tableDigestOf(`${TABLE}\nFREE scratch/**`)).not.toBe(digest);
    expect(tableDigestOf(TABLE.replace("HUB 3", "HUB 4"))).not.toBe(digest);
    expect(rows(["TOUCH docs/notes.md"])[0]).toContain(` table=${digest} `);
  });

  test("CONTROL: one diff answers one owed set, whatever order its facts arrive in", () => {
    const facts = ["TOUCH packages/node/src/open-vessel.ts", "TOUCH packages/cli/src/verb-table.ts", "EDGE packages/node/tests/a.test.ts packages/node/src/open-vessel.ts secs=9"];
    const { table, facts: f } = readOwes(`${TABLE}\n${facts.join("\n")}`);
    expect(rows([...facts].reverse())).toEqual(rows(facts));
    expect(owedOf(table, f).seams).toEqual(["boot", "doors"]);
  });
});

describe("the operator", () => {
  const wiki = (texts: Record<string, string>) => ({ getTiddler: (title: string) => (title in texts ? { fields: { title, text: texts[title] } } : undefined) });
  const run = (titles: string[], operands: string[], texts: Record<string, string>): string[] =>
    floorOwes((cb) => titles.forEach((t) => cb(undefined as never, t)), { operator: "floor-owes", operand: operands[0] ?? "", operands: operands as never }, { wiki: wiki(texts) as never });

  test("RED 12: the operator folds the seam record with the percent-encoded facts of its second operand", () => {
    const facts = "TOUCH packages/node/src/open-vessel.ts\nTOUCH packages/node/src/[odd].ts";
    const out = run([FLOOR_SEAMS], ["runs", encodeURIComponent(facts)], { [FLOOR_SEAMS]: TABLE });
    expect(out[0]).toContain("facts=2 touched=2 seams=1 refuse=1");
    expect(out).toContain("SET e2e-node · trunk:boot");
    expect(run([FLOOR_SEAMS, "facts"], ["sets"], { [FLOOR_SEAMS]: TABLE, facts: "TOUCH packages/node/src/open-vessel.ts" })).toEqual(["e2e-node"]);
  });

  test("RED 13: a record the wiki lacks throws by title (an empty answer would read as nothing owed); so do facts that will not decode", () => {
    expect(() => run(["lar:///nowhere"], ["runs"], {})).toThrow(/lar:\/\/\/nowhere names no record/);
    expect(() => run([FLOOR_SEAMS], ["runs", "%E0%A4%A"], { [FLOOR_SEAMS]: TABLE })).toThrow(/would not decode/);
  });

  test("the house skin classes the operator", () => {
    const title = "lar:///ha.ka.ba/lararium/tw5/filters/floor-owes";
    expect(LARARIUM_MODULES).toContain(title);
    expect(skinOfModule(title).name).toBe("lararium");
  });
});
