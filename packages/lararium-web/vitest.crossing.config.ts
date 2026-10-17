import { defineConfig } from "vitest/config";

/**
 * The floor crossing: a real Chromium on the page a staged hearth serves, crossing that hearth's gates
 * (`tests/e2e/floor-crossing.e2e.test.ts`). It stands a node vessel and a browser together, so it rides its own config
 * and no suite collects it: `vitest run --config vitest.crossing.config.ts`, under a scratch `HOME` and `LAR_STAGE_DIR`.
 * `LAR_CHROMIUM` names a Chromium binary where Playwright's own install stands absent.
 */
export default defineConfig({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    name: "floor-crossing-e2e",
    include: ["tests/e2e/floor-crossing.e2e.test.ts"],
    environment: "node",
    browser: { enabled: false },
    isolate: true,
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 600_000,
    // Every staged vessel declares its origins: the hearth serves its page, its relay and its oracle on one origin.
    env: { LAR_SAME_ORIGIN: "true" },
  },
});
