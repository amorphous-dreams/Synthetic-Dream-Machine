/**
 * node-host — path roots and structural contracts for the lararium node daemon.
 */

import { repoRoot } from "@lararium/mesh/node";
import { daemonBagsDir } from "./lares-config.js";

export const REPO_ROOT        = repoRoot;

/** The daemon's bags root — resolves through the composable bags cap (`LAR_BAGS` → config → repo-relative
 *  `<corpus>/bags`). A FUNCTION, not a const, so a per-daemon `~/.lares/config.json` override carries. */
export function bagsRoot(): string {
  return daemonBagsDir();
}

export interface CorpusSource {
  name:   string;
  path:   string;
  bag:    string;
  quine?: true;
}
