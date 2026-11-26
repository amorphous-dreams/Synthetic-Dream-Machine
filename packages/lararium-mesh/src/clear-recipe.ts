/**
 * clear-recipe — THE CLEAR WIKI'S RECIPE AND ITS FLOOR PICK: the floor-class view of any recipe, and which floor a clear
 * island mounts. Pure cores both: no island, no listener, no boot.
 *
 * THE CLEAR RECIPE. `clearRecipeOf(recipe)` keeps what rides a floor and drops everything sealed above it. The oracle foot
 * stays; the system canon (`lares`, `lararium`) stays, since it stands on every floor; a canon or library bag stays only
 * where its OWN declared tier reads `public` (`floorCarriesTier`), and a bag whose tier nobody answers drops (the safe
 * answer). Every instance slot (draft, personal, working), every mirror, every pin and every optional plugin offering drops,
 * and one memory-held temp layer tops the stack. A kept bag reads from the floor's own snapshot of it, by CID; a clear
 * island never opens a live document.
 *
 * THE CLEAR WIKI NEVER SAVES. The temp top alone takes a write, and it leaves with the composition. A write below it, a
 * promotion, a mirror and a receipt ask each answer the herm's own refusal (`herm-stack.ts`, the `wikiNeverSaves` office),
 * inward, with its cure.
 *
 * THE FLOOR PICK. `clearFloorPick` reads the release chain the leyline carries: one counted head mounts, stamped
 * `carried-unaccepted` with the head release's CID (a place accepts by its own act, never a herm); no counted release, or
 * two heads standing, mounts genesis. The pick reads causal identity alone: no argument carries a clock.
 *
 * Platform-blind and pure. Ships into the wiki VM as the module tiddler `lar:///ha.ka.ba/lararium/tw5/lib/clear-recipe`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/herm-caps · lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/herm-rungs
 */

import { floorCarriesTier, type CapTier } from "./cap-tier.js";
import type { FloorReleaseStanding } from "./floor-release.js";
import { HERM_REFUSAL, type HermRefusal } from "./herm-stack.js";
import { LARARIUM_BAG, LARES_BAG, ORACLE_BAG, wikiCanonOf, wikiSlotUri, type SlotUri, type WikiRecipe } from "./wiki-recipe.js";

// ── the clear recipe ───────────────────────────────────────────────────────────────────────────────────────────────

/** A floor-class recipe: `expandRecipe` lays its memory top, the bags that ride a floor, and the oracle foot. */
export interface ClearRecipe {
  readonly wikiSlug: string;
  readonly libraryBags?: readonly SlotUri[];
  readonly clear: true;
}

export const isClearRecipe = (r: WikiRecipe): r is ClearRecipe => r.clear === true;

/** The canon every floor carries, whatever a tier source answers. */
const FLOOR_SYSTEM_CANON: ReadonlySet<SlotUri> = new Set([LARES_BAG, LARARIUM_BAG]);

/** A bag's own declared tier, or null where this reader holds no declaration for it. */
export type BagTierOf = (bag: SlotUri) => CapTier | null | undefined;

/**
 * THE FLOOR-CLASS VIEW OF A RECIPE. The recipe's canon and its library bags keep their order and stay only where they ride
 * a floor; the wiki keeps its slug, so the temp top stays the wiki's own. A recipe already clear returns re-read through the
 * same law, never trusted as it stands.
 */
export function clearRecipeOf(recipe: WikiRecipe, tierOf: BagTierOf = () => null): ClearRecipe {
  const rides = (bag: SlotUri): boolean => {
    if (bag === ORACLE_BAG) return false; // the foot lays itself
    if (FLOOR_SYSTEM_CANON.has(bag)) return true;
    const tier = tierOf(bag);
    return tier !== null && tier !== undefined && floorCarriesTier(tier);
  };
  const candidates = isClearRecipe(recipe) ? (recipe.libraryBags ?? []) : [wikiCanonOf(recipe), ...(recipe.libraryBags ?? [])];
  const libraryBags = [...new Set(candidates)].filter(rides);
  return { wikiSlug: recipe.wikiSlug, clear: true, ...(libraryBags.length > 0 ? { libraryBags } : {}) };
}

/** The clear wiki's one writable layer: its memory-held temp top. */
export const clearTopSlot = (recipe: Pick<ClearRecipe, "wikiSlug">): SlotUri => wikiSlotUri(recipe.wikiSlug, "temp");

/** The flags a clear recipe's slot registers with: the temp top takes every write, and nothing beneath it takes one. */
export function clearLayerFlags(recipe: Pick<ClearRecipe, "wikiSlug">, slot: SlotUri): { writable: boolean; defaultWritable: boolean } {
  const top = slot === clearTopSlot(recipe);
  return { writable: top, defaultWritable: top };
}

/** What a hand may ask of a clear wiki: a write at a slot, or an act that would persist something. */
export type ClearAsk =
  | { readonly kind: "put" | "tombstone"; readonly slot: SlotUri }
  | { readonly kind: "promote" | "mirror" | "receipt" };

/**
 * The refusal a clear wiki answers an ask with, or null where the ask lands: a put or a tombstone at the memory top alone.
 * Every other ask answers the herm's `wikiNeverSaves` refusal, its line naming the ask.
 */
export function clearAskRefusal(recipe: Pick<ClearRecipe, "wikiSlug">, ask: ClearAsk): HermRefusal | null {
  if ((ask.kind === "put" || ask.kind === "tombstone") && ask.slot === clearTopSlot(recipe)) return null;
  const refusal = HERM_REFUSAL.wikiNeverSaves;
  const where = ask.kind === "put" || ask.kind === "tombstone" ? ` at ${ask.slot}` : "";
  return { ...refusal, why: `the clear wiki takes no ${ask.kind}${where}; ${refusal.why}` };
}

// ── the floor pick ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The two stamps a clear floor reads by (the floor-accept ruling's own words). */
export const CLEAR_FLOOR_STAMP = Object.freeze({ genesis: "genesis", carried: "carried-unaccepted" } as const);

export type ClearFloorPick =
  /** The genesis floor: `cid` null where the seed names no floor witness (the island then reads its seed's own). */
  | { readonly cid: string | null; readonly stamp: typeof CLEAR_FLOOR_STAMP.genesis; readonly head: null; readonly note?: string }
  /** The newest release the leyline carries, never accepted here: `head` names the release CID the pick read. */
  | { readonly cid: string; readonly stamp: typeof CLEAR_FLOOR_STAMP.carried; readonly head: string };

/**
 * THE FLOOR A CLEAR ISLAND MOUNTS. `carriedHead` holds the fold of the release rows this vessel carries
 * (`foldFloorReleases`), or null where it carries no board. The pick moves no pin and writes nothing.
 */
export function clearFloorPick(args: { readonly genesis: string | null; readonly carriedHead: Pick<FloorReleaseStanding, "standing" | "head"> | null }): ClearFloorPick {
  const carried = args.carriedHead;
  if (carried !== null && carried.standing === "released" && carried.head !== null) {
    return { cid: carried.head.body.manifest, stamp: CLEAR_FLOOR_STAMP.carried, head: carried.head.cid };
  }
  if (carried !== null && carried.standing === "unsettled") {
    return { cid: args.genesis, stamp: CLEAR_FLOOR_STAMP.genesis, head: null, note: "two release heads stand and the cabal settled neither; the genesis floor mounts" };
  }
  return { cid: args.genesis, stamp: CLEAR_FLOOR_STAMP.genesis, head: null };
}
