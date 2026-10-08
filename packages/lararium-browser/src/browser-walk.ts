/**
 * browser-walk — a browser leaf WALKS: it keeps, per hearth it walks at, the carried invite until it settles and
 * the grant that hearth pushed, in its own IndexedDB; and it presents under its own per-Nexus leaf.
 *
 * The walk itself is the platform-blind walk client (`walk-client`, mesh): the hearth's gate reads only what a
 * socket presents, so a browser and a node vessel walk alike. This module supplies the two things a browser holds
 * on its own: the store (IndexedDB, never federated) and the leaf (derived from this vessel's own persona root —
 * every leaf keeps its own floor root).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import {
  deriveNexusScopedKey, hexToBytes, PERSONA_GLAMOUR_CONTEXT,
  type WalkLeaf, type WalkRecord, type WalkStore,
} from "@lararium/mesh";
import { openVesselIdb, idbGet, idbPut, WALK_STORE, loadBrowserPersonaRootSeed } from "./browser-vessel-identity.js";

/** The walk store over this vessel's own IndexedDB, keyed by the hearth's gate key. */
export function browserWalkStore(idbName: string): WalkStore {
  return {
    async read(gatePubKey) {
      const db = await openVesselIdb(idbName);
      try { return (await idbGet<WalkRecord>(db, WALK_STORE, gatePubKey.toLowerCase())) ?? null; } finally { db.close(); }
    },
    async write(gatePubKey, record) {
      const db = await openVesselIdb(idbName);
      try { await idbPut(db, WALK_STORE, gatePubKey.toLowerCase(), record); } finally { db.close(); }
    },
  };
}

/** This vessel's leaf in Nexus `nexusAid`, derived from the persona root at `handleIndex`. */
export async function browserWalkLeaf(idbName: string, nexusAid: string, handleIndex: number): Promise<WalkLeaf> {
  const root = await loadBrowserPersonaRootSeed(idbName, handleIndex);
  const kp = await deriveNexusScopedKey(root, handleIndex, PERSONA_GLAMOUR_CONTEXT, nexusAid);
  return { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
}
