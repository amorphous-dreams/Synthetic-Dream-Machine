import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // A worker that inherits no house root names a scratch one (the resolvers refuse an unnamed root).
    setupFiles: ["../../tools/vitest-scratch-house.mjs"],
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    environment: "node",
    // Offerings carry their OWN tests beside their own artifacts (R2c: `offerings/highlight/`),
    // never inside `tests/`, so each offering's directory is self-contained end to end.
    include: ["tests/**/*.test.ts", "offerings/**/*.test.ts"],
    // THE BROWSER LAMPS STAND DIM (operator, 2026-11-20: "disable all browser tests for now, while we move quickly to settle the
    // road"; account and relight in tools/ci-cells.mjs, BROWSER_LAMPS_DIM). These three suites drive a real Chromium throughout; they
    // stay in the tree, untouched, for the browser Mu. meme-routes.e2e stays: its node contact runs, and its one Chromium describe
    // skips loudly when no engine launches. TO RELIGHT: delete this `exclude`.
    exclude: [
      "**/node_modules/**",
      "tests/filter-cts-chromium.e2e.test.ts",
      "tests/standalone-single-file.e2e.test.ts",
      "tests/syncer-back-parity.e2e.test.ts",
    ],
  },
});
