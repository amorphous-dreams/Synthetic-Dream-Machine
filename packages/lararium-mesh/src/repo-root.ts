/**
 * repo-root — walk up from import.meta.url to find the monorepo root.
 * Anchors on the first ancestor directory containing pnpm-workspace.yaml.
 * Works from any depth: src/, scripts/, dist/.
 */

import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`[repo-root] pnpm-workspace.yaml not found walking up from ${start}`);
}

export const repoRoot: string = findRepoRoot(
  dirname(fileURLToPath(import.meta.url)),
);
