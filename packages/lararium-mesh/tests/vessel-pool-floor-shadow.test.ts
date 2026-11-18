/**
 * The shadow read at mount (backlog-awakens 3a): each wiki mount reads the floor it stands on (the vessel's pin, or the
 * genesis floor the founding record names) beside the founding record's own folds, records the reading in the tally once
 * per boot and floor, prints any mismatch, and keeps serving the island exactly as before.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";
import { sha256HexBytesSync } from "../src/crypto.js";
import { FLOOR_MANIFEST_FORMAT, GENESIS_FLOOR_TIDDLER, floorManifestBytes } from "../src/floor-manifest.js";
import { computeEngineCid, computeGrammarCid, computePluginsCid } from "../src/genesis-doc.js";
import { ENGINE_CORE_ID, type LarDoc, type LarBlobEntry } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import type { FloorShadowTally } from "../src/floor-shadow.js";

const CORE = "c".repeat(64);
const blobs: Record<string, LarBlobEntry> = {
  [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, version: "5.4.0", sha256: CORE, mimeType: "application/javascript" },
  extra: { id: "$:/plugins/operator/extra", version: "1", sha256: "2".repeat(64), mimeType: "application/json", kind: "plugin" },
};
const entries = [{ id: "$:/plugins/operator/extra", version: "1", sha256: "2".repeat(64), kind: "plugin" as const }];
const truth = { engine: computeEngineCid(CORE), grammar: computeGrammarCid(entries), plugins: computePluginsCid(entries) };
function manifest(fields: Partial<typeof truth> = {}) {
  const bytes = floorManifestBytes({ format: FLOOR_MANIFEST_FORMAT, ...truth, ...fields, snapshots: { lares: "a".repeat(64), lararium: "b".repeat(64) } });
  return { cid: sha256HexBytesSync(bytes), bytes };
}
function founding(genesisFloor: string | null): LarDoc {
  return { tiddlers: genesisFloor ? { [GENESIS_FLOOR_TIDDLER]: storedLarRecord(GENESIS_FLOOR_TIDDLER, { cid: genesisFloor }, "test") } : {}, blobs };
}
const spec: WikiMountSpec = { coreHash: CORE, recipe: { wikiSlug: "wiki" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } };

function rig(opts: { pin: string | null; record: LarDoc; held: Array<{ cid: string; bytes: Uint8Array }>; tally?: { value: unknown } }) {
  const manifests: Array<Record<string, unknown>> = [];
  const listeners = new Set<(raw: unknown) => void>();
  const hear = (msg: unknown): void => { for (const fn of [...listeners]) fn(msg); };
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      return { post(msg) {
        const type = (msg as { type?: string }).type;
        if (type === "manifest") manifests.push(msg as Record<string, unknown>);
        if (type === "manifest" || type === "teardown") queueMicrotask(() => hear(type === "manifest" ? mkEa("wiki") : mkTeardownAck()));
      }, listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, onError: () => () => {}, terminate() {} };
    },
    newSyncChannel() { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  const tally = opts.tally ?? { value: null };
  const pool = new VesselIslandPoolCore({
    host, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }),
    floorCid: () => opts.pin,
    readContent: (cid) => opts.held.find((m) => m.cid === cid)?.bytes ?? null,
    foundingRecord: () => opts.record,
    floorShadow: { load: () => tally.value, save: (t: FloorShadowTally) => { tally.value = JSON.parse(JSON.stringify(t)); } },
  });
  return { pool, manifests, tally };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("the floor shadow read rides each wiki mount and never moves serving", () => {
  test("a pinned floor whose engine differs prints a mismatch, records it, and the mount still serves the island", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const moved = manifest({ engine: computeEngineCid("d".repeat(64)) });
    const { pool, manifests, tally } = rig({ pin: moved.cid, record: founding(null), held: [moved] });
    await pool.mountWiki("wiki", spec);
    expect(pool.has("wiki")).toBe(true);
    expect(manifests[0]?.["floorCid"]).toBe(moved.cid);
    const t = tally.value as FloorShadowTally;
    expect(t.mismatchBoots).toBe(1);
    expect(t.firstMismatch?.moved.map((m) => m.field)).toEqual(["engine"]);
    expect(warn.mock.calls.flat().join(" ")).toContain("engine");
    await pool.disposeAll();
  });

  test("CONTROL: an agreeing pinned floor counts one clean boot and prints no mismatch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const same = manifest();
    const { pool, tally } = rig({ pin: same.cid, record: founding(null), held: [same], tally: { value: { cleanBoots: 4, mismatchBoots: 0, unreadBoots: 0, firstMismatch: null } } });
    await pool.mountWiki("wiki", spec);
    expect((tally.value as FloorShadowTally).cleanBoots).toBe(5);
    expect(warn).not.toHaveBeenCalled();
    await pool.disposeAll();
  });

  test("an unpinned vessel reads the genesis floor its founding record names", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const genesis = manifest({ engine: computeEngineCid("e".repeat(64)) });
    const { pool, manifests, tally } = rig({ pin: null, record: founding(genesis.cid), held: [genesis] });
    await pool.mountWiki("wiki", spec);
    expect(manifests[0]?.["floorCid"]).toBeUndefined();
    const t = tally.value as FloorShadowTally;
    expect(t.firstMismatch?.manifest).toBe(genesis.cid);
    await pool.disposeAll();
  });

  test("a second mount on the same floor in one boot counts nothing more", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const same = manifest();
    const { pool, tally } = rig({ pin: same.cid, record: founding(null), held: [same] });
    await pool.mountWiki("wiki", spec);
    await pool.unmountWiki("wiki");
    await pool.mountWiki("wiki", spec);
    expect((tally.value as FloorShadowTally).cleanBoots).toBe(1);
    await pool.disposeAll();
  });

  test("absent manifest bytes record unread by name and the mount serves", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const same = manifest();
    const { pool, tally } = rig({ pin: same.cid, record: founding(null), held: [] });
    await pool.mountWiki("wiki", spec);
    expect(pool.has("wiki")).toBe(true);
    const t = tally.value as FloorShadowTally;
    expect(t.unreadBoots).toBe(1);
    expect(t.mismatchBoots).toBe(0);
    await pool.disposeAll();
  });
});
