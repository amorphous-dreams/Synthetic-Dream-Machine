// held-out-cells.test.mjs — the cell matrix derives from the scenario script's own list, and the merge fails closed.
// A merge that read a missing cell as nothing to report would turn a cancelled job into a green run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DRIVERS, VERDICT_FILE, budgetMinutes, cellMatrix, cellVerdict, collectVerdicts, evaluateMerge, parseScenarioList, renderMerge,
} from "./held-out-cells.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEAD = "a".repeat(40);
const drivers = [{ driver: "whole", seconds: 60, image: true }, { driver: "walks", image: true, mesh: true, unfold: "walks.sh" }];
const list = () => "alpha 30\nbeta-two 300\n";
const cells = cellMatrix({ drivers, list });
const green = (cell, more = {}) => ({ ...cellVerdict({ cell, status: 0, seconds: 10, head: HEAD }), ...more });

test("the matrix unfolds a scenario driver into one cell per listed scenario and keeps a whole driver as one", () => {
  assert.deepEqual(cells, [
    { cell: "whole", driver: "whole", image: "true", mesh: "", scenario: "", timeout_minutes: budgetMinutes(60) },
    { cell: "walks-alpha", driver: "walks", image: "true", mesh: "true", scenario: "alpha", timeout_minutes: budgetMinutes(30) },
    { cell: "walks-beta-two", driver: "walks", image: "true", mesh: "true", scenario: "beta-two", timeout_minutes: budgetMinutes(300) },
  ]);
  // A flag rides as a string: the runner compares `matrix.mesh == 'true'` against a JSON boolean by number.
  for (const c of cells) for (const k of ["image", "mesh"]) assert.equal(typeof c[k], "string");
  assert.ok(budgetMinutes(300) > budgetMinutes(30), "a longer walk earns a longer budget");
});

test("RED: a scenario list of any other shape, an empty one and a repeated name each throw", () => {
  assert.deepEqual(parseScenarioList("a 1\n\nb 22\n"), [{ scenario: "a", seconds: 1 }, { scenario: "b", seconds: 22 }]);
  assert.throws(() => parseScenarioList("a\n"), /no <name> <seconds>/);
  assert.throws(() => parseScenarioList("a 0\n"), /no <name> <seconds>/);
  assert.throws(() => parseScenarioList("#0 building with docker\n"), /no <name> <seconds>/, "a build log never reads as a list");
  assert.throws(() => parseScenarioList("\n"), /names no scenario/);
  assert.throws(() => parseScenarioList("a 1\na 2\n"), /"a" twice/);
  assert.throws(() => cellMatrix({ drivers: [{ driver: "x", seconds: 1 }, { driver: "x", seconds: 1 }], list }), /share the name "x"/);
});

test("the live matrix reads the scenario script's own list, and that door starts no build", () => {
  const r = spawnSync("bash", [join(ROOT, "tools/mesh-scenarios.sh"), "--list"], { encoding: "utf8", env: { PATH: process.env.PATH, DOCKER_HOST: "unix:///nonexistent/docker.sock" } });
  assert.equal(r.status, 0, r.stderr);
  const listed = parseScenarioList(r.stdout);
  const live = cellMatrix();
  assert.deepEqual(live.filter((c) => c.driver === "mesh-scenarios").map((c) => c.scenario), listed.map((s) => s.scenario));
  assert.deepEqual([...new Set(live.map((c) => c.driver))], DRIVERS.map((d) => d.driver));
  // Every listed scenario names a walk the script holds, and an unknown name refuses before any image resolves.
  const text = readFileSync(join(ROOT, "tools/mesh-scenarios.sh"), "utf8");
  for (const { scenario } of listed) {
    const fn = scenario.startsWith("operator-") ? "run_operator" : `run_${scenario.replaceAll("-", "_")}`;
    assert.match(text, new RegExp(`^${fn}\\(\\) \\{`, "m"), `no ${fn} stands for the listed scenario ${scenario}`);
  }
  const typo = spawnSync("bash", [join(ROOT, "tools/mesh-scenarios.sh"), "no-such-scenario"], { encoding: "utf8", env: { PATH: process.env.PATH, DOCKER_HOST: "unix:///nonexistent/docker.sock" } });
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /unknown scenario "no-such-scenario"/);
  assert.doesNotMatch(typo.stderr + typo.stdout, /docker|building/i);
  // The account runs twenty jobs at once and CI with its shards takes twelve: the cells stay inside the rest.
  const wf = readFileSync(join(ROOT, ".github/workflows/held-out.yml"), "utf8");
  assert.equal(Number(/^      max-parallel: (\d+)$/m.exec(wf)?.[1]), 8);
  for (const c of live) assert.ok(c.timeout_minutes <= 60, `${c.cell} asks ${c.timeout_minutes} minutes`);
});

/** The walks a scenario script defines more than once: bash runs the LAST definition. */
function walksDefinedTwice(text) {
  const defs = [...text.matchAll(/^(run_[a-z_]+)\(\) \{/gm)].map((m) => m[1]);
  return [...new Set(defs.filter((d, i) => defs.indexOf(d) !== i))];
}

test("RED: a walk defined twice reads as a fault, and the control reads clean", () => {
  assert.deepEqual(walksDefinedTwice("run_a() {\n}\nrun_b() {\n}\n"), []);
  assert.deepEqual(walksDefinedTwice("run_a() {\n}\nrun_a() {\n}\n"), ["run_a"]);
});

test("every walk in the scenario script stands ONCE", () => {
  // Bash keeps the last definition of a name, so a second copy silently replaces the walk a hand just changed.
  const twice = walksDefinedTwice(readFileSync(join(ROOT, "tools/mesh-scenarios.sh"), "utf8"));
  assert.deepEqual(twice, [], `walks defined more than once: ${twice.join(", ")}`);
});

test("every cell green for this head merges green, one line per driver", () => {
  const m = evaluateMerge({ cells, verdicts: cells.map((c) => green(c.cell)), head: HEAD });
  assert.equal(m.ok, true);
  assert.deepEqual(renderMerge(m), [
    "HELD-OUT-DRIVER: whole ok=true cells=1/1 seconds=10",
    "HELD-OUT-DRIVER: walks ok=true cells=2/2 seconds=20",
    `HELD-OUT-VERIFY: ok=true drivers=2 cells=3 green=3 red=0 missing=0 head=${HEAD}`,
  ]);
});

test("RED: a red cell, a missing cell, a foreign head, a stray cell, a doubled cell and an unreadable file each fail closed by name", () => {
  const all = () => cells.map((c) => green(c.cell));
  const red = evaluateMerge({ cells, verdicts: [all()[0], all()[1], { ...cellVerdict({ cell: "walks-beta-two", status: 1, seconds: 5, head: HEAD }) }], head: HEAD });
  assert.equal(red.ok, false);
  assert.ok(renderMerge(red).includes("HELD-OUT-DRIVER: walks ok=false cells=1/2 seconds=15 red=beta-two"));
  assert.ok(renderMerge(red).includes("HELD-OUT-DRIVER: whole ok=true cells=1/1 seconds=10"), "a red driver never reddens its neighbour's line");

  const missing = evaluateMerge({ cells, verdicts: all().slice(1), head: HEAD });
  assert.equal(missing.ok, false);
  assert.ok(renderMerge(missing).includes("HELD-OUT-DRIVER: whole ok=false cells=0/1 seconds=0 missing=whole"));

  const none = evaluateMerge({ cells, verdicts: [], head: HEAD });
  assert.equal(none.ok, false);
  assert.equal(none.missing, 3);

  const foreign = evaluateMerge({ cells, verdicts: [green("whole", { head: "b".repeat(40) }), ...all().slice(1)], head: HEAD });
  assert.equal(foreign.ok, false);
  assert.match(renderMerge(foreign).join("\n"), /HELD-OUT-PROBLEM: the verdict for "whole" measured bbbbbbbbb, never this head/);
  assert.equal(foreign.missing, 1, "a verdict for another head fills no cell");

  const stray = evaluateMerge({ cells, verdicts: [...all(), green("nobody")], head: HEAD });
  assert.equal(stray.ok, false);
  assert.match(renderMerge(stray).join("\n"), /names "nobody"/);

  assert.equal(evaluateMerge({ cells, verdicts: [...all(), green("whole")], head: HEAD }).ok, false, "two verdicts for one cell");
  assert.equal(evaluateMerge({ cells, verdicts: [...all(), { unreadable: "x/held-out-verdict.json" }], head: HEAD }).ok, false);
  // A verdict that claims ok over a non-zero status reads red: the status decides.
  assert.equal(evaluateMerge({ cells, verdicts: [green("whole", { status: 3 }), ...all().slice(1)], head: HEAD }).ok, false);
  assert.equal(evaluateMerge({ cells: [], verdicts: [], head: HEAD }).ok, false, "an empty matrix measured nothing");
  assert.throws(() => cellVerdict({ cell: "x", status: NaN, seconds: 1, head: HEAD }), /no exit status/);
});

test("the record door writes the file the merge door reads, through the downloaded artifact layout", () => {
  const temp = mkdtempSync(join(tmpdir(), "held-out-cells-"));
  const tool = join(ROOT, "tools/held-out-cells.mjs");
  try {
    const live = cellMatrix();
    for (const c of live) {
      const dir = join(temp, `held-out-cell-${c.cell}-1-1`);
      const r = spawnSync("node", [tool, "record", "--dir", dir, "--cell", c.cell, "--status", "0", "--seconds", "7", "--head", HEAD], { encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    }
    assert.equal(collectVerdicts(temp).length, live.length);
    const ok = spawnSync("node", [tool, "merge-verify", "--artifacts-dir", temp, "--head", HEAD], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, new RegExp(`HELD-OUT-VERIFY: ok=true drivers=${DRIVERS.length} cells=${live.length} green=${live.length} red=0 missing=0 head=${HEAD}`));

    // RED: one cell's driver exits non-zero, and one file rots.
    const first = join(temp, `held-out-cell-${live[0].cell}-1-1`);
    spawnSync("node", [tool, "record", "--dir", first, "--cell", live[0].cell, "--status", "1", "--seconds", "7", "--head", HEAD]);
    const red = spawnSync("node", [tool, "merge-verify", "--artifacts-dir", temp, "--head", HEAD], { encoding: "utf8" });
    assert.equal(red.status, 1);
    assert.match(red.stdout, new RegExp(`HELD-OUT-DRIVER: ${live[0].driver} ok=false`));
    mkdirSync(join(temp, "rot"));
    writeFileSync(join(temp, "rot", VERDICT_FILE), "{ not json");
    assert.match(spawnSync("node", [tool, "merge-verify", "--artifacts-dir", temp, "--head", HEAD], { encoding: "utf8" }).stdout, /HELD-OUT-PROBLEM: unreadable verdict/);
    // An absent artifacts directory reads every cell missing, never an error and never green.
    const absent = spawnSync("node", [tool, "merge-verify", "--artifacts-dir", join(temp, "nowhere"), "--head", HEAD], { encoding: "utf8" });
    assert.equal(absent.status, 1);
    assert.match(absent.stdout, new RegExp(`missing=${live.length} `));
    assert.equal(spawnSync("node", [tool, "merge-verify"], { encoding: "utf8" }).status, 2);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
