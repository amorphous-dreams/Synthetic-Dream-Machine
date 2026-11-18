/**
 * shore-merge — where a disk edit meets a records edit over one carrier, the three sides merge before either drowns.
 *
 * The base: the words of the last agreement. Ours: the records' render. Theirs: the file as the hand left it.
 *
 * THE BASE'S WORDS COME FROM A PLACE THAT HOLDS THEM IN CLEAR BY LAW. Clear text rests in the live wiki and the
 * operator's projected files alone (lar:///ha.ka.ba/lararium/mesh/sealed-store, R1); the synced tree holds hashes. So
 * the base reads from the git history the projected file itself rests in: a face pool (`projections/faces/<pet name>/`,
 * whose watch core commits the planes at each sitting's close), or any repository a mirror stands inside. The blob at the
 * newest commit of that path whose bytes hash to the base the key folded answers (`basePoolText`); no history, no
 * commit of the path, or no blob at that hash answers none, and the caller lands the file whole, saying why. The merge runs through the one seal merge (`@lararium/mesh/meme-merge`, the
 * module git's `.mem` driver reads too): a slot only one side moved takes that side, a slot both moved line-merges
 * alone, and a `.mem` re-seals through the normalize law. A slot both sides moved into overlap answers a conflict
 * that names the slot; the caller lands nothing and says so.
 *
 * ONE CALLER, BY DESIGN. `lares shore take-disk` merges a standoff a person names by its key (`shore-take-disk.ts`).
 * The watch core's read-back over a face pool (`poolIngestPorts`, `@lararium/node` ingest-scan) lands a clean pool edit
 * as an unattended INGEST wave and hands every conflict to the disk shore by title, so a both-moved carrier reaches
 * this merge through the same door, never around it.
 */

import { basename, dirname } from "node:path";
import { contentHash, runGit, type GitRun } from "@lararium/node";
import { digestsEqual } from "@lararium/mesh";
import { mergeCarrier, type MemeSealer } from "@lararium/mesh/meme-merge";
import { mergeTexts } from "@lararium/mesh/meme-merge-git";
import { stampCarrier, verifyBcc } from "@lararium/memetic-frame";
import { normalizeMemeSource } from "@lararium/tw5/meme-normalize";

/** The normalize law's shore for a merged `.mem` body: the frame canonical, then the block check stamped over it (the git driver's sealer). */
export const memeSealer: MemeSealer = (body) => {
  const res = normalizeMemeSource(body, { grammar: false });
  if (res.faults.length > 0) return { ok: false, why: res.faults.map((f) => `${f.code}: ${f.message}`).join("; ") };
  const sealed = stampCarrier(res.text);
  const verdict = verifyBcc(sealed);
  return verdict === "ok" || verdict === "head-unbound" ? { ok: true, text: sealed } : { ok: false, why: `the merged carrier reads ${verdict}; no check can seal it` };
};

export interface StandoffSides {
  /** The words of the last agreement. */
  readonly base: string;
  /** The records' render. */
  readonly records: string;
  /** The file's words. */
  readonly disk: string;
  /** The file the merge names in a conflict. */
  readonly path: string;
  /** The file's extension: a `.mem` re-seals; any other text merges by line with no seal. */
  readonly ext: string;
}

export type StandoffMerge =
  | { readonly resolved: true; readonly text: string }
  | { readonly resolved: false; readonly why: string };

/** How many commits of one path the base read walks back, newest first, looking for the base's bytes. */
export const POOL_BASE_DEPTH = 64;

export type PoolBase = { readonly text: string; readonly commit: string } | { readonly text: null; readonly why: string };

/**
 * THE BASE'S WORDS FROM THE FILE'S OWN GIT HISTORY: the blob of `file` at the newest commit (within `POOL_BASE_DEPTH`)
 * whose bytes hash to `baseDisk`, the base's disk side the key folded. The git run carries no hook env (`runGit`).
 */
export function basePoolText(file: string, baseDisk: string, git: GitRun = runGit): PoolBase {
  const dir = dirname(file);
  const top = git(["rev-parse", "--show-toplevel"], dir);
  if (top.code !== 0) return { text: null, why: `the file rests in no git history (no pool .git above ${dir}), so no base's words stand in clear` };
  const prefix = git(["rev-parse", "--show-prefix"], dir);
  if (prefix.code !== 0) return { text: null, why: `git could not name the file's place in its history (${prefix.stderr.trim() || "no answer"})` };
  const rel = `${prefix.stdout.trim()}${basename(file)}`;
  const cwd = top.stdout.trim();
  const revs = git(["rev-list", "-n", String(POOL_BASE_DEPTH), "HEAD", "--", rel], cwd);
  const commits = revs.code === 0 ? revs.stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  if (commits.length === 0) return { text: null, why: `the pool's git holds no commit of ${rel}, so no base's words stand in clear` };
  for (const commit of commits) {
    const blob = git(["show", `${commit}:${rel}`], cwd);
    if (blob.code === 0 && digestsEqual(contentHash(blob.stdout), baseDisk)) return { text: blob.stdout, commit };
  }
  return { text: null, why: `no commit of ${rel} in the pool's git (the newest ${commits.length}) holds the base's bytes` };
}

/** One three-way merge of a carrier's sides: the merged words, or a conflict that names where both moved. */
export function mergeStandoffSides(sides: StandoffSides): StandoffMerge {
  const merged = mergeCarrier({
    base: sides.base, ours: sides.records, theirs: sides.disk, path: sides.path,
    lineMerge: mergeTexts, seal: sides.ext === ".mem" ? memeSealer : null,
  });
  return merged.resolved ? { resolved: true, text: merged.text } : { resolved: false, why: merged.why };
}
