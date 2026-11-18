/**
 * ashes — where a BURNED face's root rests: a face whose pet name no standing face carries.
 *
 * A face's private planes rest in ONE root keyed by its pet name (`<projections>/faces/<pet name>/`, `bag-paths.ts`), so a
 * re-found finds them where they stand: the re-minted face under the same pet name keeps the same folder, and nothing adopts,
 * copies or moves. Ashes serve the one case left: a face whose pet name no standing face carries. Its root moves to
 * `<projections>/ashes/<pet name>/`, beside the labels that named it: plaintext still, and out of the live mirror set. A face
 * whose pet name still stands never moves (the move refuses by name). Nothing walks ashes: the disk projector writes only its
 * grants, and the census, the seed and the export walk `faces/`, `wikis/` and `bags/` alone. A person deletes them by hand
 * when they please.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { faceRoot, faceSegmentRefusal, labelledRelations, readFaceLabel } from "@lararium/node";
import { faceLabelPath, faceBasesPath } from "./face-labels.js";

export const ASHES_DIR = "ashes";

/** `<projections>/ashes`. */
export function ashesDir(projections: string): string {
  return join(projections, ASHES_DIR);
}

/** The live paths a burned face's segment names (its root, and every label and bases sidecar under its pet name), each with the
 *  place it takes under ashes. */
export function faceFolderMoves(projections: string, segment: string): Array<{ readonly from: string; readonly to: string }> {
  const base = join(ashesDir(projections), segment);
  const labelled = labelledRelations(projections).filter((r) => readFaceLabel(r, projections)?.petname.normalize("NFC") === segment);
  return [
    { from: faceRoot(projections, segment), to: base },
    ...labelled.flatMap((r) => [
      { from: faceLabelPath(r, projections), to: join(`${base}.labels`, `${r}.json`) },
      { from: faceBasesPath(r, projections), to: join(`${base}.labels`, `${r}.bases.json`) },
    ]),
  ];
}

/** What a move to ashes did: the paths it moved, or why it moved none. */
export type AshesMove = { readonly segment: string; readonly moved: readonly string[] } | { readonly segment: string; readonly left: string };

/**
 * Move a burned face's root (and its labels) under `<projections>/ashes/<pet name>`. `standing` names the segments of the faces
 * standing on this vessel: a segment among them (compared as the face-segment rule compares, without case) never moves. All or
 * none: where a place under ashes already stands, nothing moves and the answer says which.
 */
export function moveFaceToAshes(projections: string, segment: string, standing: readonly string[]): AshesMove {
  const named = faceSegmentRefusal(segment);
  if (named !== null) return { segment, left: `${named.code}: ${named.why}` };
  if (faceSegmentRefusal(segment, standing)?.code === "face-segment-collision") return { segment, left: `the face "${segment}" still stands on this vessel, so its root stays where it stands` };
  const moves = faceFolderMoves(projections, segment).filter((m) => existsSync(m.from));
  const taken = moves.filter((m) => existsSync(m.to));
  if (taken.length > 0) return { segment, left: `a place under ashes already stands (${taken.map((m) => m.to).join(", ")}); move it aside and try again` };
  const moved: string[] = [];
  for (const m of moves) {
    mkdirSync(join(m.to, ".."), { recursive: true });
    renameSync(m.from, m.to);
    moved.push(`${m.from} -> ${m.to}`);
  }
  return { segment, moved };
}
