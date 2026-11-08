import { expect, test } from "vitest";
import { makeShareBoundary, makeManifestTierSource, makeTierFloorSource, type CapTier } from "@lararium/mesh";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

// No vessel, listener or worker: the exact verdict openNodeVessel seats on BOTH Repo hooks.
test("P27 node repo: a proven sibling cannot pull VEIL; PERSONAGROUP still crosses", async () => {
  let tier: CapTier = "veil";
  const refused: Error[] = [];
  const tiers = makeShareBoundary({
    declared: makeManifestTierSource({ bagOfDoc: () => ({ kind: "bag", bag: "work" }),
      manifestOf: () => ({ bag: "work", tier, home: "hearth" }), tiddlerTiersOf: () => [] }),
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }),
  }, (error) => refused.push(error));
  const input = { hasWsSocket: false, sibling: true, siblingGate: { mayFederate: () => true },
    peerClass: undefined, selfSlotFedGate: null, antigenRing: NO_BANS, shadow: NOBODY_ASIDE,
    protectedDocs: NOTHING_CLASSED, membership: null, planeSeal: null,
    peerId: "sibling", documentId: "doc" as never, tiers };
  expect(await selfSlotShareDecision(input)).toBe(false);
  expect(refused.at(-1)).toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
  tier = "personagroup";
  expect(await selfSlotShareDecision(input)).toBe(true);
});
