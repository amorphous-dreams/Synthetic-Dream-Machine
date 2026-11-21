/**
 * The genesis bake writes the floor's plugins offering: one PluginOffering over every non-core blob the mount loads (the boot
 * set), signed by a hand the actor seed derives so one tree bakes one offering, its record riding the seed's blob rows and the
 * CAS under a mime outside the boot set. A floor whose offering differs from the boot set, or whose manifest names another
 * record, refuses the bake by name.
 */
import { describe, expect, it } from "vitest";
import { buildGenesisDoc, verifyGenesisArtifact, type GenesisInputs, type GenesisPluginEntry } from "../src/genesis-doc.js";
import { cutFloorSnapshot, floorManifestCid, type FloorManifest } from "../src/floor-manifest.js";
import { FLOOR_OFFERING_BLOB_ID, FLOOR_OFFERING_MIME, genesisFloorOffering, signFloorOffering, verifyFloorOfferingSet } from "../src/floor-offering.js";
import { verifyPluginOffering } from "../src/plugin-offering.js";
import { bootSetPluginCids } from "../src/cas.js";
import { sha256HexBytesSync } from "../src/crypto.js";

const entry = (id: string, kind: NonNullable<GenesisPluginEntry["kind"]>, text: string): GenesisPluginEntry => {
  const blob = new TextEncoder().encode(text);
  return { id, version: "unknown", sha256: sha256HexBytesSync(blob), mimeType: "application/json", blob, license: "MIT", kind };
};
const PLUGINS: GenesisPluginEntry[] = [
  entry("lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext", "grammar", "grammar"),
  entry("lararium-boot-shadows", "base", "base"),
  entry("$:/themes/tiddlywiki/vanilla", "stock", "stock"),
];
const provenanceOf = (p: GenesisPluginEntry) => ({ source: "https://example.test", commit: "0".repeat(40), path: `${p.id}.json`, licence: p.license ?? "MIT" });
const ACTOR = "11".repeat(32);

async function bake(plugins = PLUGINS, offeringPlugins = PLUGINS) {
  const coreBlob = new TextEncoder().encode("core");
  const inputs: GenesisInputs = { actorSeed: ACTOR, coreBlob, coreVersion: "1", plugins };
  const baseline = buildGenesisDoc(inputs);
  const offering = await genesisFloorOffering({ actorSeed: ACTOR, plugins: offeringPlugins, provenanceOf });
  const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares" } } }), lararium = cutFloorSnapshot({});
  const manifest: FloorManifest = { format: "lararium-floor", engine: baseline.engineCid, plugins: offering.cid, snapshots: { lares: lares.cid, lararium: lararium.cid } };
  return { inputs, offering, manifest, floor: { manifest, snapshots: { lares, lararium }, offering: { bytes: offering.bytes, cid: offering.cid } } };
}

describe("the genesis floor's plugins offering", () => {
  it("offers every non-core blob the mount loads, from a hand the actor seed derives, one tree one offering", async () => {
    const a = await genesisFloorOffering({ actorSeed: ACTOR, plugins: PLUGINS, provenanceOf });
    const b = await genesisFloorOffering({ actorSeed: ACTOR, plugins: [...PLUGINS].reverse(), provenanceOf });
    expect(a.cid).toBe(b.cid);
    expect(await verifyPluginOffering(a.offering)).toEqual({ ok: true });
    expect(a.offering.blobs.map((x) => x.id).sort()).toEqual(PLUGINS.map((p) => p.id).sort());
    expect(verifyFloorOfferingSet(a.offering, PLUGINS)).toBeNull();
    expect(verifyFloorOfferingSet(a.offering, PLUGINS.slice(1))).toMatch(/memetic-wikitext/);
  });

  it("rides the offering record in the seed's blob rows and the CAS, outside the boot set", async () => {
    const { inputs, floor, offering, manifest } = await bake();
    const art = buildGenesisDoc({ ...inputs, floor });
    expect(() => verifyGenesisArtifact(art)).not.toThrow();
    expect(art.seed.blobs[FLOOR_OFFERING_BLOB_ID]).toMatchObject({ sha256: offering.cid, mimeType: FLOOR_OFFERING_MIME, kind: "floor" });
    expect(art.casEntries.map((e) => e.cid)).toEqual(expect.arrayContaining([offering.cid, floorManifestCid(manifest)]));
    expect(bootSetPluginCids(art.seed.blobs)).not.toContain(offering.cid);
    expect([...bootSetPluginCids(art.seed.blobs)].sort()).toEqual(PLUGINS.map((p) => p.sha256).sort());
  });

  it("refuses a floor whose offering differs from the boot set, or whose manifest names another record", async () => {
    const short = await bake(PLUGINS, PLUGINS.slice(0, 2));
    expect(() => buildGenesisDoc({ ...short.inputs, floor: short.floor })).toThrow(/floor plugins offering/);
    const { inputs, floor } = await bake();
    const other = await signFloorOffering({ seed: new Uint8Array(32).fill(9), blobs: floor.manifest ? (await genesisFloorOffering({ actorSeed: ACTOR, plugins: PLUGINS, provenanceOf })).offering.blobs : [] });
    expect(() => buildGenesisDoc({ ...inputs, floor: { ...floor, offering: { bytes: other.bytes, cid: other.cid } } })).toThrow(/floor plugins offering/);
    expect(() => buildGenesisDoc({ ...inputs, floor: { manifest: floor.manifest, snapshots: floor.snapshots } as never })).toThrow(/floor plugins offering/);
  });
});
