/**
 * tw5-bin-path.ts — the LOGICAL path of the TW5 binary a build actually read.
 *
 * The pack transcript attests which binary packed the plugin. A realpath names wherever the bytes happen to sit
 * on THIS disk, so two checkouts of one commit would attest different paths (a submodule behind a symlink in a
 * scratch worktree); a constant would attest the submodule even when the build read something else. This module
 * answers both: it resolves the binary the build ran, then expresses that REAL file under the repo — under the
 * submodule's own logical location when the real file sits inside the submodule's real tree, under the repo root
 * otherwise. Checkouts agree whenever they read the same binary, and a build that read a different binary
 * records a different path, which `tw5BinMismatch` reads against the fixed submodule location.
 */
import { realpathSync } from "node:fs";
import path from "node:path";

/** The submodule's logical, repo-relative location of the TW5 CLI: the binary every checkout is expected to read. */
export const TW5_BIN_FIXED_LOGICAL_PATH = "TiddlyWiki5/tiddlywiki.js";
const SUBMODULE_DIR = "TiddlyWiki5";

const within = (dir: string, file: string): string | null => {
  const rel = path.relative(dir, file);
  return rel === "" || rel.startsWith("..") || path.isAbsolute(rel) ? null : rel.split(path.sep).join("/");
};
const realOrNull = (p: string): string | null => { try { return realpathSync(p); } catch { return null; } };

export function resolveTw5BinLogicalPath(input: { resolvedBin: string; repoRoot: string }): string {
  const real = realpathSync(input.resolvedBin);
  const submoduleReal = realOrNull(path.join(input.repoRoot, SUBMODULE_DIR));
  const inSubmodule = submoduleReal ? within(submoduleReal, real) : null;
  if (inSubmodule) return `${SUBMODULE_DIR}/${inSubmodule}`;
  const repoReal = realpathSync(input.repoRoot);
  const inRepo = within(repoReal, real);
  if (inRepo) return inRepo;
  throw new Error(`[pack-transcript] the TW5 binary the build read (${real}) sits outside the repo (${repoReal}) and the submodule: it names no logical path`);
}

/** `null` when the recorded binary IS the fixed submodule binary; else a sentence naming both. */
export function tw5BinMismatch(recorded: string): string | null {
  return recorded === TW5_BIN_FIXED_LOGICAL_PATH
    ? null
    : `the build read ${recorded}, not the submodule's ${TW5_BIN_FIXED_LOGICAL_PATH}`;
}
