import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { expect, test, vi } from "vitest";
import { composeVessel, islandFloorStack, larVesselOf, makeShareBoundary, makeTierFloorSource,
  makeIslandAudienceReader, type IslandAudienceContext, type IslandMsg_CasBlock } from "@lararium/mesh";
import { nodeWorkerHandle } from "../src/worker-handle.js";
import { nodeContentReader } from "../src/vessel-island-pool.js";

// A port double only: no worker, vessel or listener starts in this proof.
test("P27 node: daemon reads held private bytes; pool recipe/face relations gate the same CID and name unresolved asks", async () => {
  const cas = vi.fn(async () => new Uint8Array([7]));
  const tiers = makeShareBoundary({ declared: { declaredTierForDoc: () => "veil" },
    floor: makeTierFloorSource({ federatable: () => false, sealed: () => true, secrets: () => false }) }, () => {});
  const floor = await composeVessel(islandFloorStack({ cas, tiers, documentsForCid: () => ["held-private"] }));
  const caps = larVesselOf(floor).record;
  let face: string | null = "automerge:own-plane";
  let plane: "catalog" | "oracle" | null = "catalog";
  const audience = makeIslandAudienceReader({ ownFacePlane: () => face, recipePlane: () => plane });
  const island: IslandAudienceContext = { wikiId: "work", wikiSlug: "work", facePlaneId: null };
  const ask = (kind: "daemon" | "wiki") => new Promise<IslandMsg_CasBlock>((resolve) => {
    const worker = Object.assign(new EventEmitter(), { postMessage: resolve });
    nodeWorkerHandle(worker as unknown as Worker, { island: kind, caps, casAudience: () => audience(island) });
    // A worker's forged audience field never joins the host's relation.
    worker.emit("message", { type: "cas:want", requestId: "r", cid: "private-cid", audience: "in-process" });
  });
  try {
    expect(await ask("daemon")).toMatchObject({ bytes: new Uint8Array([7]) });
    expect(await ask("wiki")).toMatchObject({ bytes: new Uint8Array([7]) });
    const read = nodeContentReader(caps, audience);
    await expect(read("private-cid", island)).resolves.toEqual(new Uint8Array([7]));
    plane = "oracle";
    expect(await ask("wiki")).toMatchObject({ bytes: null, refusal: "declared-tier-audience" });
    await expect(read("private-cid", island)).rejects.toMatchObject({ reason: "declared-tier-audience" });
    plane = null;
    expect(await ask("wiki")).toMatchObject({ bytes: null, refusal: "declared-tier-audience-unresolved" });
    await expect(read("private-cid", island)).rejects.toMatchObject({ reason: "declared-tier-audience-unresolved" });
    const scoped = { ...island, facePlaneId: face };
    await expect(read("private-cid", scoped)).resolves.toEqual(new Uint8Array([7]));
    face = "automerge:other-plane";
    await expect(read("private-cid", scoped)).rejects.toMatchObject({ reason: "declared-tier-audience-unresolved" });
    expect(cas).toHaveBeenCalledTimes(4);
  } finally { await floor.dispose(); }
});
