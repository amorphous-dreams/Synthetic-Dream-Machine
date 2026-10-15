import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

const root = new URL(".", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
{ find: "@lararium/tw5", replacement: path.resolve(root, "../lararium-tw5/src/index.ts") },
    ],
  },
  test: {
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // A dotfile under tests/ never reads as a suite. A tool that writes a transient copy of a suite (a witness
    // that strips skips) writes it outside this include, and a copy a killed run left behind stays uncollected.
    exclude: [...configDefaults.exclude, "tests/**/.*"],
  },
});
