/**
 * face-route — THE SEAM A NEW FACE ASKS ITS OWN ROUTE THROUGH.
 *
 * A face's custody key rests in that face's own slot tree, bound under a human route that face asks for: the vessel's
 * route opens no sibling face, and a face's route opens no sibling. A founding or an admit that has no face custody yet
 * gathers the slots here. A CLI seats a terminal prompt; a test seats a fixed passphrase. With nothing seated the act
 * refuses by name and founds nothing, so no face ever rests under a route nobody gave.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";
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

type RoutePurpose = "persona-new" | "bundle.restore";
/** Bind the public identifying arguments; never hash a human route or a bundle key into this name. */
export function faceRouteBindDigest(purpose: RoutePurpose, args: Readonly<Record<string, unknown>>): string {
  // Both restore callers know the sealed body only inside their run callback. Canonicalize its bytes here,
  // so the wire's base64 and the sealed act's decoded bytes bind the same bundle, including card restores.
  // With no explicit `as`, only the receiving store can choose the next free index. For that unknown index,
  // purpose + one-use + an unguessable ref stand; the known bundle bytes still bind at both ends.
  const body = args["body"];
  const bundle = purpose === "bundle.restore"
    ? createHash("sha256").update(typeof body === "string" ? Buffer.from(body, "base64") : body as Uint8Array).digest("hex") : null;
  return createHash("sha256").update(JSON.stringify(purpose === "persona-new"
    ? { purpose, handleIndex: args["handleIndex"] ?? 0 }
    : { purpose, bundle, as: args["as"] ?? null })).digest("hex");
}
const parked = new Map<string, { slots: readonly SlotSpec[]; purpose: RoutePurpose; digest: string }>();
const operationRoute = new AsyncLocalStorage<{ slots: readonly SlotSpec[] | null }>();
/** Park at most four abandoned routes, each behind a fresh one-use capability. */
export function parkFaceRoute(slots: readonly SlotSpec[], purpose: RoutePurpose, digest: string): string {
  const ref = randomBytes(32).toString("hex");
  parked.set(ref, { slots, purpose, digest });
  while (parked.size > 4) parked.delete(parked.keys().next().value!);
  return ref;
}
export class FaceRouteRefused extends Error {
  override readonly name = "FaceRouteRefused";
  constructor() { super("face-route-refused: route reference absent, expired, spent, or for another operation or identifying arguments"); }
}
/** Spend the capability before the operation begins; async context isolates concurrent operations. */
export async function withFaceRoute<T>(ref: string | undefined, purpose: RoutePurpose, digest: string, act: () => Promise<T>): Promise<T> {
  if (ref === undefined) return act();
  const entry = parked.get(ref);
  parked.delete(ref); // Every presentation spends it, including a purpose or argument mismatch.
  if (!entry || entry.purpose !== purpose || entry.digest !== digest) throw new FaceRouteRefused();
  const scope = { slots: entry.slots as readonly SlotSpec[] | null };
  try { return await operationRoute.run(scope, act); }
  finally { scope.slots = null; }
}

export class FaceRouteAbsent extends Error {
  override readonly name = "FaceRouteAbsent";
  constructor(label: string) {
    super(`face ${label} asks its own human route and none was given: run the act at a terminal, or pass the face's route`);
  }
}

/** Hands a founding the route it gathered, so the founding's own ward act (its root's mint) rides that route: one prompt, one act. */
export type OnFaceRoute = (slots: readonly SlotSpec[]) => void;

export async function gatherFaceRoute(label: string): Promise<readonly SlotSpec[]> {
  const scoped = operationRoute.getStore();
  const handed = scoped?.slots ?? null;
  if (scoped) scoped.slots = null;
  if (!handed && !gatherer) throw new FaceRouteAbsent(label);
  const slots = handed ?? await gatherer!({ label });
  assertFoundingRoute(slots);
  return slots;
}

/**
 * Make sure custody stands for the face of `group`: found it under a route the face asks for when the index names none.
 * A face that stands and rests locked refuses `FaceLocked` at its first row; this act never opens a face by guessing.
 */
export async function ensureFaceCustodyOfGroup(group: string, onRoute?: OnFaceRoute): Promise<{ readonly fcid: string; readonly ordinal: number }> {
  const digest = personaGroupDigest(group);
  const standing = await faceStandingCustody({ group: digest });
  if (standing !== null) return { fcid: standing.fcid, ordinal: standing.ordinal };
  // A joinee takes the next handle index at request time: its ordinal in the floor index.
  const slots = await gatherFaceRoute(`g${digest.slice(0, 8)}`);
  onRoute?.(slots);
  return foundFaceCustody({ group: digest, slots });
}

/** Found custody for a face that has no group yet, under its founding ask; the caller binds the group when it stands. */
export async function ensureFaceCustodyOfAsk(askDigest: string, label: string, handleIndex?: number, onRoute?: OnFaceRoute): Promise<string> {
  const standing = await faceStandingCustody({ ask: askDigest });
  if (standing !== null) return standing.fcid;
  // A face's handle index is its ordinal: a face already settled at this index (its ask retired) serves the re-entry.
  if (handleIndex !== undefined) {
    const there = await faceStandingCustody({ ordinal: handleIndex });
    if (there !== null && there.group !== null) return there.fcid;
    // A face RESERVED at this handle index (its first row rested before the ask could be named) takes the ask.
    if (there !== null && there.ask === null) { await bindFaceAskCustody(there.fcid, askDigest); return there.fcid; }
  }
  const slots = await gatherFaceRoute(label);
  onRoute?.(slots);
  return (await foundFaceCustody({ ask: askDigest, slots, ...(handleIndex !== undefined ? { ordinal: handleIndex } : {}) })).fcid;
}

/**
 * Make sure custody stands for the face at handle index `handleIndex`, RESERVED under no group and no ask: the root of persona zero
 * rests before the seed charter whose AID the founding ask digests, so the face stands first and takes its ask when that stands.
 */
export async function ensureFaceCustodyAtHandle(handleIndex: number, label: string, onRoute?: OnFaceRoute): Promise<string> {
  const there = await faceStandingCustody({ ordinal: handleIndex });
  if (there !== null) return there.fcid;
  const slots = await gatherFaceRoute(label);
  onRoute?.(slots);
  return (await foundFaceCustody({ ordinal: handleIndex, slots })).fcid;
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
