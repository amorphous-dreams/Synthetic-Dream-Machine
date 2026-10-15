/**
 * surface-mount-real-island.test — the REAL island kernel boots a session surface from its view alone.
 *
 * The compiled wiki island (`dist/src/node-wiki-island.js`: the sovereign kernel and a full TW5 engine) mounts
 * through `mountSurface`. Its manifest carries no store, no catalog and no content directory, so the boot
 * succeeds only when the kernel:
 *   · stands its Repo under the peer ID its scoped view minted, or its leg never opens;
 *   · lays every slot from the manifest's resolved ids, since it holds no catalog to ask;
 *   · pulls the engine core and every plugin through the view's content door, since it holds no store.
 *
 * The same island through the wiki door takes a store on disk (the control), and the surface leaves none.
 */
import { describe, test, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { automergeLoad, ENGINE_CORE_ID, emptyLarDoc, storedLarRecord, wikiBagUri, wikiSlotUri, wikiUri, type LarDoc } from "@lararium/mesh";
import { resolveSurfaceRecipe } from "../../lararium-mesh/src/surface-recipe.js";
import { casDirForStorage, readCasBlobFromFs } from "../src/node-cas.js";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { setupCasFromGenesis } from "./cas-test-setup.js";
import { GENESIS_SEED, loadGenesisBytes } from "./genesis-test-source.js";

const ISLAND_JS = new URL("../dist/src/node-wiki-island.js", import.meta.url);
const SLUG = "surface-test";
const TIMEOUT = 60_000;

const skipReason =
  !existsSync(GENESIS_SEED) ? "genesis/seed.json absent — run: pnpm --filter @lararium/node build:genesis" :
  !existsSync(fileURLToPath(ISLAND_JS)) ? "dist/src/node-wiki-island.js absent — run: pnpm --filter @lararium/node build" :
  false;

describe.skipIf(skipReason)(`a session surface on the real island kernel${skipReason ? ` [SKIPPED: ${skipReason}]` : ""}`, () => {
  test("the kernel boots TW5 from the view's content door and the resolved slots, and leaves no store", async () => {
    const genesisBytes = loadGenesisBytes();
    const genesisDoc = automergeLoad<LarDoc>(genesisBytes);
    const coreHash = genesisDoc.blobs?.[ENGINE_CORE_ID]?.sha256 as string;
    const cas = setupCasFromGenesis(genesisDoc);
    const repo = new Repo({ peerId: "owner" as PeerId });
    const oracle = repo.import<LarDoc>(genesisBytes);
    const make = (title: string) => {
      const handle = repo.create<LarDoc>(emptyLarDoc());
      handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: `${title} body` }, "test"); });
      return handle;
    };
    const catalog = make("catalog"), canon = make("CanonTiddler"), working = make("WorkingTiddler"), plane = make("PlaneTiddler");
    canon.change((d) => { d.tiddlers["LastTiddler"] = storedLarRecord("LastTiddler", { text: "copied in the island's last breath" }, "test"); });
    catalog.change((d) => { d.tiddlers[wikiBagUri(SLUG)] = storedLarRecord(wikiBagUri(SLUG), { text: canon.url }, "test"); });

    const verdict = await resolveSurfaceRecipe({
      wikiSlug: SLUG,
      planes: { read: (which, title) => (which === "catalog" ? catalog : oracle).doc()?.tiddlers?.[title], oracleDocument: oracle.url },
      face: {
        facePlaneId: plane.url,
        planes: [{ name: "lar:///ha.ka.ba/bags/persona-synthetic", document: plane.url }],
        slotDocument: (_wiki, kind) => (kind === "working" ? working.url : null),
      },
      mayRead: () => true,
      plugins: { coreHash, islandBlobs: oracle.doc()?.blobs, lookup: () => undefined, readBytes: (cid) => readCasBlobFromFs(cid, casDirForStorage(cas.storageDir)) },
      profile: "face",
    });
    if (!verdict.ok) throw new Error(`${verdict.refusal}: ${verdict.detail}`);
    expect(verdict.recipe.pluginCids.length).toBeGreaterThan(0);                         // the floor resolved

    const pool = new VesselIslandPool({
      workerScriptUrl: ISLAND_JS, mainRepo: repo, storageRoot: cas.storageDir,
      resolvePluginCids: async () => ({ ok: true as const, pluginCids: cas.pluginCids }),
    });
    try {
      const before = readdirSync(cas.storageDir).sort();
      // `mountSurface` awaits the island's `ea`: the kernel resolved every slot and booted the engine.
      const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: verdict.recipe });
      expect(pool.tier(key)).toBe("wela");
      expect(pool.surfaceOf(key)).toMatchObject({ wikiId: wikiUri(SLUG), capabilityProfile: "face" });
      // The island's leg stands under the minted ID, and through it the island reached only its recipe's documents.
      const view = [...repo.peers].map((peer) => pool.viewOfPeer(peer)).find((v) => v !== null);
      expect(view).toBeTruthy();
      expect(view!.catalog(wikiSlotUri(SLUG, "working"))).toEqual({ ok: true, documentUrl: working.url });
      expect(view!.fetch(catalog.url).ok).toBe(false);
      // The kernel LAID the resolved slots: a copy from the wiki's canon into its working layer runs inside
      // the island, and the write reaches the owner's Repo through the view's leg.
      await pool.placeWikiVerb(key, {
        verb: "COPY", requestedBy: "test",
        args: { title: "CanonTiddler", "from-bag": wikiBagUri(SLUG), "to-bag": wikiSlotUri(SLUG, "working"), "change-id": "synthetic-gesture" },
      }, { sessionId: "session-1", generation: 0 });
      let landed = false;
      for (let i = 0; i < 150 && !landed; i++) {
        landed = working.doc()?.tiddlers?.["CanonTiddler"] !== undefined;
        if (!landed) await new Promise((r) => setTimeout(r, 20));
      }
      expect(landed).toBe(true);
      expect(canon.doc()?.tiddlers?.["WorkingTiddler"]).toBeUndefined();

      // THE ISLAND KEEPS NO STORE, so its last write must reach the owner before it goes. A second copy lands
      // inside the island and the session closes in the same breath: the kernel settles before it acks, and the
      // owner holds the write the moment the close returns, with no wait here.
      await pool.placeWikiVerb(key, {
        verb: "COPY", requestedBy: "test",
        args: { title: "LastTiddler", "from-bag": wikiBagUri(SLUG), "to-bag": wikiSlotUri(SLUG, "working"), "change-id": "last-gesture" },
      }, { sessionId: "session-1", generation: 0 });
      const closed = await pool.closeSession("session-1");
      // The owner confirmed it holds what the island wrote before the island went: the close reads settled.
      expect(closed).toEqual([{ wikiId: key, acked: true, settled: true }]);
      expect(working.doc()?.tiddlers?.["LastTiddler"]).toBeDefined();
      expect(pool.has(key)).toBe(false);
      await expect(pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-b", recipe: verdict.recipe })).rejects.toThrow("session-ended");
      // A session island holds an ephemeral replica: the mount laid nothing on disk.
      expect(readdirSync(cas.storageDir).sort()).toEqual(before);

      // CONTROL: the same island through the wiki door takes a store under the same root.
      expect(readdirSync(cas.storageDir).sort()).toEqual(before);
      await pool.mountWiki(wikiUri("outside"), { coreHash, recipe: { wikiSlug: "outside" }, grants: { islandUrl: oracle.url, wikiUrl: canon.url } });
      expect(readdirSync(cas.storageDir).length).toBeGreaterThan(before.length);
    } finally {
      await pool.disposeAll();
      await repo.shutdown();
      cas.cleanup();
    }
  }, TIMEOUT);
});
