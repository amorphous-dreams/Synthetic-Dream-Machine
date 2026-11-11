/**
 * ashes — where a former face's mirror folders rest once their memory landed whole on a face this vessel wears.
 *
 * After a re-founding the former face's folders (`wikis/daemon-<former>`, `bags/daemon-<former>`, `bags/kahua-<former>`) rest
 * under the projections root, keyed by the former relation. Once a seed's adoption or an import landed that face's memory on
 * the face that carries its pet-name, with NOTHING pending (no stand-off, no refusal, no kahua item waiting for a hand),
 * the folders move to `<projections>/ashes/<old-relation>/` beside their face card: plaintext still, and out of the live
 * mirror set. Nothing walks ashes: the disk projector writes only its grants, the census and the export walk `wikis/` and
 * `bags/`, and the seed classifies those two dirs alone. So nothing reads ashes back into a layer and nothing projects
 * into them, and the next export names none of those folders unclaimed. A person deletes them by hand when they please.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { daemonFaceFolder, kahuaFaceFolder } from "@lararium/node";
import { faceCardPath } from "./face-cards.js";

export const ASHES_DIR = "ashes";

/** `<projections>/ashes`. */
export function ashesDir(projections: string): string {
  return join(projections, ASHES_DIR);
}

/** The live folders a former face's relation names, each with the place it takes under ashes. */
export function faceFolderMoves(projections: string, relation: string): Array<{ readonly from: string; readonly to: string }> {
  const base = join(ashesDir(projections), relation);
  return [
    { from: join(projections, "wikis", daemonFaceFolder(relation)), to: join(base, "wikis", daemonFaceFolder(relation)) },
    { from: join(projections, "bags", daemonFaceFolder(relation)), to: join(base, "bags", daemonFaceFolder(relation)) },
    { from: join(projections, "bags", kahuaFaceFolder(relation)), to: join(base, "bags", kahuaFaceFolder(relation)) },
    { from: faceCardPath(relation, projections), to: join(base, "face-card.json") },
  ];
}

/** What a move to ashes did: the paths it moved, or why it moved none. */
export type AshesMove = { readonly relation: string; readonly moved: readonly string[] } | { readonly relation: string; readonly left: string };

/**
 * Move a former face's folders (and its card) under `<projections>/ashes/<relation>/`. All or none: where a place under
 * ashes already stands, nothing moves and the answer says which. A folder that never stood takes no move.
 */
export function moveFaceToAshes(projections: string, relation: string): AshesMove {
  const moves = faceFolderMoves(projections, relation).filter((m) => existsSync(m.from));
  const taken = moves.filter((m) => existsSync(m.to));
  if (taken.length > 0) return { relation, left: `a place under ashes already stands (${taken.map((m) => m.to).join(", ")}); move it aside and seed again` };
  const moved: string[] = [];
  for (const m of moves) {
    mkdirSync(join(m.to, ".."), { recursive: true });
    renameSync(m.from, m.to);
    moved.push(`${m.from} -> ${m.to}`);
  }
  return { relation, moved };
}
