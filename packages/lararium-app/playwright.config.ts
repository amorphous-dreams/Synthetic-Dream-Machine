import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lararium browser smoke suite.
 *
 * Requires the node server to be running:
 *   pnpm --filter @lararium/node serve
 *
 * Run:
 *   pnpm --filter @lararium/app test:e2e
 *
 * Cold-boot note: Automerge initial sync from a fresh browser (no IndexedDB)
 * takes ~50s for the 760KB CRDT snapshot. A persistent userDataDir is used so
 * the first run warms IDB and subsequent runs boot in <2s via local cache.
 * Delete tests/.playwright-userdata/ to reset to cold-boot state.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // 90s covers cold-boot first sync (~50s) plus test execution margin.
  // Warm-boot (IDB cached) resolves in ~2s; the extra budget is free.
  timeout: 90_000,
  retries: 0,
  workers: 1,

  use: {
    baseURL:           "http://127.0.0.1:4321",
    headless:          true,
    screenshot:        "only-on-failure",
    video:             "off",
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Persistent userDataDir — preserves IndexedDB across test runs.
        // First run (cold): ~50s Automerge sync; subsequent runs (warm): <2s.
        // Tests share IDB; only lar:///test-arc-a is written as a side-effect.
        userDataDir: path.join(__dirname, "tests", ".playwright-userdata"),
      },
    },
  ],
});
