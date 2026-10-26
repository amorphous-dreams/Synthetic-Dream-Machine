/**
 * hearth-floor-claims — a hearth's FLOOR PIN CLAIMS: each floor pin it stands, claimed at the head of its own place KEL under the
 * signer the KEL seats there (lar:///ha.ka.ba/lararium/mesh/place-floor-pin).
 *
 * Two doors read it: the sovereign session sends the claims and the KEL rows beside the pin set it already sends (`gate-sync-server`),
 * so a connected reader's pair index re-files a rotated hearth's pin live; and the banner's floor card carries the flow route's claim.
 * The chain loads through the custody-reconciled door (`loadPlaceKelChain`), so a rotation staged before a crash finishes first.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-floor-claims
 */
import {
  ed25519SignerFromSeed, hexToBytes, signPlaceFloorPin, verifyPlaceKel,
  type GateBundlePin, type HearthFloorProof, type PlaceFloorPinStatement, type PlaceKelEvent,
} from "@lararium/mesh";
import { loadPlaceKelChain, loadVesselSigningSeed } from "./node-vessel-identity.js";

/** Claim each pin at the place KEL's head; null where the place has no KEL that reads. */
export async function hearthFloorProof(pins: readonly GateBundlePin[]): Promise<HearthFloorProof | null> {
  const chain = await loadPlaceKelChain();
  const at = verifyPlaceKel(chain);
  if (!at.ok) return null;
  const signer = ed25519SignerFromSeed(await loadVesselSigningSeed());
  const claims: PlaceFloorPinStatement[] = [];
  for (const pin of pins) claims.push(await signPlaceFloorPin({ at, pin, sign: async (image) => hexToBytes(await signer(image)) }));
  return { claims, kel: chain as readonly PlaceKelEvent[] };
}
