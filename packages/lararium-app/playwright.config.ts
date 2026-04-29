import { defineConfig, devices } from "@playwright/test";

/**
 * Lararium browser smoke suite.
 *
 * Requires the node server to be running:
 *   pnpm --filter @lararium/node serve
 *
 * Run:
 *   pnpm --filter @lararium/app test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,

  use: {
    baseURL:           "http://127.0.0.1:4321",
    headless:          true,
    screenshot:        "only-on-failure",
    video:             "off",
    // Capture console errors for the forbidden-error checks
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
