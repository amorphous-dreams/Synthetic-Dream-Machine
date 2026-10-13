/**
 * surface-mount-vessel-path.test — a session surface mounted through the node vessel's own parts.
 *
 * The mesh vectors prove the resolver, the view and the pool's key over an in-thread island. This suite walks
 * the VESSEL path: a real Repo, a real filesystem content store read by `readCasBlobFromFs`, a real Crossroads
 * board read by `nodeOfferingLookup`, the node `VesselIslandPool`, and a real `worker_threads` island that
 * stands a stock Repo on the port its manifest carried.
 *
 * Proven here:
 *   · a recipe that names an offering resolves through the vessel path: the island's manifest carries the
 *     floor and the offering's verified, byte-checked plugin, and a recipe that names none carries the floor;
 *   · the contract's first test, from inside a real island: its own layers arrive, another face's working
 *     layer and the vessel's catalog never do, a bag takes no write, and the island holds no store;
 *   · the two asked gates answer a real island from its own view;
 *   · two same-face sessions stand two real islands over the one Repo.
 *
 * The modules under test stay out of the mesh barrel until a production caller mounts a surface, so this suite
 * reads them at their source.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import {
  ENGINE_CORE_ID, LARES_BAG, computePluginsCid, emptyLarDoc, hex, pluginOfferingAnnounceOf, pluginOfferingCid, recipeRecordFields,
  recipeUri, sha256HexBytesSync, signPluginOffering, storedLarRecord, wikiBagUri, wikiUri,
  type LarDoc, type OfferedBlob, type PluginOffering, type WikiRecipe,
} from "@lararium/mesh";
import { resolveSurfaceRecipe, type SurfaceRecipe } from "../../lararium-mesh/src/surface-recipe.js";
import { casDirForStorage, readCasBlobFromFs } from "../src/node-cas.js";
import { nodeOfferingLookup } from "../src/node-plugin-resolution.js";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { setCasDoor, setCustodyWriteDoor, setRestDoor } from "../src/worker-handle.js";

const PROBE_URL = new URL("./fixtures/session-island-probe.mjs", import.meta.url);
const SLUG = "table";
const WIKI = wikiUri(SLUG);
const SHARED_BAG = "lar:///ha.ka.ba/bags/elyncia";
const GRAMMAR_ID = "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext";
const SEED = new Uint8Array(32).fill(44);

let storageDir: string;
let repo: Repo;
let pool: VesselIslandPool;
beforeEach(() => {
  storageDir = mkdtempSync(join(tmpdir(), "surface-vessel-path-"));
  repo = new Repo({ peerId: "owner" as PeerId });
});
afterEach(async () => {
  await pool?.disposeAll();
  await repo?.shutdown();
  rmSync(storageDir, { recursive: true, force: true });
});

/** Write real bytes into the vessel's content store under their own address. */
function putBlob(bytes: Uint8Array): string {
  const casDir = casDirForStorage(storageDir);
  const cid = sha256HexBytesSync(bytes);
  mkdirSync(casDir, { recursive: true });
  writeFileSync(join(casDir, cid), bytes);
  return cid;
}

async function vessel() {
  const doc = (title: string): DocHandle<LarDoc> => {
    const handle = repo.create<LarDoc>(emptyLarDoc());
    handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: `${title} body` }, "test"); });
    return handle;
  };
  const oracle = doc("oracle"), catalog = doc("catalog"), crossroads = repo.create<LarDoc>(emptyLarDoc());
  const canon = doc("canon"), shared = doc("shared"), lares = doc("lares");
  const faces = {
    player:  { plane: doc("player-plane"),  working: doc("player-working"),  draft: doc("player-draft"),  personal: doc("player-personal") },
    referee: { plane: doc("referee-plane"), working: doc("referee-working"), draft: doc("referee-draft"), personal: doc("referee-personal") },
  };
  const point = (handle: DocHandle<LarDoc>, title: string, url: string): void => {
    handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: url }, "test"); });
  };
  point(catalog, wikiBagUri(SLUG), canon.url);
  point(catalog, SHARED_BAG, shared.url);
  point(oracle, LARES_BAG, lares.url);

  // The fixed floor: the grammar's bytes rest in the content store, and the oracle document names them.
  const grammarCid = putBlob(new TextEncoder().encode(JSON.stringify({ title: GRAMMAR_ID })));
  const coreCid = putBlob(new TextEncoder().encode("the engine core"));
  const islandBlobs = {
    core:    { id: ENGINE_CORE_ID, sha256: coreCid,    mimeType: "application/javascript" },
    grammar: { id: GRAMMAR_ID,     sha256: grammarCid, mimeType: "application/json" },
  };

  // One signed offering, announced on the Crossroads board, its plugin's bytes in the content store.
  const offeredCid = putBlob(new TextEncoder().encode(JSON.stringify({ title: "$:/plugins/synthetic/highlight" })));
  const blob: OfferedBlob = {
    id: "$:/plugins/synthetic/highlight", version: "0.9.0", sha256: offeredCid,
    provenance: { source: "https://example.invalid/synthetic", commit: "0000000", path: "plugins/highlight", licence: "BSD-3-Clause", author: "a synthetic author" },
  };
  const offering: PluginOffering = await signPluginOffering(
    { offeror: hex(await ed.getPublicKeyAsync(SEED)), pluginsCid: computePluginsCid([blob]), blobs: [blob] },
    async (bytes) => hex(await ed.signAsync(bytes, SEED)),
  );
  const offeringCid = pluginOfferingCid(offering);
  const announce = pluginOfferingAnnounceOf(offering);
  const announceKey = `lar:///ha.ka.ba/dreamnet/plugin-offering-announces/${encodeURIComponent(announce.offeringCid)}`;
  crossroads.change((d) => { d.tiddlers[announceKey] = storedLarRecord(announceKey, { text: JSON.stringify(announce) }, "plugin-offering"); });

  const writeRecipe = (recipe: WikiRecipe): void => {
    const title = recipeUri("catalog", recipe.wikiSlug);
    catalog.change((d) => { d.tiddlers[title] = storedLarRecord(title, recipeRecordFields(recipe), "test"); });
  };
  const resolve = async (who: "player" | "referee"): Promise<SurfaceRecipe> => {
    const held = faces[who];
    const verdict = await resolveSurfaceRecipe({
      wikiSlug: SLUG,
      planes: { read: (plane, title) => (plane === "catalog" ? catalog : oracle).doc()?.tiddlers?.[title], oracleDocument: oracle.url },
      face: {
        facePlaneId: held.plane.url,
        planes: [{ name: `lar:///ha.ka.ba/bags/persona-${who}`, document: held.plane.url }],
        slotDocument: (wikiId, kind) => (wikiId === WIKI ? held[kind].url : null),
      },
      mayRead: () => true,
      // THE VESSEL'S OWN PLUGIN INPUTS: the Crossroads board's lookup and the filesystem content store.
      plugins: {
        coreHash: coreCid, islandBlobs,
        lookup: nodeOfferingLookup(crossroads.doc()),
        readBytes: (cid) => readCasBlobFromFs(cid, casDirForStorage(storageDir)),
      },
      profile: "face",
    });
    if (!verdict.ok) throw new Error(`${verdict.refusal}: ${verdict.detail}`);
    return verdict.recipe;
  };
  // The islands' storage root stands beside the content store, as `casDirForStorage` lays it.
  pool = new VesselIslandPool({
    workerScriptUrl: PROBE_URL, mainRepo: repo, storageRoot: storageDir,
    resolvePluginCids: async () => ({ ok: true as const, pluginCids: [] }),
  });
  // A placement names the session it acts for; the pool passes it only to that session's own island.
  const probe = (key: string, verb: string, args: Record<string, unknown> = {}) => {
    const surface = pool.surfaceOf(key);
    return pool.placeWikiVerb(key, { verb, args, requestedBy: "test" }, surface ? { sessionId: surface.sessionId, generation: surface.generation } : undefined);
  };
  return { oracle, catalog, canon, shared, lares, faces, writeRecipe, resolve, probe, grammarCid, coreCid, offeredCid, offeringCid };
}

describe("a session surface through the node vessel's own parts", () => {
  test("a recipe that names an offering resolves through the vessel path into the island's manifest", async () => {
    const v = await vessel();
    v.writeRecipe({ wikiSlug: SLUG, libraryBags: [SHARED_BAG], pluginOfferings: [v.offeringCid] });
    const recipe = await v.resolve("player");
    expect(recipe.pluginCids).toEqual([v.grammarCid, v.offeredCid]);
    const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const seen = await v.probe(key, "manifest");
    expect(seen["pluginCids"]).toEqual([v.grammarCid, v.offeredCid]);
    expect(seen["coreHash"]).toBe(v.coreCid);
    expect(seen["resolved"]).toMatchObject({ [SHARED_BAG]: v.shared.url, [wikiBagUri(SLUG)]: v.canon.url });
    // A session island holds an ephemeral replica: the node host would grant a store, and the surface took none.
    expect(seen["storage"]).toBeNull();
    expect(seen["catalogUrl"]).toBeNull();
    expect(seen["view"]).toEqual({ peerId: expect.stringMatching(/^session-island-/) });

    // CONTROL: a recipe that names no offering mounts the floor alone, under another key.
    v.writeRecipe({ wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const plain = await v.resolve("player");
    const plainKey = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: plain });
    expect(plainKey).not.toBe(key);
    expect((await v.probe(plainKey, "manifest"))["pluginCids"]).toEqual([v.grammarCid]);
    // And an offering whose bytes left the content store refuses the mount by name.
    v.writeRecipe({ wikiSlug: SLUG, pluginOfferings: [v.offeringCid] });
    rmSync(join(casDirForStorage(storageDir), v.offeredCid));
    await expect(v.resolve("player")).rejects.toThrow(/plugins-refused.*missing-bytes/);
  });

  test("the contract's first test, from inside a real island", async () => {
    const v = await vessel();
    v.writeRecipe({ wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await v.resolve("player") });
    // CONTROL FIRST: the island's own working layer and a bag its recipe composes both arrive.
    expect(await v.probe(key, "find", { url: v.faces.player.working.url })).toEqual({ found: true, titles: ["player-working"] });
    expect(await v.probe(key, "find", { url: v.shared.url })).toEqual({ found: true, titles: ["shared"] });
    // Another face's working layer and plane, and the vessel's catalog: no byte, no name.
    for (const beyond of [v.faces.referee.working, v.faces.referee.plane, v.catalog]) {
      expect(await v.probe(key, "find", { url: beyond.url })).toEqual({ found: false, titles: [] });
    }
    // The island writes its working layer, and the owner's Repo holds the write.
    await v.probe(key, "write", { url: v.faces.player.working.url, title: "edit" });
    const landed = async (handle: DocHandle<LarDoc>): Promise<boolean> => {
      for (let i = 0; i < 100; i++) {
        if (handle.doc()?.tiddlers?.["edit"] !== undefined) return true;
        await new Promise((r) => setTimeout(r, 20));
      }
      return false;
    };
    expect(await landed(v.faces.player.working)).toBe(true);
    // A bag takes no write from a session island.
    await v.probe(key, "write", { url: v.shared.url, title: "edit" });
    await new Promise((r) => setTimeout(r, 400));
    expect(v.shared.doc()?.tiddlers?.["edit"]).toBeUndefined();
  });

  test("KNOWN POSITIVE: an island mounted through the wiki door reads another face's working layer and the catalog", async () => {
    const v = await vessel();
    await pool.mountWiki(WIKI, { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } });
    expect(await v.probe(WIKI, "find", { url: v.faces.referee.working.url })).toEqual({ found: true, titles: ["referee-working"] });
    expect((await v.probe(WIKI, "find", { url: v.catalog.url }))["found"]).toBe(true);
    expect((await v.probe(WIKI, "manifest"))["storage"]).not.toBeNull();
  });

  test("a session island takes none of the vessel's own doors", async () => {
    const v = await vessel();
    v.writeRecipe({ wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const reached: string[] = [];
    // Every door stands, each recording what reaches it.
    setCasDoor(async (cid) => { reached.push(`cas:${cid}`); return new Uint8Array([7, 7, 7]); });
    setRestDoor(async (ids) => { reached.push(`rest:${ids.join(",")}`); });
    setCustodyWriteDoor(async (carrier) => { reached.push(`custody:${carrier}`); });
    try {
      const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await v.resolve("player") });
      const asks = [
        { type: "cas:want", fields: { cid: "ab".repeat(32) } },
        { type: "doc:rest", fields: { documentIds: [v.faces.referee.working.documentId] } },
        { type: "custody:write", fields: { carrier: "archive", bytes: new Uint8Array([1, 2, 3]) } },
      ];
      for (const ask of asks) expect(await v.probe(key, "door", ask)).toEqual({ answered: false });
      expect(reached).toEqual([]);
      // KNOWN POSITIVE: the same asks from an island mounted through the wiki door each draw an answer. A wiki
      // island reaches the FETCH door alone; its rest ask and its custody write refuse by name and reach no door
      // (the daemon island alone reaches those two: `island-doors-by-class.test.ts`).
      await pool.mountWiki(WIKI, { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } });
      expect(await v.probe(WIKI, "door", asks[0]!)).toEqual({ answered: true, type: "cas:block", bytes: 3 });
      expect(await v.probe(WIKI, "door", asks[1]!)).toMatchObject({ answered: true, type: "doc:rested" });
      expect(await v.probe(WIKI, "door", asks[2]!)).toMatchObject({ answered: true, type: "custody:written" });
      expect(reached).toEqual([`cas:${"ab".repeat(32)}`]);
    } finally {
      setCasDoor(null); setRestDoor(null); setCustodyWriteDoor(null);
    }
  });

  test("the two asked gates answer a real island from its own view, and two sessions stand two islands", async () => {
    const v = await vessel();
    v.writeRecipe({ wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await v.resolve("player");
    const one = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const two = await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    expect(one).not.toBe(two);
    expect(pool.stats().wela).toBe(2);
    const peers = [(await v.probe(one, "manifest"))["view"], (await v.probe(two, "manifest"))["view"]] as { peerId: string }[];
    expect(peers[0]!.peerId).not.toBe(peers[1]!.peerId);

    expect(await v.probe(one, "catalog", { name: SHARED_BAG })).toEqual({ documentUrl: v.shared.url, refusal: null });
    expect(await v.probe(one, "catalog", { name: "lar:///ha.ka.ba/bags/persona-referee" })).toEqual({ documentUrl: null, refusal: "beyond-facets" });
    // Content: the vessel's own filesystem store answers what the view passes, and nothing it refuses.
    expect(await v.probe(one, "content", { cid: v.grammarCid })).toEqual({ ok: true, refusal: null });
    expect(await v.probe(one, "content", { cid: v.offeredCid })).toEqual({ ok: false, refusal: "beyond-facets" });   // its recipe names no offering
    expect(await v.probe(one, "content", { cid: "../cas/" + v.grammarCid })).toEqual({ ok: false, refusal: "beyond-facets" });
    // The session's end drops its island alone.
    await pool.closeSession("session-1");
    expect([pool.has(one), pool.has(two)]).toEqual([false, true]);
    expect(await v.probe(two, "find", { url: v.faces.player.working.url })).toMatchObject({ found: true });
  });
});
