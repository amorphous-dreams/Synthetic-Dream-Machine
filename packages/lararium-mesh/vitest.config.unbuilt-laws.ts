import { configDefaults, defineConfig } from "vitest/config";
import base from "./vitest.config";

// The unbuilt-laws witness's own config. It runs the register's skip-stripped copy, which the witness writes under
// `.unbuilt-laws/` — outside the package's default include, so no mesh suite run collects its reds — at the same
// depth as `tests/`, so the copy's relative imports resolve as the register's do.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [".unbuilt-laws/*.test.ts"],
    exclude: [...configDefaults.exclude],
  },
});
