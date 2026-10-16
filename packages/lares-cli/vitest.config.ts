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
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/support/found-route.ts", "tests/support/scratch-custody-setup.ts"],
  },
});
