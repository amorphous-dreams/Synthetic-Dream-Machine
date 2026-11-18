/**
 * face-label — the ONE shape and decision of a face's LABEL (operator ruling 2026-11-11: "faces name themselves at
 * creation"): the pet-name a face relation wears, kept in plaintext beside the face's private mirrors so a reader that
 * outlives the sealed rows (a seed after a re-founding, an export, an adoption by pet-name) names the face from the label
 * alone.
 *
 * Every vessel writes the same record through its own substrate, behind one port (`FaceLabelShelf`): the node's
 * `<projections>/face-labels/<F>.json` (`@lararium/node` `face-labels.ts`), the browser's origin-private file system under
 * the same relative path (`@lararium/browser` `browser-face-labels.ts`). The bytes, the validation and the
 * write-or-not decision live here alone, so a face founded on either device leaves the same label.
 *
 * Platform-blind: no node: imports, no DOM.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */

/** The folder, under a vessel's plaintext projections root, the labels rest in. */
export const FACE_LABELS_DIR = "face-labels";
export const FACE_LABEL_SCHEMA = "lar-face-label/1";
export const FACE_BASES_SCHEMA = "lar-face-bases/1";

/** One label: the pet-name a face relation wore when it last stood or a door last read it. */
export interface FaceLabel {
  readonly schema: typeof FACE_LABEL_SCHEMA;
  readonly relation: string;
  readonly petname: string;
  readonly handleIndex: number;
}

/** What a writer hands in: the face's relation (null before its log names one) and its pet-name (absent where unnamed). */
export interface FaceLabelInput {
  readonly relation: string | null;
  readonly petname: string | null | undefined;
  readonly handleIndex: number;
}

const RELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Whether `relation` spells a face relation (a v4 UUID, lower hex). */
export function isFaceLabelRelation(relation: unknown): relation is string {
  return typeof relation === "string" && RELATION.test(relation);
}

/** `<F>.json`: the label's file name under the labels folder. */
export function faceLabelFileName(relation: string): string {
  if (!isFaceLabelRelation(relation)) throw new Error(`face label: invalid relation ${JSON.stringify(relation)}`);
  return `${relation}.json`;
}

/** `<F>.bases.json`: the bases sidecar's file name under the labels folder. */
export function faceBasesFileName(relation: string): string {
  if (!isFaceLabelRelation(relation)) throw new Error(`face bases: invalid relation ${JSON.stringify(relation)}`);
  return `${relation}.bases.json`;
}

/** The label a face's facts name, or null where they name none (no relation, no pet-name). */
export function faceLabelOf(face: FaceLabelInput): FaceLabel | null {
  if (!isFaceLabelRelation(face.relation) || typeof face.petname !== "string" || face.petname.trim() === "" || !Number.isSafeInteger(face.handleIndex)) return null;
  return { schema: FACE_LABEL_SCHEMA, relation: face.relation, petname: face.petname, handleIndex: face.handleIndex };
}

/** A label's bytes as every substrate rests them. */
export function faceLabelBytes(label: FaceLabel): string {
  return `${JSON.stringify({ schema: label.schema, relation: label.relation, petname: label.petname, handleIndex: label.handleIndex }, null, 2)}\n`;
}

/** The label some bytes name for `relation`, or null where they name none (unparseable, another relation, no pet-name). */
export function parseFaceLabel(bytes: string | null | undefined, relation: string): FaceLabel | null {
  if (typeof bytes !== "string") return null;
  let raw: unknown;
  try { raw = JSON.parse(bytes); } catch { return null; }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["schema"] !== FACE_LABEL_SCHEMA || r["relation"] !== relation || typeof r["petname"] !== "string" || r["petname"].trim() === ""
    || !Number.isSafeInteger(r["handleIndex"])) return null;
  return { schema: FACE_LABEL_SCHEMA, relation, petname: r["petname"], handleIndex: r["handleIndex"] as number };
}

/**
 * THE DECISION: the label to write, or null where nothing moves. A face naming no label writes none; a standing label that
 * already says the same takes no write (a replay lands nothing); one naming another pet-name or ordinal takes the present.
 */
export function faceLabelToWrite(standing: FaceLabel | null, face: FaceLabelInput): FaceLabel | null {
  const label = faceLabelOf(face);
  if (label === null) return null;
  if (standing !== null && standing.petname === label.petname && standing.handleIndex === label.handleIndex) return null;
  return label;
}

/**
 * THE PORT a substrate binds: one shelf of named plaintext files, the labels folder. `read` answers a file's text or
 * null; `write` rests it whole (a substrate writes atomically where it can).
 */
export interface FaceLabelShelf {
  read(name: string): Promise<string | null>;
  write(name: string, bytes: string): Promise<void>;
}

/** The label a shelf holds for `relation`, or null. */
export async function readFaceLabelFrom(shelf: FaceLabelShelf, relation: string): Promise<FaceLabel | null> {
  if (!isFaceLabelRelation(relation)) return null;
  return parseFaceLabel(await shelf.read(faceLabelFileName(relation)).catch(() => null), relation);
}

/**
 * Write one face's label through a shelf, deciding by `faceLabelToWrite`. Never throws: a label serves as an aid, and no
 * standing face fails over it. Answers whether it wrote.
 */
export async function writeFaceLabelTo(shelf: FaceLabelShelf, face: FaceLabelInput): Promise<boolean> {
  try {
    if (!isFaceLabelRelation(face.relation)) return false;
    const label = faceLabelToWrite(await readFaceLabelFrom(shelf, face.relation), face);
    if (label === null) return false;
    await shelf.write(faceLabelFileName(label.relation), faceLabelBytes(label));
    return true;
  } catch { return false; }
}
