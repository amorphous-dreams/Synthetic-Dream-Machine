/**
 * Where the one-road-cost probe lands its verdict: OUTSIDE this package's subtree. The per-package
 * build stamp digests every `.json` under the subtree, so a verdict written inside it would turn every
 * witness that reads the stamp `stale build` after a suite run. Each module load owns a fresh directory,
 * so no two runs share a verdict file.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const verdictDirectory = mkdtempSync(join(tmpdir(), "lares-keyhive-one-road-cost-"));
export const VERDICT_PATH = join(verdictDirectory, "verdict.json");
