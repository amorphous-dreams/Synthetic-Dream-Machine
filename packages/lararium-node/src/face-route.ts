/**
 * face-route — THE SEAM A NEW FACE ASKS ITS OWN ROUTE THROUGH.
 *
 * A face's custody key rests in that face's own slot tree, bound under a human route that face asks for: the vessel's
 * route opens no sibling face, and a face's route opens no sibling. A founding or an admit that has no face custody yet
 * gathers the slots here. A CLI seats a terminal prompt; a test seats a fixed passphrase. With nothing seated the act
 * refuses by name and founds nothing, so no face ever rests under a route nobody gave.
 */
import { assertFoundingRoute } from "./custody-session.js";
import type { SlotSpec } from "@lararium/mesh";
import { bindFaceAskCustody, bindFaceCustody, faceStandingCustody, foundFaceCustody, retireFaceAskCustody } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";

export type FaceRouteGatherer = (face: { readonly label: string }) => Promise<readonly SlotSpec[]>;

let gatherer: FaceRouteGatherer | null = null;

/** Seat the act that gathers a new face's route; `null` clears it. */
/** Whether a gatherer already sits (a host that seated its own keeps it). */
export function faceRouteSeated(): boolean { return gatherer !== null; }
export function seatFaceRoute(gather: FaceRouteGatherer | null): void { gatherer = gather; }

let parked: readonly SlotSpec[] | null = null;
/** Park the route the next face founding takes (one use): a CLI hands it over the custody door before a face founds inside a standing vessel. */
export function parkFaceRoute(slots: readonly SlotSpec[] | null): void { parked = slots; }

export class FaceRouteAbsent extends Error {
  override readonly name = "FaceRouteAbsent";
  constructor(label: string) {
    super(`face ${label} asks its own human route and none was given: run the act at a terminal, or pass the face's route`);
  }
}

export async function gatherFaceRoute(label: string): Promise<readonly SlotSpec[]> {
  const handed = parked;
  parked = null;
  if (!handed && !gatherer) throw new FaceRouteAbsent(label);
  const slots = handed ?? await gatherer!({ label });
  assertFoundingRoute(slots);
  return slots;
}

/**
 * Make sure custody stands for the face of `group`: found it under a route the face asks for when the index names none.
 * A face that stands and rests locked refuses `FaceLocked` at its first row; this act never opens a face by guessing.
 */
export async function ensureFaceCustodyOfGroup(group: string): Promise<{ readonly fcid: string; readonly ordinal: number }> {
  const digest = personaGroupDigest(group);
  const standing = await faceStandingCustody({ group: digest });
  if (standing !== null) return { fcid: standing.fcid, ordinal: standing.ordinal };
  // A joinee takes the next handle index at request time: its ordinal in the floor index.
  return foundFaceCustody({ group: digest, slots: await gatherFaceRoute(`g${digest.slice(0, 8)}`) });
}

/** Found custody for a face that has no group yet, under its founding ask; the caller binds the group when it stands. */
export async function ensureFaceCustodyOfAsk(askDigest: string, label: string, handleIndex?: number): Promise<string> {
  const standing = await faceStandingCustody({ ask: askDigest });
  if (standing !== null) return standing.fcid;
  // A face's handle index is its ordinal: a face already settled at this index (its ask retired) serves the re-entry.
  if (handleIndex !== undefined) {
    const there = await faceStandingCustody({ ordinal: handleIndex });
    if (there !== null && there.group !== null) return there.fcid;
    // A face RESERVED at this handle index (its first row rested before the ask could be named) takes the ask.
    if (there !== null && there.ask === null) { await bindFaceAskCustody(there.fcid, askDigest); return there.fcid; }
  }
  return (await foundFaceCustody({ ask: askDigest, slots: await gatherFaceRoute(label), ...(handleIndex !== undefined ? { ordinal: handleIndex } : {}) })).fcid;
}

/**
 * Make sure custody stands for the face at handle index `handleIndex`, RESERVED under no group and no ask: the root of persona zero
 * rests before the seed charter whose AID the founding ask digests, so the face stands first and takes its ask when that stands.
 */
export async function ensureFaceCustodyAtHandle(handleIndex: number, label: string): Promise<string> {
  const there = await faceStandingCustody({ ordinal: handleIndex });
  if (there !== null) return there.fcid;
  return (await foundFaceCustody({ ordinal: handleIndex, slots: await gatherFaceRoute(label) })).fcid;
}

/**
 * The face's group stands: bind its digest to the face founded under the ask, move the ask's rows under the group, and
 * retire the ask from the floor index. A face whose ask already retired (an earlier run bound it) moves nothing.
 */
export async function settleFaceCustody(askDigest: string, group: string, moveRows: () => Promise<void>): Promise<void> {
  const digest = personaGroupDigest(group);
  const byAsk = await faceStandingCustody({ ask: askDigest });
  if (byAsk === null) {
    if (await faceStandingCustody({ group: digest }) === null) throw new Error("[face-route] the face of this founding stands in no custody; found it again");
    return;
  }
  await bindFaceCustody(byAsk.fcid, digest);
  await moveRows();
  await retireFaceAskCustody(byAsk.fcid);
}
