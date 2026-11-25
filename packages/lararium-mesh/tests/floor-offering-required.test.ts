/**
 * A release may change the plugins a floor offers, never drop what every mount needs to boot. The required ids derive from the
 * classes the bake declares required (the memetic-wikitext parser, the base seed), read off the vessel's own island blob rows,
 * and `resolveFloorWhole` refuses `floor-offering-incomplete`, naming each missing id, so accept and the release door both
 * meet it.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync } from "../src/crypto.js";
import { cutFloorSnapshot, floorManifestBytes, floorManifestCid, type FloorManifest } from "../src/floor-manifest.js";
import { floorRequiredBlobIds, resolveFloorWhole, signFloorOffering } from "../src/floor-offering.js";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import { ENGINE_CORE_ID } from "../src/base-doc.js";

const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
const bytesOf = (s: string) => new TextEncoder().encode(`blob-${s}`);
const BASE_ID = "lararium-boot-shadows";

async function floorOffering(ids: Array<[string, string]>) {
  const signed = await signFloorOffering({ seed: new Uint8Array(32).fill(5), blobs: ids.map(([id, s]) => ({ id, version: "unknown", sha256: sha256HexBytesSync(bytesOf(s)), provenance })) });
  const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares" } } }), lararium = cutFloorSnapshot({});
  const manifest: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: signed.cid, snapshots: { lares: lares.cid, lararium: lararium.cid } };
  const cas = new Map<string, Uint8Array>([[floorManifestCid(manifest), floorManifestBytes(manifest)], [lares.cid, lares.bytes], [lararium.cid, lararium.bytes], [signed.cid, signed.bytes]]);
  for (const [, s] of ids) cas.set(sha256HexBytesSync(bytesOf(s)), bytesOf(s));
  return { cid: floorManifestCid(manifest), fetch: async (c: string) => cas.get(c) ?? null };
}

describe("the blobs every mount needs", () => {
  test("the required ids derive from the island's declared classes, the parser always among them", () => {
    const island = {
      [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, kind: undefined },
      [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, kind: "grammar" },
      [BASE_ID]: { id: BASE_ID, kind: "base" },
      "$:/themes/tiddlywiki/vanilla": { id: "$:/themes/tiddlywiki/vanilla", kind: "stock" },
      "lar:///x/plugin": { id: "lar:///x/plugin", kind: "plugin" },
      "floor-manifest": { id: "floor-manifest", kind: "floor" },
    };
    expect(floorRequiredBlobIds(island)).toEqual([LARES_MEMETIC_WIKITEXT_PLUGIN_URI, BASE_ID].sort());
    expect(floorRequiredBlobIds(undefined)).toEqual([LARES_MEMETIC_WIKITEXT_PLUGIN_URI]);
  });

  test("an island declaring the house skin requires it beside the parser and the base seed", () => {
    const island = {
      [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, kind: "grammar" },
      [LARES_LARARIUM_PLUGIN_URI]: { id: LARES_LARARIUM_PLUGIN_URI, kind: "lararium" },
      [BASE_ID]: { id: BASE_ID, kind: "base" },
    };
    expect(floorRequiredBlobIds(island)).toEqual([LARES_MEMETIC_WIKITEXT_PLUGIN_URI, LARES_LARARIUM_PLUGIN_URI, BASE_ID].sort());
  });

  test("an offering that drops a required id refuses floor-offering-incomplete, naming it; one that keeps them resolves (CONTROL)", async () => {
    const required = [LARES_MEMETIC_WIKITEXT_PLUGIN_URI, BASE_ID];
    const partial = await floorOffering([[LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "g"], ["lar:///x/plugin", "p"]]);
    expect(await resolveFloorWhole(partial.cid, partial.fetch, { required }))
      .toMatchObject({ refusal: "floor-offering-incomplete", reason: expect.stringContaining(BASE_ID) });
    const whole = await floorOffering([[LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "g"], [BASE_ID, "b"], ["lar:///x/other", "o"]]);
    expect(await resolveFloorWhole(whole.cid, whole.fetch, { required })).toHaveProperty("offering");
  });
});

import { floorSkinCids } from "../src/floor-offering.js";
import { LARES_LARARIUM_PLUGIN_URI as HOUSE_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI as GRAMMAR_URI } from "../src/lar-uris.js";
describe("floorSkinCids ~ the CIDs the attested island names for the house skins", () => {
  test("reads each skin's sha256 off the island's own blob rows, never off a hand-kept list; another row names no skin", () => {
    const blobs = { a: { id: GRAMMAR_URI, sha256: "a".repeat(64) }, b: { id: HOUSE_URI, sha256: "b".repeat(64) }, c: { id: "$:/plugins/x/person", sha256: "c".repeat(64) } };
    expect(floorSkinCids(blobs)).toEqual({ [GRAMMAR_URI]: "a".repeat(64), [HOUSE_URI]: "b".repeat(64) });
    expect(floorSkinCids(undefined)).toEqual({});
    expect(floorSkinCids({ a: { id: GRAMMAR_URI } })).toEqual({});
  });
});
