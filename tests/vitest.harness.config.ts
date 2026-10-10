import { defineConfig } from "vitest/config";

/**
 * THE HARNESS'S OWN UNIT SUITE — `harness/**` holds the harness's pure logic (scenario graphs, the
 * stop-is-the-barrier contract) and runs FAST, isolated, parallel, exactly like any other package's
 * unit tests. It never boots a vessel, so it carries none of `vitest.config.ts`'s e2e pacing: no
 * 180s timeouts, no `fileParallelism: false`, no `LAR_SAME_ORIGIN`/`LAR_E2E_RUN_DIR` env. Folding it
 * into the e2e config (as it once stood) meant `pnpm -r test` — which skips `tests/` entirely,
 * because that package names no plain `test` script — never ran it at all; this config IS that script.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["harness/**/*.test.ts"],
  },
});
