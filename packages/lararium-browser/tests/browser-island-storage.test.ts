import { describe, expect, test } from "vitest";
import { browserIslandStorage } from "../src/browser-sovereign-island-model.js";
import type { IslandMsg_Manifest } from "@lararium/mesh";

const manifest = (patch: Partial<IslandMsg_Manifest> = {}): IslandMsg_Manifest => ({
  schema_version: 1,
  type: "manifest",
  wikiUri: "lar:///ha.ka.ba/browser-storage-regression",
  coreHash: null,
  recipe: { wikiSlug: "storage-regression" },
  grants: { islandUrl: "automerge:oracle", wikiUrl: "automerge:wiki" },
  syncPort: {} as MessagePort,
  ...patch,
});

describe("browser island storage composition", () => {
  test("ordinary omitted-storage islands retain their per-wiki IndexedDB partition", () => {
    expect(browserIslandStorage(manifest())).toBeDefined();
  });

  test("D-VR daemon primary omits storage while owned IDB remains explicit", () => {
    expect(browserIslandStorage(manifest({ ownedDocument: {
      documentUrl: "automerge:daemon",
      syncPort: {} as MessagePort,
      storage: { type: "idb", dbName: "owned-daemon" },
    } }))).toBeUndefined();
    expect(browserIslandStorage(manifest({ storage: { type: "idb", dbName: "owned-daemon" } }))).toBeDefined();
  });
});
