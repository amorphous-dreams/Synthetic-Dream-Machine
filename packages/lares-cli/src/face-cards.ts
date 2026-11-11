/**
 * face-cards — which pet-name a face relation wore, written in plaintext where a re-founding never reaches, so the seed
 * adopts a former face's mirrors by pet-name from disk alone.
 *
 * A face's private mirrors key by its relation F (`wikis/daemon-<F>`, `bags/daemon-<F>`, `bags/kahua-<F>`). A
 * re-founding clears the hearth, mints new keys and a new relation, and keeps the projections root, so the old folders
 * still rest there under the old F, and nothing on disk named their face: the pet-name lived in the sealed rows the
 * hearth held. The CARD names it: `<projections>/face-cards/<F>.json` holds `{ relation, petname, handleIndex }`, written
 * each time a door reads the faces this vessel wears (`liveFaces`: seed, export, import), so every vessel the founding walk
 * seeded holds a card for each named face it wore.
 *
 * A card names a pet-name, never a key, a grant or an AID: it lets the seed ask "which face here carries this pet-name",
 * exactly as an import maps a bundle face, and the answer refuses by name where none or two do. The card rests beside the
 * mirrors it speaks for, outside `wikis/` and `bags/`, so no projector, census, ingest or export walks it as a carrier.
 * When the folders move to ashes, the card moves with them.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { larProjectionsHome, atomicWriteFileSync } from "@lararium/node";

export const FACE_CARDS_DIR = "face-cards";
export const FACE_CARD_SCHEMA = "lar-face-card/1";

/** One card: the pet-name a face relation wore when a door last read it. */
export interface FaceCard {
  readonly schema: typeof FACE_CARD_SCHEMA;
  readonly relation: string;
  readonly petname: string;
  readonly handleIndex: number;
}

const RELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** `<projections>/face-cards`. */
export function faceCardsDir(projections: string = larProjectionsHome()): string {
  return join(projections, FACE_CARDS_DIR);
}

/** `<projections>/face-cards/<F>.json`. */
export function faceCardPath(relation: string, projections: string = larProjectionsHome()): string {
  if (!RELATION.test(relation)) throw new Error(`face card: invalid relation ${JSON.stringify(relation)}`);
  return join(faceCardsDir(projections), `${relation}.json`);
}

/** The card a relation holds, or null where none stands or its bytes name no card. */
export function readFaceCard(relation: string, projections: string = larProjectionsHome()): FaceCard | null {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(faceCardPath(relation, projections), "utf8")); } catch { return null; }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["schema"] !== FACE_CARD_SCHEMA || r["relation"] !== relation || typeof r["petname"] !== "string" || r["petname"].trim() === ""
    || !Number.isSafeInteger(r["handleIndex"])) return null;
  return { schema: FACE_CARD_SCHEMA, relation, petname: r["petname"], handleIndex: r["handleIndex"] as number };
}

/**
 * Write a card for each face that wears a relation and a pet-name. A card that already says the same thing takes no
 * write; one that names another pet-name takes the present one (a face renamed keeps one card). Never throws: a card serves as
 * an aid the seed reads, and a door that reads the faces never fails over it.
 */
export function writeFaceCards(faces: ReadonlyArray<{ readonly relation: string | null; readonly petname: string | null; readonly handleIndex: number }>, projections?: string): void {
  let root: string;
  try { root = projections ?? larProjectionsHome(); } catch { return; }
  for (const f of faces) {
    if (f.relation === null || !RELATION.test(f.relation) || f.petname === null || f.petname.trim() === "") continue;
    const standing = readFaceCard(f.relation, root);
    if (standing !== null && standing.petname === f.petname && standing.handleIndex === f.handleIndex) continue;
    try {
      mkdirSync(faceCardsDir(root), { recursive: true });
      const card: FaceCard = { schema: FACE_CARD_SCHEMA, relation: f.relation, petname: f.petname, handleIndex: f.handleIndex };
      atomicWriteFileSync(faceCardPath(f.relation, root), `${JSON.stringify(card, null, 2)}\n`, undefined, { mode: 0o600 });
    } catch { /* an unwritable card leaves the seed to refuse by name */ }
  }
}

/** Every relation a card stands for. */
export function cardedRelations(projections: string = larProjectionsHome()): string[] {
  try { return readdirSync(faceCardsDir(projections)).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).filter((r) => RELATION.test(r)).sort(); }
  catch { return []; }
}

/** Move a relation's card to `dest` (a file path); nothing where no card stands. Returns whether it moved. */
export function moveFaceCard(relation: string, dest: string, projections: string = larProjectionsHome()): boolean {
  const from = faceCardPath(relation, projections);
  if (!existsSync(from) || existsSync(dest)) return false;
  renameSync(from, dest);
  return true;
}
