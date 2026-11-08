import { expect, test } from "vitest";
import { makeManifestTierSource, makeShareBoundary, makeTierFloorSource, peerShareAudience } from "../src/index.js";

const quiet = { sibling: false, relay: false, gateArmed: false, grantAdmits: false, houseIsland: false };

test("P27 audience: a browser peer proves its audience positively; an unclassified peer and a null-gate relay prove nothing", () => {
  expect(peerShareAudience(quiet), "an unclassified peer").toBeUndefined();
  expect(peerShareAudience({ ...quiet, relay: true }), "a relay with no gate armed").toBeUndefined();
  expect(peerShareAudience({ ...quiet, sibling: true, relay: true }), "one id on two carriers").toBeUndefined();
  // CONTROLS: each positive proof answers its audience.
  expect(peerShareAudience({ ...quiet, houseIsland: true })).toBe("in-process");
  expect(peerShareAudience({ ...quiet, sibling: true })).toBe("fleet");
  expect(peerShareAudience({ ...quiet, relay: true, gateArmed: true })).toBe("world");
  expect(peerShareAudience({ ...quiet, relay: true, gateArmed: true, grantAdmits: true })).toBe("fleet");
  // The unproven audience refuses by name at the one predicate, even for a public doc.
  const refused: Error[] = [];
  const tiers = makeShareBoundary({ declared: { declaredTierForDoc: () => "public" },
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }) }, (e) => refused.push(e));
  expect(tiers.allows(true, "public-doc", peerShareAudience(quiet), true)).toBe(false);
  expect(refused.at(-1)).toMatchObject({ reason: "declared-tier-audience-unresolved" });
});

test("P27 declared tier: a present null refinement parses VEIL; only undefined reads absent", () => {
  let raw: unknown[] = [undefined];
  const source = makeManifestTierSource({ bagOfDoc: () => ({ kind: "bag", bag: "b" }),
    manifestOf: () => ({ bag: "b", tier: "public", home: "hearth" }), tiddlerTiersOf: () => raw });
  expect(source.declaredTierForDoc("d"), "CONTROL: an absent refinement adds nothing").toBe("public");
  raw = [null];
  expect(source.declaredTierForDoc("d")).toBe("veil");
});

test("P27 declared tier: a plane bound as no bag answers the tier it declares", () => {
  const source = makeManifestTierSource({ bagOfDoc: () => ({ kind: "non-bag", tier: "contract" }),
    manifestOf: () => null, tiddlerTiersOf: () => null });
  expect(source.declaredTierForDoc("hosting")).toBe("contract");
});
