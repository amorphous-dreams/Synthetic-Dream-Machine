/**
 * fleet-join-admit — the admit a verified fleet-join answer carries, in the shape a vessel founds a face by.
 *
 * The answer's device edge carries the signed `device-admit/v1` payload; its gate pin, floor pins, canon list and reach ride INSIDE
 * the PersonaGroup root's signature over the answer (`@lararium/mesh` `fleet-join`). This reads them into the one
 * shape both founding doors take: the node's `runInit` and the browser's admit boot. Platform-blind: the node's
 * fleet-join door and the browser's land the same value off the same answer.
 *
 * Call it on an answer `readFleetJoinAnswer` verified, never on a carried file: the shape checks here guard the
 * founding, and the answer's signature makes the pin the hearth's own.
 */
import type { FleetJoinAnswer } from "@lararium/mesh";
import type { CarriedAdmitPayload, DeviceAdmitPayload } from "./index.js";

export const FLEET_JOIN_ADMIT_REFUSALS = ["edge-malformed", "edge-other-face", "reach-malformed"] as const;
export type FleetJoinAdmitRefusalName = (typeof FLEET_JOIN_ADMIT_REFUSALS)[number];

const ISLAND_KINDS = new Set(["own", "anchor", "charter", "explicit"]);

/** The admit `answer` carried: the signed edge, with the signed pin, canon and reach beside it. */
export function carriedAdmitOfFleetJoin(answer: FleetJoinAnswer): CarriedAdmitPayload | { readonly refusal: FleetJoinAdmitRefusalName } {
  const edge = answer.edge as DeviceAdmitPayload;
  if (typeof edge !== "object" || edge === null || edge.kind !== "device-admit/v1") return { refusal: "edge-malformed" };
  if (edge.personaGroupId !== answer.personaGroup) return { refusal: "edge-other-face" };
  const { islandKind, islandScope, syncUrl } = answer.reach;
  if (islandKind !== null && !ISLAND_KINDS.has(islandKind)) return { refusal: "reach-malformed" };
  return {
    ...edge,
    syncUrl,
    hearthGatePubKey: answer.carriage.gatePin.signingKey,
    hearthGatePin:    answer.carriage.gatePin,
    hearthFloorPins:  answer.floorPins,
    hearthCanonDocs:  answer.carriage.canon,
    ...(islandKind !== null ? { hearthIslandKind: islandKind as NonNullable<CarriedAdmitPayload["hearthIslandKind"]> } : {}),
    ...(islandScope !== null ? { hearthIslandScope: islandScope } : {}),
  };
}
