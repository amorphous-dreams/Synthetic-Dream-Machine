/**
 * node-veil-lift — where a node keeps a face's VEIL-LIFT link: one row under that face's own custody, twin of the browser's
 * `browser-veil-lift`.
 *
 * The link (`@lararium/mesh` veil-lift: the face's ATOM signs {veil, face, atom}; the vessel's key signs nothing of it) rests as `veil-lift-g<digest>.json`, a face row
 * (`vault-carriers` row `veil-lift`, face-hot): it seals under that face's custody key alone, a locked face's link reads for no one, a
 * cleared face's link leaves with its tree, and no place row, board or boot record carries it. The face's founding and a fleet join's
 * landing keep it once; a replay keeps the record it holds. It grants nothing: no gate, cap or proof reads it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/the-veil-ladder#/the-base-model
 */
import { signVeilLift, verifyVeilLift, type VeilLiftRecord } from "@lararium/mesh";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";
import { personaGroupDigest } from "./persona-group-file.js";

/** The face row a PersonaGroup's veil-lift link rests in, by its group digest. */
export const VEIL_LIFT_GROUP_FILE = /^veil-lift-g([0-9a-f]{64})\.json$/;
export const veilLiftGroupFile = (group: string): string => {
  if (!group) throw new Error("veil-lift row names no PersonaGroup");
  return `veil-lift-g${personaGroupDigest(group)}.json`;
};

const recordOf = async (bytes: Uint8Array | null | undefined): Promise<VeilLiftRecord | null> => {
  if (!bytes) return null;
  let raw: unknown = null;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
  return verifyVeilLift(raw);
};

/** The link this node holds for `group`, verified; null where none rests or the bytes read as no link. */
export async function readNodeVeilLift(group: string): Promise<VeilLiftRecord | null> {
  return recordOf(await readCustodyRow("identity", veilLiftGroupFile(group)));
}

/**
 * Keep the link for a face that landed over this node's veil: the face's atom signs it over the vessel's PUBLIC key, and it rests
 * under the face's custody. A face that already holds a link for this veil and this atom keeps it (a replayed landing writes
 * nothing). The atom seed stays the caller's to zero.
 */
export async function keepNodeVeilLift(group: string, atomSeed: Uint8Array): Promise<VeilLiftRecord> {
  const record = await signVeilLift({ atomSeed, veil: await loadVesselVerifyingKey(), face: group });
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const standing = await readNodeVeilLift(group);
  if (standing !== null && standing.veil === record.veil && standing.atom === record.atom && standing.face === group) return standing;
  await updateCustodyRow("identity", veilLiftGroupFile(group), () => ({ plaintext: bytes, value: undefined }));
  return record;
}
