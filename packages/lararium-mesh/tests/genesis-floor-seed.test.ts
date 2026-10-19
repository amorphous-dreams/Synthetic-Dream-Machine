import { describe, expect, it } from "vitest";
import { buildGenesisDoc, computeEngineCid, computeGrammarCid, computePluginsCid, verifyGenesisArtifact, type GenesisInputs } from "../src/genesis-doc.js";
import { floorManifestBytes, floorManifestCid, GENESIS_FLOOR_TIDDLER, cutFloorSnapshot } from "../src/floor-manifest.js";
import { bootSetPluginCids } from "../src/cas.js";
import { GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER, genesisCasManifestFromSeed } from "../src/genesis-doc.js";

describe("genesis floor seed", () => {
  it("carries the floor in CAS without moving region folds or boot plugin membership", () => {
    const coreBlob = new TextEncoder().encode("core");
    const inputs: GenesisInputs = { actorSeed: "11".repeat(32), coreBlob, coreVersion: "1", plugins: [] };
    const empty = cutFloorSnapshot({});
    const lares = cutFloorSnapshot({ "lar:///lares/a": { tiddler: { title: "lar:///lares/a" } } });
    const baseline = buildGenesisDoc(inputs);
    const manifest = { format: "lararium-floor/v1" as const, engine: baseline.engineCid, grammar: computeGrammarCid([]), plugins: computePluginsCid([]), lares: lares.cid, lararium: empty.cid };
    const floor = { manifest, lares, lararium: empty };
    const without = baseline;
    const withFloor = buildGenesisDoc({ ...inputs, floor });
    expect([withFloor.engineCid, withFloor.grammarCid, withFloor.pluginsCid]).toEqual([without.engineCid, without.grammarCid, without.pluginsCid]);
    expect(() => verifyGenesisArtifact(withFloor)).not.toThrow();
    expect(withFloor.seed.blobs).toMatchObject({ "floor-manifest": { kind: "floor", mimeType: "application/vnd.lararium.floor-manifest+json" }, "floor-lares": { kind: "floor", mimeType: "application/vnd.lararium.floor-snapshot" }, "floor-lararium": { kind: "floor", mimeType: "application/vnd.lararium.floor-snapshot" } });
    expect((withFloor.seed.tiddlers[GENESIS_FLOOR_TIDDLER] as any).tiddler).toMatchObject({ title: GENESIS_FLOOR_TIDDLER, text: "", cid: floorManifestCid(manifest) });
    // The seed carries metadata alone: a floor row's bytes ride the CAS plane, never seed.json.
    for (const id of ["floor-manifest", "floor-lares", "floor-lararium"]) expect(withFloor.seed.blobs[id]).not.toHaveProperty("blob");
    expect(bootSetPluginCids(withFloor.seed.blobs)).not.toContain(floorManifestCid(manifest));
    expect(genesisCasManifestFromSeed(withFloor.seed).blobs.map(x => x.id)).toEqual(expect.arrayContaining(["floor-manifest", "floor-lares", "floor-lararium"]));
    expect(withFloor.casEntries.map(x => x.cid)).toEqual(expect.arrayContaining([floorManifestCid(manifest), lares.cid, empty.cid]));
    expect(floorManifestBytes(manifest)).toBeInstanceOf(Uint8Array);
    for (const title of [GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER]) expect(withFloor.seed.tiddlers[title]).toEqual(without.seed.tiddlers[title]);
    expect(() => buildGenesisDoc({ ...inputs, floor: { ...floor, manifest: { ...manifest, engine: "bad" } } })).toThrow(/floor engine CID mismatch/);
  });
});
