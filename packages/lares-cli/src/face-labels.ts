/**
 * face-labels — the CLI's door onto the face labels and their bases sidecars (`@lararium/node` `face-labels.ts` owns the
 * shape): each face relation's pet-name and its working copies' override bases, in plaintext outside every mirror.
 *
 * The vessel writes both whenever a face stands; the CLI's face reads (`liveFaces`: seed, export, import) write the label
 * too. Every helper here defaults the projections root to the house's own.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import {
  larProjectionsHome, faceLabelsDir as nodeLabelsDir, faceLabelPath as nodeLabelPath, faceBasesPath as nodeBasesPath, readFaceLabel as nodeReadLabel,
  writeFaceLabel, labelledRelations as nodeLabelled, readFaceBases as nodeReadBases, writeFaceBases as nodeWriteBases, FACE_LABEL_SCHEMA, FACE_LABELS_DIR,
  type FaceLabel,
} from "@lararium/node";
import { storeVerb } from "./store-door.js";

export { FACE_LABEL_SCHEMA, FACE_LABELS_DIR, writeFaceLabel, type FaceLabel };

/** `<projections>/face-labels`. */
export function faceLabelsDir(projections: string = larProjectionsHome()): string { return nodeLabelsDir(projections); }
/** `<projections>/face-labels/<F>.json`. */
export function faceLabelPath(relation: string, projections: string = larProjectionsHome()): string { return nodeLabelPath(relation, projections); }
/** `<projections>/face-labels/<F>.bases.json`. */
export function faceBasesPath(relation: string, projections: string = larProjectionsHome()): string { return nodeBasesPath(relation, projections); }
/** The label a relation holds, or null. */
export function readFaceLabel(relation: string, projections: string = larProjectionsHome()): FaceLabel | null { return nodeReadLabel(relation, projections); }
/** The bases a face's sidecar names, title -> canon carrier identity. */
export function readFaceBases(relation: string, projections: string = larProjectionsHome()): Record<string, string> { return nodeReadBases(relation, projections); }
/** Write a face's bases sidecar where it moved. */
export function writeFaceBases(relation: string, bases: Readonly<Record<string, string>>, projections: string = larProjectionsHome()): boolean { return nodeWriteBases(relation, bases, projections); }
/** Every relation a label stands for. */
export function labelledRelations(projections: string = larProjectionsHome()): string[] { return nodeLabelled(projections); }

/**
 * Write a label for each face that wears a relation and a pet-name. Never throws: a label serves as an aid the seed reads,
 * and a door that reads the faces never fails over it.
 */
export function writeFaceLabels(faces: ReadonlyArray<{ readonly relation: string | null; readonly petname: string | null; readonly handleIndex: number }>, projections?: string): void {
  let root: string;
  try { root = projections ?? larProjectionsHome(); } catch { return; }
  for (const f of faces) writeFaceLabel(f, root);
}

/**
 * THE FACE NAMES ITSELF. Write one face's label at the act that names it (`persona new`, a carried rename): the relation the
 * act already holds, else the one the face's own stage answers (`kahua-read`, as `liveFaces` reads it). Never throws, and
 * answers the relation it labelled (null where none answered): a label serves as an aid, so the naming act never fails over it.
 */
export async function labelFaceAtNaming(
  face: { readonly handleIndex: number; readonly petname: string; readonly relation?: string | null },
  readRelation: (handleIndex: number) => Promise<string | null>,
  projections?: string,
): Promise<string | null> {
  if (face.petname.trim() === "") return null;
  let relation = face.relation ?? null;
  if (relation === null) { try { relation = await readRelation(face.handleIndex); } catch { relation = null; } }
  if (relation === null) return null;
  let root: string;
  try { root = projections ?? larProjectionsHome(); } catch { return null; }
  writeFaceLabel({ relation, petname: face.petname, handleIndex: face.handleIndex }, root);
  return relation;
}

/** The relation a face's own stage answers (`kahua-read`), or null where it answers none. */
export async function faceRelationOnStage(handleIndex: number): Promise<string | null> {
  const { output } = await storeVerb("kahua-read", { face: handleIndex, action: "list" });
  return typeof output["relation"] === "string" ? output["relation"] : null;
}
