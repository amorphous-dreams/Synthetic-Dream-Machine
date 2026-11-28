/**
 * floor-flip (3c, follow-lei S1) — a mount loads its plugin set from the floor it stands on, never from the founding record's own
 * blob rows. The floor resolves whole for its plugins (the offering verified, every required id present, every blob re-hashed);
 * the engine stays island-supplied under a mount check (the island's core folds to the floor's `engine`). A floor that does not
 * resolve, or whose engine moved, serves the island's set and names why; no floor named serves the island quietly.
 */
import { describe, expect, test } from "vitest";
import { sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";
import { FLOOR_MANIFEST_FORMAT, floorManifestBytes } from "../src/floor-manifest.js";
import { computeEngineCid } from "../src/genesis-doc.js";
import { signFloorOffering } from "../src/floor-offering.js";
import { ENGINE_CORE_ID, type LarBlobEntry } from "../src/base-doc.js";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";
import { bootSetPluginCids } from "../src/cas.js";
import { resolveRecipePluginCids, type FloorMountReading } from "../src/surface-recipe.js";
import { FLOOR_PIN_KIND, vesselMountFloorCid, writeFloorPin } from "../src/floor-pin.js";
import { GENESIS_FLOOR_TIDDLER } from "../src/floor-manifest.js";
import { storedLarRecord } from "../src/stored-record.js";
import type { LarDoc } from "../src/base-doc.js";

const bytesOf = (label: string): Uint8Array => utf8Bytes(JSON.stringify({ label }));
const blob = (id: string, label: string, kind: string, mimeType = "application/json"): LarBlobEntry & { bytes: Uint8Array } => {
  const bytes = bytesOf(label);
  return { id, version: "1", sha256: sha256HexBytesSync(bytes), mimeType, kind, bytes } as LarBlobEntry & { bytes: Uint8Array };
};
const CORE = blob(ENGINE_CORE_ID, "core", "engine", "application/javascript");
const GRAMMAR = blob(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "grammar-1", "grammar");
const HOUSE = blob(LARES_LARARIUM_PLUGIN_URI, "house-1", "lararium");
const BASE = blob("$:/plugins/lares/base", "base-1", "base");
const HOUSE2 = blob(LARES_LARARIUM_PLUGIN_URI, "house-2", "lararium");
const EXTRA = blob("$:/plugins/operator/extra", "extra-1", "plugin");
const island: Record<string, LarBlobEntry> = Object.fromEntries([CORE, GRAMMAR, HOUSE, BASE].map((b) => [b.id, b]));

const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };
const offer = (rows: readonly LarBlobEntry[]) => signFloorOffering({ seed: new Uint8Array(32).fill(7), blobs: rows.map((b) => ({ id: b.id, version: b.version, sha256: b.sha256, provenance })) });
const SAME = await offer([GRAMMAR, HOUSE, BASE]);
const NEWER = await offer([GRAMMAR, HOUSE2, BASE, EXTRA]);
const SHORT = await offer([HOUSE, BASE]);

function manifest(plugins: string, engine = computeEngineCid(CORE.sha256)): { cid: string; bytes: Uint8Array } {
  const bytes = floorManifestBytes({ format: FLOOR_MANIFEST_FORMAT, engine, plugins, snapshots: { lares: "a".repeat(64), lararium: "b".repeat(64) } });
  return { cid: sha256HexBytesSync(bytes), bytes };
}
const store = (...extra: Array<{ cid: string; bytes: Uint8Array }>) => {
  const all = new Map<string, Uint8Array>([
    ...[CORE, GRAMMAR, HOUSE, BASE, HOUSE2, EXTRA].map((b) => [b.sha256, b.bytes] as const),
    ...[SAME, NEWER, SHORT].map((o) => [o.cid, o.bytes] as const),
    ...extra.map((e) => [e.cid, e.bytes] as const),
  ]);
  return (cid: string) => all.get(cid) ?? null;
};
const resolve = (floorCid: string | null | undefined, readBytes: (cid: string) => Uint8Array | null, onFloorFallback?: (slug: string, r: FloorMountReading) => void) =>
  resolveRecipePluginCids({ wikiSlug: "user" }, {
    islandBlobs: island, lookup: () => undefined, readBytes,
    ...(floorCid !== undefined ? { floorCid } : {}), ...(onFloorFallback ? { onFloorFallback } : {}),
  });

describe("the flip: a mount loads the floor's plugin set (3c)", () => {
  test("RED: a floor whose offering differs from the founding record's blobs mounts the OFFERING's set, the house and the operator's extra included", async () => {
    const m = manifest(NEWER.cid);
    const r = await resolve(m.cid, store(m));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.pluginCids].sort()).toEqual([GRAMMAR, HOUSE2, BASE, EXTRA].map((b) => b.sha256).sort());
    expect(r.pluginCids).not.toContain(HOUSE.sha256);
    expect(r.floor).toEqual({ source: "floor", manifest: m.cid });
  });

  test("CONTROL: a floor equal to the founding record mounts byte-identical CIDs to the island path", async () => {
    const m = manifest(SAME.cid);
    const flipped = await resolve(m.cid, store(m));
    const islandOnly = await resolve(undefined, store(m));
    expect(flipped.ok && islandOnly.ok).toBe(true);
    if (!flipped.ok || !islandOnly.ok) return;
    expect([...flipped.pluginCids].sort()).toEqual([...islandOnly.pluginCids].sort());
    expect([...islandOnly.pluginCids].sort()).toEqual([...bootSetPluginCids(island)].sort());
    expect(islandOnly.floor).toEqual({ source: "island", manifest: null, why: "no floor named" });
  });

  test("RED: an engine whose core folds differently from the floor's engine serves the island's set and names engine-moved", async () => {
    const m = manifest(NEWER.cid, computeEngineCid("d".repeat(64)));
    const named: FloorMountReading[] = [];
    const r = await resolve(m.cid, store(m), (_slug, reading) => named.push(reading));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.pluginCids].sort()).toEqual([...bootSetPluginCids(island)].sort());
    expect(r.floor).toMatchObject({ source: "island", manifest: m.cid, why: expect.stringContaining("engine-moved") });
    expect(named).toEqual([r.floor]);
  });

  test("RED: a floor whose offering bytes are absent, or that drops a required blob, serves the island's set and names why", async () => {
    const m = manifest(NEWER.cid);
    const noOffering = (cid: string) => (cid === NEWER.cid ? null : store(m)(cid));
    const absent = await resolve(m.cid, noOffering);
    expect(absent.ok && absent.floor).toMatchObject({ source: "island", manifest: m.cid, why: expect.stringContaining("floor-absent") });
    const s = manifest(SHORT.cid);
    const short = await resolve(s.cid, store(s));
    expect(short.ok && short.floor).toMatchObject({ source: "island", why: expect.stringContaining("floor-offering-incomplete") });
    if (short.ok) expect([...short.pluginCids].sort()).toEqual([...bootSetPluginCids(island)].sort());
    const gone = await resolve(m.cid, () => null);
    expect(gone.ok && gone.floor).toMatchObject({ source: "island", why: expect.stringContaining("floor-absent") });
  });

  test("CONTROL: a blob whose bytes differ from its CID refuses the floor, never a silent load", async () => {
    const m = manifest(NEWER.cid);
    const lying = (cid: string) => (cid === EXTRA.sha256 ? bytesOf("not-extra") : store(m)(cid));
    const r = await resolve(m.cid, lying);
    expect(r.ok && r.floor).toMatchObject({ source: "island", why: expect.stringContaining("differ") });
  });
});

describe("the mount's floor pick: the pin, else the genesis floor the founding record names", () => {
  test("RED: no pin mounts the genesis floor's CID; a pin mounts its own manifest", async () => {
    const genesis = "9".repeat(64), pinned = "8".repeat(64);
    const islandDoc = () => ({ tiddlers: { [GENESIS_FLOOR_TIDDLER]: storedLarRecord(GENESIS_FLOOR_TIDDLER, { cid: genesis }, "test") } }) as never;
    expect(await vesselMountFloorCid({ state: async () => ({ doc: () => ({ tiddlers: {} }) as never }), islandDoc })).toBe(genesis);
    const withPin = { tiddlers: {} } as never as LarDoc;
    writeFloorPin(withPin, { kind: FLOOR_PIN_KIND, nexus: "aid", release: "7".repeat(64), manifest: pinned });
    expect(await vesselMountFloorCid({ state: async () => ({ doc: () => withPin }), islandDoc })).toBe(pinned);
    expect(await vesselMountFloorCid({ state: async () => { throw new Error("locked"); }, islandDoc })).toBe(genesis);
    expect(await vesselMountFloorCid({ state: async () => null, islandDoc: () => null })).toBeNull();
    // An island read that throws falls back, never rejects the mount (cold read #578, finding 5).
    expect(await vesselMountFloorCid({ state: async () => ({ doc: () => withPin }), islandDoc: () => { throw new Error("torn"); } })).toBe(pinned);
    expect(await vesselMountFloorCid({ state: async () => null, islandDoc: () => { throw new Error("torn"); } })).toBeNull();
  });
});
