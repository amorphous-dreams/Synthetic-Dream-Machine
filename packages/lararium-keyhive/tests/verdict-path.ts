/**
 * Where the one-road-cost probe lands its verdict: OUTSIDE this package's subtree. The per-package
 * build stamp digests every `.json` under the subtree, so a verdict written inside it would turn every
 * witness that reads the stamp `stale build` after a suite run.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";

export const VERDICT_PATH = join(tmpdir(), "lares-keyhive-one-road-cost.verdict.json");
