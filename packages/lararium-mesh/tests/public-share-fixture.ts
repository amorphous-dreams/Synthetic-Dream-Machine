import { makeShareBoundary, makeTierFloorSource } from "../src/index.js";

/** Structural guard fixtures declare PUBLIC explicitly so the new tightening floor adds no restriction.
 * P27's dedicated tests supply restrictive, mutable declarations instead. Never a production fallback. */
export const publicShareTiers = makeShareBoundary({
  declared: { declaredTierForDoc: () => "public" },
  floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }),
}, () => {});

export const publicCasFixture = {
  tiers: publicShareTiers,
  documentForBag: (bag: string) => bag,
  documentsForCid: (): readonly string[] => [],
  releasedDocument: () => "released-public-floor",
};

export const publicIslandFixture = {
  tiers: publicShareTiers,
  documentsForCid: () => ["held-public-doc"],
};
