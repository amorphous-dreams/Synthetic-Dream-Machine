/** Stryker's vitest config for lararium-mesh: no dist guard, rooted at the package, only the suites that import the mutated modules. */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: [{ find: "@lararium/tw5", replacement: path.resolve(root, "../lararium-tw5/src/index.ts") }] },
  test: {
    isolate: true,
    environment: "node",
    include: [
      "tests/cap-compose.test.ts", "tests/quorum-entry.test.ts", "tests/cap-layers-take-no-working-role.test.ts",
      "tests/carriage-caps-crash-hardening.test.ts", "tests/who-face-cap.test.ts", "tests/spectral-keel-cap.test.ts",
    ],
  },
});
