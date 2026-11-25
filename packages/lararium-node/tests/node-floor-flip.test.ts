/**
 * node-floor-flip (3c, follow-lei S1) — the node resolver hands the floor it stands on to the one mesh selection, so a mount loads
 * the floor offering's set; a named floor that does not serve says so once (the island's set serves), never per mount.
 */
import { describe, expect, test, vi } from "vitest";
import { ENGINE_CORE_ID } from "@lararium/mesh/base-doc";
import { FLOOR_MANIFEST_FORMAT } from "@lararium/mesh/wire-names";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";
import { computeEngineCid } from "@lararium/mesh/genesis-doc";
import { floorManifestBytes } from "@lararium/mesh/floor-manifest";
import { sha256HexBytesSync, utf8Bytes } from "@lararium/mesh/crypto";
import { signFloorOffering } from "@lararium/mesh/floor-offering";
import { logFloorFallback, resolveNodeIslandPluginCids } from "../src/node-plugin-resolution.js";

const row = (id: string, label: string, kind: string, mimeType = "application/json") => {
  const bytes = utf8Bytes(JSON.stringify({ label }));
  return { id, version: "1", sha256: sha256HexBytesSync(bytes), mimeType, kind, bytes };
};
const CORE = row(ENGINE_CORE_ID, "core", "engine", "application/javascript");
const GRAMMAR = row(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "grammar-1", "grammar");
const GRAMMAR2 = row(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "grammar-2", "grammar");
const island = Object.fromEntries([CORE, GRAMMAR].map((b) => [b.id, b]));
const provenance = { source: "https://example.test", commit: "0".repeat(40), path: "p.json", licence: "MIT" };

describe("the node resolver mounts the floor's set (the flip)", () => {
  test("RED: a floorCid naming a newer grammar mounts that grammar's bytes, never the founding record's", async () => {
    const offered = await signFloorOffering({ seed: new Uint8Array(32).fill(3), blobs: [{ id: GRAMMAR2.id, version: "1", sha256: GRAMMAR2.sha256, provenance }] });
    const manifest = floorManifestBytes({ format: FLOOR_MANIFEST_FORMAT, engine: computeEngineCid(CORE.sha256), plugins: offered.cid, snapshots: { lares: "a".repeat(64), lararium: "b".repeat(64) } });
    const floorCid = sha256HexBytesSync(manifest);
    const store = new Map<string, Uint8Array>([[floorCid, manifest], [offered.cid, offered.bytes], [GRAMMAR2.sha256, GRAMMAR2.bytes], [GRAMMAR.sha256, GRAMMAR.bytes]]);
    const r = await resolveNodeIslandPluginCids({ islandBlobs: island, recipe: { wikiSlug: "user" }, lookup: () => undefined, readBytes: (cid) => store.get(cid) ?? null, floorCid });
    expect(r).toMatchObject({ ok: true, pluginCids: [GRAMMAR2.sha256], floor: { source: "floor", manifest: floorCid } });
    const quiet = await resolveNodeIslandPluginCids({ islandBlobs: island, recipe: { wikiSlug: "user" }, lookup: () => undefined, readBytes: (cid) => store.get(cid) ?? null });
    expect(quiet).toMatchObject({ ok: true, pluginCids: [GRAMMAR.sha256] });
  });

  test("CONTROL: a floor that does not serve is said once per floor and reason", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reading = { source: "island" as const, manifest: "e".repeat(64), why: "floor-absent: test" };
    logFloorFallback("user", reading); logFloorFallback("other", reading);
    logFloorFallback("user", { source: "floor", manifest: "e".repeat(64) });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
