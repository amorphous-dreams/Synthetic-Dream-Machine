/**
 * The node host keeps the floor shadow tally (backlog-awakens 3a) as one small JSON file beside the vessel store, so the
 * operator reads it with `lares vessel read` while the vessel stands or not. The node pool binds that store and passes the
 * founding record through to the shared pool core.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FLOOR_SHADOW_FILE, floorShadowFileStore, readFloorShadowFile } from "../src/floor-shadow-file.js";
import { VesselIslandPool } from "../src/vessel-island-pool.js";

const dirs: string[] = [];
const scratch = (): string => { const d = mkdtempSync(join(tmpdir(), "floor-shadow-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const tally = { cleanBoots: 3, mismatchBoots: 0, unreadBoots: 1, firstMismatch: null };

describe("the floor shadow tally rests in one file beside the vessel store", () => {
  test("a saved tally reads back through the store and the plain reader", async () => {
    const dir = scratch();
    const store = floorShadowFileStore(dir);
    await store.save(tally);
    expect(existsSync(join(dir, FLOOR_SHADOW_FILE))).toBe(true);
    expect(await store.load()).toEqual(tally);
    expect(readFloorShadowFile(dir)).toEqual(tally);
  });

  test("CONTROL: an absent or garbled file reads null, never a throw", () => {
    const dir = scratch();
    expect(readFloorShadowFile(dir)).toBeNull();
    writeFileSync(join(dir, FLOOR_SHADOW_FILE), "{not json");
    expect(readFloorShadowFile(dir)).toBeNull();
    writeFileSync(join(dir, FLOOR_SHADOW_FILE), JSON.stringify({ cleanBoots: -1 }));
    expect(readFloorShadowFile(dir)).toBeNull();
  });

  test("the node pool binds the file store under its storage root and passes the founding record through", () => {
    const dir = scratch();
    const record = { tiddlers: {} };
    const pool = new VesselIslandPool({ caps: {}, storageRoot: dir, foundingRecord: () => record,
      resolvePluginCids: async () => ({ ok: true, pluginCids: [] }) });
    const core = pool as unknown as { _floorShadow: unknown; _foundingRecord: (() => unknown) | null };
    expect(core._floorShadow).not.toBeNull();
    expect(core._foundingRecord?.()).toBe(record);
  });
});
