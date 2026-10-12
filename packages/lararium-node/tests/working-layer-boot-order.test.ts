import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, emptyLarDoc, NoWorkingLayerRefusal, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { claimStore } from "../src/owned-store.js";
import { startUdsChannel } from "../src/uds-channel.js";

describe("daemon working layer boot seam", () => {
  test("the UDS channel cannot arm until the daemon composite has its working default", async () => {
    const repo = new Repo();
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID), writable: true, defaultWritable: false });
    const dir = mkdtempSync(join(tmpdir(), "working-layer-boot-"));
    const claim = await claimStore(dir, { holder: "vessel" });
    try {
      expect(() => startUdsChannel({ daemonHandle, composite, claim, repo, placeVerb: () => {} }))
        .toThrowError(NoWorkingLayerRefusal);
      expect(Object.keys(daemonHandle.doc()!.tiddlers)).toEqual([]);

      const working = wikiSlotUri("daemon", "working");
      composite.addLayer({ bagId: working, store: new MemoryTiddlerStore(working), writable: true, defaultWritable: true });
      expect(composite.defaultWritableBagId()).toBe(working);
      const channel = startUdsChannel({ daemonHandle, composite, claim, repo, placeVerb: () => {} });
      channel.close();
    } finally {
      await claim.release();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
