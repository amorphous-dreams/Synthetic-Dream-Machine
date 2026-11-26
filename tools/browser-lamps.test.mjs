// browser-lamps.test.mjs — the lamp account holds to the tree and to the vitest configs.
// Every browser test file stands in exactly one class (lit, lamp, dim); a lamp names a file the tree holds and a proof the
// account knows; the pointer every dim comment cites (tools/ci-cells.mjs BROWSER_LAMPS_DIM) names a real export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BROWSER_LAMPS_DIM, BROWSER_LAMPS_LIT, LAMP_PROOFS, LAMPS_ENV, census, censusOf, lampsOf, litFilesOf, ticketLines } from "./browser-lamps.mjs";
import * as cells from "./ci-cells.mjs";

const CONFIG = `
const node = { test: { name: "web-node", include: [
  "tests/a.test.ts",
  "tests/b.test.ts",
] } };
const dark = [{ test: { name: "vessel-host", include: ["tests/vessel-host-*.test.ts"] } }];
`;
const LAMP = [{ project: "lamp-x", from: "vessel-host", files: [{ file: "tests/c.test.ts", proof: "relit-unproven" }] }];
const TREE = ["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts", "tests/d.test.ts"];
const count = (over = {}) => censusOf({ files: TREE, lit: litFilesOf(CONFIG, "web-node"), lamps: LAMP, configText: CONFIG, darkProjects: ["vessel-host"], ...over });

test("C1 the census counts every file once: lit, lamp and dim sum to the tree", () => {
  const c = count();
  assert.deepEqual({ total: c.total, lit: c.lit, lamp: c.lamp, dim: c.dim }, { total: 4, lit: 2, lamp: 1, dim: 1 });
  assert.deepEqual(c.dimFiles, ["tests/d.test.ts"]);
  assert.deepEqual(c.byProof, { "relit-unproven": 1, lit: 0, red: 0 });
  assert.deepEqual(c.problems, []);
});

test("C2 RED each break of the account reads as a named problem; CONTROL: C1's lawful account names none", () => {
  const gone = count({ lamps: [{ ...LAMP[0], files: [{ file: "tests/gone.test.ts", proof: "relit-unproven" }] }] });
  assert.match(gone.problems.join("\n"), /lamp lamp-x names tests\/gone\.test\.ts, which the tree lacks/);
  const both = count({ lamps: [{ ...LAMP[0], files: [{ file: "tests/a.test.ts", proof: "relit-unproven" }] }] });
  assert.match(both.problems.join("\n"), /tests\/a\.test\.ts stands both lit and in lamp lamp-x/);
  const twice = count({ lamps: [LAMP[0], { ...LAMP[0], project: "lamp-y" }] });
  assert.match(twice.problems.join("\n"), /tests\/c\.test\.ts stands in two lamps/);
  const unknown = count({ lamps: [{ ...LAMP[0], files: [{ file: "tests/c.test.ts", proof: "green-enough" }] }] });
  assert.match(unknown.problems.join("\n"), /carries no known proof \(green-enough\)/);
  const orphan = count({ lamps: [{ ...LAMP[0], from: "no-such-project" }] });
  assert.match(orphan.problems.join("\n"), /takes its settings from "no-such-project", which the config lacks/);
  const stale = count({ lit: ["tests/a.test.ts", "tests/left.test.ts"] });
  assert.match(stale.problems.join("\n"), /the lit list names tests\/left\.test\.ts, which the tree lacks/);
  const dark = count({ darkProjects: ["chromium"] });
  assert.match(dark.problems.join("\n"), /the dim account names project "chromium", which the config lacks/);
});

test("C3 a red lamp stays in the count: a finding, never hidden", () => {
  const c = count({ lamps: [{ ...LAMP[0], files: [{ file: "tests/c.test.ts", proof: "red", note: "the second boot read nothing" }] }] });
  assert.equal(c.lamp, 1);
  assert.equal(c.byProof.red, 1);
  assert.deepEqual(c.problems, []);
});

test("C4 litFilesOf reads the named project's own include list, and refuses a project the config lacks", () => {
  assert.deepEqual(litFilesOf(CONFIG, "web-node"), ["tests/a.test.ts", "tests/b.test.ts"]);
  assert.throws(() => litFilesOf(CONFIG, "browser-node"), /names no project "browser-node"/);
});

test("T1 the real tree: the account holds with no problem, and every count sums", () => {
  const rows = census();
  assert.deepEqual(rows.map((r) => r.pkg), BROWSER_LAMPS_DIM.packages.map((p) => p.pkg));
  for (const row of rows) {
    assert.deepEqual(row.problems, [], `${row.pkg}: ${row.problems.join("; ")}`);
    assert.equal(row.lit + row.lamp + row.dim, row.total, `${row.pkg}: lit + lamp + dim`);
    assert.ok(row.lit > 0, `${row.pkg}: a lit list that reads empty reads as a broken census`);
  }
});

test("T2 every lamp carries a proof the account knows, and the ticket runs exactly the lamp projects under the lamp environment", () => {
  for (const lamp of BROWSER_LAMPS_LIT) {
    assert.ok(lamp.files.length > 0, `${lamp.project} holds files`);
    for (const f of lamp.files) assert.ok(LAMP_PROOFS.includes(f.proof), `${f.file}: ${f.proof}`);
  }
  const lines = ticketLines();
  const dirs = [...new Set(BROWSER_LAMPS_LIT.map((lamp) => lamp.dir))];
  assert.equal(lines.length, dirs.length);
  for (const dir of dirs) {
    const line = lines.find((l) => l.includes(`cd ${dir} `));
    assert.ok(line, `a ticket line for ${dir}`);
    assert.ok(line.includes(`${LAMPS_ENV}=1 `));
    assert.deepEqual([...line.matchAll(/--project (\S+?)\)?(?= |$)/g)].map((m) => m[1].replace(/\)$/, "")), lampsOf(dir).map((lamp) => lamp.project));
  }
});

test("P1 the pointer reads true: tools/ci-cells.mjs exports BROWSER_LAMPS_DIM and BROWSER_LAMPS_LIT", () => {
  assert.equal(cells.BROWSER_LAMPS_DIM, BROWSER_LAMPS_DIM);
  assert.equal(cells.BROWSER_LAMPS_LIT, BROWSER_LAMPS_LIT);
  assert.ok(BROWSER_LAMPS_DIM.relight.length > 0);
});
