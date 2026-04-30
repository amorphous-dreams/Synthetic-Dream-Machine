import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout:  30_000,
  use: {
    baseURL:   "http://127.0.0.1:4321",
    headless:  true,
    viewport:  { width: 1280, height: 900 },
    video:     "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "tsx scripts/serve.ts",
    url:     "http://127.0.0.1:4321",
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
