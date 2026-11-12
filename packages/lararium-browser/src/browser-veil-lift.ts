/**
 * browser-veil-lift — where a browser keeps a face's VEIL-LIFT link: one row under that face's own custody tree.
 *
 * The link (`@lararium/mesh` `veil-lift`: the vessel's key signs {veil, face, atom}) rests as `veil-lift/<PersonaGroup>`, a
 * face row: it seals under that face's tree alone, a locked face's link reads for no one, a cleared face's link leaves with
 * its tree, and no row of the place tree, no board and no boot record carries it. The landing of an overlay keeps it once;
 * a replay keeps the record it holds.
 */
import { verifyVeilLift, type VeilLiftRecord } from "@lararium/mesh";
import { readKeystoreRow, writeKeystoreRow } from "./browser-custody.js";
import { signBrowserVeilLift } from "./browser-vessel-identity.js";

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
 * Keep the link for a face that landed over this browser's veil: the vessel's own key signs it, and it rests under the
 * face's tree. A face that already holds a link for this veil and this atom keeps it (a replayed landing writes nothing).
 */
export async function keepBrowserVeilLift(idbName: string, face: string, atomKey: string): Promise<VeilLiftRecord> {
  const standing = await readBrowserVeilLift(idbName, face);
  const record = await signBrowserVeilLift(idbName, face, atomKey);
  if (standing !== null && standing.veil === record.veil && standing.atom === record.atom) return standing;
  await writeKeystoreRow(idbName, veilLiftRow(face), new TextEncoder().encode(JSON.stringify(record)));
  return record;
}
