import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { defineConfig } from "vitest/config";
import { alias } from "./vitest.alias";

/** The e2e project — residency / ingest witnesses that stand real vessels.
 *
 * `vitest.config.ts` excludes `tests/e2e/**` from both its projects, so this config alone runs that
 * directory, and it reaches source through the shared alias list rather than a copy of its own.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    environment: "node",
    // A `lares` CLI a suite spawns takes the harness's explicit ward and face routes; the product answers neither from a file.
    env: { NODE_OPTIONS: [process.env["NODE_OPTIONS"], `--import=${pathToFileURL(join(import.meta.dirname, "..", "..", "tools", "test-ward-route.mjs")).href}`].filter(Boolean).join(" ") },
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
