/**
 * The oracle document holds genesis seed rows alone; each vessel keeps its pointers in its own catalog.
 * TESTIMONY — 2026-10-18: the pointer converged to one value.
 */
import { getHeads } from "@automerge/automerge";
import { describe, test, expect, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import {
  CROSSROADS_DOC_URI, LARES_DOC_URI, LARARIUM_DOC_URI,
  emptyLarDoc, materializeGenesisIsland, tiddlerText,
} from "@lararium/mesh";
import { mintLaresIfAbsent, mintLarariumIfAbsent, readGenesisSeed, reconcileWellKnownTiddlers } from "../src/genesis-artifact.js";
import { registerCrossroadsPointer } from "@lararium/mesh";

const genesisDir = join(repoRoot, "genesis");
function repo(network: MessageChannelNetworkAdapter[] = []) {
  return new Repo({ network, sharePolicy: async () => true });
}
async function vessel(label: string, r: Repo, nexus: string) {
  const seed = readGenesisSeed(genesisDir);
  if (!seed) throw new Error(`tracked genesis seed missing under ${genesisDir}`);
  const oracle = await materializeGenesisIsland(r, seed, label);
  const catalog = r.create(emptyLarDoc());
  const laresUrl = mintLaresIfAbsent(r, catalog);
  mintLarariumIfAbsent(r, catalog);
  await registerCrossroadsPointer(r, catalog, nexus);
  return { oracle, catalog, nexus, laresUrl };
}

describe("shared @oracle document is a seed, not a registry", () => {
  test("synced vessels keep their own pointers in their catalogs", async () => {
    const { port1, port2 } = new MessageChannel();
    const aRepo = repo([new MessageChannelNetworkAdapter(port1)]);
    const bRepo = repo([new MessageChannelNetworkAdapter(port2)]);
    try {
      const a = await vessel("probe-A", aRepo, "a1".repeat(32));
      const b = await vessel("probe-B", bRepo, "b2".repeat(32));
      const pointers = [LARES_DOC_URI, LARARIUM_DOC_URI, CROSSROADS_DOC_URI];
      const seedTitle = Object.keys(readGenesisSeed(genesisDir)!.tiddlers).find((key) => !pointers.includes(key));
      if (!seedTitle) throw new Error("tracked genesis seed has no non-pointer row");

      const aSeed = () => tiddlerText(a.oracle.doc()?.tiddlers?.[seedTitle]);
      const bSeed = () => tiddlerText(b.oracle.doc()?.tiddlers?.[seedTitle]);
      await vi.waitFor(() => expect(getHeads(a.oracle.doc()!)).toEqual(getHeads(b.oracle.doc()!)));
      expect(aSeed()).toBe(bSeed());

      await reconcileWellKnownTiddlers(b.catalog, b.laresUrl);
      for (const title of pointers) {
        expect(tiddlerText(a.catalog.doc()?.tiddlers?.[title])).toBeTruthy();
        expect(tiddlerText(b.catalog.doc()?.tiddlers?.[title])).toBeTruthy();
        expect(tiddlerText(a.catalog.doc()?.tiddlers?.[title])).not.toBe(tiddlerText(b.catalog.doc()?.tiddlers?.[title]));
        expect(a.oracle.doc()?.tiddlers?.[title]).toBeUndefined();
        expect(b.oracle.doc()?.tiddlers?.[title]).toBeUndefined();
      }
    } finally {
      port1.close(); port2.close();
      await aRepo.shutdown(); await bRepo.shutdown();
    }
  }, 15_000);
});
