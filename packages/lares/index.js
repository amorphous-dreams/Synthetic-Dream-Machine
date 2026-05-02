import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export const laresRoot = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the monorepo root (two levels up from packages/lares/). */
export const repoRoot = dirname(dirname(laresRoot));
