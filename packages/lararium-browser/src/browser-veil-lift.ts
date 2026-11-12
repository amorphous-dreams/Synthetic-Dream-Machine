/**
 * browser-veil-lift — where a browser keeps a face's VEIL-LIFT link: one row under that face's own custody tree.
 *
 * The link (`@lararium/mesh` `veil-lift`: the face's ATOM signs {veil, face, atom}; the vessel's key signs nothing of it) rests as `veil-lift/<PersonaGroup>`, a
 * face row: it seals under that face's tree alone, a locked face's link reads for no one, a cleared face's link leaves with
 * its tree, and no row of the place tree, no board and no boot record carries it. The landing of an overlay keeps it once;
 * a replay keeps the record it holds.
 */
import { signVeilLift, verifyVeilLift, type VeilLiftRecord } from "@lararium/mesh";
import { readKeystoreRow, writeKeystoreRow } from "./browser-custody.js";

/** The face row a PersonaGroup's veil-lift link rests in. */
export const veilLiftRow = (face: string): string => `veil-lift/${face}`;

/** The link this browser holds for `face`, verified; null where none rests or the bytes read as no link. */
export async function readBrowserVeilLift(idbName: string, face: string): Promise<VeilLiftRecord | null> {
  const held = await readKeystoreRow(idbName, veilLiftRow(face));
  if (!(held instanceof Uint8Array)) return null;
  let raw: unknown = null;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(held)); } catch { return null; }
  return verifyVeilLift(raw);
}

/**
 * Keep the link for a face that landed over this browser's veil: the face's atom signs it over the veil's PUBLIC key, and it
 * rests under the face's tree. A face that already holds a link for this veil and this atom keeps it (a replayed landing
 * writes nothing). The atom seed stays the caller's to zero.
 */
export async function keepBrowserVeilLift(idbName: string, face: string, veil: string, atomSeed: Uint8Array): Promise<VeilLiftRecord> {
  const standing = await readBrowserVeilLift(idbName, face);
  const record = await signVeilLift({ atomSeed, veil, face });
  if (standing !== null && standing.veil === record.veil && standing.atom === record.atom) return standing;
  await writeKeystoreRow(idbName, veilLiftRow(face), new TextEncoder().encode(JSON.stringify(record)));
  return record;
}
