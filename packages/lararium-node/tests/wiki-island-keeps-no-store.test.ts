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
 *   W4  an island store an older composition left beside the vessel's names itself once, at the wiki's first mount, with what
 *       it holds (its files, its bytes, its stranded temps), and nothing reads or removes it.
 *   W3  a write made in the wiki island (a COPY verb) reaches the vessel's Repo before the island acks its teardown.
 *
 * Uses the real compiled node-wiki-island.js entry. Meme: lar:///ha.ka.ba/lararium/node/vessel-island-pool
 */
import { describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { automergeLoad, ENGINE_CORE_ID, emptyLarDoc, storedLarRecord, wikiBagUri, wikiSlotUri, wikiUri, type LarDoc } from "@lararium/mesh";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { islandStoreDir } from "../src/island-store-left.js";
import { setupCasFromGenesis } from "./cas-test-setup.js";
import { GENESIS_SEED, loadGenesisBytes } from "./genesis-test-source.js";

const ISLAND_JS = new URL("../dist/src/node-wiki-island.js", import.meta.url);
const missing = !existsSync(GENESIS_SEED) ? "genesis/seed.json absent — build genesis" :
  !existsSync(fileURLToPath(ISLAND_JS)) ? "dist/src/node-wiki-island.js absent — build node" : null;

const SLUG = "keeps-no-store";
/** Where a wiki island's own store stood: `<storageRoot>/<wiki id, path-safe>`. */
const islandStorePath = islandStoreDir;

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
  // The receipt capability stands as the vessel composes it: the pool answers each receipt ask from its main Repo.
  const pool = new VesselIslandPool({ caps: { receipt: async () => {} },
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
      const copied = await s.pool.placeWikiVerb(wikiId, {
        verb: "COPY", requestedBy: "test",
        args: { title: "Held By The Vessel", "from-bag": wikiBagUri(SLUG), "to-bag": wikiSlotUri(SLUG, "working"), "change-id": "keeps-no-store" },
      });
      expect(copied).toMatchObject({ verb: "COPY", toBag: wikiSlotUri(SLUG, "working") });
      await s.pool.disposeAll();
      expect(s.working.doc()?.tiddlers?.["Held By The Vessel"]).toBeDefined();
      expect(existsSync(islandStorePath(s.cas.storageDir, wikiId))).toBe(false);
    } finally { await s.close(); }
  }, 60_000);

  test("W4 — an island store left from an older composition names itself once, and stays untouched", async () => {
    const s = stand();
    const wikiId = wikiUri(SLUG);
    const left = islandStorePath(s.cas.storageDir, wikiId);
    const chunk = join(left, "3Y", "8D9NrR", "snapshot", "a1b2");
    mkdirSync(join(chunk, ".."), { recursive: true });
    writeFileSync(chunk, new Uint8Array(1_000));
    writeFileSync(`${chunk}.4242.tmp`, new Uint8Array(10));
    const warned: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => { warned.push(args.map(String).join(" ")); });
    try {
      await s.pool.mountWiki(wikiId, s.spec);
      await s.pool.unmountWiki(wikiId);
      await s.pool.mountWiki(wikiId, s.spec);
      const named = warned.filter((line) => line.includes("an island store stands unused at"));
      expect(named).toEqual([`[vessel-pool] an island store stands unused at ${left}: the vessel holds every doc (2 files, 1010 bytes, 1 stranded temp); nothing reads it, nothing removes it; a re-found leaves it behind`]);
      expect(readFileSync(chunk).byteLength).toBe(1_000);
    } finally { spy.mockRestore(); await s.close(); }
  }, 60_000);
});
