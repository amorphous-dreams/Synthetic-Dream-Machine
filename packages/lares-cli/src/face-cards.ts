/**
 * face-cards — the CLI's door onto the face cards and their bases sidecars (`@lararium/node` `face-cards.ts` owns the
 * shape): each face relation's pet-name and its working copies' override bases, in plaintext outside every mirror.
 *
 * The vessel writes both whenever a face stands; the CLI's face reads (`liveFaces`: seed, export, import) write the card
 * too, and an import that matches a former face's uncarded folder to a bundle face writes its card. Every helper here
 * defaults the projections root to the house's own.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import {
  larProjectionsHome, faceCardsDir as nodeCardsDir, faceCardPath as nodeCardPath, faceBasesPath as nodeBasesPath, readFaceCard as nodeReadCard,
  writeFaceCard, cardedRelations as nodeCarded, readFaceBases as nodeReadBases, writeFaceBases as nodeWriteBases, FACE_CARD_SCHEMA, FACE_CARDS_DIR,
  type FaceCard,
} from "@lararium/node";

export { FACE_CARD_SCHEMA, FACE_CARDS_DIR, writeFaceCard, type FaceCard };

/** `<projections>/face-cards`. */
export function faceCardsDir(projections: string = larProjectionsHome()): string { return nodeCardsDir(projections); }
/** `<projections>/face-cards/<F>.json`. */
export function faceCardPath(relation: string, projections: string = larProjectionsHome()): string { return nodeCardPath(relation, projections); }
/** `<projections>/face-cards/<F>.bases.json`. */
export function faceBasesPath(relation: string, projections: string = larProjectionsHome()): string { return nodeBasesPath(relation, projections); }
/** The card a relation holds, or null. */
export function readFaceCard(relation: string, projections: string = larProjectionsHome()): FaceCard | null { return nodeReadCard(relation, projections); }
/** The bases a face's sidecar names, title -> canon text hash. */
export function readFaceBases(relation: string, projections: string = larProjectionsHome()): Record<string, string> { return nodeReadBases(relation, projections); }
/** Write a face's bases sidecar where it moved. */
export function writeFaceBases(relation: string, bases: Readonly<Record<string, string>>, projections: string = larProjectionsHome()): boolean { return nodeWriteBases(relation, bases, projections); }
/** Every relation a card stands for. */
export function cardedRelations(projections: string = larProjectionsHome()): string[] { return nodeCarded(projections); }

/**
 * Write a card for each face that wears a relation and a pet-name. Never throws: a card serves as an aid the seed reads,
 * and a door that reads the faces never fails over it.
 */
export function writeFaceCards(faces: ReadonlyArray<{ readonly relation: string | null; readonly petname: string | null; readonly handleIndex: number }>, projections?: string): void {
  let root: string;
  try { root = projections ?? larProjectionsHome(); } catch { return; }
  for (const f of faces) writeFaceCard(f, root);
}
