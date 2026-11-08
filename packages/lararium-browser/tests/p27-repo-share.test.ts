import { expect, test } from "vitest";
import { makeShareBoundary, makeManifestTierSource, makeTierFloorSource, type CapTier } from "@lararium/mesh";
import { browserShareConfig } from "../src/open-browser-vessel.js";

// lead runs: the browser package config launches Chromium; this seat never launches it.
test("P27 browser repo: both hooks refuse VEIL for a sibling; PERSONAGROUP still crosses", async () => {
  let tier: CapTier = "veil";
  const refused: Error[] = [];
  const tiers = makeShareBoundary({
    declared: makeManifestTierSource({ bagOfDoc: () => ({ kind: "bag", bag: "work" }),
      manifestOf: () => ({ bag: "work", tier, home: "hearth" }), tiddlerTiersOf: () => [] }),
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }),
  }, (error) => refused.push(error));
  const cfg = browserShareConfig(new Set(), () => null, {
    isSibling: () => true, gate: () => ({ mayFederate: () => true }),
  }, tiers);
  expect(await cfg.access("sibling" as never, "doc" as never)).toBe(false);
  expect(await cfg.announce("sibling" as never, "doc" as never)).toBe(false);
  expect(refused.at(-1)).toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
  tier = "personagroup";
  expect(await cfg.access("sibling" as never, "doc" as never)).toBe(true);
  expect(await cfg.announce("sibling" as never, "doc" as never)).toBe(true);
});
