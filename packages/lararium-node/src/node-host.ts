/**
 * node-host — path roots and structural contracts for the lararium node daemon.
 */

import { join } from "path";
import { laresRoot, repoRoot } from "@lares/core";

export const LARES_ROOT       = laresRoot;
export const BAGS_ROOT        = join(repoRoot, "bags");
export const LARES_MEMES_ROOT = join(BAGS_ROOT, "@lares");
export const REPO_ROOT        = repoRoot;

export interface CorpusSource {
  name:   string;
  path:   string;
  bag:    string;
  quine?: true;
}
