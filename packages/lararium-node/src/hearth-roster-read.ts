/**
 * hearth-roster-read — the vessel's half of the hearth roster (`lares vessel roster`, the MCP seat's `vessel_roster`, the
 * wake block "Lares hearth (who is home)"): what this vessel reads of who is home, composed into the one roster shape
 * (`@lararium/mesh`'s `hearth-roster`).
 *
 * The verb channel answers `hearth-roster` itself and never places it: it hands in the sessions bound on its socket (each
 * one the kernel holds while its process holds it), the worn slot, the lit and lent faces, and the hand that asked. The
 * plane read, a port the vessel lends (`readHearthPlane` over its own Repo and catalog), reads the worn and lit faces'
 * intent planes; a face whose plane cannot read stands in `unread` with its cause, and the rest of the roster rides on.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-roster
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  composeHearthRoster, intentAdmissionRecordsOfGroup, intentEntryRecordsOfGroup, planeRosterOf, readIntentPlane,
  type HearthLocalSeat, type HearthPlaneDigest, type HearthRoster,
} from "@lararium/mesh";
import { loadIntentFace } from "./commands/intent.js";

/** The verb the channel answers itself: a read of who is home. */
export const HEARTH_ROSTER_VERB = "hearth-roster";

export interface HearthPlaneReading {
  readonly planes: readonly HearthPlaneDigest[];
  readonly unread: readonly { readonly face: number; readonly reason: string }[];
}

/** A plane read's fault as one short code (its lead token), so no free text crosses into the roster. */
export function hearthReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lead = /^\s*\[?([A-Za-z][A-Za-z0-9-]*)/.exec(message)?.[1] ?? "";
  return /^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(lead) ? lead : "unread";
}

/** One face's intent plane as the roster reads it, through the intent door's own fold (`runIntentCommand`'s `show`). */
export async function readHearthPlane(repo: Repo, catalogUrl: string | undefined, face: number): Promise<HearthPlaneDigest> {
  const loaded = await loadIntentFace(repo, catalogUrl, { index: face });
  const { group, projection, plane, standing, heldFrontiers, verbs, atom } = loaded;
  const view = readIntentPlane({
    group, records: intentEntryRecordsOfGroup(plane.doc(), group), verbs, heldFrontiers: heldFrontiers(),
    admissions: intentAdmissionRecordsOfGroup(plane.doc(), group),
    face: { devices: projection.devices, rosterCids: projection.cids,
      admittedAt: new Map(projection.admissions.map(({ deviceKey, cid }) => [deviceKey, cid])), lineage: loaded.face.lineage },
    standing,
  });
  return planeRosterOf(view, { face, self: atom.key });
}

/** Each face's plane, one after another; a face that does not read names its cause and the others ride on. */
export function hearthPlanesOver(read: (face: number) => Promise<HearthPlaneDigest>): (faces: readonly number[]) => Promise<HearthPlaneReading> {
  return async (faces) => {
    const planes: HearthPlaneDigest[] = [], unread: { face: number; reason: string }[] = [];
    for (const face of [...new Set(faces)].sort((a, b) => a - b)) {
      try { planes.push(await read(face)); }
      catch (error) { unread.push({ face, reason: hearthReason(error) }); }
    }
    return { planes, unread };
  };
}

/** The roster from what the channel holds and the planes the vessel lends; with no plane port, each worn face reads unread. */
export async function hearthRosterOf(input: {
  readonly worn: number | null;
  readonly lit: readonly number[];
  readonly lent: readonly number[] | null;
  readonly local: readonly HearthLocalSeat[];
  readonly asker: "seat" | "hand";
  readonly planes?: (faces: readonly number[]) => Promise<HearthPlaneReading>;
}): Promise<HearthRoster> {
  const faces = [...(input.worn === null ? [] : [input.worn]), ...input.lit];
  const reading: HearthPlaneReading = input.planes
    ? await input.planes(faces).catch((error: unknown) => ({ planes: [], unread: faces.map((face) => ({ face, reason: hearthReason(error) })) }))
    : { planes: [], unread: [...new Set(faces)].map((face) => ({ face, reason: "no-plane-read" })) };
  return composeHearthRoster({ worn: input.worn, lit: input.lit, lent: input.lent, local: input.local, asker: input.asker, planes: reading.planes, unread: reading.unread });
}
