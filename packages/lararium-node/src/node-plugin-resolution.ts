/**
 * node-plugin-resolution — the ONE node resolver (R3, M1): resolves ONE wiki's final manifest
 * `pluginCids`, through the SAME selector + CAS path on BOTH node paths (the daemon VM and the
 * wiki island pool).
 *
 * `resolveNodeIslandPluginCids` folds the fixed boot-set floor (grammar + boot shadows, read off
 * the island/oracle doc's own blobs) UNION this wiki's own recipe's verified, byte-checked
 * offering selection. It retires the old vessel-WIDE `pluginCidsFromIslandBlobs` hand-off (every
 * island got the exact SAME list, with no per-recipe distinction): `bootSetPluginCids`/`bootSetIds`
 * now name that floor computation under its right, narrower scope — one fixed INGREDIENT of a
 * per-island resolution, never the whole answer by itself.
 *
 * Fail-closed throughout, in order: an offering this lookup cannot find, a lying lookup, a
 * boot-set-collision or cross-offering duplicate claim, or any `verifyPluginOffering` code
 * (`selectPluginBlobs`) refuses first; only THEN does a selected CID's bytes get checked against
 * the local CAS (`verifyCasBytes`) — missing or corrupt bytes refuse by name, never silently as
 * an empty or trimmed set.
 *
 * `nodeOfferingLookup` builds the node Crossroads board's offering lookup: a verified selection
 * re-verifies every offering it resolves (`selectPluginBlobs` → `verifyPluginOffering`), so this
 * lookup stays a shape-only projection (`offeringAnnouncesFromDoc`) — never a second, redundant
 * certify pass.
 *
 * Lifted out of `open-node-vessel.ts` (M1): a single module BOTH node call sites import, instead
 * of each reproducing or re-deriving the combinator — so a mutation to one path's wiring cannot
 * silently diverge from the other's, and this module alone carries the node resolver's test.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/node-plugin-resolution
 */

import type { LarDoc, WikiRecipe, OfferingLookup } from "@lararium/mesh";
import { offeringAnnouncesFromDoc, resolveRecipePluginCids } from "@lararium/mesh";

export type NodePluginResolutionVerdict =
  | { readonly ok: true; readonly pluginCids: readonly string[] }
  | { readonly ok: false; readonly error: string };

export interface ResolveNodeIslandPluginCidsOpts {
  readonly islandBlobs: Record<string, { readonly id?: string; readonly sha256?: string; readonly mimeType?: string }> | undefined;
  readonly recipe: WikiRecipe;
  readonly lookup: OfferingLookup;
  readonly readBytes: (cid: string) => Uint8Array | null;
}

/**
 * The node vessel's plugin selection for one recipe. The selection itself stands in mesh
 * (`resolveRecipePluginCids`), the one function the surface mount's resolver and the browser read too; this
 * door hands it the node's own inputs: the island document's blobs, the Crossroads lookup and the filesystem
 * content store.
 */
export function resolveNodeIslandPluginCids(
  opts: ResolveNodeIslandPluginCidsOpts,
): Promise<NodePluginResolutionVerdict> {
  return resolveRecipePluginCids(opts.recipe, { islandBlobs: opts.islandBlobs, lookup: opts.lookup, readBytes: opts.readBytes });
}

/** @see the module docblock. */
export function nodeOfferingLookup(crossroadsDoc: LarDoc | undefined | null): OfferingLookup {
  const byOfferingCid = new Map(offeringAnnouncesFromDoc(crossroadsDoc).map((a) => [a.offeringCid, a.offering]));
  return (cid) => byOfferingCid.get(cid);
}
