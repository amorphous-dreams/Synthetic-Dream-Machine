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
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import { openVesselIdb, idbGet, WALK_STORE, loadBrowserPersonaRootSeed } from "./browser-vessel-identity.js";

/**
 * A face join must follow the island the issuing hearth resolved when it minted admission. Earlier
 * browser fallthroughs derived a private island when those carried pins were absent; that mounted
 * a different recipe plane and made shared carriers look absent. The browser refuses the missing
 * relation by name rather than rebuilding it from a gate key.
 */
export function requireAdmittedFaceIsland<
  T extends Pick<CarriedAdmitPayload, "hearthIslandKind" | "hearthIslandScope">,
>(
  payload: T,
): asserts payload is T & {
  readonly hearthIslandKind: NonNullable<CarriedAdmitPayload["hearthIslandKind"]>;
  readonly hearthIslandScope: string;
} {
  const { hearthIslandKind, hearthIslandScope } = payload;
  if (
    !hearthIslandKind ||
    !["own", "anchor", "charter", "explicit"].includes(hearthIslandKind) ||
    typeof hearthIslandScope !== "string" ||
    hearthIslandScope.length === 0
  ) {
    throw new Error("[face-join] admission lacks the hearth's resolved island kind and scope");
  }
}

/**
 * The walk store over this vessel's own IndexedDB, keyed by the hearth's gate key. An `update` reads, decides and
 * writes inside ONE read-write transaction, which IndexedDB runs alone over the store: no other tab or callback of
 * this origin lands between the read and the write. A decision that throws aborts the transaction and writes nothing.
 */
export function browserWalkStore(idbName: string): WalkStore {
  return {
    async read(gatePubKey) {
      const db = await openVesselIdb(idbName);
      try { return (await idbGet<WalkRecord>(db, WALK_STORE, gatePubKey.toLowerCase())) ?? null; } finally { db.close(); }
    },
    async update(gatePubKey, decide) {
      const db = await openVesselIdb(idbName);
      try {
        return await new Promise<WalkRecord | null>((resolve, reject) => {
          const key = gatePubKey.toLowerCase();
          const tx = db.transaction(WALK_STORE, "readwrite");
          const rows = tx.objectStore(WALK_STORE);
          let wrote: WalkRecord | null = null;
          let refused: { readonly error: unknown } | null = null;
          const get = rows.get(key);
          get.onsuccess = () => {
            try {
              wrote = decide((get.result as WalkRecord | undefined) ?? null);
              if (wrote) rows.put(wrote, key);
            } catch (error) { refused = { error }; tx.abort(); }
          };
          tx.oncomplete = () => resolve(wrote);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(refused ? refused.error : (tx.error ?? new Error("the walk store's transaction aborted")));
        });
      } finally { db.close(); }
    },
  };
}

/** This vessel's leaf in Nexus `nexusAid`, derived from the persona root at `handleIndex`. */
export async function browserWalkLeaf(idbName: string, nexusAid: string, handleIndex: number): Promise<WalkLeaf> {
  const root = await loadBrowserPersonaRootSeed(idbName, handleIndex);
  const kp = await deriveNexusScopedKey(root, handleIndex, PERSONA_GLAMOUR_CONTEXT, nexusAid);
  return { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
}
