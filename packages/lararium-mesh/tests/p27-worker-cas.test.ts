import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { answerCas, answerIslandAsks, composeVessel, islandFloorStack, larVesselOf,
  makeShareBoundary, makeTierFloorSource, sha256HexBytesSync, vesselCasAsker, makeIslandAudienceReader } from "../src/index.js";

test("P27 worker byte door: private daemon reads through its record; world refuses with its name and hashes still verify", async () => {
  const bytes = new TextEncoder().encode("held private body");
  const cid = sha256HexBytesSync(bytes);
  const resolve = vi.fn(async () => bytes);
  const tiers = makeShareBoundary({ declared: { declaredTierForDoc: () => "veil" },
    floor: makeTierFloorSource({ federatable: () => false, sealed: () => true, secrets: () => false }) }, () => {});
  const floor = await composeVessel(islandFloorStack({ tiers, cas: resolve, documentsForCid: () => ["held"] }));
  const caps = larVesselOf(floor).record;
  let toVessel!: (msg: unknown) => void;
  let toWorker!: (msg: unknown) => void;
  const stop = answerIslandAsks({ post: (msg) => toWorker(msg), listen: (cb) => { toVessel = cb; return () => {}; } }, caps);
  const read = vesselCasAsker({ post: (msg) => toVessel(msg), listen: (cb) => { toWorker = cb; } });
  try {
    await expect(read(cid)).resolves.toEqual(bytes);
    await expect(read(cid)).resolves.toEqual(bytes);
    expect(resolve).toHaveBeenCalledTimes(2); // A repeat/local hit still crosses the gate.
    toVessel = (msg) => { void answerCas(caps, msg as { requestId: string; cid: string }, "world").then(toWorker); };
    await expect(read(cid)).rejects.toMatchObject({ name: "DeclaredTierRefusal", reason: "declared-tier-audience" });
    toVessel = (msg) => toWorker({ type: "cas:block", requestId: (msg as { requestId: string }).requestId, bytes: new Uint8Array([9]) });
    await expect(read(cid)).rejects.toThrow(/CID mismatch/);
  } finally { stop(); await floor.dispose(); }
});

test("P27 worker shores: both kernel byte readers use the shared port door, with no substrate CAS shortcut", () => {
  for (const rel of ["../../lararium-node/src/sovereign-island-model.ts", "../../lararium-browser/src/browser-sovereign-island-model.ts"]) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(src).toMatch(/resolveByCid:\s*vesselCasAsker\(/);
    expect(src).not.toMatch(/readCasBlobFrom(?:Fs|Opfs)\(/);
  }
});

test("P27 audience: a faulting plane reader proves no relation", () => {
  const reader = makeIslandAudienceReader({ ownFacePlane: () => null, recipePlane: () => { throw new Error("unread"); } });
  expect(reader({ wikiId: "x", wikiSlug: "x", facePlaneId: null })).toBeUndefined();
});
