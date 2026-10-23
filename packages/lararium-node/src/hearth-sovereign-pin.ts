/**
 * hearth-sovereign-pin — the FULL gate pin a hearth's admit and fleet-join answer carry.
 *
 * The pin is the public half of the sovereign gate bundle the hearth derives from its sealed custody root for one
 * Nexus on the sovereign sync route (`/ws`): `deriveGateBundle(sovereignGateRoot(custodyGateDoor()), nexus, route)`.
 * It never reads the vessel's own identity key (the old HEX64 pin did), so the key a joinee pins is the key the
 * hearth's gate answers under and no other. The bundle's secrets are dropped the moment the pin is read.
 *
 * `door` is a seam for a caller that holds another door (a test's, or a vessel whose seat is already open); the
 * default is the node's own custody door, which answers only while the seat holds its key and throws
 * `CustodyLocked` otherwise: an admit minted from a locked seat refuses rather than pin a key it cannot answer.
 *
 * THE STOOD NEXUS. A vessel stands its own sovereign sync gate at the AID of the charter it keeps (the primary charter's
 * genesis: `ownNexusAid` in the boot), whatever its island standing resolves to. `stoodSovereignPin` derives the pin
 * there, so a pin a fleet-join answer carries names a Nexus a gate actually stands at; a vessel that keeps no charter
 * stands no sovereign gate and refuses `NoStoodNexus` by name.
 *
 * THE FLOOR PINS. The vessel stands its flow's floor gate at the same Nexus on the flow route, under its floor key
 * (`floorGateRoot(vesselFloorKeyDoor())`). `stoodFloorPins` reads that pin set, so a fleet-join answer and the sovereign
 * session can carry it under a signature: a floor route takes its pin only through an authenticated relation or a
 * carried signed pin set (house ruling "The admit's gate pin").
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-sovereign-pin
 */
import {
  FLOW_SOCKET_ROUTE, SOVEREIGN_SYNC_ROUTE, deriveGateBundle, floorGateRoot, floorRoute, sovereignGateRoot, sovereignRoute,
  type CustodyRootDoor, type FloorKeyDoor, type GateBundlePin,
} from "@lararium/mesh";
import { custodyGateDoor } from "./custody-seat.js";
import { primaryNexusAid } from "./carried-set.js";

/** The hearth's sovereign sync pin at `nexusAid` (the Nexus's identifier as text). */
export function hearthSovereignPin(nexusAid: string, door: CustodyRootDoor = custodyGateDoor()): GateBundlePin {
  const bundle = deriveGateBundle(sovereignGateRoot(door), new TextEncoder().encode(nexusAid), sovereignRoute(SOVEREIGN_SYNC_ROUTE));
  try { return bundle.pin; } finally { bundle.drop(); }
}

/** No charter kept at the seal home: no sovereign gate stands, so no pin names one. */
export class NoStoodNexus extends Error {
  constructor() { super("this vessel keeps no charter, so no sovereign gate stands for a pin to name: found or import the charter first"); this.name = "NoStoodNexus"; }
}

/** The hearth's sovereign sync pin at the Nexus its own sync gate STANDS at: the primary charter's AID. */
export function stoodSovereignPin(sealHome: string, door: CustodyRootDoor = custodyGateDoor()): GateBundlePin {
  const aid = primaryNexusAid(sealHome);
  if (aid === null) throw new NoStoodNexus();
  return hearthSovereignPin(aid, door);
}

/** The routes this vessel stands a floor gate on, at every Nexus it stands at: the flow's. */
export const STOOD_FLOOR_ROUTES: readonly string[] = [FLOW_SOCKET_ROUTE];

/** The hearth's floor pins at `nexusAid`: one per floor route its floor gates stand on, the bundles' secrets dropped. */
export function hearthFloorPins(nexusAid: string, door: FloorKeyDoor): GateBundlePin[] {
  return STOOD_FLOOR_ROUTES.map((route) => {
    const bundle = deriveGateBundle(floorGateRoot(door), new TextEncoder().encode(nexusAid), floorRoute(route));
    try { return bundle.pin; } finally { bundle.drop(); }
  });
}

/** The hearth's floor pins at the Nexus its gates STAND at (the primary charter's AID). */
export function stoodFloorPins(sealHome: string, door: FloorKeyDoor): GateBundlePin[] {
  const aid = primaryNexusAid(sealHome);
  if (aid === null) throw new NoStoodNexus();
  return hearthFloorPins(aid, door);
}
