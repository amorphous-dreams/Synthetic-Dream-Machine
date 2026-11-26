import { defineConfig } from "vitest/config";
import path from "path";
import { readFileSync } from "fs";

const root = new URL(".", import.meta.url).pathname;
const meshExports = JSON.parse(readFileSync(path.resolve(root, "../lararium-mesh/package.json"), "utf8")).exports as Record<string, { import: string }>;
const meshReseated = Object.entries(meshExports).flatMap(([key, target]) => {
  const seat = key === "." ? null : /^\.\/dist\/(.+)\.js$/.exec(target.import)?.[1];
  return seat && seat !== key.slice(2) ? [{ find: `@lararium/mesh/${key.slice(2)}`, replacement: path.resolve(root, "../lararium-mesh/src", `${seat}.ts`) }] : [];
});

export default defineConfig({
  resolve: {
    alias: [
      // Every mesh subpath reads SOURCE, as the bare barrel does (the sibling lanes hold the same rule): a subpath that
      // resolved through the package would test mesh's dist beside its src and load one module twice. A subpath the
      // exports map seats elsewhere (`./harvest` -> `capture/harvest`) reads its own seat first.
      ...meshReseated,
      { find: /^@lararium\/mesh\/(.+)$/, replacement: path.resolve(root, "../lararium-mesh/src") + "/$1.ts" },
      { find: /^@lararium\/mesh$/, replacement: path.resolve(root, "../lararium-mesh/src/index.ts") },
    ],
  },
  test: {
    globalSetup: ["../../tools/vitest-dist-guard.mjs"],
    // A worker that inherits no house root names a scratch one (the resolvers refuse an unnamed root).
    setupFiles: ["../../tools/vitest-scratch-house.mjs", "../../tools/vitest-silence-guard.mjs"],
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The ceremonies drive real Keyhive wasm — first construction pays a load cost the default misreads
    // as a hang. The probes have always run at this speed; the lane simply has to allow for it.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
