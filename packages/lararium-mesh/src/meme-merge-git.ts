/**
 * meme-merge-git — the node shore of the one seal merge: git's own three-way line merge, `git merge-file`.
 *
 * `./meme-merge` stays pure and takes its line merge handed in; this module hands it git's, so the git driver and the
 * vessel merge with the hunks, the conflict markers and the conflict count git's own text merge writes. It spawns a
 * process, so only node imports it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures#/the-seal-merge
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LineMergeInput, LineMergeResult } from "./meme-merge.js";

/** git's own three-way merge over three texts: `{ text, conflicts }`, conflicts counted as `git merge-file` counts them. */
export function mergeTexts({ base, ours, theirs, path = "carrier", markerSize = 7 }: LineMergeInput): LineMergeResult {
  const dir = mkdtempSync(join(tmpdir(), "mem-merge-"));
  try {
    for (const [name, text] of [["O", base], ["A", ours], ["B", theirs]] as const) writeFileSync(join(dir, name), text);
    const r = spawnSync("git", [
      "merge-file", "-p", `--marker-size=${markerSize}`,
      "-L", path, "-L", `${path} (base)`, "-L", `${path} (theirs)`,
      join(dir, "A"), join(dir, "O"), join(dir, "B"),
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status === null || r.status < 0 || r.error) throw new Error(`git merge-file did not answer: ${String(r.error ?? r.stderr)}`);
    return { text: r.stdout, conflicts: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
