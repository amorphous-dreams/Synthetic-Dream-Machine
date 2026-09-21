import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Web-surface tests run in real Chromium because this shore owns the DOM adapter. Pure phone-seat tests remain
// pure functions inside that browser context; no test boots a vessel here.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    browser: { enabled: true, provider: playwright(), instances: [{ browser: "chromium" }] },
  },
});
