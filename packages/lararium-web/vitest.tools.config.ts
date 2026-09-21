import { defineConfig } from "vitest/config";

// This configuration selects executable migration controls. Keep their narrow
// list: the wider `tools/**/*.test.mjs` surface includes standalone witness
// scripts that use exit status rather than Vitest's test registration.
export default defineConfig({
  test: {
    include: [
      "../../tools/web-migration-name-control.test.mjs",
      "../../tools/web-artifact-reachability.test.mjs",
    ],
    environment: "node",
  },
});
