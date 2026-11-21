/**
 * face-route-prompt — THE ROUTE A NEW FACE ASKS FOR.
 *
 * Each face seals its custody under a key wrapped in that face's own slot tree, bound under a human route the face
 * asks for when it founds: the vessel's route opens no sibling face and no face's route opens the vessel. A terminal
 * answers with a prompt; a harness seats its own route explicitly (`tools/test-ward-route.mjs`); with neither, the act
 * refuses by name and founds nothing. No marker file ever answers for a route.
 */
import type { SlotSpec } from "@lararium/mesh";
import { faceRouteBindDigest, faceRouteSeated, gatherFaceRoute, seatFaceRoute } from "@lararium/node";
import { sendCustodyFrame } from "./custody-door.js";
import { askYesNo, gatherFoundingRoute, requireTty } from "./custody-prompt.js";

/**
 * The node route a founding just gathered, held for the ONE question persona zero's face founding asks next. A face founded any
 * later asks nothing of it.
 */
let nodeRouteOfThisFounding: readonly SlotSpec[] | null = null;

/** Why a new face over a standing vessel's door binds a passphrase alone. */
export const STANDING_VESSEL_PASSPHRASE_ONLY = "a standing vessel takes a passphrase route for a new face over its door; stop the vessel to bind a paper sheet";

/** Set while a route gathers for a standing vessel's door: the bind prompt then offers the passphrase alone. */
let gatheringForStandingVessel = false;
export function noteFoundingNodeRoute(slots: readonly SlotSpec[]): void { nodeRouteOfThisFounding = slots; }

/**
 * One new face's route: a prompt on a terminal, and nothing else. No file answers for it: a face (and the ward it binds) founds
 * only under a route a person typed. A test harness seats its route explicitly (`tools/test-ward-route.mjs`, loaded ahead of the
 * binary); the product never reads a marker here.
 */
export async function gatherNewFaceRoute(face: { readonly label: string }): Promise<readonly SlotSpec[]> {
  requireTty(`a new face (${face.label})`);
  const nodeRoute = nodeRouteOfThisFounding;
  nodeRouteOfThisFounding = null;
  if (nodeRoute !== null) {
    // THE FIRST FOUNDING ASKS, NOTHING PRESELECTED. The answer decides only which route the face tree binds: the two trees stay
    // independent either way (separate wrapped keys, KDF salts and slot ids), so a later rotation on one never moves the other.
    const same = await askYesNo(`Should persona zero's face tree take the same typed route as this vessel's node tree? One credential then opens both.`);
    if (same) return nodeRoute;
  }
  process.stdout.write(`Face ${face.label} takes a route of its own, apart from this vessel's. Lose it and this face's sealed state opens for no one.\n`);
  return gatherFoundingRoute(gatheringForStandingVessel ? { passphraseOnly: STANDING_VESSEL_PASSPHRASE_ONLY } : {});
}

/** Seat the gatherer the face-founding acts of this process ask. */
export function seatNewFaceRoute(): void { if (!faceRouteSeated()) seatFaceRoute(gatherNewFaceRoute); }

/**
 * Hand a new face's route to the vessel standing on this store, over its custody door, before a face founds inside it.
 * The route rides the custody frame alone: a verb's arguments get hashed into a receipt, so the route never rides one.
 */
export async function handFaceRouteToVessel(label: string, purpose: "persona-new" | "bundle.restore", args: Readonly<Record<string, unknown>>): Promise<string> {
  // The gatherer this process seated asks (the binary seats the terminal prompt; a harness seats its own route explicitly).
  // THE PROMPT KNOWS FIRST: it offers the passphrase alone, so no sheet prints that the door would then refuse.
  gatheringForStandingVessel = true;
  let slots: readonly SlotSpec[];
  try { slots = await gatherFaceRoute(label); } finally { gatheringForStandingVessel = false; }
  // A harness that seats its own route still meets the door's rule here.
  for (const slot of slots) {
    if (slot.pins.some((pin) => pin.kind !== "passphrase")) throw new Error(STANDING_VESSEL_PASSPHRASE_ONLY);
  }
  const answer = await sendCustodyFrame({ op: "face-route", slots, purpose, argsDigest: faceRouteBindDigest(purpose, args) });
  if (answer === null || typeof answer["ref"] !== "string") {
    throw new Error("the standing vessel did not take the new face's route; nothing was founded");
  }
  return answer["ref"] as string;
}

/**
 * Hand a face's EXISTING route to the standing vessel, for a founding that stopped midway (its custody and anchors stand, its
 * plane entry does not): the act runs again under the route that face already binds, so the ward door asks it ONCE, hidden, and
 * nothing binds a new one (`persona-route-rebind`). The route rides the custody frame alone, as a new face's does.
 */
export async function handExistingFaceRouteToVessel(face: number, purpose: "persona-new", args: Readonly<Record<string, unknown>>): Promise<string> {
  // LOADED WHEN ASKED: the ward door reaches the store door and its session connector, and this module rides every founding's import
  // graph (a suite's setup loads it), so a static import would load the connector before a suite can mock it.
  const { gatherWardRoute } = await import("./ward-door.js");
  const route = await gatherWardRoute(`lares persona new ${face} (completing h${face}'s founding)`, face);
  const slots: SlotSpec[] = route.flatMap((c) => (c.kind === "passphrase" ? [{ t: 1, pins: [{ kind: "passphrase" as const, passphrase: c.passphrase }] }] : []));
  if (slots.length === 0) throw new Error(STANDING_VESSEL_PASSPHRASE_ONLY);
  const answer = await sendCustodyFrame({ op: "face-route", slots, purpose, argsDigest: faceRouteBindDigest(purpose, args) });
  if (answer === null || typeof answer["ref"] !== "string") throw new Error(`the standing vessel did not take h${face}'s route; nothing was founded`);
  return answer["ref"] as string;
}
