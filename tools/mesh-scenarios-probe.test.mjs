// mesh-scenarios-probe.test.mjs — the held-out mesh-scenarios driver's readiness probe crosses the socket with a verb the
// probed place ANSWERS. A herm stands as a place with no face, and a faceless place answers only its floor
// (packages/lararium-node/src/floor-verbs.ts): `bag stats` (`residency`) refuses `control-home-unnamed` there on every poll,
// which read as "the relay never answered" in realm-crossing, quorum-realm, meme and board. The probe asks a herm a floor
// query (`vessel unbound` -> `unbound-docs`) and a hearth `bag stats`, each through `docker compose exec` (the socket).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = readFileSync(join(ROOT, "tools/mesh-scenarios.sh"), "utf8");

/** The `answers` function as the driver defines it, cut whole from the script. */
function answersFn() {
  const start = SCRIPT.indexOf("answers() {");
  assert.ok(start >= 0, "mesh-scenarios.sh defines answers()");
  const end = SCRIPT.indexOf("\n}\n", start);
  return SCRIPT.slice(start, end + 3);
}

function probe(svc) {
  const dir = mkdtempSync(join(tmpdir(), "mesh-probe-"));
  try {
    const log = join(dir, "calls.log");
    writeFileSync(join(dir, "compose"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\n`);
    chmodSync(join(dir, "compose"), 0o755);
    const r = spawnSync("bash", ["-c", `COMPOSE="${join(dir, "compose")}"\n${answersFn()}\nanswers "$1"`, "probe", svc], { encoding: "utf8" });
    return { status: r.status, calls: readFileSync(log, "utf8") };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("a herm's probe rides a floor query across the socket; a hearth's rides bag stats", () => {
  const herm = probe("herm-source");
  assert.equal(herm.status, 0);
  assert.match(herm.calls, /^exec -T herm-source node packages\/lares-cli\/dist\/src\/bin\/lares\.js vessel unbound\n$/);
  const relay = probe("herm-relay-2");
  assert.match(relay.calls, /vessel unbound/);
  const hearth = probe("lararium-a");
  assert.match(hearth.calls, /^exec -T lararium-a node packages\/lares-cli\/dist\/src\/bin\/lares\.js bag stats --json\n$/);
});

test("the herm's verb stands on the floor, and `vessel unbound` names that verb", () => {
  const floor = readFileSync(join(ROOT, "packages/lararium-node/src/floor-verbs.ts"), "utf8");
  const queries = /FLOOR_QUERY_VERBS[^=]*=\s*\[([^\]]*)\]/.exec(floor)?.[1] ?? "";
  assert.match(queries, /"unbound-docs"/, "unbound-docs answers on the floor");
  assert.doesNotMatch(queries, /"residency"/, "residency stays off the floor, so a herm never answers bag stats");
  const vessel = readFileSync(join(ROOT, "packages/lares-cli/src/commands/vessel.ts"), "utf8");
  assert.match(vessel, /unbound:[\s\S]{0,200}runVerb\("unbound-docs"/);
});
