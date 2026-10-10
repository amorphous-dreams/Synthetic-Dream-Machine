import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * THE RUN'S OWN SCRATCH DIRECTORY — where its JSON report and its boot-phase timeline land.
 *
 * Every run writes both, so a slow file is read off a measurement rather than guessed. The directory sits
 * under `LAR_STAGE_DIR` (else the OS temp dir) and carries this runner's pid, so two concurrent runs never
 * write one report. `LAR_E2E_RUN_DIR` names it outright; the harness reads the same variable to place the
 * timeline beside the report.
 */
const RUN_DIR = process.env["LAR_E2E_RUN_DIR"]
  ?? join(process.env["LAR_STAGE_DIR"] ?? tmpdir(), `lares-e2e-run-${process.pid}`);
mkdirSync(RUN_DIR, { recursive: true });

export default defineConfig({
  test: {
    // STATED, not inherited. `isolate: true` is vitest's default, and suites here depend on it:
    // several modules hold process-global registries (a Map of holders, memo caches) that no reset
    // clears, so a fresh module registry per file is the only thing returning them to zero. Left
    // implicit, the property disappears the day someone reaches for `isolate: false` for speed —
    // a change that reads as a tuning knob and lands as a correctness change. Written down, it has
    // to be turned off on purpose.
    isolate: true,
    environment: "node",
    include: ["e2e/**/*.test.ts", "harness/**/*.test.ts"],
    // A SCRATCH PROBE IS NEVER COLLECTED. A `zz-*` or `__probe-*` file dropped into `e2e/` would join every
    // other run's whole set while it exists; `tools/e2e-harness-law.test.mjs` lists a planted one to prove it.
    exclude: [...configDefaults.exclude, "**/zz-*", "**/__probe-*"],
    reporters: ["default", "json"],
    outputFile: { json: join(RUN_DIR, "e2e-report.json") },
    // A staged vessel boots a real daemon (~30s incl. genesis); e2e pacing.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // One instance per run — no parallel daemons fighting over ports.
    fileParallelism: false,
    // EVERY STAGED VESSEL DECLARES ITS ORIGINS. A scratch LAR_ROOT reads its own (absent) config.json and
    // never the operator's, so nothing declares the origins a boot composes. `sameOrigin` says "every
    // surface this standing has shares the relay face's origin": relay = read = Web for a lararium (the
    // staged face serves all three, as the operator's own config declares), relay = read for a herm, which
    // composes no origin at boot and reads this as nothing. Never LAR_WEB_ORIGIN here: a herm refuses it.
    // Spawns inherit process.env, so this one line reaches every vessel a suite stands.
    env: { LAR_SAME_ORIGIN: "true", LAR_E2E_RUN_DIR: RUN_DIR },
  },
});
