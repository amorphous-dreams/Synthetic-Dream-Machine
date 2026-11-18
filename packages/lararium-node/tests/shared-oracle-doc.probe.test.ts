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
import { readGenesisSeed } from "../src/genesis-artifact.js";
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
  await registerCrossroadsPointer(r, catalog, nexus);
  return { oracle, catalog, nexus };
}

describe("shared @oracle document is a seed, not a registry", () => {
  test("synced vessels keep their own pointers in their catalogs", async () => {
    const { port1, port2 } = new MessageChannel();
    const aRepo = repo([new MessageChannelNetworkAdapter(port1)]);
    const bRepo = repo([new MessageChannelNetworkAdapter(port2)]);
    try {
      const a = await vessel("probe-A", aRepo, "a1".repeat(32));
      const b = await vessel("probe-B", bRepo, "b2".repeat(32));
      const seedTitle = Object.keys(readGenesisSeed(genesisDir)!.tiddlers).find((key) => key !== CROSSROADS_DOC_URI);
      if (!seedTitle) throw new Error("tracked genesis seed has no non-pointer row");

      const aSeed = () => tiddlerText(a.oracle.doc()?.tiddlers?.[seedTitle]);
      const bSeed = () => tiddlerText(b.oracle.doc()?.tiddlers?.[seedTitle]);
      await vi.waitFor(() => expect(getHeads(a.oracle.doc()!)).toEqual(getHeads(b.oracle.doc()!)));
      expect(aSeed()).toBe(bSeed());

      // The crossroads pointer stands per vessel, in its own catalog; the shared document names none of it.
      expect(tiddlerText(a.catalog.doc()?.tiddlers?.[CROSSROADS_DOC_URI])).toBeTruthy();
      expect(tiddlerText(b.catalog.doc()?.tiddlers?.[CROSSROADS_DOC_URI])).toBeTruthy();
      expect(tiddlerText(a.catalog.doc()?.tiddlers?.[CROSSROADS_DOC_URI])).not.toBe(tiddlerText(b.catalog.doc()?.tiddlers?.[CROSSROADS_DOC_URI]));
      // The live system documents rest in the Kahu realm: no catalog carries a row for either bag, and the shared
      // document names neither (the rows retire; no second home).
      for (const title of [LARES_DOC_URI, LARARIUM_DOC_URI, CROSSROADS_DOC_URI]) {
        expect(a.oracle.doc()?.tiddlers?.[title]).toBeUndefined();
        expect(b.oracle.doc()?.tiddlers?.[title]).toBeUndefined();
      }
      for (const title of [LARES_DOC_URI, LARARIUM_DOC_URI]) {
        expect(a.catalog.doc()?.tiddlers?.[title]).toBeUndefined();
        expect(b.catalog.doc()?.tiddlers?.[title]).toBeUndefined();
      }
    } finally {
      port1.close(); port2.close();
      await aRepo.shutdown(); await bRepo.shutdown();
    }
  }, 15_000);
});
