/**
 * face-route-prompt — THE ROUTE A NEW FACE ASKS FOR.
 *
 * Each face seals its custody under a key wrapped in that face's own slot tree, bound under a human route the face
 * asks for when it founds: the vessel's route opens no sibling face and no face's route opens the vessel. A terminal
 * answers with a prompt; a harness seats its own route explicitly (`tools/test-ward-route.mjs`); with neither, the act
 * refuses by name and founds nothing. No marker file ever answers for a route.
 */
import type { SlotSpec } from "@lararium/mesh";
import { faceRouteSeated, gatherFaceRoute, seatFaceRoute } from "@lararium/node";
import { sendCustodyFrame } from "./custody-door.js";
import { askYesNo, gatherFoundingRoute, requireTty } from "./custody-prompt.js";

/**
 * The node route a founding just gathered, held for the ONE question persona zero's face founding asks next. A face founded any
 * later asks nothing of it.
 */
let nodeRouteOfThisFounding: readonly SlotSpec[] | null = null;
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
  return gatherFoundingRoute();
}

/** Seat the gatherer the face-founding acts of this process ask. */
export function seatNewFaceRoute(): void { if (!faceRouteSeated()) seatFaceRoute(gatherNewFaceRoute); }

/**
 * Hand a new face's route to the vessel standing on this store, over its custody door, before a face founds inside it.
 * The route rides the custody frame alone: a verb's arguments get hashed into a receipt, so the route never rides one.
 */
export async function handFaceRouteToVessel(label: string): Promise<void> {
  // The gatherer this process seated asks (the binary seats the terminal prompt; a harness seats its own route explicitly).
  const slots = await gatherFaceRoute(label);
  for (const slot of slots) {
    if (slot.pins.some((pin) => pin.kind !== "passphrase")) {
      throw new Error("a standing vessel takes a passphrase route for a new face over its door; stop the vessel to bind a paper sheet");
    }
  }
  const answer = await sendCustodyFrame({ op: "face-route", slots });
  if (answer === null || (answer as { parked?: unknown }).parked !== true) {
    throw new Error("the standing vessel did not take the new face's route; nothing was founded");
  }
}
