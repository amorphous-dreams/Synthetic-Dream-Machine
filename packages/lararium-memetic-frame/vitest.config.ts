import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // A worker that inherits no house root names a scratch one (the resolvers refuse an unnamed root).
    setupFiles: ["../../tools/vitest-scratch-house.mjs"],
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
