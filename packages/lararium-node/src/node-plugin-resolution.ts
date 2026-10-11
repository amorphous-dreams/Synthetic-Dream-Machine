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
import {
  bootSetIds, bootSetPluginCids, verifyCasBytes,
  selectPluginBlobs, selectedPluginCids,
  offeringAnnouncesFromDoc, sha256HexBytesSync,
} from "@lararium/mesh";

export type NodePluginResolutionVerdict =
  | { readonly ok: true; readonly pluginCids: readonly string[] }
  | { readonly ok: false; readonly error: string };

export interface ResolveNodeIslandPluginCidsOpts {
  readonly islandBlobs: Record<string, { readonly id?: string; readonly sha256?: string; readonly mimeType?: string }> | undefined;
  readonly recipe: WikiRecipe;
  readonly lookup: OfferingLookup;
  readonly readBytes: (cid: string) => Uint8Array | null;
}

/** @see the module docblock. */
export async function resolveNodeIslandPluginCids(
  opts: ResolveNodeIslandPluginCidsOpts,
): Promise<NodePluginResolutionVerdict> {
  if (opts.recipe.pluginOfferingsFault) {
    return { ok: false, error: `${opts.recipe.wikiSlug}: malformed-offerings-field: ${opts.recipe.pluginOfferingsFault}` };
  }
  const floorCids  = bootSetPluginCids(opts.islandBlobs);
  const bootIds    = bootSetIds(opts.islandBlobs);
  const offerings  = opts.recipe.pluginOfferings ?? [];
  const selection  = await selectPluginBlobs(offerings, opts.lookup, bootIds);
  if (!selection.ok) {
    return { ok: false, error: `${opts.recipe.wikiSlug}: offering selection ${JSON.stringify(selection.failure)}` };
  }
  const selectedCids = selectedPluginCids(selection.blobs);
  const bytesVerdict = verifyCasBytes(selectedCids, opts.readBytes, (b) => sha256HexBytesSync(b));
  if (!bytesVerdict.ok) {
    return { ok: false, error: `${opts.recipe.wikiSlug}: ${JSON.stringify(bytesVerdict.failure)}` };
  }
  // Dedup: a selected offering's CID coinciding with a floor CID would need a raw sha256 collision
  // (practically disjoint namespaces), but a Set keeps the manifest from ever naming one CID twice.
  return { ok: true, pluginCids: [...new Set([...floorCids, ...selectedCids])] };
}

/** @see the module docblock. */
export function nodeOfferingLookup(crossroadsDoc: LarDoc | undefined | null): OfferingLookup {
  const byOfferingCid = new Map(offeringAnnouncesFromDoc(crossroadsDoc).map((a) => [a.offeringCid, a.offering]));
  return (cid) => byOfferingCid.get(cid);
}
