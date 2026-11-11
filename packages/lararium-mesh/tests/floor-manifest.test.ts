import { describe, expect, test } from "vitest";
import { getAllChanges, load } from "@automerge/automerge";
import { sha256HexBytesSync } from "../src/crypto.js";
import {
  cutFloorSnapshot, openFloorSnapshot, floorManifestBytes, floorManifestCid,
  readFloorManifest, resolveFloor, type FloorManifest,
} from "../src/floor-manifest.js";

const rows = {
  "lar:///ha.ka.ba/lares/api/probe": { tiddler: { title: "lar:///ha.ka.ba/lares/api/probe", text: "probe" } },
  "lar:///ha.ka.ba/lares/api/second": { tiddler: { title: "lar:///ha.ka.ba/lares/api/second", text: "second" } },
};
const manifest: FloorManifest = { format: "lararium-floor/v2", engine: "engine", grammar: "grammar", plugins: "plugins", snapshots: { lararium: "b".repeat(64), lares: "a".repeat(64), sdm: "c".repeat(64) } };

describe("floor manifest and snapshots", () => {
  test("cuts canonical history-free snapshots and refuses a key/title split", () => {
    const a = cutFloorSnapshot(rows), b = cutFloorSnapshot(Object.fromEntries(Object.entries(rows).reverse()));
    expect(a.bytes).toEqual(b.bytes); expect(a.cid).toBe(b.cid); expect(getAllChanges(load(a.bytes))).toHaveLength(1);
    expect(() => cutFloorSnapshot({ wrong: rows["lar:///ha.ka.ba/lares/api/probe"]! })).toThrow();
  });
  test("opens, checks the CID before parsing, and never throws on malformed bytes", () => {
    const cut = cutFloorSnapshot(rows);
    expect(openFloorSnapshot(cut.bytes, cut.cid)).toEqual({ rows });
    const flipped = cut.bytes.slice(); flipped[0] ^= 1;
    expect(openFloorSnapshot(flipped, cut.cid)).toMatchObject({ refusal: "floor-snapshot-cid-mismatch" });
    // Garbage under its OWN cid passes the rehash and fails the load: malformed, never a mismatch.
    const garbage = new Uint8Array([1, 2, 3]);
    expect(openFloorSnapshot(garbage, sha256HexBytesSync(garbage))).toMatchObject({ refusal: "floor-snapshot-malformed" });
    expect(openFloorSnapshot(garbage, "0".repeat(64))).toMatchObject({ refusal: "floor-snapshot-cid-mismatch" });
  });
  test("round-trips canonical manifest bytes and names each refusal", () => {
    const bytes = floorManifestBytes(manifest);
    expect(readFloorManifest(bytes)).toEqual({ manifest }); expect(floorManifestCid(manifest)).toMatch(/^[0-9a-f]{64}$/);
    const cases = [
      ['{"format":"unknown"}', "floor-manifest-format"],
      ['{"format":"lararium-floor/v2"}', "floor-manifest-malformed"],
      // A house canon without the system canon reads malformed: lares and lararium stand in every floor.
      [JSON.stringify({ ...manifest, snapshots: { sdm: "c".repeat(64) } }), "floor-manifest-malformed"],
      // Unsorted slugs differ from the canonical bytes.
      [JSON.stringify({ ...manifest, snapshots: { sdm: "c".repeat(64), lares: "a".repeat(64), lararium: "b".repeat(64) } }), "floor-manifest-malformed"],
      // A slug that spells no bag.
      [JSON.stringify({ ...manifest, snapshots: { ...manifest.snapshots, "../x": "d".repeat(64) } }), "floor-manifest-malformed"],
      [JSON.stringify({ ...manifest, extra: "x" }), "floor-manifest-malformed"],
      [new TextDecoder().decode(bytes).replaceAll(",", ", "), "floor-manifest-malformed"],
      [JSON.stringify(Object.fromEntries(Object.entries(manifest).reverse())), "floor-manifest-malformed"],
      // A control character the encoder would refuse, spelled by hand in the canonical order.
      [new TextDecoder().decode(bytes).replace('"engine":"engine"', '"engine":"bad\\u0001value"'), "floor-manifest-malformed"],
    ] as const;
    expect(() => floorManifestBytes({ ...manifest, engine: "bad\u0001value" })).toThrow();
    for (const [text, refusal] of cases) expect(readFloorManifest(new TextEncoder().encode(text))).toMatchObject({ refusal });
  });
  test("V1 RETIRED — the v1 shape (lares and lararium keyed alone) refuses by name, with no back-compat", () => {
    const v1 = JSON.stringify({ format: "lararium-floor/v1", engine: "engine", grammar: "grammar", plugins: "plugins", lares: "a".repeat(64), lararium: "b".repeat(64) });
    const read = readFloorManifest(new TextEncoder().encode(v1));
    expect(read).toMatchObject({ refusal: "floor-manifest-format" });
    expect("reason" in read && read.reason).toMatch(/lararium-floor\/v1 stands retired/);
    expect(() => floorManifestBytes({ ...manifest, format: "lararium-floor/v1" } as unknown as FloorManifest)).toThrow(/lararium-floor\/v2 alone/);
  });
  test("resolves manifest and snapshots by CID, naming absent and corrupt content", async () => {
    const sdmRows = { "lar:///ha.ka.ba/sdm/probe": { tiddler: { title: "lar:///ha.ka.ba/sdm/probe", text: "sdm" } } };
    const lares = cutFloorSnapshot(rows), lararium = cutFloorSnapshot({}), sdm = cutFloorSnapshot(sdmRows);
    const m: FloorManifest = { ...manifest, snapshots: { lares: lares.cid, lararium: lararium.cid, sdm: sdm.cid } };
    const bytes = floorManifestBytes(m);
    const cid = floorManifestCid(m);
    const map = new Map([[cid, bytes], [lares.cid, lares.bytes], [lararium.cid, lararium.bytes], [sdm.cid, sdm.bytes]]);
    // One snapshot per house-canon slug: sdm reads beside the system canon.
    expect(await resolveFloor(cid, async (key) => map.get(key) ?? null)).toMatchObject({ snapshots: { lares: rows, lararium: {}, sdm: sdmRows } });
    const sdmBytes = map.get(sdm.cid)!; map.delete(sdm.cid);
    expect(await resolveFloor(cid, async (key) => map.get(key) ?? null)).toMatchObject({ refusal: "floor-absent", reason: expect.stringContaining("sdm") });
    map.set(sdm.cid, sdmBytes);
    expect(await resolveFloor(cid, async () => null)).toMatchObject({ refusal: "floor-absent" });
    expect(await resolveFloor(cid, async (key) => key === cid ? bytes : null)).toMatchObject({ refusal: "floor-absent" });
    map.set(lares.cid, Uint8Array.of(9));
    expect(await resolveFloor(cid, async (key) => map.get(key) ?? null)).toMatchObject({ refusal: "floor-snapshot-cid-mismatch" });
  });
});
