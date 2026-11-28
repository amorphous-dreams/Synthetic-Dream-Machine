import test from "node:test";
import assert from "node:assert/strict";
import { PACKAGES, readWeights, weigh } from "./unit-weights.mjs";

test("weigh: planted reports read to per-package seconds under the shared checkout root, e2e aside", () => {
  const at = "/runner/work/repo/repo";
  const t = (name, secs) => ({ name: `${at}/${name}`, startTime: 1000, endTime: 1000 + secs * 1000 });
  const table = weigh([{ testResults: [t("packages/lararium-node/tests/a.test.ts", 1.23), t("tests/harness/h.test.ts", 0.4)] }, { testResults: [t("tests/e2e/walk.test.ts", 300), t("packages/lararium-node/tests/b.test.ts", 9)] }], "planted");
  assert.deepEqual(table, { _measured: "planted", "packages/lararium-node": { "tests/a.test.ts": 1.2, "tests/b.test.ts": 9 }, tests: { "harness/h.test.ts": 0.4 } });
  assert.throws(() => weigh([{ testResults: [] }], "empty"), /no timed file/);
});

test("the weights table measures every vitest package the test cells run", () => {
  const w = readWeights();
  for (const dir of PACKAGES) assert.ok(w[dir] && Object.keys(w[dir]).length > 0, `tools/unit-weights.json measures nothing of ${dir}`);
});
