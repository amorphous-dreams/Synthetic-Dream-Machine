import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CENSUS, ROOT, STEPS, runGate } from "./pre-push-gate.mjs";

test("RED: a red step refuses by name and the later steps still run; CONTROL: all ok reads green", () => {
  const ran = [];
  const steps = [{ name: "a" }, { name: "b" }, { name: "c" }];
  const lines = [];
  const r = runGate(steps, (s) => { ran.push(s.name); return s.name === "b" ? 3 : 0; }, (l) => lines.push(l));
  assert.equal(r.code, 1);
  assert.deepEqual(ran, ["a", "b", "c"], "no short-circuit");
  assert.match(lines.join("\n"), /PRE-PUSH GATE REFUSES: b \(exit 3\)/);
  const g = runGate(steps, () => 0, () => {});
  assert.equal(g.code, 0);
});

test("the roster names real files: every census suite and the witness script exist", () => {
  for (const c of CENSUS) assert.ok(existsSync(join(ROOT, "packages/lararium-mesh/tests", `${c}.test.ts`)), c);
  assert.ok(existsSync(join(ROOT, "tools/witness-all.sh")));
  assert.deepEqual(STEPS.map((s) => s.name), ["witnesses-fast", "census-laws"]);
});
