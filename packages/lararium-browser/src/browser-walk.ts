/**
 * browser-walk — a browser leaf WALKS: it keeps, per hearth it walks at, the carried invite until it settles and
 * the grant that hearth pushed, in its own IndexedDB; and it presents under its own per-Nexus leaf.
 *
 * The walk itself is the platform-blind walk client (`walk-client`, mesh): the hearth's gate reads only what a
 * socket presents, so a browser and a node vessel walk alike. This module supplies the two things a browser holds
 * on its own: the store (IndexedDB, never federated) and the face's key at the Nexus (32 bytes minted at random
 * where the face first presents there, never derived from the persona seed; it rests beside the face's root).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import * as ed25519 from "@noble/ed25519";
import { hex, type WalkLeaf, type WalkRecord, type WalkStore } from "@lararium/mesh";
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import { openVesselIdb, idbGet, WALK_STORE, NEXUS_KEY_STORE, loadBrowserPersonaRootSeed } from "./browser-vessel-identity.js";

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

/**
 * The key the face at `handleIndex` presents in Nexus `nexusAid`: the one standing, or 32 bytes minted at random in
 * one IndexedDB transaction where none stands (a walk presents the face there). Throws where this vessel holds no
 * root at that index: a face it does not hold presents nowhere.
 */
export async function browserWalkLeaf(idbName: string, nexusAid: string, handleIndex: number): Promise<WalkLeaf> {
  (await loadBrowserPersonaRootSeed(idbName, handleIndex)).fill(0);
  const key = `h${handleIndex}:${nexusAid.trim().toLowerCase()}`;
  const db = await openVesselIdb(idbName);
  try {
    const seed = await new Promise<Uint8Array>((resolve, reject) => {
      const tx = db.transaction(NEXUS_KEY_STORE, "readwrite");
      const rows = tx.objectStore(NEXUS_KEY_STORE);
      let held: Uint8Array | null = null;
      const get = rows.get(key);
      get.onsuccess = () => {
        const standing = get.result as unknown;
        if (standing instanceof Uint8Array && standing.length === 32) { held = Uint8Array.from(standing); return; }
        if (standing !== undefined) { tx.abort(); return; }
        held = crypto.getRandomValues(new Uint8Array(32));
        rows.put(Uint8Array.from(held), key);
      };
      tx.oncomplete = () => (held ? resolve(held) : reject(new Error("browser-walk: the face's key at that Nexus would not read")));
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("browser-walk: the face's key at that Nexus stands malformed"));
    });
    return { verifyingKey: hex(await ed25519.getPublicKeyAsync(seed)), seed };
  } finally { db.close(); }
}
