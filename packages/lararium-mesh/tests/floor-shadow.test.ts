/**
 * The floor shadow read (backlog-awakens 3a): the pinned floor's engine, grammar and plugins fields read beside the folds
 * recomputed from the founding record's own blobs. It only reads: a mismatch names the field, absent manifest bytes read
 * `unread` by name, and nothing throws.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync } from "../src/crypto.js";
import { FLOOR_MANIFEST_FORMAT, floorManifestBytes } from "../src/floor-manifest.js";
import { computeEngineCid, computeGrammarCid, computePluginsCid } from "../src/genesis-doc.js";
import { ENGINE_CORE_ID, type LarBlobEntry } from "../src/base-doc.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import { floorShadowLine, foldFloorShadowTally, readFloorShadow, readFloorShadowTally } from "../src/floor-shadow.js";

const CORE_SHA = "c".repeat(64);
const blobs: Record<string, LarBlobEntry> = {
  [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, version: "5.4.0", sha256: CORE_SHA, mimeType: "application/javascript" },
  grammar: { id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "1", sha256: "1".repeat(64), mimeType: "application/json", kind: "grammar" },
  extra: { id: "$:/plugins/operator/extra", version: "1", sha256: "2".repeat(64), mimeType: "application/json", kind: "plugin" },
};
const entries = Object.values(blobs).filter((b) => b.id !== ENGINE_CORE_ID).map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, ...(b.kind ? { kind: b.kind as never } : {}) }));
const truth = { engine: computeEngineCid(CORE_SHA), grammar: computeGrammarCid(entries), plugins: computePluginsCid(entries) };

function manifest(fields: Partial<typeof truth> = {}): { cid: string; bytes: Uint8Array } {
  const bytes = floorManifestBytes({ format: FLOOR_MANIFEST_FORMAT, ...truth, ...fields, snapshots: { lares: "a".repeat(64), lararium: "b".repeat(64) } });
  return { cid: sha256HexBytesSync(bytes), bytes };
}
const store = (...ms: Array<{ cid: string; bytes: Uint8Array }>) => async (cid: string) => ms.find((m) => m.cid === cid)?.bytes ?? null;

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
    const other = manifest({ grammar: computeGrammarCid([]) });
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: async () => other.bytes, islandBlobs: blobs, coreSha256: CORE_SHA })).verdict).toBe("unread");
    expect((await readFloorShadow({ manifestCid: null, readBytes: store(m), islandBlobs: blobs, coreSha256: CORE_SHA })).verdict).toBe("unread");
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: store(m), islandBlobs: undefined, coreSha256: CORE_SHA })).verdict).toBe("unread");
  });

  test("the core hash falls back to the founding record's own core blob", async () => {
    const m = manifest();
    expect((await readFloorShadow({ manifestCid: m.cid, readBytes: store(m), islandBlobs: blobs, coreSha256: null })).verdict).toBe("clean");
  });
});

describe("the shadow tally counts boots and keeps the first mismatch", () => {
  test("clean boots count; the first mismatch stays named once later ones land; unread counts apart", async () => {
    const same = manifest();
    const moved = manifest({ plugins: computePluginsCid([]) });
    const clean = await readFloorShadow({ manifestCid: same.cid, readBytes: store(same), islandBlobs: blobs, coreSha256: CORE_SHA });
    const bad = await readFloorShadow({ manifestCid: moved.cid, readBytes: store(moved), islandBlobs: blobs, coreSha256: CORE_SHA });
    const unread = await readFloorShadow({ manifestCid: same.cid, readBytes: async () => null, islandBlobs: blobs, coreSha256: CORE_SHA });
    let t = foldFloorShadowTally(null, clean);
    t = foldFloorShadowTally(t, clean);
    expect(floorShadowLine(t)).toBe("floor shadow: clean across 2 boots");
    t = foldFloorShadowTally(t, bad);
    t = foldFloorShadowTally(t, bad);
    t = foldFloorShadowTally(t, unread);
    expect(t.cleanBoots).toBe(2);
    expect(t.mismatchBoots).toBe(2);
    expect(t.unreadBoots).toBe(1);
    expect(t.firstMismatch?.manifest).toBe(moved.cid);
    expect(t.firstMismatch?.moved.map((m) => m.field)).toEqual(["plugins"]);
    expect(floorShadowLine(t)).toContain("first mismatch");
    expect(floorShadowLine(t)).toContain("plugins");
    // The tally reads back from its stored JSON, and a malformed value reads null, never a guess.
    expect(readFloorShadowTally(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(readFloorShadowTally({ cleanBoots: "two" })).toBeNull();
    expect(floorShadowLine(null)).toBe("floor shadow: no boot read yet");
  });
});
