/**
 * browser-walk — a browser leaf WALKS: it keeps, per hearth it walks at, the carried invite until it settles and
 * the grant that hearth pushed, under the slot tree; and it presents under its own per-Nexus leaf.
 *
 * The walk itself is the platform-blind walk client (`walk-client`, mesh): the hearth's gate reads only what a
 * socket presents, so a browser and a node vessel walk alike. This module keeps the walk record and the face's
 * per-Nexus key as sealed custody rows, local to the browser.
 *
 * WHAT RESTS WHERE: `walk/<gateKey>` carries each walk record, including its invite; `nexus-key/h<N>/<aid>`
 * carries the face's 32-byte key at that Nexus. Each row rests under the slot tree in `keystore`.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import * as ed25519 from "@noble/ed25519";
import { hex, type WalkLeaf, type WalkRecord, type WalkStore } from "@lararium/mesh";
import type { CarriedAdmitPayload } from "@lararium/keyhive";
import { loadBrowserPersonaRootSeed } from "./browser-vessel-identity.js";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";

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
 * The walk store under the slot tree, keyed by the hearth's gate key. An update holds the custody act lock
 * through its read, decision and write. A decision that throws writes nothing.
 */
export function browserWalkStore(idbName: string): WalkStore {
  return {
    async read(gatePubKey) { return (await readKeystoreRow(idbName, `walk/${gatePubKey.toLowerCase()}`) as WalkRecord | undefined) ?? null; },
    update(gatePubKey, decide) { return withCustodyRows(idbName, async (rows) => {
      const row = `walk/${gatePubKey.toLowerCase()}`;
      const wrote = decide((await rows.read(row) as WalkRecord | undefined) ?? null);
      if (wrote) await rows.write(row, wrote);
      return wrote;
    }); },
  };
}

/**
 * The key the face at `handleIndex` presents in Nexus `nexusAid`: the one standing, or 32 bytes minted at random in
 * one custody act where none stands (a walk presents the face there). Throws where this vessel holds no
 * root at that index: a face it does not hold presents nowhere.
 */
export async function browserWalkLeaf(idbName: string, nexusAid: string, handleIndex: number): Promise<WalkLeaf> {
  (await loadBrowserPersonaRootSeed(idbName, handleIndex)).fill(0);
  const row = `nexus-key/h${handleIndex}/${nexusAid.trim().toLowerCase()}`;
  const seed = await withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(row);
    if (standing instanceof Uint8Array && standing.length === 32) return Uint8Array.from(standing);
    if (standing !== undefined) throw new Error("browser-walk: the face's key at that Nexus stands malformed");
    const fresh = crypto.getRandomValues(new Uint8Array(32));
    try { await rows.write(row, fresh); return Uint8Array.from(fresh); } finally { fresh.fill(0); }
  });
  return { verifyingKey: hex(await ed25519.getPublicKeyAsync(seed)), seed };
}
