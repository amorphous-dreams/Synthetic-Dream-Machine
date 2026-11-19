/**
 * wiki-island-keeps-no-store — a wiki island relays through the vessel and rests nothing of its own.
 *
 * The vessel's Repo holds the one store (single-owner law). A wiki island's Repo stands with no storage adapter, as a
 * session island's already does: every slot document arrives from the vessel over the sync port, and what the island
 * writes rests only once the vessel holds it.
 *
 *   W1  a wiki island mounts and tears down, and no store directory stands for it under the pool's storage root.
 *   W2  a slot document the vessel alone holds arrives with no island-local read: the island's old store path holds a
 *       file no store could read, and the mount still declares `ea`.
 *   W3  a write made in the wiki island (a COPY verb) reaches the vessel's Repo before the island acks its teardown.
 *
 * Uses the real compiled node-wiki-island.js entry. Meme: lar:///ha.ka.ba/lararium/node/vessel-island-pool
 */
import { describe, expect, test } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { automergeLoad, ENGINE_CORE_ID, emptyLarDoc, storedLarRecord, wikiBagUri, wikiSlotUri, wikiUri, type LarDoc } from "@lararium/mesh";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { setupCasFromGenesis } from "./cas-test-setup.js";
import { GENESIS_SEED, loadGenesisBytes } from "./genesis-test-source.js";

const ISLAND_JS = new URL("../dist/src/node-wiki-island.js", import.meta.url);
const missing = !existsSync(GENESIS_SEED) ? "genesis/seed.json absent — build genesis" :
  !existsSync(fileURLToPath(ISLAND_JS)) ? "dist/src/node-wiki-island.js absent — build node" : null;

const SLUG = "keeps-no-store";
/** Where a wiki island's own store stood: `<storageRoot>/<wiki id, path-safe>`. */
const islandStorePath = (root: string, wikiId: string): string =>
  join(root, wikiId.replace(/^lar:\/\/\//, "").replace(/[^a-zA-Z0-9@._-]/g, "_"));

function stand() {
  if (missing) throw new Error(missing);
  const genesisBytes = loadGenesisBytes();
  const genesisDoc = automergeLoad<LarDoc>(genesisBytes);
  const coreHash = genesisDoc.blobs?.[ENGINE_CORE_ID]?.sha256 as string;
  const cas = setupCasFromGenesis(genesisDoc);
  const repo = new Repo({ peerId: "keeps-no-store-vessel" as PeerId });
  const oracle = repo.import<LarDoc>(genesisBytes);
  const wiki = repo.create<LarDoc>(emptyLarDoc());
  wiki.change((doc) => { doc.tiddlers["Held By The Vessel"] = storedLarRecord("Held By The Vessel", { text: "only the vessel rests me" }, "test"); });
  const working = repo.create<LarDoc>(emptyLarDoc());
  const pool = new VesselIslandPool({ caps: {},
    workerScriptUrl: ISLAND_JS, mainRepo: repo, storageRoot: cas.storageDir, cidDir: cas.cidDir,
    resolvePluginCids: async () => ({ ok: true as const, pluginCids: cas.pluginCids }),
  });
  const spec = { coreHash, recipe: { wikiSlug: SLUG }, grants: { islandUrl: oracle.url, wikiUrl: wiki.url, workingUrl: working.url } };
  return { cas, repo, wiki, working, pool, spec, close: async () => { await pool.disposeAll(); await repo.shutdown(); cas.cleanup(); } };
}

describe("a wiki island keeps no store of its own", () => {
  test("W1 — a mount and a teardown leave no island store directory under the storage root", async () => {
    const s = stand();
    const wikiId = wikiUri(SLUG);
    try {
      await s.pool.mountWiki(wikiId, s.spec);
      expect(s.pool.tier(wikiId)).toBe("wela");
      await s.pool.disposeAll();
      expect(existsSync(islandStorePath(s.cas.storageDir, wikiId))).toBe(false);
    } finally { await s.close(); }
  }, 60_000);

  test("W2 — a slot document the vessel alone holds arrives with no island-local read", async () => {
    const s = stand();
    const wikiId = wikiUri(SLUG);
    // A file where the island's store directory stood: any read of an island store there fails at once.
    writeFileSync(islandStorePath(s.cas.storageDir, wikiId), "not a store");
    try {
      await s.pool.mountWiki(wikiId, s.spec);
      expect(s.pool.tier(wikiId)).toBe("wela");
    } finally { await s.close(); }
  }, 60_000);

  test("W3 — a write made in the island reaches the vessel's Repo before the teardown ack", async () => {
    const s = stand();
    const wikiId = wikiUri(SLUG);
    try {
      await s.pool.mountWiki(wikiId, s.spec);
      // A copy from the wiki's bag into its working layer runs inside the island; the teardown follows in the same breath,
      // with no wait between: the island holds no store, so the vessel's Repo holds the write once the teardown returns.
      await s.pool.placeWikiVerb(wikiId, {
        verb: "COPY", requestedBy: "test",
        args: { title: "Held By The Vessel", "from-bag": wikiBagUri(SLUG), "to-bag": wikiSlotUri(SLUG, "working"), "change-id": "keeps-no-store" },
      });
      await s.pool.disposeAll();
      expect(s.working.doc()?.tiddlers?.["Held By The Vessel"]).toBeDefined();
      expect(existsSync(islandStorePath(s.cas.storageDir, wikiId))).toBe(false);
    } finally { await s.close(); }
  }, 60_000);
});
