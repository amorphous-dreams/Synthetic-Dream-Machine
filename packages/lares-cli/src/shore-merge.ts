/**
 * shore-merge — where a disk edit meets a records edit over one carrier, the three sides merge before either drowns.
 *
 * The base: the words the synced tree keeps beside the last agreement (`SyncedTree.bodyAt`). Ours: the records' render.
 * Theirs: the file as the hand left it. The merge runs through the one seal merge (`@lararium/mesh/meme-merge`, the
 * module git's `.mem` driver reads too): a slot only one side moved takes that side, a slot both moved line-merges
 * alone, and a `.mem` re-seals through the normalize law. A slot both sides moved into overlap answers a conflict
 * that names the slot; the caller lands nothing and says so.
 *
 * TWO CALLERS, ONE MERGE. `lares shore take-disk` merges a standoff a person names by its key (`shore-take-disk.ts`).
 * THE WATCH CORE'S READ-BACK takes the same door where it lands a disk wave over a records edit: a `both-moved`
 * answer from the ingest gate, with the base's words, the records' render and the file in hand, calls
 * `mergeStandoffSides` before it hands the standoff to `lares shore`, so an edit to one slot on disk and another in
 * the wiki both stand (face-pools W4; the core itself lands with W1/W2, and this seam waits for it).
 */

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

/** One three-way merge of a carrier's sides: the merged words, or a conflict that names where both moved. */
export function mergeStandoffSides(sides: StandoffSides): StandoffMerge {
  const merged = mergeCarrier({
    base: sides.base, ours: sides.records, theirs: sides.disk, path: sides.path,
    lineMerge: mergeTexts, seal: sides.ext === ".mem" ? memeSealer : null,
  });
  return merged.resolved ? { resolved: true, text: merged.text } : { resolved: false, why: merged.why };
}
