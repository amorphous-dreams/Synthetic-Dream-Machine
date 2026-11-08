/**
 * P27's HONEST WITNESS: the production `makeHeldShareFloor` composition, read through readers shaped as the node
 * vessel hands them (a real Repo's handles, the face's catalog binding and sealed map, the deterministic public gate,
 * the face's secrets registry over its own catalog), with no permissive stub anywhere. Each scenario names the crossing
 * the household walk (M3) rides: crossroads to the world, a sibling's face plane, the bound catalog after its init, a
 * face-grant member, a contracted carrier's hosting doc, the herm's `/cas`, and a private blob at the island floor.
 */
import { afterEach, expect, test, vi } from "vitest";
import { Repo, type DocHandle, type DocumentId } from "@automerge/automerge-repo";
import {
  DeterministicFederationGate, FACE_CATALOG_BAG_ID, composeVessel, crossroadsDocUrl, documentIdOfUrl, emptyLarDoc,
  islandFloorStack, larVesselOf, makeHeldShareFloor, makePersonaGroupIdentityRing, personaScopedBagIds, storedLarRecord,
  type LarDoc,
} from "@lararium/mesh";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED, type SelfSlotShareInput } from "../src/self-slot-share.js";
import { publicCasShore } from "../src/bulb-read-face.js";

const NEXUS = "ab".repeat(32);
const SIBLING = "sibling-device";
const MEMBER = "face-grant-member";
const MEMBER_KEY = "cd".repeat(32);
const CARRIER = "contracted-carrier";
const STRANGER = "stranger";
const CID = "ef".repeat(32);

const repos: Repo[] = [];
afterEach(async () => { for (const r of repos.splice(0)) await r.shutdown(); });

async function house() {
  const repo = new Repo({ network: [] });
  repos.push(repo);
  const face = personaScopedBagIds("p27-honest-face");
  const circles = repo.create<LarDoc>(emptyLarDoc());
  circles.change((d) => { d.tiddlers["lar:///ha.ka.ba/note"] = storedLarRecord("lar:///ha.ka.ba/note", { textCid: CID }, "test"); });
  const catalog: DocHandle<LarDoc> = repo.create<LarDoc>(emptyLarDoc());
  const hosting = repo.create<LarDoc>(emptyLarDoc());
  await Promise.all([circles.whenReady(), catalog.whenReady(), hosting.whenReady()]);
  const publicGate = new DeterministicFederationGate(NEXUS);
  const crossroads = documentIdOfUrl(crossroadsDocUrl(NEXUS))! as DocumentId;
  // The face's sealed map names its plane and its catalog; nothing else.
  const sealed = new Set<string>([circles.documentId, catalog.documentId]);
  const hostingDocs = new Set<DocumentId>([hosting.documentId]);
  const refused: Error[] = [];
  const floor = makeHeldShareFloor({
    genesisCids: () => new Set(),
    handles: () => repo.handles,
    catalog: () => undefined,
    bindings: () => [[face.circles, circles.documentId], [FACE_CATALOG_BAG_ID, catalog.documentId]],
    publicPlane: (id) => publicGate.mayFederate(id as DocumentId),
    sealedPlane: (id) => sealed.has(id),
    nonBagTier: (id) => hostingDocs.has(id as DocumentId) ? "contract" : null,
    faceOwns: (id) => sealed.has(id),
    secrets: { catalog: { face: () => catalog, sealed: () => true, failure: () => null, flush: async () => { await repo.flush(); } } },
    onRefusal: (error) => refused.push(error),
  });
  const ring = makePersonaGroupIdentityRing({
    governs: (id) => id === circles.documentId,
    provenVesselKey: (peerId) => peerId === MEMBER ? MEMBER_KEY : null,
    siblingKeyOf: (peerId) => peerId === SIBLING ? "11".repeat(32) : null,
    deviceAside: () => false,
    grants: { records: () => [{ seats: MEMBER_KEY }], verify: async (record, key) => (record as { seats: string }).seats === key },
  });
  const crossing = (peerId: string, documentId: DocumentId, over: Partial<SelfSlotShareInput> = {}): Promise<boolean> => selfSlotShareDecision({
    tiers: floor.tiers, hasWsSocket: peerId !== SIBLING, sibling: peerId === SIBLING,
    siblingGate: ring.composeSiblings(publicGate), peerClass: peerId === CARRIER ? "contracted" : "stranger",
    selfSlotFedGate: ring.compose(publicGate), faceGrant: ring, antigenRing: NO_BANS, shadow: NOBODY_ASIDE,
    protectedDocs: NOTHING_CLASSED, membership: null, planeSeal: null, hostingDocs, peerId, documentId, ...over,
  });
  return { repo, floor, circles, catalog, hosting, crossroads, crossing, refused };
}

test("P27 honest floor: crossroads reaches the world before and after the face's registry reads", async () => {
  const h = await house();
  expect(await h.crossing(STRANGER, h.crossroads), "the public board crosses with the registry still uninitialized").toBe(true);
  await h.floor.registry.initialize();
  expect(await h.crossing(STRANGER, h.crossroads)).toBe(true);
});

test("P27 honest floor: a sibling reads the face's PERSONAGROUP plane at fleet once the bound catalog initializes; a stranger never", async () => {
  const h = await house();
  expect(await h.crossing(SIBLING, h.circles.documentId), "an uninitialized registry refuses the face's own plane").toBe(false);
  expect(h.refused.at(-1)).toMatchObject({ name: "SecretsRegistryRefusal", reason: "secrets-registry-uninitialized" });
  expect(await h.floor.registry.initialize()).toBe("initialized");
  expect(await h.crossing(SIBLING, h.circles.documentId)).toBe(true);
  expect(await h.crossing(STRANGER, h.circles.documentId)).toBe(false);
});

test("P27 honest floor: a fresh bound face catalog follows the face to its fleet after init, never to the world", async () => {
  const h = await house();
  expect(h.floor.tiers.allows(true, h.catalog.documentId, "fleet", true)).toBe(false);
  await h.floor.registry.initialize();
  expect(h.floor.tiers.allows(true, h.catalog.documentId, "fleet", true)).toBe(true);
  expect(h.floor.tiers.allows(true, h.catalog.documentId, "world", true)).toBe(false);
});

test("P27 honest floor: a face-grant member the ring admits reads the face plane as fleet", async () => {
  const h = await house();
  await h.floor.registry.initialize();
  expect(await h.crossing(MEMBER, h.circles.documentId)).toBe(true);
  // CONTROL: the same peer with no ring proof reads as the world, and the PERSONAGROUP plane withholds.
  expect(await h.crossing(MEMBER, h.circles.documentId, { faceGrant: null })).toBe(false);
});

test("P27 honest floor: a contracted carrier replicates the hosting docs; the world does not", async () => {
  const h = await house();
  expect(await h.crossing(CARRIER, h.hosting.documentId)).toBe(true);
  expect(await h.crossing(STRANGER, h.hosting.documentId)).toBe(false);
});

test("P27 honest floor: a private blob stays refused to the world while the daemon island reads it in-process", async () => {
  const h = await house();
  await h.floor.registry.initialize();
  const cas = vi.fn(async () => new Uint8Array([9]));
  const island = await composeVessel(islandFloorStack({ cas, tiers: h.floor.tiers, documentsForCid: h.floor.documentsForCid }));
  try {
    const door = larVesselOf(island).record.cas!;
    expect(h.floor.documentsForCid(CID)).toEqual([h.circles.documentId]);
    await expect(door(CID, "world")).rejects.toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
    await expect(door(CID, "in-process")).resolves.toEqual(new Uint8Array([9]));
    expect(cas).toHaveBeenCalledOnce();
  } finally { await island.dispose(); }
});

test("P27 honest floor: the herm's /cas reads the board that carries the pointer, and a held private reference withholds", async () => {
  const h = await house();
  await h.floor.registry.initialize();
  const fresh = "12".repeat(32);
  const pointer = (cid: string) => ({ title: `pointer-${cid.slice(0, 4)}`, bagId: "lar:///ha.ka.ba/bags/crossroads", documentId: h.crossroads, record: { tiddler: { textCid: cid } } });
  const shore = publicCasShore({
    casDir: "unused-no-byte-read", tiers: h.floor.tiers, documentForBag: h.floor.documentForBag, documentsForCid: h.floor.documentsForCid,
    releasedDocument: () => h.crossroads, references: () => [pointer(fresh), pointer(CID)], bagTier: () => "public",
  });
  expect(await shore.isPublic(fresh), "a pointer on the public board names public bytes").toBe(true);
  expect(await shore.isPublic(CID), "the face's PERSONAGROUP plane holds the same cid").toBe(false);
});
