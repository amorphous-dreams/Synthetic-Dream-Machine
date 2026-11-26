/**
 * floor-owes — RED FIRST (written by floor-owes#1, run by the familiar). The floor's ticket rule, driven end to end: the host
 * gathers a diff's facts, the wiki's fold answers the owed set, the bench gate plans the steps.
 *
 * THE REPLAY: the #585 landing (develop merge 31bd0e0c3) ran a narrow ticket and left two files red on develop,
 * `packages/lares-cli/tests/ingest-settles-every-row.test.ts` and `packages/lararium-node/tests/e2e/lit-face-home-wiki.test.ts`.
 * Fed that merge's 21 source paths, the rule owes both, and the gate's plan holds a step that runs each.
 * CONTROL rows stand beside each RED, so a rule that owes everything or nothing reads red here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NODE_E2E, ROOT_E2E, VESSEL, checkOwes, owedSteps, plan, runGate, tracked } from "./bench-gate.mjs";
import { DEVELOP, DOOR_ASK_BYTES, FOLD, ROOT, TABLE, askFilter, census, checkoutJudge, edgesOf, gatherFacts, headerHolds, lines, owes, resolveLiteral, runFold, secsOf, tidText } from "./floor-owes.mjs";

/** The source paths the #585 merge moved (`git diff --name-only 31bd0e0c3^1 31bd0e0c3`, tests and the inventory aside). */
const REPLAY_585 = [
  "packages/lararium-mesh/src/capability-record.ts", "packages/lararium-mesh/src/lar-vessel.ts", "packages/lararium-mesh/src/sealed-rest.ts",
  "packages/lararium-node/src/disk-projector.ts", "packages/lararium-node/src/heads-rest.ts", "packages/lararium-node/src/index.ts",
  "packages/lararium-node/src/ingest-scan.ts", "packages/lararium-node/src/island-behaviors.ts", "packages/lararium-node/src/native-landing.ts",
  "packages/lararium-node/src/open-node-vessel.ts", "packages/lararium-node/src/shore-verb.ts", "packages/lararium-node/src/standoff-drafts.ts",
  "packages/lararium-node/src/synced-tree.ts", "packages/lararium-node/src/worker-handle.ts",
  "packages/lares-cli/src/commands/ingest.ts", "packages/lares-cli/src/commands/shore.ts", "packages/lares-cli/src/commands/watch.ts",
  "packages/lares-cli/src/ingest-core.ts", "packages/lares-cli/src/seed-mirrors.ts", "packages/lares-cli/src/shore-core.ts", "packages/lares-cli/src/shore-take-disk.ts",
];
const MISSED_CLI = "packages/lares-cli/tests/ingest-settles-every-row.test.ts";
const MISSED_NODE_E2E = "packages/lararium-node/tests/e2e/lit-face-home-wiki.test.ts";

/** Four of the cli package's own unit files (package-relative), for weights a plan can read against the live tree. */
const CLI_TESTS = tracked("packages/lares-cli/tests/*.test.ts").slice(0, 4).map((p) => p.slice("packages/lares-cli/".length));
const darkDoor = () => ({ ok: false, stdout: "", why: "no hearth on this bench" });
const own = () => checkoutJudge(ROOT);
/** The checkout's own fold over its own table and the given fact lines. */
const fold = (facts, view = "runs") => { const j = own(); return runFold(j.fold, `${j.table}\n${facts.join("\n")}`, view); };
/** The owed set for touched paths, by the checkout's own fold (the doors dark). */
const owedFor = (paths) => owes({ root: ROOT, paths, door: darkDoor, judge: own });

test("RED replay #585: the merge's 21 source paths owe both files its narrow ticket missed, and the gate's plan runs each", () => {
  assert.equal(REPLAY_585.length, 21);
  const owed = owedFor(REPLAY_585);
  assert.equal(owed.via, "develop checkout");
  assert.deepEqual(owed.refuse, [], "every path of the replay stands in a seam");
  const cli = owed.files.find((f) => f.path === MISSED_CLI);
  assert.ok(cli, `the rule owes no ${MISSED_CLI}`);
  assert.match(cli.why, /seam:projector-base-pin/, "the projector seam declares the guard no import shows");
  const e2eNode = owed.sets.find((s) => s.name === "e2e-node");
  assert.ok(e2eNode, "a trunk seam owes the whole node e2e set");
  assert.match(e2eNode.why, /trunk:/);

  const steps = plan({ touched: [], owed });
  const names = steps.map((s) => s.name);
  assert.ok(names.indexOf("floor-owes") === 1 && names.indexOf("build") === 2, `the rule answers before the build: ${names.slice(0, 4).join(", ")}`);
  assert.ok(steps.some((s) => s.cwd === "packages/lares-cli" && s.args.includes(MISSED_CLI.slice("packages/lares-cli/".length))), "no step in the cli package runs ingest-settles-every-row");
  const node = steps.find((s) => s.name === "e2e-node");
  assert.ok(node, "the plan holds no node e2e step: the gate's tree walk drops every e2e/ path, the root of the lit-face miss");
  assert.deepEqual(node.args, NODE_E2E.args, "the whole set runs: the config alone, no file list");
  assert.equal(node.cwd, NODE_E2E.dir);
  assert.ok(node.scratch, "a step that stands vessels runs under its own scratch LAR_ROOT");
  assert.ok(tracked(`${NODE_E2E.dir}/${NODE_E2E.under}*.test.ts`).includes(MISSED_NODE_E2E), "the node e2e set lacks lit-face-home-wiki");
  assert.match(lines(owed).at(-1), /^owes=[0-9a-f]{64}$/);
});

test("CONTROL: prose owes nothing past the fixed floor; one leaf source owes its seam's guards and no whole set", () => {
  const prose = owedFor(["wtf/README.md", "wikis/workshop/ha.ka.ba/lares/docs/history/workshop/index.mem"]);
  assert.deepEqual([prose.refuse, prose.sets, prose.globs, prose.files], [[], [], [], []]);
  assert.deepEqual(plan({ touched: [], owed: prose }).map((s) => s.name).filter((n) => /^(owed|heavy|e2e|vessel|witness)-/.test(n)), []);
  const leaf = owedFor(["packages/lares-cli/src/commands/kapae.ts"]);
  assert.deepEqual(leaf.refuse, []);
  assert.ok(!leaf.sets.some((s) => s.name === "e2e-node" || s.name.startsWith("pkg:")), `a leaf command owes no whole set: ${leaf.sets.map((s) => s.name).join(", ")}`);
  assert.ok(leaf.files.some((f) => f.path === "tests/e2e/tiddler-door.test.ts" && f.tier === "vessel"), "the door seam's e2e guard rides, in the vessel tier");
  assert.ok(plan({ touched: [], owed: leaf }).some((s) => s.name === "e2e-root" && s.args.includes("e2e/tiddler-door.test.ts")));
});

test("RED R4: a touched source path in no seam refuses the ticket by name and stops the gate before the build", () => {
  const planted = "packages/lararium-node/src/zz-planted-in-no-seam.ts";
  const owed = owedFor([planted, "packages/lararium-node/src/shore-verb.ts"]);
  assert.deepEqual(owed.refuse.map((r) => r.path), [planted]);
  assert.equal(owed.refuse[0].why, `floor-owes: ${planted} stands in no seam; add a MOVES row to the seam table, then ask again`);
  const said = [];
  assert.equal(checkOwes(owed, (l) => said.push(l)), 1);
  assert.match(said.join("\n"), new RegExp(`REFUSE ${planted.replace(/[.]/g, "\\.")}`));
  assert.match(said.at(-1), /^pono: seat each refused path/);
  const ran = [];
  const r = runGate(plan({ touched: [], owed }).filter((s) => !s.check || s.check === "owes"), (s) => { ran.push(s.name); return s.check === "owes" ? checkOwes(owed, () => {}) : 0; }, () => {});
  assert.deepEqual(ran, ["floor-owes"], "a refused ticket builds nothing");
  assert.match(r.line, /^BENCH GATE REFUSES: floor-owes \(exit 1\)/);
  // CONTROL: the same lane without the planted path passes the step.
  assert.equal(checkOwes(owedFor(["packages/lararium-node/src/shore-verb.ts"]), () => {}), 0);
});

test("RED: an unreadable fact owes MORE, never less; a hub and a barrel owe their package whole and the node e2e set", () => {
  assert.deepEqual(fold(["UNREAD diff"], "sets"), ["all", "e2e-node"]);
  assert.deepEqual(fold(["TOUCH packages/lares-cli/src/commands/kapae.ts", "UNREAD edges"], "sets"), ["all", "e2e-node"]);
  const all = owedSteps({ owed: { via: "develop x", touched: [], refuse: [], globs: [], files: [], sets: [{ name: "all", why: "unread:diff" }, { name: "e2e-node", why: "unread:diff" }] }, weights: { "packages/lares-cli": { [CLI_TESTS[0]]: 9 } }, root: ROOT });
  assert.ok(all.some((s) => s.name === "heavy-lares-cli") && all.some((s) => s.name === "e2e-node"));
  const edges = Array.from({ length: 40 }, (_, i) => `EDGE packages/lares-cli/tests/t${i}.test.ts packages/lares-cli/src/commands/kapae.ts`);
  assert.deepEqual(fold(["TOUCH packages/lares-cli/src/commands/kapae.ts", ...edges.slice(0, 39)], "sets"), [], "CONTROL: 39 direct tests make no hub");
  assert.deepEqual(fold(["TOUCH packages/lares-cli/src/commands/kapae.ts", ...edges], "sets"), ["e2e-node", "pkg:packages/lares-cli"]);
  assert.deepEqual(fold(["TOUCH packages/lararium-mesh/src/index.ts"], "sets"), ["e2e-node", "pkg:packages/lararium-mesh"]);
  // The cli door table owes the whole cli suite; a trunk seam the whole node e2e set.
  assert.ok(fold(["TOUCH packages/lares-cli/src/verb-table.ts"], "sets").includes("pkg:packages/lares-cli"));
  assert.ok(fold(["TOUCH packages/lararium-node/src/uds-channel.ts"], "sets").includes("e2e-node"));
});

test("RED dark: where no fold answers, the gate fails wide (touched packages' heavy tier, the whole node e2e set); CONTROL: tools alone owe no e2e", () => {
  const dark = owes({ root: ROOT, paths: ["packages/lararium-mesh/src/sealed-rest.ts"], door: darkDoor, judge: () => { throw new Error("develop holds no fold"); } });
  assert.equal(dark.via, "dark");
  assert.match(dark.why, /door: no hearth on this bench; develop: develop holds no fold/);
  assert.equal(checkOwes(dark, () => {}), 0, "a dark answer refuses nothing; it widens");
  assert.match(lines(dark).at(-1), /^owes=dark/);
  const weights = { "packages/lararium-mesh": Object.fromEntries(tracked("packages/lararium-mesh/tests/*.test.ts").slice(0, 3).map((p) => [p.slice("packages/lararium-mesh/".length), 30])) };
  const steps = owedSteps({ owed: dark, weights, touched: ["packages/lararium-mesh"], root: ROOT });
  assert.deepEqual(steps.map((s) => s.name), ["heavy-lararium-mesh", "e2e-node"]);
  assert.deepEqual(steps[1].args, NODE_E2E.args);
  const tools = owedSteps({ owed: { ...dark, touched: ["tools/x.mjs"] }, weights: {}, touched: [], root: ROOT });
  assert.deepEqual(tools, []);
  const blind = owedSteps({ owed: { ...dark, touched: [] }, weights: {}, touched: [], root: ROOT });
  assert.deepEqual(blind.map((s) => s.name), ["e2e-node"], "no readable diff at all owes the node e2e set");
});

test("RED the door: an answer holds only where the fold's header leads it and counts the facts sent; else develop's fold answers", () => {
  const paths = ["packages/lares-cli/src/commands/kapae.ts"];
  const sent = new Set(gatherFacts({ root: ROOT, paths }).lines).size;
  const answering = (titles) => () => ({ ok: true, stdout: JSON.stringify({ ok: true, data: { titles } }) });
  const good = [`OWES facts=${sent} touched=1 seams=1 refuse=0 sets=0 globs=0 files=1`, "FILE vessel tests/e2e/from-the-door.test.ts · seam:planted"];
  const viaDoor = owes({ root: ROOT, paths, door: answering(good), judge: own });
  assert.equal(viaDoor.via, "door");
  assert.deepEqual(viaDoor.files.map((f) => f.path), ["tests/e2e/from-the-door.test.ts"]);
  // A wiki holding no such operator answers an empty list: that reads as dark, never as nothing owed.
  for (const titles of [[], [`OWED facts=${sent}`], [`OWES facts=${sent + 1}`], ["Filter error: unknown operator"]]) {
    const r = owes({ root: ROOT, paths, door: answering(titles), judge: own });
    assert.equal(r.via, "develop checkout", `a door answering ${JSON.stringify(titles)} passed as the fold`);
    assert.ok(r.files.some((f) => f.path === "tests/e2e/tiddler-door.test.ts"));
  }
  assert.equal(headerHolds(good, sent), true);
  assert.equal(headerHolds(good, sent + 1), false);
  // Facts past one argv word never reach the door.
  let asked = 0;
  const many = Array.from({ length: 4000 }, (_, i) => `packages/lararium-node/src/shore-verb-${String(i).padStart(40, "x")}.ts`);
  assert.ok(Buffer.byteLength(askFilter("runs", many.map((p) => `TOUCH ${p}`).join("\n"))) > DOOR_ASK_BYTES);
  const big = owes({ root: ROOT, paths: many, door: () => { asked++; return darkDoor(); }, judge: own });
  assert.equal(asked, 0);
  assert.equal(big.via, "develop checkout");
});

test("RED edges: a test names a touched path through a relative import, a dist path, a package specifier or a barrel; CONTROL: a twin name elsewhere draws none", () => {
  assert.equal(resolveLiteral("packages/lararium-node/tests/e2e/x.test.ts", "../../dist/src/open-node-vessel.js"), "packages/lararium-node/src/open-node-vessel.js");
  assert.equal(resolveLiteral("tests/e2e/x.test.ts", "@lararium/mesh/crypto"), "packages/lararium-mesh/src/crypto");
  assert.equal(resolveLiteral("tests/e2e/x.test.ts", "@lararium/node"), "packages/lararium-node/src/index");
  assert.equal(resolveLiteral("tests/e2e/x.test.ts", "../../../outside.js"), null);
  const touched = ["packages/lararium-node/src/open-node-vessel.ts", "packages/lararium-mesh/src/crypto.ts", "packages/lararium-node/src/index.ts", "packages/lares-cli/src/ingest-core.ts", "tools/capability-inventory.json"];
  const grep = [
    'abc:packages/lararium-node/tests/e2e/lit.test.ts\0import { openNodeVessel } from "../../dist/src/open-node-vessel.js";',
    "abc:tests/e2e/walk.test.ts\0import { seal } from '@lararium/mesh/crypto';",
    'abc:tests/e2e/walk.test.ts\0import * as node from "@lararium/node";',
    'abc:packages/lares-cli/tests/settles.test.ts\0const core = await import("../src/ingest-core.js");',
    'abc:tools/inventory.test.mjs\0const rows = await rowsAt(new URL("./capability-inventory.json", import.meta.url));',
    'abc:packages/lararium-tw5/tests/twin.test.ts\0import { x } from "../src/ingest-core.js";',
  ].join("\n");
  assert.deepEqual(edgesOf(grep, touched, "abc"), [
    ["packages/lararium-node/tests/e2e/lit.test.ts", "packages/lararium-node/src/open-node-vessel.ts"],
    ["packages/lares-cli/tests/settles.test.ts", "packages/lares-cli/src/ingest-core.ts"],
    ["tests/e2e/walk.test.ts", "packages/lararium-mesh/src/crypto.ts"],
    ["tests/e2e/walk.test.ts", "packages/lararium-node/src/index.ts"],
    ["tools/inventory.test.mjs", "tools/capability-inventory.json"],
  ]);
  assert.equal(secsOf({ _measured: "x", "packages/lares-cli": { "tests/a.test.ts": 7.5 } }, "packages/lares-cli/tests/a.test.ts"), 7.5);
  assert.equal(secsOf({ "packages/lares-cli": {} }, "packages/lares-cli/tests/a.test.ts"), undefined);
  // The live tree: the replay's real import lines reach the missed node e2e file at depth one.
  const live = gatherFacts({ root: ROOT, paths: ["packages/lararium-node/src/open-node-vessel.ts"] }).lines;
  assert.ok(live.some((l) => l.startsWith(`EDGE ${MISSED_NODE_E2E} packages/lararium-node/src/open-node-vessel.ts`)), "the head's own test files draw no edge to open-node-vessel");
});

test("RED the gate's plan: owed files past the swift tier ride `owed-<pkg>`, e2e files their own steps, VESSEL tool tests `vessel-tools`, globs expand, dark files stay unrun", () => {
  // Live cli files: one measured swift, one measured heavy, and two the glob names (one never measured, one heavy).
  const [QUICK, SLOW, UNMEASURED, GLOBBED] = CLI_TESTS;
  const owed = {
    via: "develop x", touched: [], refuse: [], sets: [{ name: "witness:custody-census-witness", why: "seam:vault" }],
    globs: [{ glob: "packages/lares-cli/tests/shore-*.test.ts", why: "seam:shore" }],
    files: [
      { tier: "heavy", path: `packages/lares-cli/${SLOW}`, why: "edge" }, { tier: "swift", path: `packages/lares-cli/${QUICK}`, why: "edge" },
      { tier: "vessel", path: "packages/lararium-node/tests/e2e/lit-face-home-wiki.test.ts", why: "edge" }, { tier: "vessel", path: "tests/e2e/smoke.test.ts", why: "seam" },
      { tier: "vessel", path: `tools/${VESSEL[0]}`, why: "seam" }, { tier: "tool", path: "tools/floor-owes.test.mjs", why: "itself" },
      { tier: "dark", path: "packages/lararium-web/tests/e2e/shore-writes.e2e.test.ts", why: "seam" }, { tier: "heavy", path: "packages/lararium-browser/tests/dim.test.ts", why: "edge" },
      { tier: "heavy", path: "tests/harness/stop-child.test.ts", why: "seam:test-rig" },
    ],
  };
  const steps = owedSteps({ owed, weights: { "packages/lares-cli": { [QUICK]: 0.3, [SLOW]: 12, [GLOBBED]: 20 }, tests: { "harness/stop-child.test.ts": 8 } }, root: ROOT, expand: (glob) => (glob.includes("shore-*") ? [`packages/lares-cli/${UNMEASURED}`, `packages/lares-cli/${GLOBBED}`] : []) });
  const by = Object.fromEntries(steps.map((s) => [s.name, s]));
  assert.deepEqual(Object.keys(by).sort(), ["e2e-node", "e2e-root", "owed-lararium-browser", "owed-lares-cli", "owed-tests", "vessel-tools", "witness-custody-census"]);
  assert.deepEqual(by["owed-lares-cli"].args.filter((a) => a.startsWith("tests/")), [SLOW, GLOBBED].sort(), "the heavy owed file and the glob's heavy file ride; the swift and the never-measured ones already ride the swift step");
  assert.deepEqual(by["e2e-node"].args, [...NODE_E2E.args, "tests/e2e/lit-face-home-wiki.test.ts"]);
  assert.deepEqual(by["e2e-root"].args, [...ROOT_E2E.args, "e2e/smoke.test.ts"]);
  assert.deepEqual(by["vessel-tools"].args, ["--test", `tools/${VESSEL[0]}`]);
  assert.ok(by["owed-lararium-browser"].args.includes("--passWithNoTests"), "a dim package's named file outside the lit slice collects nothing, and that passes");
  assert.ok(!by["owed-lares-cli"].args.includes("--passWithNoTests"), "CONTROL: a lit package still refuses an empty collection");
  assert.deepEqual(by["witness-custody-census"].args, ["tools/custody-census-witness.sh"]);
  assert.ok(!steps.some((s) => s.args.some((a) => a.includes("shore-writes.e2e"))), "a dark file reads receipted and unrun");
  for (const name of ["e2e-node", "e2e-root", "vessel-tools"]) assert.ok(by[name].scratch, `${name} stands vessels under no scratch root`);
  const said = [];
  checkOwes({ ...owed, digest: "d".repeat(64) }, (l) => said.push(l));
  assert.match(said.join("\n"), /^DARK 1 · owed and unrun, no lamp lit: packages\/lararium-web\/tests\/e2e\/shore-writes\.e2e\.test\.ts$/m);
  // The verdict line carries the receipt.
  assert.match(runGate([{ name: "a" }], () => 0, () => {}, { head: "abc", base: "def", owes: "0123456789abcdef" }).line, /^BENCH GATE GREEN at abc over develop def · 1 steps · \d+ s · owes=0123456789abcdef$/);
  // CONTROL: the keeper's verdict plan and a caller holding no owed set keep the plan they had.
  assert.ok(!plan({ touched: [], verdict: true, owed }).some((s) => s.name === "floor-owes" || s.name.startsWith("e2e-")));
  assert.ok(!plan({ touched: [] }).some((s) => s.name === "floor-owes"));
});

test("the vessel roster: every VESSEL tool test of the gate reads vessel-tier in the seam table", () => {
  for (const v of VESSEL) assert.deepEqual(fold([`TOUCH tools/${v}`]).filter((r) => r.startsWith("FILE ")), [`FILE vessel tools/${v} · itself`]);
});

test("the census: the checkout's own table places every tracked path and declares every vessel file; a planted stray reads red", () => {
  const c = census({ root: ROOT });
  assert.equal(c.why, "");
  assert.deepEqual(c.rows.slice(1), [], "the seam table left tracked paths unplaced, vessel files undeclared or guards dead");
  assert.equal(c.clean, true);
  const planted = fold(["TOUCH packages/lararium-node/src/zz-planted-in-no-seam.ts", "TOUCH tests/e2e/zz-planted-undeclared.test.ts"], "census");
  assert.ok(planted.includes("UNMAPPED packages/lararium-node/src/zz-planted-in-no-seam.ts"));
  assert.ok(planted.includes("UNDECLARED tests/e2e/zz-planted-undeclared.test.ts"));
  assert.ok(planted.some((r) => r.startsWith("DEAD ")), "a tree of two files leaves every guard dead");
  const broken = census({ root: ROOT, fold: () => { throw new Error("the fold would not run: planted"); } });
  assert.equal(broken.clean, false, "a census that cannot run reads unclean");
  assert.match(broken.why, /planted/);
});

// ── develop judges, never the lane ────────────────────────────────────────────────────────────────────────────────────
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
const sh = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8", env: ENV });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const put = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
const SMALL_TABLE = ["title: planted seams", "type: text/plain", "", "PKG n packages/node", "SEAM shore", "MOVES shore n shore-*", "GUARDS shore e2e shore-walk", ""].join("\n");

/** A fixture repo whose `develop` (and `refs/remotes/origin/develop`) carries the house's own fold and a small seam table. */
function fixture(t, { withFold = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "floor-owes-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  sh(root, "init", "-q", "-b", "develop");
  if (withFold) { mkdirSync(dirname(join(root, FOLD)), { recursive: true }); copyFileSync(join(ROOT, FOLD), join(root, FOLD)); put(root, TABLE, SMALL_TABLE); }
  put(root, "packages/node/src/shore-verb.ts", "export const shore = 1;\n");
  put(root, "packages/node/tests/shore-verb.test.ts", 'import { shore } from "../src/shore-verb.js";\nvoid shore;\n');
  put(root, "packages/node/tests/other.test.ts", 'import { other } from "../src/other.js";\nvoid other;\n');
  sh(root, "add", "-A");
  sh(root, "commit", "-q", "-m", "base");
  sh(root, "update-ref", DEVELOP, "HEAD");
  const lane = (name, edit) => {
    sh(root, "checkout", "-q", "-b", name, "develop");
    edit(root);
    sh(root, "add", "-A");
    sh(root, "commit", "-q", "-m", name);
    return sh(root, "rev-parse", "HEAD");
  };
  return { root, lane };
}

test("RED develop judges: the facts come off the lane's diff and head, the fold and table out of develop's git objects", (t) => {
  const f = fixture(t);
  f.lane("lane", (r) => put(r, "packages/node/src/shore-verb.ts", "export const shore = 2;\n"));
  const facts = gatherFacts({ root: f.root, head: "lane" });
  assert.deepEqual(facts.touched, ["packages/node/src/shore-verb.ts"]);
  assert.deepEqual(facts.lines, ["TOUCH packages/node/src/shore-verb.ts", "UNREAD weights", "EDGE packages/node/tests/shore-verb.test.ts packages/node/src/shore-verb.ts"]);
  const r = owes({ root: f.root, head: "lane", door: darkDoor });
  assert.match(r.via, /^develop [0-9a-f]{9}$/);
  assert.deepEqual(r.files.map((x) => `${x.tier} ${x.path}`), ["heavy packages/node/tests/shore-verb.test.ts", "vessel tests/e2e/shore-walk.test.ts"]);
  assert.deepEqual(r.refuse, []);
});

test("RED no lane judges itself: a lane that frees every path in its own table still draws develop's refusal", (t) => {
  const f = fixture(t);
  f.lane("lane", (r) => { put(r, TABLE, `${SMALL_TABLE}FREE **\n`); put(r, "packages/node/src/brand-new.ts", "export const n = 1;\n"); put(r, FOLD, "export const floorOwesRows = () => ['OWES 1 facts=0'];\n"); });
  const r = owes({ root: f.root, head: "lane", door: darkDoor });
  assert.match(r.via, /^develop /);
  assert.deepEqual(r.refuse.map((x) => x.path).sort(), [FOLD, TABLE, "packages/node/src/brand-new.ts"].sort(), "develop's small table seats none of the three, so each refuses");
});

test("RED a develop holding no fold answers dark, never clean; a deleted touched test owes nothing by itself", (t) => {
  const bare = fixture(t, { withFold: false });
  bare.lane("lane", (r) => put(r, "packages/node/src/shore-verb.ts", "export const shore = 3;\n"));
  const dark = owes({ root: bare.root, head: "lane", door: darkDoor });
  assert.equal(dark.via, "dark");
  assert.match(dark.why, /holds no packages\/lararium-tw5\/src\/floor-owes\.ts/);
  assert.deepEqual(dark.touched, ["packages/node/src/shore-verb.ts"]);
  const f = fixture(t);
  f.lane("lane", (r) => rmSync(join(r, "packages/node/tests/other.test.ts")));
  const gone = gatherFacts({ root: f.root, head: "lane" });
  assert.ok(gone.lines.includes("GONE packages/node/tests/other.test.ts"));
  assert.deepEqual(owes({ root: f.root, head: "lane", door: darkDoor }).files, []);
});

test("tidText reads a .tid file's text past its header", () => {
  assert.equal(tidText("title: x\ntype: text/plain\n\nSEAM a\nMOVES a path b\n"), "SEAM a\nMOVES a path b\n");
  assert.equal(tidText("title: x"), "");
});
