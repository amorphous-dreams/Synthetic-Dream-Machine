/**
 * shore-merge — where a disk edit meets a records edit over one carrier, the three sides merge before either drowns.
 *
 * The base: the words of the last agreement. Ours: the records' render. Theirs: the file as the hand left it.
 *
 * THE BASE'S WORDS COME FROM A PLACE THAT HOLDS THEM IN CLEAR BY LAW. Clear text rests in the live wiki and the
 * operator's projected files alone (lar:///ha.ka.ba/lararium/mesh/sealed-store, R1); the synced tree holds hashes. So
 * the base reads from the git history the projected file itself rests in: a face pool (`projections/faces/<pet name>/`,
 * whose watch core commits the planes at each sitting's close), or any repository a mirror stands inside. The blob at the
 * newest commit of that path whose bytes hash to the base the key folded answers (`basePoolText`, through the node's one
 * place and blob read, `pool-head`); no history, no
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

import { basePoolText as nodeBasePoolText, memeSealer, POOL_BASE_DEPTH, runGit, type GitRun, type PoolBase } from "@lararium/node";
import { mergeCarrier } from "@lararium/mesh/meme-merge";
import { mergeTexts } from "@lararium/mesh/meme-merge-git";

/** The normalize law's shore for a merged `.mem` body (one sealer, `@lararium/node` standoff-collapse). */
export { memeSealer, POOL_BASE_DEPTH, type PoolBase };

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

/**
 * THE BASE'S WORDS FROM THE FILE'S OWN GIT HISTORY (`@lararium/node` `basePoolText`, one read for this door and the
 * stand-off keeper alike); the git run here carries no hook env (`runGit`).
 */
export function basePoolText(file: string, baseDisk: string, git: GitRun = runGit): PoolBase {
  return nodeBasePoolText(file, baseDisk, git);
}

/** One three-way merge of a carrier's sides: the merged words, or a conflict that names where both moved. */
export function mergeStandoffSides(sides: StandoffSides): StandoffMerge {
  const merged = mergeCarrier({
    base: sides.base, ours: sides.records, theirs: sides.disk, path: sides.path,
    lineMerge: mergeTexts, seal: sides.ext === ".mem" ? memeSealer : null,
  });
  return merged.resolved ? { resolved: true, text: merged.text } : { resolved: false, why: merged.why };
}
