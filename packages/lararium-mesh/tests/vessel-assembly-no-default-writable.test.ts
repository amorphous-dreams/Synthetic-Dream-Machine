/**
 * vessel-assembly-no-default-writable — the vessel assembly composite holds no default writable.
 *
 * The daemon bag and the social planes mount writable for explicit-bag writes. A bagless write needs a
 * wiki's working layer, so on the assembly composite alone it refuses by name instead of landing in a bag.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { assembleVessel, type VesselKeel } from "../src/open-vessel-core.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { NoWorkingLayerRefusal } from "../src/composite-store.js";
import { DAEMON_BAG_ID } from "../src/index.js";

describe("the vessel assembly composite", () => {
  test("mounts the daemon bag writable, offers no default writable, and refuses a bagless write by name", async () => {
    const repo = new Repo();
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const keel: VesselKeel = {
      repo,
      catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
      waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<T>,
      loadGenesis: async () => ({
        islandHandle: repo.create<LarDoc>(emptyLarDoc()),
        coreHash: "test-core-hash",
        bootstrap: { daemonUrl: daemonHandle.url, personaPlanes: [] },
      }),
      tempStore: () => ({}) as never,
    } as unknown as VesselKeel;
    const { composite } = await assembleVessel(keel);
    expect(composite.hasWritableBag(DAEMON_BAG_ID)).toBe(true);
    expect(composite.defaultWritableBagId()).toBeNull();
    await expect(composite.put({ tiddler: { title: "lar:///ha.ka.ba/t/bagless", text: "x" } }, { kind: "test" })).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    expect(Object.keys(daemonHandle.doc().tiddlers)).not.toContain("lar:///ha.ka.ba/t/bagless");
    // CONTROL — an explicit-bag write still lands.
    await composite.put({ tiddler: { title: "lar:///ha.ka.ba/t/explicit", text: "x" } }, { kind: "test" }, { bag: DAEMON_BAG_ID });
    expect(Object.keys(daemonHandle.doc().tiddlers)).toContain("lar:///ha.ka.ba/t/explicit");
  });
});
