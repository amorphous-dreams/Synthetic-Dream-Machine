import { describe, expect, test } from "vitest";
import { browserIslandStorage } from "../src/browser-sovereign-island-model.js";
import type { IslandMsg_Manifest } from "@lararium/mesh/island-protocol";

const manifest = (patch: Partial<IslandMsg_Manifest> = {}): IslandMsg_Manifest => ({
  type: "manifest",
  wikiUri: "lar:///ha.ka.ba/browser-storage-regression",
  coreHash: null,
  recipe: { wikiSlug: "storage-regression" },
  grants: { islandUrl: "automerge:oracle", wikiUrl: "automerge:wiki" },
  syncPort: {} as MessagePort,
  ...patch,
});

describe("browser island storage composition", () => {
  test("a manifest that names no store stands none: a wiki island rests nothing of its own", () => {
    expect(browserIslandStorage(manifest(), async () => false)).toBeUndefined();
  });

  test("D-VR daemon primary omits storage while owned IDB remains explicit", () => {
    expect(browserIslandStorage(manifest({ ownedDocument: {
      documentUrl: "automerge:daemon",
      syncPort: {} as MessagePort,
      storage: { type: "idb", dbName: "owned-daemon" },
    } }), async () => false)).toBeUndefined();
    expect(browserIslandStorage(manifest({ storage: { type: "idb", dbName: "owned-daemon" } }), async () => false)).toBeDefined();
  });
});
