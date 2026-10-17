import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Web-surface tests run in real Chromium because this shore owns the DOM adapter. Pure phone-seat tests remain
// pure functions inside that browser context; no test boots a vessel here.
export default defineConfig({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    projects: [
      {
        test: {
          name: "web-browser",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/e2e/**"],
          browser: { enabled: true, provider: playwright(), instances: [{ browser: "chromium" }] },
        },
      },
      {
        test: {
          name: "shore-writes-e2e",
          include: ["tests/e2e/shore-writes.e2e.test.ts"],
          environment: "node",
          browser: { enabled: false },
          testTimeout: 90_000,
        },
      },
    ],
  },
});
