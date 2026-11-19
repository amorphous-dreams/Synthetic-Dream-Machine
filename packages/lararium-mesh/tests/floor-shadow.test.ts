/**
 * The floor shadow read (backlog-awakens 3a): the pinned floor's engine field reads beside the fold recomputed from the founding
 * record's core blob, and its plugins offering (read at `manifest.plugins`) beside the founding record's own boot set. The floor
 * names no grammar: the parser rides the offering. It only reads: a mismatch names the field, absent bytes read `unread` by
 * name, and nothing throws.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync } from "../src/crypto.js";
import { FLOOR_MANIFEST_FORMAT, floorManifestBytes } from "../src/floor-manifest.js";
import { computeEngineCid } from "../src/genesis-doc.js";
import { signFloorOffering } from "../src/floor-offering.js";
import { ENGINE_CORE_ID, type LarBlobEntry } from "../src/base-doc.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import { floorShadowLine, foldFloorShadowTally, readFloorShadow, readFloorShadowTally } from "../src/floor-shadow.js";

const CORE_SHA = "c".repeat(64);
const blobs: Record<string, LarBlobEntry> = {
  [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, version: "5.4.0", sha256: CORE_SHA, mimeType: "application/javascript" },
  grammar: { id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "1", sha256: "1".repeat(64), mimeType: "application/json", kind: "grammar" },
  extra: { id: "$:/plugins/operator/extra", version: "1", sha256: "2".repeat(64), mimeType: "application/json", kind: "plugin" },
};
const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
const offer = (rows: readonly LarBlobEntry[]) => signFloorOffering({ seed: new Uint8Array(32).fill(6), blobs: rows.map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, provenance })) });
/** The offering over the founding record's whole boot set, and one that drops the operator's extra plugin. */
const WHOLE = await offer([blobs["grammar"]!, blobs["extra"]!]);
const SHORT = await offer([blobs["grammar"]!]);
const truth = { engine: computeEngineCid(CORE_SHA), plugins: WHOLE.cid };

function manifest(fields: Partial<typeof truth> = {}): { cid: string; bytes: Uint8Array } {
  const bytes = floorManifestBytes({ format: FLOOR_MANIFEST_FORMAT, ...truth, ...fields, snapshots: { lares: "a".repeat(64), lararium: "b".repeat(64) } });
  return { cid: sha256HexBytesSync(bytes), bytes };
}
const OFFERINGS = [{ cid: WHOLE.cid, bytes: WHOLE.bytes }, { cid: SHORT.cid, bytes: SHORT.bytes }];
const store = (...ms: Array<{ cid: string; bytes: Uint8Array }>) => async (cid: string) => [...ms, ...OFFERINGS].find((m) => m.cid === cid)?.bytes ?? null;

describe("readFloorShadow reads the floor beside the founding record", () => {
  test("a floor whose engine field differs names engine moved; CONTROL: an agreeing floor reads clean", async () => {
    const moved = manifest({ engine: computeEngineCid("d".repeat(64)) });
    const same = manifest();
    const r = await readFloorShadow({ manifestCid: moved.cid, readBytes: store(moved, same), islandBlobs: blobs, coreSha256: CORE_SHA });
    expect(r.verdict).toBe("mismatch");
    if (r.verdict === "mismatch") expect(r.moved.map((m) => m.field)).toEqual(["engine"]);
    expect(await readFloorShadow({ manifestCid: same.cid, readBytes: store(moved, same), islandBlobs: blobs, coreSha256: CORE_SHA }))
      .toEqual({ verdict: "clean", manifest: same.cid });
  });

  test("absent manifest bytes read unread by name, never a mismatch and never a throw", async () => {
    const m = manifest();
    const r = await readFloorShadow({ manifestCid: m.cid, readBytes: async () => null, islandBlobs: blobs, coreSha256: CORE_SHA });
    expect(r.verdict).toBe("unread");
    if (r.verdict === "unread") expect(r.why).toContain("absent");
    const thrown = await readFloorShadow({ manifestCid: m.cid, readBytes: async () => { throw new Error("disk"); }, islandBlobs: blobs, coreSha256: CORE_SHA });
    expect(thrown.verdict).toBe("unread");
  });

  test("bytes that differ from their CID, no manifest named, or no blobs read unread", async () => {
    const m = manifest();
    const other = manifest({ plugins: SHORT.cid });
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: async () => other.bytes, islandBlobs: blobs, coreSha256: CORE_SHA })).verdict).toBe("unread");
    expect((await readFloorShadow({ manifestCid: null, readBytes: store(m), islandBlobs: blobs, coreSha256: CORE_SHA })).verdict).toBe("unread");
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: store(m), islandBlobs: undefined, coreSha256: CORE_SHA })).verdict).toBe("unread");
  });

  test("the core hash falls back to the founding record's own core blob", async () => {
    const m = manifest();
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: store(m), islandBlobs: blobs, coreSha256: null })).verdict).toBe("clean");
  });
});

describe("the floor's plugins offering beside the founding record's boot set", () => {
  test("an offering that drops a blob the founding record boots on names plugins moved, naming the blob; the whole set reads clean (CONTROL)", async () => {
    const short = manifest({ plugins: SHORT.cid });
    const r = await readFloorShadow({ manifestCid: short.cid, readBytes: store(short), islandBlobs: blobs, coreSha256: CORE_SHA });
    expect(r.verdict).toBe("mismatch");
    if (r.verdict === "mismatch") {
      expect(r.moved.map((m) => m.field)).toEqual(["plugins"]);
      expect(r.moved[0]!.island).toContain("$:/plugins/operator/extra");
    }
    const whole = manifest();
    expect(await readFloorShadow({ manifestCid: whole.cid, readBytes: store(whole), islandBlobs: blobs, coreSha256: CORE_SHA })).toEqual({ verdict: "clean", manifest: whole.cid });
  });

  test("absent or corrupt offering bytes read unread, naming the offering", async () => {
    const m = manifest();
    const onlyManifest = async (cid: string) => (cid === m.cid ? m.bytes : null);
    const r = await readFloorShadow({ manifestCid: m.cid, readBytes: onlyManifest, islandBlobs: blobs, coreSha256: CORE_SHA });
    expect(r).toMatchObject({ verdict: "unread", why: expect.stringContaining("offering") });
  });

  test("a stored tally naming a grammar move reads null: the floor carries no grammar field", () => {
    expect(readFloorShadowTally({ cleanBoots: 0, mismatchBoots: 1, unreadBoots: 0, firstMismatch: { manifest: "m", moved: [{ field: "grammar", floor: "a", island: "b" }] } })).toBeNull();
  });
});

describe("the shadow tally counts boots and keeps the first mismatch on each floor", () => {
  test("clean boots count; the first mismatch stays named once later ones land; unread counts apart", async () => {
    const same = manifest();
    const moved = manifest({ plugins: SHORT.cid });
    const clean = await readFloorShadow({ manifestCid: same.cid, readBytes: store(same), islandBlobs: blobs, coreSha256: CORE_SHA });
    const bad = await readFloorShadow({ manifestCid: moved.cid, readBytes: store(moved), islandBlobs: blobs, coreSha256: CORE_SHA });
    const unread = await readFloorShadow({ manifestCid: same.cid, readBytes: async () => null, islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(null, clean);
    t = foldFloorShadowTally(t, clean);
    expect(floorShadowLine(t)).toBe(`floor shadow on floor ${same.cid.slice(0, 12)}…: clean across 2 boots, 0 unread`);
    t = foldFloorShadowTally(t, unread);
    expect(t.current).toMatchObject({ floor: same.cid, cleanBoots: 2, unreadBoots: 1, mismatchBoots: 0 });
    t = foldFloorShadowTally(t, bad);
    t = foldFloorShadowTally(t, bad);
    expect(t.current?.floor).toBe(moved.cid);
    expect(t.current?.mismatchBoots).toBe(2);
    expect(t.current?.firstMismatch?.manifest).toBe(moved.cid);
    expect(t.current?.firstMismatch?.moved.map((m) => m.field)).toEqual(["plugins"]);
    expect(floorShadowLine(t)).toContain("first mismatch");
    expect(floorShadowLine(t)).toContain("plugins");
    // The tally reads back from its stored JSON, and a malformed value reads null, never a guess.
    expect(readFloorShadowTally(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(readFloorShadowTally({ cleanBoots: "two" })).toBeNull();
    expect(floorShadowLine(null)).toBe("floor shadow: no boot read yet");
  });
});

describe("the shadow tally keys its count by the floor each boot read", () => {
  const short = (cid: string): string => `${cid.slice(0, 12)}…`;

  test("an older floor's mismatch stays set aside: the new floor reads clean after N clean boots", async () => {
    const old = manifest({ plugins: SHORT.cid });
    const now = manifest();
    const bad = await readFloorShadow({ manifestCid: old.cid, readBytes: store(old), islandBlobs: blobs, coreSha256: CORE_SHA });
    const clean = await readFloorShadow({ manifestCid: now.cid, readBytes: store(now), islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(null, bad);
    for (let i = 0; i < 3; i++) t = foldFloorShadowTally(t, clean);
    expect(floorShadowLine(t)).toBe(`floor shadow on floor ${short(now.cid)}: clean across 3 boots, 0 unread; 1 older floor set aside`);
    expect(t).toMatchObject({
      current: { floor: now.cid, cleanBoots: 3, mismatchBoots: 0, unreadBoots: 0, firstMismatch: null },
      prior:   [{ floor: old.cid, cleanBoots: 0, mismatchBoots: 1, unreadBoots: 0 }],
    });
    expect(readFloorShadowTally(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });

  test("a stored tally that names no floor reads as a prior floor's history, never a fault", async () => {
    const now = manifest();
    const unkeyed = { cleanBoots: 0, mismatchBoots: 2, unreadBoots: 5,
      firstMismatch: { manifest: "e".repeat(64), moved: [{ field: "plugins", floor: "f".repeat(64), island: "$:/plugins/operator/extra" }] } };
    const kept = readFloorShadowTally(unkeyed);
    expect(kept).toEqual({ current: null, prior: [{ floor: null, ...unkeyed }] });
    const clean = await readFloorShadow({ manifestCid: now.cid, readBytes: store(now), islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(kept, clean);
    t = foldFloorShadowTally(t, clean);
    t = foldFloorShadowTally(t, clean);
    expect(floorShadowLine(t)).toBe(`floor shadow on floor ${short(now.cid)}: clean across 3 boots, 0 unread; 1 older floor set aside`);
  });

  test("a boot back on an older floor picks that floor's own count back up", async () => {
    const a = manifest();
    const b = manifest({ plugins: SHORT.cid });
    const onA = await readFloorShadow({ manifestCid: a.cid, readBytes: store(a), islandBlobs: blobs, coreSha256: CORE_SHA });
    const onB = await readFloorShadow({ manifestCid: b.cid, readBytes: store(b), islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(null, onA);
    t = foldFloorShadowTally(t, onA);
    t = foldFloorShadowTally(t, onB);
    t = foldFloorShadowTally(t, onA);
    expect(t).toMatchObject({ current: { floor: a.cid, cleanBoots: 3 }, prior: [{ floor: b.cid, mismatchBoots: 1 }] });
  });

  test("CONTROL: on one floor the first mismatch stays named once later boots land", async () => {
    const moved = manifest({ plugins: SHORT.cid });
    const bad = await readFloorShadow({ manifestCid: moved.cid, readBytes: store(moved), islandBlobs: blobs, coreSha256: CORE_SHA });
    const unread = await readFloorShadow({ manifestCid: moved.cid, readBytes: async () => null, islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(null, bad);
    t = foldFloorShadowTally(t, unread);
    expect(floorShadowLine(t)).toContain("first mismatch");
    expect(floorShadowLine(t)).toContain("plugins");
  });
});
