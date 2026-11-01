/**
 * harvester-burn — the Q6 pyre's red: the turn harvesters stand nowhere in live source.
 *
 * Train Q's row Q6 burns both harvester clusters (operator 2026-10-31, rounds 2 and 3): the mesh
 * capture readers, the tw5 form layer's bearing/skeleton/self-read readers, the two VM harvesters,
 * the recall stamp filters, `lares sense pour`, the Python turn readers and `tools/turn-parity.mjs`.
 * This witness reads every tracked source file (packages + tools, tests and generated plugin bytes
 * aside: Q5 regenerates the plugin after the burn) and reds on any burned module still standing or
 * any burned name still spoken on a code line.
 *
 * An old-name check lives one commit past the move and then burns (operator 2026-10-25): this file
 * goes in the pyre's closing commit.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");

/** The modules the pyre burns, by tracked path. Each must stand absent. */
const BURNED_FILES = [
  "packages/lararium-mesh/src/capture/turn-harvest.ts",
  "packages/lararium-mesh/src/capture/bearing-harvest.ts",
  "packages/lararium-mesh/src/capture/build-patch.ts",
  "packages/lararium-mesh/src/capture/stamp-filter.ts",
  "packages/lararium-tw5/src/form-layer/bearing-ast.ts",
  "packages/lararium-tw5/src/form-layer/move-skeleton.ts",
  "packages/lararium-tw5/src/form-layer/self-read-harvester.ts",
  "packages/lararium-tw5/src/capture/capture-annotate-vm.ts",
  "packages/lararium-tw5/src/query-derive-vm.ts",
  "packages/lararium-sensorium/scripts/form_encoder.py",
  "packages/lararium-sensorium/scripts/loci_io.py",
  "tools/turn-parity.mjs",
  "tools/turn-parity-witness.sh",
];

/** The names the burned modules defined. None may stand on a code line of live source. */
export const BURNED_NAMES = [
  // mesh capture
  "harvestTurnGradient", "TurnHarvest", "HARVEST_FLOOR", "closingPanel",
  "BEARING_STANDING", "isDrifted", "buildPatch", "CaptureContext", "hallForHarvest",
  "readStampFilters", "hitPassesStampFilters", "drawerPassesStampFilters", "StampFilters",
  // tw5 form layer
  "parseBearing", "parseBearingPayload", "linearizeBearing", "bearingFacets", "BearingFacets",
  "emitMoveSkeleton", "MoveSkeleton", "placeholderTree", "SkeletonBearing",
  "harvestSequence", "probeTurnSequence", "harvestVoiceReadings", "turnPhaseBand",
  // the VM harvesters and their channel
  "captureAnnotate", "captureAnnotateVm", "deriveQuerySkeleton", "deriveQuerySkeletonVm",
  "DaemonMsg_DeriveSkeletonRequest", "DaemonMsg_DeriveSkeletonResult", "mkDaemonDeriveSkeletonRequest",
  "mkDaemonDeriveSkeletonResult", "DaemonDeriveSkeletonResult", "derive-skeleton-request",
  // the CLI pour leg and the Python turn readers
  "cmdHarvest", "resolveLociIo", "resolveFormEncoderSpawn", "encode_form", "HARVEST_VERSION",
];

/** Import specifiers that reach a burned module. */
const BURNED_SPECIFIERS = [
  /["'][^"']*\/(turn-harvest|bearing-harvest|build-patch|stamp-filter|bearing-ast|move-skeleton|self-read-harvester|capture-annotate-vm|query-derive-vm)(\.js|\.ts)?["']/,
  /^\s*(from|import)\s+(form_encoder|loci_io)\b/,
];

/** True when the path is live source this witness holds: code under packages/ or tools/, tests aside. */
function isLiveSource(path) {
  if (!/^(packages|tools)\//.test(path)) return false;
  if (!/\.(ts|mts|mjs|js|py|sh)$/.test(path)) return false;
  if (/(^|\/)(tests?|testbeds|fixtures|goldens|node_modules|dist)\//.test(path)) return false;
  if (/(\.test|\.spec)\.(ts|mjs|js)$/.test(path) || /(^|\/)test_[^/]*\.py$/.test(path) || /conftest\.py$/.test(path)) return false;
  if (path === "tools/harvester-burn.test.mjs") return false;
  // Generated plugin bytes: Q5 regenerates them after the burn.
  if (/plugin-tiddler\.generated\.ts$/.test(path) || /^packages\/lararium-tw5\/(plugins|tiddlers\/src)\//.test(path)) return false;
  return true;
}

/** A line's code, with its comment stripped (line comments, block-comment bodies, Python/shell `#`). */
function codeOf(line, path) {
  const t = line.trim();
  if (/\.(py|sh)$/.test(path)) return t.startsWith("#") ? "" : t.replace(/\s#.*$/, "");
  if (t.startsWith("*") || t.startsWith("/*") || t.startsWith("//")) return "";
  return t.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
}

/** Scan one file's text; return each hit as `path:line: name`. */
export function scanText(path, text, names = BURNED_NAMES, specifiers = BURNED_SPECIFIERS) {
  const hits = [];
  const res = names.map((n) => [n, new RegExp(`(^|[^A-Za-z0-9_$-])${n.replace(/[-$]/g, "\\$&")}(?![A-Za-z0-9_$])`)]);
  text.split("\n").forEach((line, i) => {
    const code = codeOf(line, path);
    if (!code) return;
    for (const [n, re] of res) if (re.test(code)) hits.push(`${path}:${i + 1}: ${n}`);
    for (const re of specifiers) if (re.test(code)) hits.push(`${path}:${i + 1}: import ${code.slice(0, 80)}`);
  });
  return hits;
}

function liveSources() {
  return execFileSync("git", ["ls-files", "packages", "tools"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).filter(isLiveSource).filter((p) => existsSync(join(ROOT, p)));
}

function scanTree(names = BURNED_NAMES, specifiers = BURNED_SPECIFIERS) {
  const hits = [];
  for (const p of liveSources()) hits.push(...scanText(p, readFileSync(join(ROOT, p), "utf8"), names, specifiers));
  return hits;
}

test("CONTROL (known positive): a fixture that imports harvestTurnGradient flags", () => {
  const fixture = `import { harvestTurnGradient } from "@lararium/mesh";\nconst h = harvestTurnGradient(t);\n`;
  const hits = scanText("packages/x/src/fixture.ts", fixture);
  assert.ok(hits.length >= 2, `the scanner must flag the planted import and call, got ${JSON.stringify(hits)}`);
  const spec = scanText("packages/x/src/fixture.ts", `import { x } from "./capture/turn-harvest.js";\n`);
  assert.equal(spec.length, 1, "the scanner must flag a specifier reaching a burned module");
  const py = scanText("packages/x/scripts/a.py", "from form_encoder import FormPalaceStore\n");
  assert.equal(py.length, 1, "the scanner must flag a Python import of a burned turn reader");
});

test("CONTROL (comments read nothing): a burned name inside a comment never flags", () => {
  assert.deepEqual(scanText("packages/x/src/a.ts", "// harvestTurnGradient retired\n * buildPatch\n"), []);
});

test("CONTROL (nonsense name): a name nothing defines reads zero across the tree", () => {
  assert.deepEqual(scanTree(["zzqxHarvestNobodyDefines"], [/["']\/zzqx-nobody-module["']/]), []);
  assert.ok(liveSources().length > 500, "the scan must reach the tree (a silent zero proves nothing)");
});

test("every burned module stands absent", () => {
  const standing = BURNED_FILES.filter((p) => existsSync(join(ROOT, p)));
  assert.deepEqual(standing, [], `burned modules still stand:\n${standing.join("\n")}`);
});

test("no live source speaks a burned name or imports a burned module", () => {
  const hits = scanTree();
  assert.deepEqual(hits, [], `${hits.length} live hit(s):\n${hits.slice(0, 60).join("\n")}`);
});
