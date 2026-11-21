#!/usr/bin/env node
/**
 * vitest-config-callers — every vitest config a package or the tests tree carries has a CI caller.
 *
 * A config under `packages/<pkg>/` or `tests/` that no workflow, tool or package script names never runs on a push: the
 * suite it collects reads green by silence. The default `vitest.config.ts` runs under a bare `vitest run` (the package's
 * `test` script), so only a NAMED config (`vitest.crossing.config.ts`, `vitest.e2e.config.ts`, ...) needs a caller, found in
 * `.github/workflows/*.yml`, a `tools/` script or a `package.json` script.
 *
 * Usage: node tools/vitest-config-callers.mjs   (exit 1 and name each caller-less config)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The named configs (anything but the default `vitest.config.ts`) among `files`. */
export function namedConfigs(files) {
  return files.filter((f) => /(^|\/)vitest\.[A-Za-z0-9.-]+\.config\.ts$|(^|\/)vitest\.config\.[A-Za-z0-9.-]+\.ts$/.test(f) && /^(packages\/[^/]+|tests)\//.test(f));
}

/** The configs no caller text names: `callers` maps a caller's path to its text. */
export function callerless(configs, callers) {
  return configs.filter((cfg) => {
    const base = cfg.split("/").pop();
    return ![...callers].some(([path, text]) => path !== "tools/vitest-config-callers.mjs" && !path.endsWith("vitest-config-callers.test.mjs") && text.includes(base));
  });
}

export function repoState() {
  const env = { ...process.env }; for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[k];
  const files = execFileSync("git", ["ls-files"], { cwd: ROOT, env, maxBuffer: 1 << 28 }).toString().split("\n").filter(Boolean);
  const callers = new Map(files.filter((f) => /^\.github\/workflows\/.*\.yml$|^tools\/[^/]+\.(sh|mjs)$|(^|\/)package\.json$/.test(f))
    .map((f) => [f, readFileSync(resolve(ROOT, f), "utf8")]));
  return { configs: namedConfigs(files), callers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { configs, callers } = repoState();
  const stray = callerless(configs, callers);
  if (stray.length) { console.error(`vitest-config-callers: no caller names ${stray.join(", ")}`); process.exit(1); }
  console.log(`vitest-config-callers: ${configs.length} named config(s), each with a caller`);
}
