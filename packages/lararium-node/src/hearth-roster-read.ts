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
  composeHearthRoster,
  planeRosterOf,
  type HearthLocalSeat,
  type HearthPlaneDigest,
  type HearthRoster,
} from "@lararium/mesh/hearth-roster";
import { intentAdmissionRecordsOfGroup } from "@lararium/mesh/intent-admission";
import { intentEntryRecordsOfGroup } from "@lararium/mesh/intent-entry";
import { readIntentPlane } from "@lararium/mesh/intent-read";
import { loadIntentFace } from "./commands/intent.js";

/** The verb the channel answers itself: a read of who is home. */
export const HEARTH_ROSTER_VERB = "hearth-roster";

export interface HearthPlaneReading {
  readonly planes: readonly HearthPlaneDigest[];
  readonly unread: readonly { readonly face: number; readonly reason: string }[];
}

/**
 * A plane read's fault as one short code, so no free text crosses into the roster: the kebab code its message leads with
 * (`face-not-held: h3`, `[ward-signer] …`), else its error class in kebab form (`CustodyLocked` reads `custody-locked`), else
 * `unread`.
 */
export function hearthReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lead = /^\s*\[?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/.exec(message)?.[1];
  if (lead !== undefined && lead.length <= 64) return lead;
  const name = error instanceof Error ? error.name : "";
  if (name !== "Error" && /^[A-Z][A-Za-z]{1,63}$/.test(name)) return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return "unread";
}

/** The reason a plane read the vessel's close interrupted reads under. */
export const HEARTH_CLOSING = "vessel-closing";

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

/** The plane port: each named face's plane, and an event that interrupts the reads still open (the vessel's close). */
export type HearthPlanes = (faces: readonly number[], interrupt?: Promise<string>) => Promise<HearthPlaneReading>;

/**
 * Each face's plane, one after another; a face that does not read names its cause and the others ride on. An interrupt (an
 * event, never a timer) ends the read open at that moment and every face after it, each unread under the interrupt's code;
 * the faces already read stand. The read itself runs on unawaited: no Automerge or board read can be torn mid-flight.
 */
export function hearthPlanesOver(read: (face: number) => Promise<HearthPlaneDigest>): HearthPlanes {
  return async (faces, interrupt) => {
    const planes: HearthPlaneDigest[] = [], unread: { face: number; reason: string }[] = [];
    let stopped: string | null = null;
    const stop = interrupt?.then((reason) => { stopped = reason; return { stopped: reason } as const; });
    for (const face of [...new Set(faces)].sort((a, b) => a - b)) {
      if (stopped !== null) { unread.push({ face, reason: stopped }); continue; }
      try {
        const got = await (stop ? Promise.race([read(face).then((digest) => ({ digest })), stop]) : read(face).then((digest) => ({ digest })));
        if ("digest" in got) planes.push(got.digest); else unread.push({ face, reason: got.stopped });
      } catch (error) { unread.push({ face, reason: hearthReason(error) }); }
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
  readonly planes?: HearthPlanes;
  /** An event that ends the plane reads still open (the vessel's close); each face it ends reads unread under its code. */
  readonly interrupt?: Promise<string>;
}): Promise<HearthRoster> {
  const faces = [...new Set([...(input.worn === null ? [] : [input.worn]), ...input.lit])];
  const allUnread = (reason: string): HearthPlaneReading => ({ planes: [], unread: faces.map((face) => ({ face, reason })) });
  let reading: HearthPlaneReading;
  if (!input.planes) reading = allUnread("no-plane-read");
  else {
    const asked = input.planes(faces, input.interrupt).catch((error: unknown) => allUnread(hearthReason(error)));
    // A port that ignores the interrupt still yields to it: the roster answers, and the port's late reading drops. The
    // fallback waits one turn of the event loop (a turn, not a duration), so a port that honours the interrupt answers
    // first and keeps the faces it already read.
    const yielded = input.interrupt?.then((reason) => new Promise<HearthPlaneReading>((resolve) => setImmediate(() => resolve(allUnread(reason)))));
    reading = yielded ? await Promise.race([asked, yielded]) : await asked;
  }
  return composeHearthRoster({ worn: input.worn, lit: input.lit, lent: input.lent, local: input.local, asker: input.asker, planes: reading.planes, unread: reading.unread });
}
