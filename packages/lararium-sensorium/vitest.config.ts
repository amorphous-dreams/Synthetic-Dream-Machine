import { defineConfig } from "vitest/config";
import path from "path";

const root = new URL(".", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      // Every mesh subpath rides ONE regex → src/<sub>.ts (the bare "@lararium/mesh" below would
      // otherwise swallow subpaths into "src/index.ts/<sub>").
      { find: /^@lararium\/mesh\/(.+)$/, replacement: path.resolve(root, "../lararium-mesh/src") + "/$1.ts" },
      { find: "@lararium/mesh", replacement: path.resolve(root, "../lararium-mesh/src/index.ts") },
      { find: /^@lararium\/mempalace\/(.+)$/, replacement: path.resolve(root, "../lararium-mempalace/src") + "/$1.ts" },
      { find: "@lararium/mempalace", replacement: path.resolve(root, "../lararium-mempalace/src/index.ts") },
    ],
  },
  test: {
    // STATED, not inherited — the shape every sibling package writes down.
    //
    // `include` fences the run to `tests/`. Left to vitest's default glob, a stray `*.test.ts` dropped
    // anywhere under the package joins the run, and one under `scripts/` (which holds the PYTHON holders
    // this package drives) would join it from a directory no reader thinks of as a suite.
    //
    // `isolate: true` reads as vitest's default and gets written because suites here depend on it: this
    // package memoizes python resolution and holder state at module scope, and a fresh module registry
    // per file is the only thing returning those to zero. Left implicit, the property disappears the day
    // someone reaches for `isolate: false` for speed — a change that reads as a tuning knob and lands as
    // a correctness change. Written down, it has to be turned off on purpose.
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
