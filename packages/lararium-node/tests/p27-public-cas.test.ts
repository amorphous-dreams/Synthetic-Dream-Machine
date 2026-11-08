import { expect, test } from "vitest";
import { makeShareBoundary, makeManifestTierSource, makeTierFloorSource, type CapTier } from "@lararium/mesh";
import { publicCasShore } from "../src/bulb-read-face.js";

// Exercises the HTTP face's authorization shore without binding a listener.
test("P27 public CAS: a PUBLIC registration cannot loosen the held manifest; public control serves", async () => {
  let tier: CapTier = "veil";
  let secret = false;
  const refused: Error[] = [];
  const tiers = makeShareBoundary({
    declared: makeManifestTierSource({ bagOfDoc: () => ({ kind: "bag", bag: "work" }),
      manifestOf: () => ({ bag: "work", tier, home: "hearth" }), tiddlerTiersOf: () => [] }),
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => secret }),
  }, (error) => refused.push(error));
  const entry = { title: "pointer", bagId: "work", documentId: "doc", record: { tiddler: { textCid: "cid" } } };
  const shore = publicCasShore({ casDir: "unused-no-byte-read", references: () => [entry],
    bagTier: () => "public", tiers, documentForBag: () => "doc", documentsForCid: () => ["doc"],
    realmReferences: () => [{ bagUri: "work", readTier: "public", entries: [entry] }],
    releasedFloor: () => new Set(["cid"]), releasedDocument: () => "doc" });
  expect(await shore.isPublic("cid")).toBe(false);
  expect(refused.at(-1)).toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
  tier = "public";
  expect(await shore.isPublic("cid")).toBe(true);
  secret = true;
  expect(await shore.isPublic("cid")).toBe(false);
});
