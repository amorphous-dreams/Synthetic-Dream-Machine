/**
 * The mutation run's vitest config: the laws and suites that guard the code a mutation run mutates,
 * read from source so a mutant needs no build. `stryker.config.json` names it.
 */
import { defineConfig } from "vitest/config";
import { alias, aliasesFor } from "../lararium-node/vitest.alias";

export default defineConfig({
  resolve: { alias: [
    ...alias,
    ...aliasesFor("node", "lararium-node"),
    ...aliasesFor("mempalace", "lararium-mempalace"),
    ...aliasesFor("sensorium", "lararium-sensorium"),
    ...aliasesFor("memetic-frame", "lararium-memetic-frame"),
  ] },
  test: {
    isolate: false,
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    environment: "node",
    include: ["tests/laws/reality-tunnel.law.test.ts", "tests/reality-tunnel.test.ts"],
    setupFiles: ["tests/laws/fixed-seed.ts"],
  },
});
