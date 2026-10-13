/**
 * A CAPABILITY'S LAYER NEVER TAKES THE WORKING ROLE.
 *
 * A vessel names its working layer: the one layer a bagless write lands in. A capability module mounts a
 * layer the vessel writes by NAME (the WHO board, the mesh palace). Such a layer accepts a write that
 * names its bag and never becomes the default: on a composite where no layer holds the working role, a
 * bagless write refuses by name.
 *
 * Two composites, as the two vessels assemble them: the node hearth's (substrate, mesh palace, WHO board)
 * and the browser vessel's (substrate, WHO board).
 *
 * Control: a layer mounted with the working role takes the bagless write, and a capability composed
 * AFTER it leaves the role where the vessel named it.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { whoFaceCap } from "../src/who-face-cap.js";
import { meshPalaceCap } from "../src/carriage-caps.js";
import { CompositeStore, NoWorkingLayerRefusal } from "../src/composite-store.js";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { nexusHandlesUri } from "../src/lar-uris.js";
import { MESH_PALACE_BAG } from "../src/mesh-palace.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const NEXUS = "abcdef0123456789";
const SUBSTRATE = "lar:///ha.ka.ba/bags/lararium";
const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const origin: ChangeOrigin = { kind: "lares-verb", requestId: "role" };
const substrateStub = (composite: CompositeStore): CapModule => ({ id: "substrate", requires: [], build: () => ({ composite }) });

/** The substrate as the vessel core mounts it: writable by name, never the default (`open-vessel-core`). */
function assembly(repo: Repo): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: SUBSTRATE, store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), SUBSTRATE), writable: true, defaultWritable: false });
  return composite;
}

const VESSELS: ReadonlyArray<readonly [string, (repo: Repo) => CapModule[], readonly string[]]> = [
  ["the node hearth's assembly composite", (repo) => [meshPalaceCap({ repo }), whoFaceCap({ repo, crossroadsHandle: repo.create<LarDoc>(emptyLarDoc()), nexusPubkey: NEXUS })], [MESH_PALACE_BAG, nexusHandlesUri(NEXUS)]],
  ["the browser vessel's composite", (repo) => [whoFaceCap({ repo, crossroadsHandle: repo.create<LarDoc>(emptyLarDoc()), nexusPubkey: NEXUS })], [nexusHandlesUri(NEXUS)]],
];

describe("a capability's layer never takes the working role", () => {
  for (const [name, caps, bags] of VESSELS) {
    test(`${name}: a bagless write refuses by name; a write that names a cap's bag lands`, { timeout: 15_000 }, async () => {
      const repo = new Repo({ sharePolicy: async () => true });
      const composite = assembly(repo);
      await composeVessel([substrateStub(composite), ...caps(repo)]);
      for (const bag of bags) expect(composite.layerIds).toContain(bag);

      expect(composite.defaultWritableBagId(), "no layer holds the working role").toBeNull();
      await expect(composite.put({ tiddler: { title: "lar:///t/role/bagless", text: "nowhere" } }, origin)).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
      await expect(composite.put({ tiddler: { title: "lar:///t/role/bagless", text: "nowhere" } }, origin)).rejects.toThrow(/no default writable layer stands/);
      for (const bag of bags) {
        await composite.put({ tiddler: { title: `lar:///t/role/named`, text: "by name" } }, origin, { bag });
        expect((await composite.storeForBag(bag)!.get("lar:///t/role/named"))?.tiddler.text).toBe("by name");
      }
      await repo.shutdown();
    });

    test(`${name}: CONTROL, the working layer the vessel named keeps the role when a capability composes after it`, { timeout: 15_000 }, async () => {
      const repo = new Repo({ sharePolicy: async () => true });
      const composite = assembly(repo);
      composite.addLayer({ bagId: WORKING, store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), WORKING), writable: true, defaultWritable: true });
      await composeVessel([substrateStub(composite), ...caps(repo)]);
      expect(composite.defaultWritableBagId()).toBe(WORKING);
      await composite.put({ tiddler: { title: "lar:///t/role/bagless", text: "to working" } }, origin);
      expect((await composite.storeForBag(WORKING)!.get("lar:///t/role/bagless"))?.tiddler.text).toBe("to working");
      for (const bag of bags) expect(await composite.storeForBag(bag)!.get("lar:///t/role/bagless")).toBeNull();
      await repo.shutdown();
    });
  }
});
