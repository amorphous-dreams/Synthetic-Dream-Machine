/**
 * surface-mount.test — one recipe resolver, and the island pool's identity.
 *
 * The vessel here holds REAL documents in a REAL Repo: a catalog and an oracle plane that carry recipe records
 * and bag pointers, two faces' planes and working layers, library bags. The resolver reads those replicas; the
 * pool mounts over a host whose "worker" hands the test the island's own port, so an adversary Repo can stand
 * exactly where an island stands.
 *
 * Proven here:
 *   · the resolver returns absolute ids and a revision; the vessel's own record shadows the system default;
 *   · a recipe narrows a view and never widens a grant: an unreadable bag refuses the mount by name;
 *   · every refusal answers by name, and none reads as a narrower recipe;
 *   · a recipe that names an offering resolves its plugins, byte-checked, and a missing byte refuses;
 *   · two same-face sessions take two islands; a repeated exact mount opens one;
 *   · a recipe write reaches the next mount by sync and never changes a live mount;
 *   · a surface's island rides its scoped view, holds no store and no catalog, and the wiki door's broad port
 *     hands the same adversary the other face's working layer (the known positive);
 *   · the two asked gates answer from the island's own view;
 *   · a session's end drops its surfaces alone, and a switch fences the earlier generation;
 *   · the island key never collides, whatever its parts spell.
 */
import { describe, test, expect, afterEach } from "vitest";
import * as ed from "@noble/ed25519";
import * as A from "@automerge/automerge";
import { Repo, type AutomergeUrl, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import { hex, sha256HexBytesSync } from "../src/crypto.js";
import { ENGINE_CORE_ID, emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { CasBlobLike } from "../src/cas.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import { makeIslandRepo } from "../src/island-repo.js";
import { ISLAND_PROTOCOL_VERSION, mkEa, mkFault, mkTeardownAck, type IslandMsg_Manifest } from "../src/island-protocol.js";
import { recipeUri, wikiUri } from "../src/lar-uris.js";
import { pluginOfferingCid, signPluginOffering, type OfferedBlob, type PluginOffering } from "../src/plugin-offering.js";
import { storedLarRecord } from "../src/stored-record.js";
import {
  facetsOfSurfaceRecipe, resolveSurfaceRecipe, resolvedSlotsOf, type SurfaceFace, type SurfaceRecipe, type SurfaceRecipeInput,
} from "../src/surface-recipe.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import { SURFACE_KEY_PREFIX, SurfaceMountError, VesselIslandPoolCore, islandKey, type IslandKeyParts } from "../src/vessel-island-pool-core.js";
import { replicaHeads } from "../src/island-repo.js";
import { LARES_BAG, ORACLE_BAG, recipeRecordFields, wikiBagUri, wikiSlotUri, type WikiRecipe } from "../src/wiki-recipe.js";
import type { CapabilityProfile } from "../src/session-contract.js";

const until = async (cond: () => boolean, ms = 3000): Promise<boolean> => {
  const start = performance.now();
  while (performance.now() - start < ms) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 15));
  }
  return cond();
};
const quiet = (ms = 200): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function tryFind(repo: Repo, url: string, ms = 1500): Promise<DocHandle<LarDoc> | null> {
  const found = repo.find<LarDoc>(url as AutomergeUrl).then((h) => h, () => null);
  return Promise.race([found, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

const repos: Repo[] = [];
const pools: VesselIslandPoolCore[] = [];
afterEach(async () => {
  await Promise.all(pools.splice(0).map((p) => p.disposeAll()));
  await Promise.all(repos.splice(0).map((r) => r.shutdown().catch(() => {})));
});

const SLUG = "table";
const WIKI = wikiUri(SLUG);
const SHARED_BAG  = "lar:///ha.ka.ba/bags/elyncia";
const REFEREE_BAG = "lar:///ha.ka.ba/bags/elyncia-referee";
const LATER_BAG   = "lar:///ha.ka.ba/bags/later";

// The fixed floor every island takes, and one signed offering whose bytes hash to its own address.
const GRAMMAR_CID = "11".repeat(32);
const CORE_CID    = "33".repeat(32);
const ISLAND_BLOBS: Record<string, CasBlobLike> = {
  core:    { id: ENGINE_CORE_ID, sha256: CORE_CID, mimeType: "application/javascript" },
  grammar: { id: "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext", sha256: GRAMMAR_CID, mimeType: "application/json" },
};
const OFFERED_BYTES = new TextEncoder().encode("a plugin tiddler, offered whole");
const OFFERED_CID = sha256HexBytesSync(OFFERED_BYTES);
const SEED = new Uint8Array(32).fill(13);
async function offering(): Promise<{ offering: PluginOffering; cid: string }> {
  const blob: OfferedBlob = {
    id: "$:/plugins/synthetic/highlight", version: "0.9.0", sha256: OFFERED_CID,
    provenance: { source: "https://example.invalid/synthetic", commit: "0000000", path: "plugins/highlight", licence: "BSD-3-Clause", author: "a synthetic author" },
  };
  const signed = await signPluginOffering(
    { offeror: hex(await ed.getPublicKeyAsync(SEED)), pluginsCid: computePluginsCid([blob]), blobs: [blob] },
    async (bytes) => hex(await ed.signAsync(bytes, SEED)),
  );
  return { offering: signed, cid: pluginOfferingCid(signed) };
}

/** A vessel: its two registry planes, two faces, and the bags a table holds. */
function vessel() {
  const owner = new Repo({ peerId: "owner" as PeerId });
  repos.push(owner);
  const doc = (title: string): DocHandle<LarDoc> => {
    const handle = owner.create<LarDoc>(emptyLarDoc());
    handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: `${title} body` }, "test"); });
    return handle;
  };
  const oracle = doc("oracle"), catalog = doc("catalog");
  const canon = doc("canon"), shared = doc("shared"), referee = doc("referee"), lares = doc("lares"), later = doc("later");
  const faces = {
    player:  { plane: doc("player-plane"),  working: doc("player-working"),  draft: doc("player-draft"),  personal: doc("player-personal") },
    referee: { plane: doc("referee-plane"), working: doc("referee-working"), draft: doc("referee-draft"), personal: doc("referee-personal") },
  };
  const point = (handle: DocHandle<LarDoc>, title: string, url: string): void => {
    handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: url }, "test"); });
  };
  point(catalog, wikiBagUri(SLUG), canon.url);
  point(catalog, SHARED_BAG, shared.url);
  point(catalog, REFEREE_BAG, referee.url);
  point(oracle, LARES_BAG, lares.url);
  const writeRecipe = (plane: "catalog" | "oracle", recipe: WikiRecipe, into: DocHandle<LarDoc> = plane === "catalog" ? catalog : oracle): void => {
    const title = recipeUri(plane, recipe.wikiSlug);
    into.change((d) => { d.tiddlers[title] = storedLarRecord(title, recipeRecordFields(recipe), "test"); });
  };
  return { owner, oracle, catalog, canon, shared, referee, lares, later, faces, point, writeRecipe };
}
type Vessel = ReturnType<typeof vessel>;

function faceOf(v: Vessel, who: "player" | "referee"): SurfaceFace {
  const held = v.faces[who];
  return {
    facePlaneId: held.plane.url,
    planes: [{ name: `lar:///ha.ka.ba/bags/persona-${who}`, document: held.plane.url }],
    slotDocument: (wikiId, kind) => (wikiId === WIKI ? held[kind].url : null),
  };
}

function inputOf(v: Vessel, who: "player" | "referee", over: Partial<SurfaceRecipeInput> = {}): SurfaceRecipeInput {
  const cas = new Map<string, Uint8Array>([[OFFERED_CID, OFFERED_BYTES]]);
  return {
    wikiSlug: SLUG,
    planes: {
      read: (plane, title) => (plane === "catalog" ? v.catalog : v.oracle).doc()?.tiddlers?.[title],
      oracleDocument: v.oracle.url,
    },
    face: faceOf(v, who),
    // The grant: a player face reads everything but the referee's bag.
    mayRead: (bag) => who === "referee" || bag !== REFEREE_BAG,
    plugins: { coreHash: CORE_CID, islandBlobs: ISLAND_BLOBS, lookup: () => undefined, readBytes: (cid) => cas.get(cid) ?? null },
    profile: "face",
    ...over,
  };
}
async function resolved(input: SurfaceRecipeInput): Promise<SurfaceRecipe> {
  const verdict = await resolveSurfaceRecipe(input);
  if (!verdict.ok) throw new Error(`${verdict.refusal}: ${verdict.detail}`);
  return verdict.recipe;
}

describe("one function resolves a session's effective recipe at surface mount", () => {
  test("it returns absolute ids, top first, and a revision that names them", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG, LARES_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    expect(recipe.slots).toEqual([
      { slot: wikiSlotUri(SLUG, "temp"),     layer: "temp",     document: null },
      { slot: wikiSlotUri(SLUG, "draft"),    layer: "draft",    document: v.faces.player.draft.url },
      { slot: wikiSlotUri(SLUG, "personal"), layer: "personal", document: v.faces.player.personal.url },
      { slot: wikiSlotUri(SLUG, "working"),  layer: "working",  document: v.faces.player.working.url },
      { slot: wikiBagUri(SLUG),              layer: "canon",    document: v.canon.url },
      { slot: SHARED_BAG,                    layer: "library",  document: v.shared.url },
      { slot: LARES_BAG,                     layer: "library",  document: v.lares.url },
      { slot: ORACLE_BAG,                    layer: "oracle",   document: v.oracle.url },
    ]);
    expect(recipe).toMatchObject({ wikiId: WIKI, wikiSlug: SLUG, facePlaneId: v.faces.player.plane.url, profile: "face", coreHash: CORE_CID, pluginCids: [GRAMMAR_CID], unresolved: [] });
    expect(recipe.revision).toMatch(/^[0-9a-f]{64}$/);
    // The same inputs resolve the same revision; the resolver holds no state between two calls.
    expect((await resolved(inputOf(v, "player"))).revision).toBe(recipe.revision);
    // What the island's manifest carries, and what the session's view opens, both read off that one answer.
    expect(resolvedSlotsOf(recipe)).toEqual(Object.fromEntries(recipe.slots.filter((s) => s.document).map((s) => [s.slot, s.document])));
    const facets = facetsOfSurfaceRecipe(recipe);
    expect(facets.content).toEqual([CORE_CID, GRAMMAR_CID]);
    expect(facets.documents.map((f) => f.document).sort()).toEqual(
      [v.faces.player.draft, v.faces.player.personal, v.faces.player.working, v.canon, v.shared, v.lares, v.oracle, v.faces.player.plane].map((h) => h.url).sort());
    // The catalog document itself never joins the facets, and neither does the other face's anything.
    for (const beyond of [v.catalog, v.referee, v.faces.referee.plane, v.faces.referee.working]) {
      expect(facets.documents.map((f) => f.document)).not.toContain(beyond.url);
    }
  });

  test("the vessel's own record shadows the system default, and a tombstoned one counts as nothing", async () => {
    const v = vessel();
    v.writeRecipe("oracle", { wikiSlug: SLUG, libraryBags: [LARES_BAG] });
    const byDefault = await resolved(inputOf(v, "player"));
    expect(byDefault.recipe.libraryBags).toEqual([LARES_BAG]);
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const own = await resolved(inputOf(v, "player"));
    expect(own.recipe.libraryBags).toEqual([SHARED_BAG]);
    expect(own.revision).not.toBe(byDefault.revision);
    v.catalog.change((d) => { (d.tiddlers[recipeUri("catalog", SLUG)] as unknown as { meta: Record<string, unknown> }).meta = { deleted: true }; });
    expect((await resolved(inputOf(v, "player"))).recipe.libraryBags).toEqual([LARES_BAG]);
  });

  test("a recipe narrows a view and never widens a grant", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [REFEREE_BAG, SHARED_BAG] });
    // The referee face holds the grant: its session mounts both bags.
    const referee = await resolved(inputOf(v, "referee"));
    expect(referee.slots.map((s) => s.slot)).toContain(REFEREE_BAG);                    // control
    // A player face wearing the SAME recipe refuses by the bag's name: nothing mounts by leaving a grant unasked.
    expect(await resolveSurfaceRecipe(inputOf(v, "player"))).toEqual({ ok: false, refusal: "bag-unreadable", detail: REFEREE_BAG });
    // The grant gets asked about every bag the recipe lays, the wiki's own canon among them, and about no slot of the face's own.
    const asked: string[] = [];
    await resolved(inputOf(v, "referee", { mayRead: (bag) => { asked.push(bag); return true; } }));
    expect(asked.sort()).toEqual([REFEREE_BAG, SHARED_BAG, wikiBagUri(SLUG)].sort());
    // Self-blinding: a player composes a players-only recipe over bags her face may read, and it mounts.
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const player = await resolved(inputOf(v, "player"));
    expect(player.slots.map((s) => s.slot)).not.toContain(REFEREE_BAG);
    expect(facetsOfSurfaceRecipe(player).documents.map((f) => f.document)).not.toContain(v.referee.url);
  });

  test("every refusal answers by name", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const refusal = async (over: Partial<SurfaceRecipeInput>) => {
      const verdict = await resolveSurfaceRecipe(inputOf(v, "player", over));
      return verdict.ok ? "resolved" : verdict.refusal;
    };
    expect(await refusal({})).toBe("resolved");                                               // control
    expect(await refusal({ profile: "root" as CapabilityProfile })).toBe("profile-unknown");
    expect(await refusal({ wikiSlug: "nobody-founded-this" })).toBe("wiki-unknown");
    // A `bag-stack` that stands and fails to read refuses: it never lays the recipe with its bags missing.
    const torn = recipeUri("catalog", SLUG);
    const whole = structuredClone(JSON.parse(JSON.stringify(v.catalog.doc()!.tiddlers[torn])));
    v.catalog.change((d) => { (d.tiddlers[torn] as unknown as { tiddler: Record<string, unknown> }).tiddler["bag-stack"] = [SHARED_BAG] as unknown as string; });
    expect(await refusal({})).toBe("recipe-malformed");
    v.catalog.change((d) => { delete (d.tiddlers[torn] as unknown as { tiddler: Record<string, unknown> }).tiddler["bag-stack"]; });
    expect(await refusal({})).toBe("recipe-malformed");                                   // a stack torn away refuses too
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    expect(whole).toBeTruthy();
    expect(await refusal({})).toBe("resolved");
    expect(await refusal({ face: { ...faceOf(v, "player"), facePlaneId: "" } })).toBe("face-malformed");
    expect(await refusal({ planes: { ...inputOf(v, "player").planes, oracleDocument: "not-an-address" } })).toBe("floor-unresolved");
    // One document under two layers: the face's working layer pointed at the shared bag's document.
    expect(await refusal({ face: { ...faceOf(v, "player"), slotDocument: (_w, kind) => (kind === "working" ? v.shared.url : null) } })).toBe("document-in-two-layers");
    expect(await refusal({ face: { ...faceOf(v, "player"), planes: [{ name: "lar:///persona", document: v.canon.url }] } })).toBe("document-in-two-layers");
    expect(await refusal({ face: { ...faceOf(v, "player"), planes: [{ name: "lar:///persona", document: "torn" }] } })).toBe("document-malformed");
    // A torn offerings field refuses the mount, and never reads as a recipe with no plugins.
    v.catalog.change((d) => { (d.tiddlers[recipeUri("catalog", SLUG)] as unknown as { tiddler: Record<string, unknown> }).tiddler["plugin-offerings"] = 7 as unknown as string; });
    expect(await refusal({})).toBe("plugins-refused");
  });

  test("a recipe that names an offering resolves its plugins, and a missing byte refuses", async () => {
    const v = vessel();
    const gift = await offering();
    v.writeRecipe("catalog", { wikiSlug: SLUG, pluginOfferings: [gift.cid] });
    const lookup = (cid: string): PluginOffering | undefined => (cid === gift.cid ? gift.offering : undefined);
    const base = inputOf(v, "player");
    const withGift = await resolved({ ...base, plugins: { ...base.plugins, lookup } });
    expect(withGift.pluginCids).toEqual([GRAMMAR_CID, OFFERED_CID]);
    expect(facetsOfSurfaceRecipe(withGift).content).toEqual([CORE_CID, GRAMMAR_CID, OFFERED_CID]);
    // The same recipe with the offering unknown, or with its bytes absent from the content store, refuses.
    expect(await resolveSurfaceRecipe(base)).toMatchObject({ ok: false, refusal: "plugins-refused" });
    expect(await resolveSurfaceRecipe({ ...base, plugins: { ...base.plugins, lookup, readBytes: async () => null } })).toMatchObject({ ok: false, refusal: "plugins-refused" });
    // A recipe that names none takes the floor alone, under another revision.
    v.writeRecipe("catalog", { wikiSlug: SLUG });
    const plain = await resolved({ ...base, plugins: { ...base.plugins, lookup } });
    expect(plain.pluginCids).toEqual([GRAMMAR_CID]);
    expect(plain.revision).not.toBe(withGift.revision);
  });

  test("a library no plane resolves yet stands named, and its arrival moves the revision", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [LATER_BAG] });
    const before = await resolved(inputOf(v, "player"));
    expect(before.unresolved).toEqual([LATER_BAG]);
    expect(before.slots.find((s) => s.slot === LATER_BAG)).toEqual({ slot: LATER_BAG, layer: "library", document: null });
    v.point(v.catalog, LATER_BAG, v.later.url);
    const after = await resolved(inputOf(v, "player"));
    expect(after.unresolved).toEqual([]);
    expect(after.revision).not.toBe(before.revision);
    // The same NAME pointed at another document reads as another recipe: the revision names what a mount lays.
    v.point(v.catalog, LATER_BAG, v.referee.url);
    const moved = await resolved(inputOf(v, "referee"));
    v.point(v.catalog, LATER_BAG, v.later.url);
    const back = await resolved(inputOf(v, "referee"));
    expect(moved.slots.map((s) => s.slot)).toEqual(back.slots.map((s) => s.slot));       // the setup took: same slots
    expect(moved.revision).not.toBe(back.revision);
  });

  test("two faces of one wiki resolve two recipes", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const player = await resolved(inputOf(v, "player")), referee = await resolved(inputOf(v, "referee"));
    expect(player.revision).not.toBe(referee.revision);
    expect(player.facePlaneId).not.toBe(referee.facePlaneId);
    const reach = (r: SurfaceRecipe): string[] => facetsOfSurfaceRecipe(r).documents.map((f) => f.document);
    expect(reach(player)).not.toContain(v.faces.referee.working.url);
    expect(reach(referee)).not.toContain(v.faces.player.working.url);
    expect(reach(player)).toContain(v.shared.url);                                            // sharing happens at the bag
    expect(reach(referee)).toContain(v.shared.url);
  });
});

// ── The pool ────────────────────────────────────────────────────────────────────────────────────

interface FakeIsland { manifest: IslandMsg_Manifest; posted: unknown[]; reply(msg: unknown): void; terminated: boolean }
interface HostOptions {
  fault?: (m: IslandMsg_Manifest) => boolean;
  /** Hold each island's `ea` until the test sends it. */
  holdEa?: boolean;
  /** Hold each island's teardown ack until the test sends it. */
  holdAck?: boolean;
}
/** A host whose worker keeps the manifest it received (its port included) and answers `ea`. */
function islandHost(opts: HostOptions = {}): { host: VesselIslandHost; islands: FakeIsland[] } {
  const islands: FakeIsland[] = [];
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      const listeners = new Set<(raw: unknown) => void>();
      const island: FakeIsland = { manifest: null as unknown as IslandMsg_Manifest, posted: [], reply: (msg) => { for (const l of [...listeners]) l(msg); }, terminated: false };
      islands.push(island);
      return {
        post: (msg: unknown) => {
          island.posted.push(msg);
          const type = (msg as { type?: string } | null)?.type;
          if (type === "manifest") {
            island.manifest = msg as IslandMsg_Manifest;
            const fail = opts.fault?.(island.manifest) ?? false;
            if (!opts.holdEa) queueMicrotask(() => island.reply(fail ? mkFault(island.manifest.wikiUri, "synthetic fault") : mkEa(island.manifest.wikiUri)));
          }
          if (type === "teardown" && !opts.holdAck) queueMicrotask(() => island.reply(mkTeardownAck()));
        },
        listen: (h) => { listeners.add(h); return () => { listeners.delete(h); }; },
        onError: () => () => {},
        terminate: () => { island.terminated = true; },
      };
    },
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    // The host WOULD hand every island a durable store and the pool holds a disk grant: a surface takes neither.
    storage: (wikiId) => ({ type: "nodefs", dir: `/nonexistent/${wikiId.length}` }),
  };
  return { host, islands };
}
/** Every address the pool asked the vessel's content store for. */
const storeAsked: string[] = [];
function poolOver(v: Vessel, opts: HostOptions = {}) {
  const { host, islands } = islandHost(opts);
  storeAsked.length = 0;
  const pool = new VesselIslandPoolCore({
    host, mainRepo: v.owner, resolvePluginCids: async () => ({ ok: true as const, pluginCids: [] }),
    // The store holds the offered plugin whole, holds CORRUPT bytes under the grammar's address, and lacks the core.
    readContent: (cid) => { storeAsked.push(cid); return cid === OFFERED_CID ? OFFERED_BYTES : cid === GRAMMAR_CID ? new Uint8Array([1, 2, 3]) : null; },
    diskMirrorGrant: [{ bagId: SHARED_BAG, mirrorRoot: "/nonexistent/mirror", scope: "@test" }],
    maxMountFailures: 2,
  });
  pools.push(pool);
  return { pool, islands };
}
/** Stand an adversary Repo where the island stands: on the manifest's own port, under the ID the manifest names. */
function standIsland(island: FakeIsland): Repo {
  const repo = makeIslandRepo({ syncPort: island.manifest.syncPort, ...(island.manifest.view ? { peerId: island.manifest.view.peerId } : {}) });
  repos.push(repo);
  return repo;
}
const ask = (island: FakeIsland, msg: Record<string, unknown>): Record<string, unknown> => {
  const before = island.posted.length;
  island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, ...msg });
  return island.posted[before] as Record<string, unknown>;
};

describe("the island pool keys by the whole session key", () => {
  test("two same-face sessions take two islands, and a repeated exact mount opens one", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v);
    const first = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const second = await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    expect(first).not.toBe(second);
    expect(islands.length).toBe(2);                                                      // two writers, two islands
    expect(islands[0]!.manifest.view!.peerId).not.toBe(islands[1]!.manifest.view!.peerId);
    // The exact mount again, eight at once and once more after: still the one island.
    const again = await Promise.all(Array.from({ length: 8 }, () => pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe })));
    expect(new Set(again)).toEqual(new Set([first]));
    expect(await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe })).toBe(first);
    expect(islands.length).toBe(2);
    // Every other part of the key opens another island: a second surface, a later generation, another profile.
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-b", recipe });
    await pool.mountSurface({ sessionId: "session-1", generation: 1, surfaceId: "surface-a", recipe });
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await resolved(inputOf(v, "player", { profile: "seat" })) });
    expect(islands.length).toBe(5);
    expect(pool.surfaceOf(first)).toEqual({
      sessionId: "session-1", generation: 0, surfaceId: "surface-a", wikiId: WIKI,
      facePlaneId: v.faces.player.plane.url, recipeRevision: recipe.revision, capabilityProfile: "face",
    });
  });

  test("KNOWN POSITIVE: the wiki door keys by wiki alone, so two sessions' mounts of one wiki fold into one island", async () => {
    const v = vessel();
    const { pool, islands } = poolOver(v);
    const spec = { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } };
    await pool.mountWiki(WIKI, spec);                                                    // the first tab
    await pool.mountWiki(WIKI, spec);                                                    // a second tab, a second writer
    expect(islands.length).toBe(1);
  });

  test("a recipe write reaches the next mount by sync and never changes a live mount", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const { pool, islands } = poolOver(v);
    const firstRecipe = await resolved(inputOf(v, "player"));
    const live = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: firstRecipe });
    const liveManifest = structuredClone({ ...islands[0]!.manifest, syncPort: undefined });
    const posted = islands[0]!.posted.length;

    // ANOTHER vessel of the same operator writes the recipe; sync alone carries it to this owner.
    const { port1, port2 } = new MessageChannel();
    const { MessageChannelNetworkAdapter } = await import("@automerge/automerge-repo-network-messagechannel");
    v.owner.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
    const elsewhere = new Repo({ peerId: "elsewhere" as PeerId, network: [new MessageChannelNetworkAdapter(port2)] });
    repos.push(elsewhere);
    const remoteCatalog = (await tryFind(elsewhere, v.catalog.url))!;
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG, LARES_BAG] }, remoteCatalog);
    const title = recipeUri("catalog", SLUG);
    expect(await until(() => String(JSON.stringify(v.catalog.doc()?.tiddlers?.[title])).includes(LARES_BAG))).toBe(true);   // the write arrived by sync

    // The live island heard nothing: no message after its manifest, and its manifest reads as it did.
    await quiet();
    expect(islands[0]!.posted.length).toBe(posted);
    expect({ ...islands[0]!.manifest, syncPort: undefined }).toEqual(liveManifest);
    expect(pool.has(live)).toBe(true);
    // The NEXT mount reads the write: a new revision, a new key, a new island that lays the new bag.
    const nextRecipe = await resolved(inputOf(v, "player"));
    expect(nextRecipe.revision).not.toBe(firstRecipe.revision);
    const next = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: nextRecipe });
    expect(next).not.toBe(live);
    expect(islands.length).toBe(2);
    expect(islands[1]!.manifest.resolved![LARES_BAG]).toBe(v.lares.url);
    expect(islands[0]!.manifest.resolved![LARES_BAG]).toBeUndefined();
    expect(pool.has(live)).toBe(true);                                                   // the live mount still stands
  });

  test("a surface's island takes a resolved manifest: a view, no store, no catalog, no mirror", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v);
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const manifest = islands[0]!.manifest;
    expect(manifest.wikiUri).toBe(WIKI);
    expect(manifest.view).toEqual({ peerId: expect.stringMatching(/^session-island-/) });
    expect(manifest.resolved).toEqual(resolvedSlotsOf(recipe));
    expect(manifest.grants).toEqual({ islandUrl: v.oracle.url });
    expect(manifest.storage).toBeUndefined();
    expect(manifest.diskMirrors).toBeUndefined();
    expect(manifest.pluginCids).toEqual([GRAMMAR_CID]);
    expect(manifest.coreHash).toBe(CORE_CID);
    // A recipe that DESIGNATES a bag the pool may mirror still mounts a surface with no mirror: the disk
    // reaches a wiki through a session that leases it, and never through another session's island.
    await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe: { ...recipe, recipe: { ...recipe.recipe, mirrorBags: [SHARED_BAG] } } });
    expect(islands[1]!.manifest.recipe.mirrorBags).toEqual([SHARED_BAG]);                // the setup took
    expect(islands[1]!.manifest.diskMirrors).toBeUndefined();
    // CONTROL: the wiki door, over the same host, hands its island the store and the mirror the surface went without.
    await pool.mountWiki("lar:///ha.ka.ba/wikis/outside", { coreHash: null, recipe: { wikiSlug: "outside", mirrorBags: [SHARED_BAG] }, grants: { islandUrl: v.oracle.url, catalogUrl: v.catalog.url } });
    expect(islands[2]!.manifest.storage).toBeDefined();
    expect(islands[2]!.manifest.diskMirrors?.length).toBe(1);
    expect(islands[2]!.manifest.view).toBeUndefined();
  });

  test("the island rides its scoped view: its own layers read and write, another face's cross as no byte", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const { pool, islands } = poolOver(v);
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await resolved(inputOf(v, "player")) });
    const island = standIsland(islands[0]!);
    const own = await tryFind(island, v.faces.player.working.url);
    expect(own).not.toBeNull();                                                          // control: its own layer reads
    own!.change((d) => { d.tiddlers["edit"] = storedLarRecord("edit", { text: "from the island" }, "test"); });
    expect(await until(() => v.faces.player.working.doc()?.tiddlers?.["edit"] !== undefined)).toBe(true);   // and writes
    for (const beyond of [v.faces.referee.working, v.faces.referee.plane, v.referee, v.catalog]) {
      expect(await tryFind(island, beyond.url, 700)).toBeNull();
    }
    // A bag reaches the session read-only.
    const sharedCopy = (await tryFind(island, v.shared.url))!;
    sharedCopy.change((d) => { d.tiddlers["edit"] = storedLarRecord("edit", { text: "from the island" }, "test"); });
    await quiet(300);
    expect(v.shared.doc()?.tiddlers?.["edit"]).toBeUndefined();
    expect(pool.viewOfPeer(islands[0]!.manifest.view!.peerId)?.fetch(v.faces.referee.working.url).ok).toBe(false);
    expect(pool.viewOfPeer("some-other-peer")).toBeNull();
  });

  test("KNOWN POSITIVE: the wiki door's broad port hands the same adversary another face's working layer and the catalog", async () => {
    const v = vessel();
    const { pool, islands } = poolOver(v);
    await pool.mountWiki(WIKI, { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } });
    const island = standIsland(islands[0]!);
    expect(await tryFind(island, v.faces.referee.working.url)).not.toBeNull();
    expect(await tryFind(island, v.catalog.url)).not.toBeNull();
  });

  test("the two asked gates answer from the island's own view", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const { pool, islands } = poolOver(v);
    const references = (documentId: string, cid: string): boolean =>
      documentId === v.shared.documentId && (cid === OFFERED_CID || cid === "../../identity/seed");
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await resolved(inputOf(v, "player")), referencesContent: references });
    await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe: await resolved(inputOf(v, "referee")) });
    await pool.mountWiki("lar:///ha.ka.ba/wikis/outside", { coreHash: null, recipe: { wikiSlug: "outside" }, grants: { islandUrl: v.oracle.url } });
    const [player, referee, outside] = islands as [FakeIsland, FakeIsland, FakeIsland];
    const refereePlane = "lar:///ha.ka.ba/bags/persona-referee";
    expect(ask(player, { type: "view:catalog", requestId: "q1", name: SHARED_BAG }))
      .toEqual({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:catalog-result", requestId: "q1", documentUrl: v.shared.url });
    expect(ask(player, { type: "view:catalog", requestId: "q2", name: refereePlane }))
      .toEqual({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:catalog-result", requestId: "q2", documentUrl: null, refusal: "beyond-facets" });
    expect(ask(referee, { type: "view:catalog", requestId: "q3", name: refereePlane })).toMatchObject({ documentUrl: v.faces.referee.plane.url });   // control
    // Content: the view decides, then the vessel's own store answers with bytes that recompute to the address.
    const content = async (island: FakeIsland, requestId: string, cid: string): Promise<Record<string, unknown>> => {
      island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:content", requestId, cid });
      expect(await until(() => island.posted.some((m) => (m as { requestId?: string }).requestId === requestId))).toBe(true);
      return island.posted.find((m) => (m as { requestId?: string }).requestId === requestId) as Record<string, unknown>;
    };
    expect(await content(player, "q4", OFFERED_CID)).toEqual({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:content-result", requestId: "q4", bytes: OFFERED_BYTES });
    expect(await content(player, "q5", "cid-nobody-holds")).toMatchObject({ bytes: null, refusal: "beyond-facets" });
    // The referee's mount named no reader, so the same address opens nothing for it: no reader, no reference.
    expect(await content(referee, "q6", OFFERED_CID)).toMatchObject({ bytes: null, refusal: "beyond-facets" });
    // An address the view passes whose bytes the store lacks, or holds corrupt, answers as absent; neither leaves.
    expect(await content(player, "q7", CORE_CID)).toMatchObject({ bytes: null, refusal: "content-absent" });
    expect(await content(player, "q7b", GRAMMAR_CID)).toMatchObject({ bytes: null, refusal: "content-absent" });
    expect(storeAsked).toEqual([OFFERED_CID, CORE_CID, GRAMMAR_CID]);                    // a refused address never reached the store
    // A string that names a path reaches no store, even when a document the session may read spells it.
    expect(await content(player, "q7c", "../../identity/seed")).toMatchObject({ bytes: null, refusal: "beyond-facets" });
    expect(storeAsked.length).toBe(3);
    // An island outside any session holds no view: it draws that name, never another island's answer.
    expect(ask(outside, { type: "view:catalog", requestId: "q8", name: SHARED_BAG })).toMatchObject({ documentUrl: null, refusal: "view-absent" });
    expect(await content(outside, "q9", OFFERED_CID)).toMatchObject({ bytes: null, refusal: "view-absent" });
  });

  test("a session's end drops its surfaces alone, and a switch fences the earlier generation", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v);
    const a0 = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const b0 = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-b", recipe });
    const a1 = await pool.mountSurface({ sessionId: "session-1", generation: 1, surfaceId: "surface-a", recipe });
    const other = await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    const island = standIsland(islands[0]!);
    expect(await tryFind(island, v.faces.player.working.url)).not.toBeNull();            // control: the lease stood
    const peerId = islands[0]!.manifest.view!.peerId;
    const view = pool.viewOfPeer(peerId)!;
    expect(view.fetch(v.faces.player.working.url)).toEqual({ ok: true });                // control: the view stood open
    await quiet();

    // The switch's third step: the old generation's surfaces dispose and their scoped channels close.
    const fenced = await pool.fenceSession("session-1", 1);
    expect(fenced.map((f) => f.wikiId).sort()).toEqual([a0, b0].sort());
    expect([pool.has(a0), pool.has(b0), pool.has(a1), pool.has(other)]).toEqual([false, false, true, true]);
    expect(pool.tier(a0)).toBeNull();                                                    // the lease dropped: nothing cools for a later reference
    expect(await pool.ensureWiki(a0)).toBe(false);
    expect(pool.viewOfPeer(peerId)).toBeNull();
    expect(view.closed).toBe(true);                                                      // the scoped channel closed with its island
    expect(view.fetch(v.faces.player.working.url)).toEqual({ ok: false, refusal: "view-closed", verb: "fetch" });
    expect(v.owner.peers).not.toContain(peerId);
    expect(islands[0]!.terminated).toBe(true);
    v.faces.player.working.change((d) => { d.tiddlers["after"] = storedLarRecord("after", { text: "unseen" }, "test"); });
    await quiet(300);
    expect((await tryFind(island, v.faces.player.working.url))?.doc()?.tiddlers?.["after"]).toBeUndefined();

    // The fence holds: the generation the session left mounts nothing again, and the one it wears still mounts.
    await expect(pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-c", recipe })).rejects.toThrow("generation-fenced");
    const c1 = await pool.mountSurface({ sessionId: "session-1", generation: 1, surfaceId: "surface-c", recipe });
    // The session's end drops what it still holds, and leaves the other session's island standing.
    await pool.closeSession("session-1");
    expect([pool.has(a1), pool.has(c1), pool.has(other)]).toEqual([false, false, true]);
    expect(pool.stats()).toEqual({ pinned: 0, wela: 1, anu: 0 });
    // A session that ended mounts nothing again, under any generation.
    const spawned = islands.length;
    await expect(pool.mountSurface({ sessionId: "session-1", generation: 1, surfaceId: "surface-a", recipe })).rejects.toThrow("session-ended");
    await expect(pool.mountSurface({ sessionId: "session-1", generation: 9, surfaceId: "surface-z", recipe })).rejects.toThrow("session-ended");
    expect(islands.length).toBe(spawned);                                                // the fence refuses before any island spawns
    expect(pool.has(await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-b", recipe }))).toBe(true);   // control
  });

  test("a surface that lands after its session ended, or switched, never stands", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdEa: true });
    const settle = async <T>(p: Promise<T>): Promise<T | Error> => p.then((value) => value, (err: Error) => err);
    const landing = settle(pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe }));
    const switching = settle(pool.mountSurface({ sessionId: "session-3", generation: 0, surfaceId: "surface-a", recipe }));
    const bystander = settle(pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe }));
    expect(await until(() => islands.length === 3 && islands.every((i) => i.manifest !== null))).toBe(true);
    // The booting island of the session about to switch already holds an attached view: its Repo stands and writes.
    const early = standIsland(islands[1]!);
    const earlyCopy = (await tryFind(early, v.faces.player.working.url))!;
    earlyCopy.change((d) => { d.tiddlers["before-fence"] = storedLarRecord("before-fence", { text: "x" }, "test"); });
    expect(await until(() => v.faces.player.working.doc()?.tiddlers?.["before-fence"] !== undefined)).toBe(true);   // control: the channel stood
    // The session ends, and another switches, while their islands still boot.
    const closing = pool.closeSession("session-1");
    const fencing = pool.fenceSession("session-3", 1);
    // The fence's first step closed the view of the mount in flight: a write made now never lands.
    earlyCopy.change((d) => { d.tiddlers["after-fence"] = storedLarRecord("after-fence", { text: "x" }, "test"); });
    let ended = false;
    void closing.then(() => { ended = true; });
    // Long enough for the island's Repo to send that write, were its channel still open.
    await quiet(350);
    expect(ended).toBe(false);                                                           // the close waits for the mount in flight
    expect(v.faces.player.working.doc()?.tiddlers?.["after-fence"]).toBeUndefined();
    // A session fenced in the same turn its mount began opens no channel and spawns no island at all.
    const spawnedSoFar = islands.length;
    const stillborn = settle(pool.mountSurface({ sessionId: "session-4", generation: 0, surfaceId: "surface-a", recipe }));
    void pool.fenceSession("session-4");
    expect(String(await stillborn)).toContain("session-ended");
    expect(islands.length).toBe(spawnedSoFar);
    for (const island of islands) island.reply(mkEa(island.manifest.wikiUri));           // every island breathes
    expect(String(await landing)).toContain("session-ended");
    expect(String(await switching)).toContain("generation-fenced");
    await closing; await fencing;
    await quiet(250);
    expect(v.faces.player.working.doc()?.tiddlers?.["after-fence"]).toBeUndefined();
    expect(islands[0]!.terminated && islands[1]!.terminated).toBe(true);
    expect(pool.viewOfPeer(islands[0]!.manifest.view!.peerId)).toBeNull();
    expect(v.owner.peers).not.toContain(islands[0]!.manifest.view!.peerId);
    // CONTROL: the bystander's mount landed and stands.
    const stood = await bystander;
    expect(typeof stood).toBe("string");
    expect(pool.has(stood as string)).toBe(true);
    expect(pool.stats().wela).toBe(1);
  });

  test("a pool that closes takes every mount in flight down with it", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdEa: true });
    const surface = pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe }).then((k) => k, (err: Error) => err);
    const wiki = pool.mountWiki("lar:///ha.ka.ba/wikis/outside", { coreHash: null, recipe: { wikiSlug: "outside" }, grants: { islandUrl: v.oracle.url } }).then(() => "mounted", (err: Error) => err);
    expect(await until(() => islands.length === 2 && islands.every((i) => i.manifest !== null))).toBe(true);
    let disposed = false;
    const disposing = pool.disposeAll().then((r) => { disposed = true; return r; });
    await quiet(60);
    expect(disposed).toBe(false);                                                        // the close waits for both mounts
    // A closing pool admits no mount at either door, and spawns no island for one.
    await expect(pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe })).rejects.toThrow("pool-closing");
    expect(islands.length).toBe(2);
    for (const island of islands) island.reply(mkEa(island.manifest.wikiUri));
    expect(String(await surface)).toContain("pool-closing");
    expect(String(await wiki)).toContain("pool-closing");
    await disposing;
    expect(islands.every((i) => i.terminated)).toBe(true);
    expect(pool.stats()).toEqual({ pinned: 0, wela: 0, anu: 0 });
    expect(v.owner.peers).not.toContain(islands[0]!.manifest.view!.peerId);
    // A mount that entered while the pool closed could outlast the close behind a slow plugin resolver and land
    // with nobody left to dispose it. The door refuses at its threshold, before the resolver ever runs.
    const slow = islandHost({ holdEa: true });
    let resolverCalls = 0;
    let releaseResolver: (v: { ok: true; pluginCids: string[] }) => void = () => {};
    const slowPool = new VesselIslandPoolCore({
      host: slow.host, mainRepo: v.owner,
      resolvePluginCids: () => { resolverCalls++; return new Promise((resolve) => { releaseResolver = resolve; }); },
    });
    const spec = (slug: string) => ({ coreHash: null, recipe: { wikiSlug: slug }, grants: { islandUrl: v.oracle.url } });
    const first = slowPool.mountWiki("lar:///ha.ka.ba/wikis/first", spec("first")).then(() => "mounted", (err: Error) => err);
    releaseResolver({ ok: true, pluginCids: [] });
    expect(await until(() => slow.islands.length === 1 && slow.islands[0]!.manifest !== null)).toBe(true);
    const slowDisposing = slowPool.disposeAll();
    const late = slowPool.mountWiki("lar:///ha.ka.ba/wikis/late", spec("late")).then(() => "mounted", (err: Error) => err);
    expect(String(await late)).toContain("pool-closing");
    expect(resolverCalls).toBe(1);                                                       // the late mount never reached the resolver
    slow.islands[0]!.reply(mkEa(slow.islands[0]!.manifest.wikiUri));
    await first; await slowDisposing;
    releaseResolver({ ok: true, pluginCids: [] });
    await quiet(60);
    expect(slow.islands.length).toBe(1);                                                 // and no island stood up after the close
    expect(slowPool.stats()).toEqual({ pinned: 0, wela: 0, anu: 0 });
    // CONTROL: the pool mounts again once it has closed, so the refusal named the closing and nothing else.
    const { pool: fresh, islands: freshIslands } = poolOver(v);
    expect(fresh.has(await fresh.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe }))).toBe(true);
    expect(freshIslands.length).toBe(1);
  });

  test("a fence cuts the scoped channel before the island hears of it; a close lets the island settle first", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdAck: true });
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    const [fencedIsland, closedIsland] = islands as [FakeIsland, FakeIsland];
    const fencedRepo = standIsland(fencedIsland), closedRepo = standIsland(closedIsland);
    const fencedCopy = (await tryFind(fencedRepo, v.faces.player.working.url))!;
    const closedCopy = (await tryFind(closedRepo, v.faces.player.working.url))!;
    await quiet();
    const write = (handle: DocHandle<LarDoc>, title: string): void => {
      handle.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: "written while the island tore down" }, "test"); });
    };
    const settleAsk = async (island: FakeIsland, requestId: string, heads: Record<string, string[]>): Promise<Record<string, unknown>> => {
      island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId, heads });
      expect(await until(() => island.posted.some((m) => (m as { requestId?: string }).requestId === requestId), 4000)).toBe(true);
      return island.posted.find((m) => (m as { requestId?: string }).requestId === requestId) as Record<string, unknown>;
    };

    // THE FENCE: the view closes at once. The island's later write never lands, and its settle ask draws false.
    const fencing = pool.fenceSession("session-1");
    write(fencedCopy, "after-fence");
    expect(await settleAsk(fencedIsland, "s1", { [v.faces.player.working.url]: replicaHeads(fencedCopy) })).toMatchObject({ type: "view:settled", settled: false });
    await quiet(300);
    expect(v.faces.player.working.doc()?.tiddlers?.["after-fence"]).toBeUndefined();

    // THE CLOSE: the island keeps no store, so it names its heads and the owner answers only once it holds them.
    const closing = pool.closeSession("session-2");
    expect(await until(() => closedIsland.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
    // The island names heads of a write that has NOT crossed its port yet: no answer comes while the owner lacks them.
    const pending = A.change(A.clone(closedCopy.doc()!), (d) => { d.tiddlers["during-close"] = storedLarRecord("during-close", { text: "written while the island tore down" }, "test"); });
    closedIsland.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "s2", heads: {
      [v.faces.player.working.url]: A.getHeads(pending),
      [v.shared.url]: ["ff".repeat(32)],          // a bag the session may only read: its heads count for nothing
    } });
    await quiet(250);
    expect(closedIsland.posted.some((m) => (m as { requestId?: string }).requestId === "s2")).toBe(false);
    // One settle waits per island: a second ask while the first waits answers false at once and stacks no waiter.
    expect(await settleAsk(closedIsland, "s2b", { [v.faces.player.working.url]: ["ee".repeat(32)] })).toMatchObject({ settled: false });
    // The write crosses; the owner answers once it holds those heads, and holds them at the answer.
    closedCopy.update((doc) => A.merge(doc, pending));
    expect(await until(() => closedIsland.posted.some((m) => (m as { requestId?: string }).requestId === "s2"))).toBe(true);
    expect(closedIsland.posted.find((m) => (m as { requestId?: string }).requestId === "s2")).toMatchObject({ type: "view:settled", settled: true });
    expect(v.faces.player.working.doc()?.tiddlers?.["during-close"]).toBeDefined();       // read at the answer, with no wait
    // The owner walks its own list: a hundred thousand names the island adds beyond it cost nothing and change nothing.
    const flood: Record<string, string[]> = { [v.faces.player.working.url]: A.getHeads(closedCopy.doc()!) };
    for (let i = 0; i < 100_000; i++) flood[`automerge:not-a-facet-${i}`] = ["aa".repeat(32)];
    expect(await settleAsk(closedIsland, "s2c", flood)).toMatchObject({ settled: true });
    fencedIsland.reply(mkTeardownAck());
    closedIsland.reply(mkTeardownAck());
    // The owner keeps each outcome, whatever the island acks: the closed island settled, the fenced one never did.
    expect(await closing).toEqual([{ wikiId: expect.any(String), acked: true, settled: true }]);
    expect(await fencing).toEqual([{ wikiId: expect.any(String), acked: true, settled: false }]);
    // A torn ask, and one past the head bound, settle nothing and leave the island unsettled.
    const { pool: second, islands: more } = poolOver(v, { holdAck: true });
    await second.mountSurface({ sessionId: "session-9", generation: 0, surfaceId: "surface-a", recipe });
    expect(await settleAsk(more[0]!, "t2", { [v.faces.player.working.url]: "not-heads" as unknown as string[] })).toMatchObject({ settled: false });
    expect(await settleAsk(more[0]!, "t3", { [v.faces.player.working.url]: Array.from({ length: 1025 }, () => "aa".repeat(32)) })).toMatchObject({ settled: false });
    expect(await settleAsk(more[0]!, "t4", { [v.faces.player.working.url]: ["../../not-a-hash"] })).toMatchObject({ settled: false });
    expect(await settleAsk(more[0]!, "t1", { [v.faces.player.working.url]: A.getHeads(v.faces.player.working.doc()!) })).toMatchObject({ settled: true });   // control
    // An ask still waiting when the island goes leaves it unsettled, whatever an earlier ask answered.
    more[0]!.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "t5", heads: { [v.faces.player.working.url]: ["bb".repeat(32)] } });
    await quiet(60);
    const ending = second.closeSession("session-9");
    expect(await until(() => more[0]!.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
    more[0]!.reply(mkTeardownAck());
    expect(await ending).toEqual([{ wikiId: expect.any(String), acked: true, settled: false }]);
    // ONLY A SETTLE THE TEARDOWN DRAWS COUNTS: an island that settled earlier, then acks its teardown with no
    // fresh ask, ends unsettled; the same island asking again inside its teardown ends settled (the control).
    for (const [session, asksAgain] of [["session-10", false], ["session-11", true]] as const) {
      const { pool: third, islands: last } = poolOver(v, { holdAck: true });
      await third.mountSurface({ sessionId: session, generation: 0, surfaceId: "surface-a", recipe });
      const held = { [v.faces.player.working.url]: A.getHeads(v.faces.player.working.doc()!) };
      expect(await settleAsk(last[0]!, "early", held)).toMatchObject({ settled: true });
      const going = third.closeSession(session);
      expect(await until(() => last[0]!.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
      if (asksAgain) expect(await settleAsk(last[0]!, "fresh", held)).toMatchObject({ settled: true });
      last[0]!.reply(mkTeardownAck());
      expect(await going).toEqual([{ wikiId: expect.any(String), acked: true, settled: asksAgain }]);
    }
    expect(pool.stats()).toEqual({ pinned: 0, wela: 0, anu: 0 });
  });

  test("a settle that began before a teardown never vouches for it", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdAck: true });
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const island = islands[0]!;
    const copy = (await tryFind(standIsland(island), v.faces.player.working.url))!;
    await quiet();
    const answerTo = (requestId: string): Record<string, unknown> | undefined =>
      island.posted.find((m) => (m as { requestId?: string }).requestId === requestId) as Record<string, unknown> | undefined;
    // An early ask waits on a write that has not crossed yet.
    const unsent = A.change(A.clone(copy.doc()!), (d) => { d.tiddlers["late"] = storedLarRecord("late", { text: "x" }, "test"); });
    island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "early", heads: { [v.faces.player.working.url]: A.getHeads(unsent) } });
    await quiet(80);
    expect(answerTo("early")).toBeUndefined();
    // The teardown begins. Its own ask finds the waiting place free, though the early ask still waits.
    const closing = pool.closeSession("session-1");
    expect(await until(() => island.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
    island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "fresh", heads: { [v.faces.player.working.url]: A.getHeads(copy.doc()!) } });
    expect(await until(() => answerTo("fresh") !== undefined)).toBe(true);
    expect(answerTo("fresh")).toMatchObject({ settled: true });                          // control: the teardown's own ask counts
    // The island writes AGAIN after that ask; the early ask's heads then arrive and it answers true, late.
    copy.update((doc) => A.merge(doc, unsent));
    expect(await until(() => answerTo("early") !== undefined)).toBe(true);
    expect(answerTo("early")).toMatchObject({ settled: true });
    // A third ask, begun in this teardown, fails: the island leaves unsettled, whatever the stale ask said.
    island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "torn", heads: { [v.faces.player.working.url]: "not-heads" } });
    expect(await until(() => answerTo("torn") !== undefined)).toBe(true);
    island.reply(mkTeardownAck());
    expect(await closing).toEqual([{ wikiId: expect.any(String), acked: true, settled: false }]);
  });

  test("a stale settle that answers after the teardown began changes nothing", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdAck: true });
    await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const island = islands[0]!;
    const copy = (await tryFind(standIsland(island), v.faces.player.working.url))!;
    await quiet();
    const unsent = A.change(A.clone(copy.doc()!), (d) => { d.tiddlers["late"] = storedLarRecord("late", { text: "x" }, "test"); });
    island.reply({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settle", requestId: "early", heads: { [v.faces.player.working.url]: A.getHeads(unsent) } });
    await quiet(80);
    const closing = pool.closeSession("session-1");
    expect(await until(() => island.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
    // The early ask's heads arrive during the teardown and it answers true; the teardown drew no ask of its own.
    copy.update((doc) => A.merge(doc, unsent));
    expect(await until(() => island.posted.some((m) => (m as { requestId?: string }).requestId === "early"))).toBe(true);
    expect(island.posted.find((m) => (m as { requestId?: string }).requestId === "early")).toMatchObject({ settled: true });
    island.reply(mkTeardownAck());
    expect(await closing).toEqual([{ wikiId: expect.any(String), acked: true, settled: false }]);
  });

  test("a session island's event never reaches the door that places vessel verbs", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { host, islands } = islandHost();
    const vesselDoor: Array<[string, unknown]> = [];
    const surfaceDoor: Array<[IslandKeyParts, unknown]> = [];
    const pool = new VesselIslandPoolCore({
      host, mainRepo: v.owner, resolvePluginCids: async () => ({ ok: true as const, pluginCids: [] }),
      onWorkerEvent: (wikiId, msg) => { vesselDoor.push([wikiId, msg.payload]); },
      onSurfaceEvent: (surface, msg) => { surfaceDoor.push([surface, msg.payload]); },
    });
    pools.push(pool);
    const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    await pool.mountWiki("lar:///ha.ka.ba/wikis/outside", { coreHash: null, recipe: { wikiSlug: "outside" }, grants: { islandUrl: v.oracle.url } });
    const event = (wiki: string) => ({ schema_version: ISLAND_PROTOCOL_VERSION, type: "event", wikiUri: wiki, listenable: "OnActivated", payload: { verb: "vault-unlock", uri: "lar:///synthetic" } });
    // A session island spells a verb-bearing event, under its own wiki's name and under another's.
    islands[0]!.reply(event(WIKI));
    islands[0]!.reply(event("lar:///ha.ka.ba/wikis/outside"));
    expect(vesselDoor).toEqual([]);
    expect(surfaceDoor.map(([parts]) => parts)).toEqual([pool.surfaceOf(key), pool.surfaceOf(key)]);
    // CONTROL: the same event from an island outside any session reaches the vessel's door.
    islands[1]!.reply(event("lar:///ha.ka.ba/wikis/outside"));
    expect(vesselDoor).toEqual([["lar:///ha.ka.ba/wikis/outside", { verb: "vault-unlock", uri: "lar:///synthetic" }]]);
    // With no surface door supplied, a session island's event drops.
    const bare = poolOver(v);
    await bare.pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    expect(() => bare.islands[0]!.reply(event(WIKI))).not.toThrow();
  });

  test("a placement reaches a surface only from the session its key carries, and never an island on its way down", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const { pool, islands } = poolOver(v, { holdAck: true });
    const mine = await pool.mountSurface({ sessionId: "session-1", generation: 1, surfaceId: "surface-a", recipe });
    const theirs = await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    await pool.mountWiki(WIKI, { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } });
    const verbsAt = (island: FakeIsland): number => island.posted.filter((m) => (m as { type?: string }).type === "wiki:place-verb").length;
    const place = (key: string, session?: { sessionId: string; generation: number }) =>
      pool.placeWikiVerb(key, { verb: "probe", args: {}, requestedBy: "test" }, session).then(() => "placed", (err: Error) => err.message);
    const me = { sessionId: "session-1", generation: 1 };
    // CONTROL: the session's own placement reaches its own island.
    void place(mine, me);
    expect(verbsAt(islands[0]!)).toBe(1);
    // A caller holding another session's key reaches nothing: another session, an earlier generation, no session at all.
    expect(await place(theirs, me)).toContain("the placing session holds no such surface");
    expect(await place(mine, { sessionId: "session-1", generation: 0 })).toContain("the placing session holds no such surface");
    expect(await place(mine)).toContain("the placing session holds no such surface");
    expect(await place(WIKI, me)).toContain("no session holds this island");
    expect([verbsAt(islands[0]!), verbsAt(islands[1]!), verbsAt(islands[2]!)]).toEqual([1, 0, 0]);
    // Every other placement door reads the same binding.
    pool.placeWikiEvent(theirs, { renderId: "r", eventType: "click", fields: {} }, me);
    pool.placeWikiInput(theirs, { renderId: "r", eventType: "input", value: "x" }, me);
    expect(() => pool.placeSensoriumSignal(theirs, { signal: "sensorium:read" as never, requestId: "q" }, me)).toThrow("the placing session holds no such surface");
    expect(islands[1]!.posted.length).toBe(1);                                           // its manifest, and nothing since
    // The listing names no surface: a status read learns no session and no face plane from it.
    expect(pool.inspect()).toEqual([{ wikiId: WIKI, temperature: "wela", pinned: false }]);
    expect(pool.stats()).toEqual({ pinned: 0, wela: 3, anu: 0 });
    // An island on its way down takes no placement, even from its own session.
    const closing = pool.closeSession("session-1");
    expect(await until(() => islands[0]!.posted.some((m) => (m as { type?: string }).type === "teardown"))).toBe(true);
    expect(await place(mine, me)).toContain("the island tears down");
    expect(verbsAt(islands[0]!)).toBe(1);
    islands[0]!.reply(mkTeardownAck());
    await closing;
    const rest = pool.disposeAll();
    expect(await until(() => [islands[1]!, islands[2]!].every((i) => i.posted.some((m) => (m as { type?: string }).type === "teardown")))).toBe(true);
    islands[1]!.reply(mkTeardownAck()); islands[2]!.reply(mkTeardownAck());
    await rest;
  });

  test("a call parked on an island rejects when its lease drops", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const { pool } = poolOver(v);
    const recipe = await resolved(inputOf(v, "player"));
    const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe });
    const other = await pool.mountSurface({ sessionId: "session-2", generation: 0, surfaceId: "surface-a", recipe });
    // Neither fake island answers a verb: both calls park.
    const parked = pool.placeWikiVerb(key, { verb: "never-answered", args: {}, requestedBy: "test" }, { sessionId: "session-1", generation: 0 }).then(() => "resolved", (err: Error) => err.message);
    let otherSettled = false;
    void pool.placeWikiVerb(other, { verb: "never-answered", args: {}, requestedBy: "test" }, { sessionId: "session-2", generation: 0 }).then(() => { otherSettled = true; }, () => { otherSettled = true; });
    await pool.closeSession("session-1");
    expect(await parked).toContain("went down with this call parked");
    await quiet(50);
    expect(otherSettled).toBe(false);                                                    // control: the other island's call still waits
    await pool.closeSession("session-2");
  });

  test("failure accounting reads the whole key", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const recipe = await resolved(inputOf(v, "player"));
    const doomed = new Set<string>();
    const { pool, islands } = poolOver(v, { fault: (m) => doomed.has(m.view!.peerId) || doomed.has("*") });
    doomed.add("*");
    const mount = { sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe };
    const legs = v.owner.networkSubsystem.adapters.length;
    await expect(pool.mountSurface(mount)).rejects.toThrow();
    await expect(pool.mountSurface(mount)).rejects.toThrow();
    // A failed mount closes the view it opened: no leg of a dead island stays on the owner's Repo.
    expect(v.owner.networkSubsystem.adapters.length).toBe(legs);
    await expect(pool.mountSurface(mount)).rejects.toThrow(/mount intensity cap/);       // the cap tripped for THIS key
    const spawned = islands.length;
    doomed.clear();
    // Another session mounting the same wiki under the same face stands outside that ledger.
    const other = await pool.mountSurface({ ...mount, sessionId: "session-2" });
    expect(pool.has(other)).toBe(true);
    expect(islands.length).toBe(spawned + 1);
    // A failed surface leaves no view behind.
    expect(pool.viewOfPeer(islands[0]!.manifest.view!.peerId)).toBeNull();
  });

  test("the island key never collides, whatever its parts spell", () => {
    const base: IslandKeyParts = {
      sessionId: "s", generation: 0, surfaceId: "u", wikiId: "w", facePlaneId: "f", recipeRevision: "r", capabilityProfile: "face",
    };
    // Parts that spell each other's separators: a flat join would fold these pairs into one key.
    const hostile: IslandKeyParts[] = [
      base,
      { ...base, sessionId: "s\",0,\"u" }, { ...base, sessionId: "s|0|u", surfaceId: "x" }, { ...base, sessionId: "s", surfaceId: "u\",\"w" },
      { ...base, sessionId: "s,0", surfaceId: "u" }, { ...base, sessionId: "s", generation: 1 }, { ...base, generation: 10, surfaceId: "u" },
      { ...base, sessionId: "s1", generation: 0, surfaceId: "0u" }, { ...base, wikiId: "w\",\"f", facePlaneId: "r" }, { ...base, wikiId: "wf", facePlaneId: "" + "r" },
      { ...base, recipeRevision: "r\",\"face", capabilityProfile: "seat" }, { ...base, capabilityProfile: "verb" }, { ...base, capabilityProfile: "ingest" },
      { ...base, sessionId: "[\"s\"" }, { ...base, sessionId: "s\\", surfaceId: "\"u" }, { ...base, sessionId: "s ", surfaceId: " u" },
    ];
    const keys = hostile.map(islandKey);
    expect(new Set(keys).size).toBe(hostile.length);
    // Each key reads back to exactly the parts it came from.
    for (const [i, parts] of hostile.entries()) {
      expect(keys[i]!.startsWith(SURFACE_KEY_PREFIX)).toBe(true);
      expect(JSON.parse(keys[i]!.slice(SURFACE_KEY_PREFIX.length))).toEqual([parts.sessionId, parts.generation, parts.surfaceId, parts.wikiId, parts.facePlaneId, parts.recipeRevision, parts.capabilityProfile]);
    }
    // A part of the wrong type throws; nothing defaults into a key another session could share.
    for (const torn of [
      { ...base, sessionId: "" }, { ...base, surfaceId: "" }, { ...base, wikiId: "" }, { ...base, facePlaneId: "" }, { ...base, recipeRevision: "" },
      { ...base, generation: -1 }, { ...base, generation: 0.5 }, { ...base, generation: "0" as unknown as number },
      { ...base, capabilityProfile: "root" as CapabilityProfile }, { ...base, sessionId: undefined as unknown as string },
    ]) {
      expect(() => islandKey(torn)).toThrow(SurfaceMountError);
    }
  });

  test("the two doors share no slot: the wiki door refuses an id spelled as a surface key", async () => {
    const v = vessel();
    v.writeRecipe("catalog", { wikiSlug: SLUG, libraryBags: [SHARED_BAG] });
    const { pool, islands } = poolOver(v);
    const key = await pool.mountSurface({ sessionId: "session-1", generation: 0, surfaceId: "surface-a", recipe: await resolved(inputOf(v, "player")) });
    const spec = { coreHash: null, recipe: { wikiSlug: SLUG }, grants: { islandUrl: v.oracle.url } };
    // A wiki-door caller that spells a live surface's key, or any key of that shape, reaches no island.
    await expect(pool.mountWiki(key, spec)).rejects.toThrow("wiki-id-reads-as-surface-key");
    await expect(pool.mountWiki(`${SURFACE_KEY_PREFIX}anything`, spec)).rejects.toThrow(SurfaceMountError);
    expect(islands.length).toBe(1);
    await pool.mountWiki(WIKI, spec);                                                    // control: a wiki id mounts
    expect(islands.length).toBe(2);
  });
});
