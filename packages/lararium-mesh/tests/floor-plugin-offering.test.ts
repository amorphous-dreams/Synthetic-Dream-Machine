/**
 * The floor names its plugins as ONE signed PluginOffering: `plugins` holds the CAS address of the offering record, and the
 * offering carries every non-core blob a mount loads (the memetic-wikitext parser, the base seed, the stock themes, an
 * operator's own). `grammar` retires from the floor; `engine` stays the folded digest it was, and a cut whose engine differs
 * from genesis refuses `floor-engine-unoffered`. A release's bytes travel with it: resolving the floor whole reads the
 * offering, verifies it as a taker does, and re-hashes each blob it names.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync } from "../src/crypto.js";
import {
  cutCanonFloor, cutFloorSnapshot, floorBlobCids, floorManifestBytes, floorManifestCid, readFloorManifest, resolveFloor,
  type FloorManifest,
} from "../src/floor-manifest.js";
import {
  FLOOR_OFFERING_MIME, floorOfferingBlobsOf, floorOfferingRecordCid, readFloorOffering, resolveFloorWhole, signFloorOffering,
} from "../src/floor-offering.js";
import { pluginOfferingRecordBytes, type OfferedBlob } from "../src/plugin-offering.js";
import { bootSetPluginCids } from "../src/cas.js";
import { ENGINE_CORE_ID } from "../src/base-doc.js";

const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const SEED = new Uint8Array(32).fill(7);
const provenance = { source: "https://example.test/plugins", commit: "0".repeat(40), path: "plugins/x.json", licence: "MIT" };
const bytesOf = (s: string) => new TextEncoder().encode(`blob-${s}`);
const offered = (id: string, s: string): OfferedBlob => ({ id, version: "5.3.0", sha256: sha256HexBytesSync(bytesOf(s)), provenance });

const BLOBS: OfferedBlob[] = [
  offered("lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext", "grammar"),
  offered("lar:///ha.ka.ba/lararium/boot-shadows", "base"),
  offered("$:/themes/tiddlywiki/vanilla", "stock"),
];

async function fixture() {
  const signed = await signFloorOffering({ blobs: BLOBS, seed: SEED });
  const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "l" } } });
  const lararium = cutFloorSnapshot({});
  const manifest: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: signed.cid, snapshots: { lares: lares.cid, lararium: lararium.cid } };
  const manifestCid = floorManifestCid(manifest);
  const cas = new Map<string, Uint8Array>([[manifestCid, floorManifestBytes(manifest)], [lares.cid, lares.bytes], [lararium.cid, lararium.bytes], [signed.cid, signed.bytes]]);
  for (const s of ["grammar", "base", "stock"]) cas.set(sha256HexBytesSync(bytesOf(s)), bytesOf(s));
  return { signed, manifest, manifestCid, cas, lares, lararium };
}

describe("the floor's plugin offering", () => {
  test("the manifest names format, engine, plugins and snapshots, plugins the offering record's CAS address", async () => {
    const { signed, manifest } = await fixture();
    expect(signed.cid).toBe(sha256HexBytesSync(pluginOfferingRecordBytes(signed.offering)));
    expect(floorOfferingRecordCid(signed.offering)).toBe(signed.cid);
    const bytes = floorManifestBytes(manifest);
    expect(Object.keys(JSON.parse(new TextDecoder().decode(bytes)))).toEqual(["format", "engine", "plugins", "snapshots"]);
    expect(readFloorManifest(bytes)).toEqual({ manifest });
  });

  test("a manifest that names a grammar field refuses by name; plugins must name a CAS address", async () => {
    const { manifest } = await fixture();
    const old = readFloorManifest(enc({ format: "lararium-floor", engine: manifest.engine, grammar: "a".repeat(64), plugins: manifest.plugins, snapshots: manifest.snapshots }));
    expect(old).toMatchObject({ refusal: "floor-manifest-malformed", reason: expect.stringMatching(/grammar/) });
    expect(readFloorManifest(enc({ ...manifest, plugins: "plugins" }))).toMatchObject({ refusal: "floor-manifest-malformed" });
    expect(() => floorManifestBytes({ ...manifest, plugins: `sha256:${manifest.plugins}` })).toThrow(/plugins/);
  });

  test("the offering record reads back by its CID and refuses bytes that differ or do not encode canonically", async () => {
    const { signed } = await fixture();
    expect(readFloorOffering(signed.bytes, signed.cid)).toEqual({ offering: signed.offering });
    const spaced = new TextEncoder().encode(new TextDecoder().decode(signed.bytes).replace(",", ", "));
    expect(readFloorOffering(spaced, sha256HexBytesSync(spaced))).toMatchObject({ refusal: "floor-offering-refused" });
    expect(readFloorOffering(signed.bytes, "0".repeat(64))).toMatchObject({ refusal: "floor-offering-refused" });
  });

  test("floorBlobCids names the manifest, each snapshot and the offering record, and with the offering each blob it carries", async () => {
    const { signed, manifest, manifestCid, lares, lararium } = await fixture();
    expect(floorBlobCids(manifestCid, manifest)).toEqual([manifestCid, lararium.cid, lares.cid, signed.cid]);
    expect(floorBlobCids(manifestCid, manifest, signed.offering)).toEqual([
      manifestCid, lararium.cid, lares.cid, signed.cid, ...floorOfferingBlobsOf(signed.offering).map((b) => b.sha256),
    ]);
    expect(floorOfferingBlobsOf(signed.offering).map((b) => b.id)).toEqual([...BLOBS.map((b) => b.id)].sort());
  });

  test("resolving whole reads the offering, verifies it, and re-hashes each blob, naming what is absent or refused", async () => {
    const { signed, manifestCid, cas } = await fixture();
    const fetch = async (cid: string) => cas.get(cid) ?? null;
    expect(await resolveFloorWhole(manifestCid, fetch, { required: [] })).toMatchObject({ offering: signed.offering });
    // The mount's snapshot read stays as it stood: it reads no offering.
    const asked: string[] = [];
    await resolveFloor(manifestCid, async (cid) => { asked.push(cid); return cas.get(cid) ?? null; });
    expect(asked).not.toContain(signed.cid);

    const stock = sha256HexBytesSync(bytesOf("stock"));
    cas.delete(stock);
    expect(await resolveFloorWhole(manifestCid, fetch, { required: [] })).toMatchObject({ refusal: "floor-absent", reason: expect.stringContaining("vanilla") });
    cas.set(stock, Uint8Array.of(1));
    expect(await resolveFloorWhole(manifestCid, fetch, { required: [] })).toMatchObject({ refusal: "floor-absent", reason: expect.stringContaining("vanilla") });
    cas.set(stock, bytesOf("stock"));

    cas.delete(signed.cid);
    expect(await resolveFloorWhole(manifestCid, fetch, { required: [] })).toMatchObject({ refusal: "floor-absent", reason: expect.stringContaining("offering") });

    // A forged signature under its own CID: the record reads, the taker's verify refuses it by its code.
    const forged = { ...signed.offering, sig: "0".repeat(128) };
    const forgedBytes = pluginOfferingRecordBytes(forged);
    const forgedCid = sha256HexBytesSync(forgedBytes);
    const m2: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), plugins: forgedCid, snapshots: (await fixture()).manifest.snapshots };
    const f2 = await fixture();
    f2.cas.set(forgedCid, forgedBytes); f2.cas.set(floorManifestCid(m2), floorManifestBytes(m2));
    expect(await resolveFloorWhole(floorManifestCid(m2), async (cid) => f2.cas.get(cid) ?? null, { required: [] }))
      .toMatchObject({ refusal: "floor-offering-refused", reason: expect.stringContaining("bad-signature") });
  });

  test("a cut carries the prior offering and engine forward, and refuses floor-engine-unoffered where the engine differs from genesis", async () => {
    const { manifest } = await fixture();
    const rows = { "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "moved" } } };
    const cut = cutCanonFloor({ prior: manifest, canon: { lares: rows }, genesisEngine: manifest.engine });
    expect(cut.manifest.plugins).toBe(manifest.plugins);
    expect(cut.manifest.engine).toBe(manifest.engine);
    expect(() => cutCanonFloor({ prior: manifest, canon: { lares: rows }, genesisEngine: "f".repeat(64) }))
      .toThrow(expect.objectContaining({ code: "floor-engine-unoffered" }));
  });

  test("the offering record rides a mime outside the boot set, so it never loads as a plugin", () => {
    expect(FLOOR_OFFERING_MIME).not.toBe("application/json");
    expect(bootSetPluginCids({
      [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, sha256: "c".repeat(64), mimeType: "application/javascript" },
      "floor-plugin-offering": { id: "floor-plugin-offering", sha256: "d".repeat(64), mimeType: FLOOR_OFFERING_MIME },
    } as never)).toEqual([]);
  });
});
