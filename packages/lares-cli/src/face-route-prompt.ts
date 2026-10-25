/**
 * face-route-prompt — THE ROUTE A NEW FACE ASKS FOR.
 *
 * Each face seals its custody under a key wrapped in that face's own slot tree, bound under a human route the face
 * asks for when it founds: the vessel's route opens no sibling face and no face's route opens the vessel. A terminal
 * answers with a prompt; a root a harness staged answers with the published test route (the vessel key opens the same way,
 * `offline-custody`); with neither, the act refuses by name and founds nothing.
 */
import type { SlotSpec } from "@lararium/mesh";
import { faceRouteSeated, seatFaceRoute } from "@lararium/node";
import { sendCustodyFrame } from "./custody-door.js";
import { gatherFoundingRoute, requireTty } from "./custody-prompt.js";
import { TEST_ROUTE_PASSPHRASE, testScratchRoot } from "./offline-custody.js";

/** One new face's route: a prompt on a terminal, the published test route on a staged root. */
export async function gatherNewFaceRoute(face: { readonly label: string }): Promise<readonly SlotSpec[]> {
  if (testScratchRoot()) {
    process.stderr.write(`[custody] TEST SCRATCH ROOT: binding face ${face.label} under the published test route\n`);
    return [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }] }];
  }
  requireTty(`a new face (${face.label})`);
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
  const slots = await gatherNewFaceRoute({ label });
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
