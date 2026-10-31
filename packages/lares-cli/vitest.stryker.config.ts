/**
 * Stryker's vitest config for lares-cli: source aliases (no build, no dist guard), the package's own setup files, and
 * only the suites the law-mutant catalog names. Rooted at the package so a run from the repo root finds its tests.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { alias, aliasesFor } from "../lararium-node/vitest.alias";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: [
    ...alias,
    ...aliasesFor("node", "lararium-node"),
    ...aliasesFor("mempalace", "lararium-mempalace"),
    ...aliasesFor("sensorium", "lararium-sensorium"),
    ...aliasesFor("memetic-frame", "lararium-memetic-frame"),
  ] },
  test: {
    isolate: true,
    // the live-tree checkout test reads untracked seat files a sandbox copy lacks
    testNamePattern: "^(?!.*(the live tree.s checkout holds|the brief line))",
    environment: "node",
    include: [
      "tests/laws/reality-tunnel.law.test.ts", "tests/reality-tunnel.test.ts",
      "tests/laws/moves-need-evidence.law.test.ts", "tests/laws/attempt-apart-from-effect.law.test.ts",
      "tests/laws/routing-follows-declaration.law.test.ts", "tests/laws/identity-rides-verified-bytes.law.test.ts",
      "tests/laws/outcome-keeps-cause.law.test.ts", "tests/laws/readiness-follows-evidence.law.test.ts",
    ],
    setupFiles: ["tests/support/found-route.ts", "tests/support/scratch-custody-setup.ts", "tests/laws/fixed-seed.ts"],
  },
});
