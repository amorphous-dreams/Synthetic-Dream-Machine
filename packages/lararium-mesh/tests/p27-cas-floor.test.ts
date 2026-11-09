import { expect, test, vi } from "vitest";
import type { DocHandle } from "@automerge/automerge-repo";
import { composeVessel, islandFloorStack, larVesselOf, makeShareBoundary,
  makeManifestTierSource, makeTierFloorSource, makeHeldShareFloor, buildGenesisDoc,
  genesisCasManifestFromSeed, utf8Bytes, cutFloorSnapshot, emptyLarDoc, storedLarRecord,
  SECRETS_REGISTRY_ROW, SECRETS_REGISTRY_KIND, SECRETS_REGISTRY_VERSION, type CapTier, type LarDoc } from "../src/index.js";

// Both substrate resolvers take the very same composed floor; a CID grants no audience proof.
test("P27 CAS floor: both shores refuse a private reference before reading bytes; public still reads", async () => {
  let tier: CapTier = "veil";
  const refused: Error[] = [];
  const tiers = makeShareBoundary({
    declared: makeManifestTierSource({ bagOfDoc: () => ({ kind: "bag", bag: "work" }),
      manifestOf: () => ({ bag: "work", tier, home: "hearth" }), tiddlerTiersOf: () => [] }),
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }),
  }, (error) => refused.push(error));
  const nodeRead = vi.fn(async () => new Uint8Array([1]));
  const browserRead = vi.fn(async () => new Uint8Array([1]));
  const floors = [];
  for (const cas of [nodeRead, browserRead]) {
    const floor = await composeVessel(islandFloorStack({ cas, tiers, documentsForCid: () => ["doc"] }));
    floors.push(floor);
    await expect(larVesselOf(floor).record.cas!("cid", "world")).rejects.toMatchObject({
      name: "DeclaredTierRefusal", reason: "declared-tier-audience",
    });
  }
  expect(nodeRead).not.toHaveBeenCalled();
  expect(browserRead).not.toHaveBeenCalled();
  tier = "public";
  for (const floor of floors) expect(await larVesselOf(floor).record.cas!("cid", "world")).toEqual(new Uint8Array([1]));
  expect(nodeRead).toHaveBeenCalledOnce();
  expect(browserRead).toHaveBeenCalledOnce();
  for (const floor of floors) await floor.dispose();
});

test("P27 audience: the house reads held private bytes; the same CID refuses world and an unproved relation", async () => {
  const refused: Error[] = [];
  const cas = vi.fn(async () => new Uint8Array([7]));
  const tiers = makeShareBoundary({
    declared: { declaredTierForDoc: () => "veil" },
    floor: makeTierFloorSource({ federatable: () => false, sealed: () => true, secrets: () => false }),
  }, (error) => refused.push(error));
  const floor = await composeVessel(islandFloorStack({ cas, tiers, documentsForCid: () => ["private-doc"] }));
  try {
    const door = larVesselOf(floor).record.cas!;
    await expect(door("same-cid", "in-process")).resolves.toEqual(new Uint8Array([7]));
    await expect(door("same-cid", "world")).rejects.toMatchObject({ reason: "declared-tier-audience" });
    await expect(door("same-cid", undefined)).rejects.toMatchObject({ reason: "declared-tier-audience-unresolved" });
    expect(cas).toHaveBeenCalledOnce();
    expect(refused).toHaveLength(2);
  } finally { await floor.dispose(); }
});

test("P27 boot: immutable engine and genesis-bag inventory reads with no held doc; undeclared and mutable-only CIDs refuse", async () => {
  const inputs = { actorSeed: "11".repeat(32), coreBlob: utf8Bytes("engine"), coreVersion: "test", plugins: [] };
  const baseline = buildGenesisDoc(inputs);
  const lares = cutFloorSnapshot({ "lar:///ha.ka.ba/test": { tiddler: { title: "lar:///ha.ka.ba/test", text: "public seed" } } });
  const lararium = cutFloorSnapshot({});
  const built = buildGenesisDoc({ ...inputs, floor: { lares, lararium, manifest: {
    format: "lararium-floor/v1", engine: baseline.engineCid, grammar: baseline.grammarCid,
    plugins: baseline.pluginsCid, lares: lares.cid, lararium: lararium.cid,
  } } });
  const declared = new Set(genesisCasManifestFromSeed(built.seed).blobs.map(({ cid }) => cid));
  expect(declared).toContain(lares.cid);
  expect(declared).toContain(lararium.cid);
  const cas = vi.fn(async (cid: string) => built.casEntries.find((entry) => entry.cid === cid)?.bytes ?? null);
  // No loaded bag names these bytes; the immutable seed alone supplies their PUBLIC declaration.
  let handles = {};
  let registryDoc: LarDoc | undefined;
  const registryHandle = { doc: () => registryDoc } as DocHandle<LarDoc>;
  const secretsFace = vi.fn(() => registryDoc ? registryHandle : null);
  const held = makeHeldShareFloor({ handles: () => handles, catalog: () => undefined, bindings: () => [],
    genesisCids: () => declared, publicPlane: () => false, sealedPlane: () => false, nonBagTier: () => null, faceOwns: () => false,
    secrets: { catalog: { face: secretsFace, sealed: () => false, failure: () => null, flush: async () => {} } },
    onRefusal: () => {},
  });
  const floor = await composeVessel(islandFloorStack({ cas, tiers: held.tiers, documentsForCid: held.documentsForCid }));
  try {
    const door = larVesselOf(floor).record.cas!;
    for (const cid of declared) await expect(door(cid, "world")).resolves.toEqual(built.casEntries.find((e) => e.cid === cid)!.bytes);
    const reads = cas.mock.calls.length;
    expect(held.documentsForCid("undeclared")).toEqual([]);
    await expect(door("undeclared", "world")).rejects.toMatchObject({ reason: "declared-tier-unresolved" });
    await expect(door("undeclared", "in-process")).rejects.toMatchObject({ reason: "declared-tier-unresolved" });
    expect(secretsFace).not.toHaveBeenCalled(); // no document reaches the per-document predicate
    const mutable: LarDoc = { ...emptyLarDoc(), blobs: { guessed: { id: "guessed", sha256: "mutable-only", mimeType: "text/plain", version: "test" } } };
    handles = { oracle: { isReady: () => true, doc: () => mutable } };
    expect(held.documentsForCid("mutable-only")).toEqual(["oracle"]);
    // A mutable reference names a document, not a public declaration. A doc bound nowhere proves no owner, so the
    // registry is never asked and the crossing refuses unresolved (the registry gates its own face's documents alone).
    await expect(door("mutable-only", "world")).rejects.toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-unresolved" });
    expect(secretsFace).not.toHaveBeenCalled();
    // Once the registry reads, the same unbound document still cannot declare these bytes public.
    registryDoc = emptyLarDoc();
    registryDoc.tiddlers[SECRETS_REGISTRY_ROW] = storedLarRecord(SECRETS_REGISTRY_ROW,
      { kind: SECRETS_REGISTRY_KIND, version: SECRETS_REGISTRY_VERSION }, "test");
    await expect(door("mutable-only", "world")).rejects.toMatchObject({ reason: "declared-tier-unresolved" });
    expect(cas).toHaveBeenCalledTimes(reads);
  } finally { await floor.dispose(); }
});

test("P27 CAS: withdrawing the held reference while the resolver waits withholds the answer", async () => {
  let ids = ["doc"];
  let settle!: (bytes: Uint8Array) => void;
  const tiers = makeShareBoundary({ declared: { declaredTierForDoc: () => "public" },
    floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: () => false }) }, () => {});
  const floor = await composeVessel(islandFloorStack({ tiers, documentsForCid: () => ids,
    cas: () => new Promise((resolve) => { settle = resolve; }) }));
  try {
    const answer = larVesselOf(floor).record.cas!("cid", "world");
    ids = [];
    settle(new Uint8Array([1]));
    await expect(answer).rejects.toMatchObject({ reason: "declared-tier-unresolved" });
  } finally { await floor.dispose(); }
});
