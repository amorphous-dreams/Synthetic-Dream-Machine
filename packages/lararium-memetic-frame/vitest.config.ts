import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
