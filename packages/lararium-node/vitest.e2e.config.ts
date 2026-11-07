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
    // A vessel's teardown flushes its sealed rest: the hook rides the test's own budget, not vitest's 10 s default (CI
    // run 42343523452: seat-settle-before-mount S2's afterEach timed out at 10 s on a loaded runner; alone it passes in 26 s).
    hookTimeout: 60_000,
  },
});
