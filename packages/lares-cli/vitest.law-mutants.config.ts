/**
 * The law-mutant run's vitest config: every law and the reality-tunnel suite, read from source so a
 * mutant needs no build. Each named mutant runs the files that guard the code it replaces;
 * `tools/law-mutants-witness.sh` names this config.
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
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    environment: "node",
    include: ["tests/laws/*.law.test.ts", "tests/reality-tunnel.test.ts"],
    setupFiles: ["tests/laws/fixed-seed.ts"],
  },
});
