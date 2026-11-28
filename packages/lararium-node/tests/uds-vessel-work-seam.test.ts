import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore, NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { memoryWorkOf } from "./work-store-fixture.js";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { claimStore } from "../src/owned-store.js";
import { startUdsChannel } from "../src/uds-channel.js";

describe("the UDS channel's vessel-work seam", () => {
  test("the UDS channel cannot arm on a store that stands no work capability; CONTROL: the state store arms it", async () => {
    const repo = new Repo();
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: true });
    const dir = mkdtempSync(join(tmpdir(), "working-layer-boot-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      expect(() => startUdsChannel({ stateHandle: daemonHandle, state: composite, claim, repo, placeVerb: () => {} }))
        .toThrowError(NoWorkingLayerRefusal);
      expect(Object.keys(daemonHandle.doc()!.tiddlers)).toEqual([]);

      const stateHandle = repo.create<LarDoc>(emptyLarDoc());
      const channel = startUdsChannel({ stateHandle, state: memoryWorkOf(stateHandle), claim, repo, placeVerb: () => {} });
      channel.close();
    } finally {
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
