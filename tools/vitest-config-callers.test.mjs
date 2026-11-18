import { test } from "node:test";
import assert from "node:assert/strict";
import { callerless, namedConfigs, repoState } from "./vitest-config-callers.mjs";

test("V1 RED: every named vitest config in the repo has a CI, tool or package-script caller", () => {
  const { configs, callers } = repoState();
  assert.deepEqual(callerless(configs, callers), []);
});

test("V2 CONTROL: a planted config no caller names reads caller-less, and a named one does not", () => {
  const configs = namedConfigs(["packages/x/vitest.config.ts", "packages/x/vitest.lonely.config.ts", "packages/x/vitest.used.config.ts"]);
  assert.deepEqual(configs, ["packages/x/vitest.lonely.config.ts", "packages/x/vitest.used.config.ts"]);
  assert.deepEqual(callerless(configs, new Map([[".github/workflows/ci.yml", "npx vitest run --config vitest.used.config.ts"]])), ["packages/x/vitest.lonely.config.ts"]);
});
