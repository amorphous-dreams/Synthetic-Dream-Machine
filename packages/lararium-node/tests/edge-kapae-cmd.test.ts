/** edge-kapae command vectors: board scope, hand authority, causal heads, and vessel accretion. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  hex, realmEdgeBoardDocUrl, fleetEdgeBoardDocUrl, edgeLedgerDocUrl, materializeSharedLarDoc,
  edgeKapaeActsFromBoard, keptFromLedger, mutableLarRecord, signEdgeKapae,
  deviceEdgeId, countEdgeActs, foldEdgeReadings, edgeKapaeKey,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot,
  loadVesselVerifyingKey, loadPersonaGroupRootVerifyingKey, loadPersonaGroupRootSeed,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { runEdgeKapae, EdgeKapaeError } from "../src/commands/edge-kapae-cmd.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { direct } from "./direct-store.js";

let root: string;
let priorLarRoot: string | undefined;
const EDGE = "a".repeat(64), REALM = "b".repeat(64), MEMBER = "c".repeat(64), DEVICE = "d".repeat(64);
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-kapae-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
});
afterEach(async () => {
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

async function boardState(url: string, authority: string) {
  const repo = restingRepo(larDataDir());
  const handle = await materializeSharedLarDoc(repo, url, "board:edge-kapae");
  const acts = edgeKapaeActsFromBoard(handle.doc());
  const counted = await countEdgeActs(acts, [], () => ({ holder: authority }));
  const readings = foldEdgeReadings(counted.acts);
  await repo.flush();
  return { repo, handle, acts, readings };
}

describe("runEdgeKapae", () => {
  it("a realm holder raise stands under its signer", async () => {
    const vouch = await direct(runCabalVouch)({ joiner: MEMBER, realm: REALM, boundEpoch: 0 });
    const r = await direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: true });
    expect(r.board).toBe("realm");
    expect(r.boardUrl).toBe(realmEdgeBoardDocUrl(REALM));
    expect(r.signers).toEqual([await loadPersonaGroupRootVerifyingKey(0)]);
    expect(r.shadowStands).toBe(true);
    const state = await boardState(r.boardUrl, r.signers[0]!);
    expect(state.readings.get(vouch.edgeId)?.stands).toBe(true);
    await state.repo.rest();
  });

  it("a device act lands on the signing root fleet board and names its device edge", async () => {
    const rootDid = await loadPersonaGroupRootVerifyingKey(0);
    const r = await direct(runEdgeKapae)({ device: DEVICE, raised: true });
    expect(r.board).toBe("fleet");
    expect(r.boardUrl).toBe(fleetEdgeBoardDocUrl(rootDid!));
    expect(r.edgeId).toBe(deviceEdgeId(rootDid!, DEVICE));
    expect(r.shadowStands).toBe(true);
    // A holder act names no epoch: the fleet root's hand holds no roster (kapae#/rolls).
    expect("epochCid" in r).toBe(false);
  });

  it("a second act supersedes the line head", async () => {
    const up = await direct(runEdgeKapae)({ edgeId: EDGE, raised: true });
    const down = await direct(runEdgeKapae)({ edgeId: EDGE, raised: false });
    expect(down.parents).toEqual([up.actCid]);
    expect(down.shadowStands).toBe(false);
  });

  it("refuses an explicit parent outside the counted heads", async () => {
    await expect(direct(runEdgeKapae)({ edgeId: EDGE, raised: false, parents: ["e".repeat(64)] })).rejects.toThrow(EdgeKapaeError);
  });

  it("a racing lower leaves the raise standing and reads unsettled", async () => {
    await direct(runEdgeKapae)({ edgeId: EDGE, raised: true });
    const race = await direct(runEdgeKapae)({ edgeId: EDGE, raised: false, parents: [] });
    expect(race.shadowStands).toBe(true);
    expect(race.verdict).toBe("unsettled");
  });

  it("refuses a quorum hand without a seated charter and writes nothing", async () => {
    await expect(direct(runEdgeKapae)({ edgeId: EDGE, realm: REALM, hand: "quorum", raised: true })).rejects.toThrow(EdgeKapaeError);
    const url = realmEdgeBoardDocUrl(REALM);
    const repo = restingRepo(larDataDir());
    const handle = await materializeSharedLarDoc(repo, url, "board:edge-kapae");
    expect(edgeKapaeActsFromBoard(handle.doc())).toEqual([]);
    await repo.rest();
  });

  it("refuses ambiguous relationships and a device scoped to a realm", async () => {
    await expect(direct(runEdgeKapae)({ edgeId: EDGE, member: MEMBER, realm: REALM, raised: true })).rejects.toThrow(EdgeKapaeError);
    await expect(direct(runEdgeKapae)({ member: MEMBER, device: DEVICE, realm: REALM, raised: true })).rejects.toThrow(EdgeKapaeError);
    await expect(direct(runEdgeKapae)({ edgeId: EDGE, device: DEVICE, raised: true })).rejects.toThrow(EdgeKapaeError);
    await expect(direct(runEdgeKapae)({ device: DEVICE, realm: REALM, raised: true })).rejects.toThrow(EdgeKapaeError);
  });

  it("refuses realm holder acts without authority over the named edge", async () => {
    const vouch = await direct(runCabalVouch)({ joiner: MEMBER, realm: REALM, boundEpoch: 0 });
    await generateOrLoadPersonaGroupRoot(1);
    const url = realmEdgeBoardDocUrl(REALM);
    const assertEmpty = async () => {
      const repo = restingRepo(larDataDir());
      const handle = await materializeSharedLarDoc(repo, url, "board:edge-kapae");
      expect(edgeKapaeActsFromBoard(handle.doc())).toEqual([]);
      await repo.rest();
    };
    await expect(direct(runEdgeKapae)({ edgeId: EDGE, realm: REALM, raised: true })).rejects.toThrow(EdgeKapaeError);
    await assertEmpty();
    await expect(direct(runEdgeKapae)({ member: MEMBER, realm: REALM, raised: true })).rejects.toThrow(EdgeKapaeError);
    await assertEmpty();
    await expect(direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: true, handleIndex: 1 })).rejects.toThrow(EdgeKapaeError);
    await assertEmpty();
  });

  it("does not use a raw act stored under the wrong id as a parent", async () => {
    const up = await direct(runEdgeKapae)({ edgeId: EDGE, raised: true });
    const repo = restingRepo(larDataDir());
    const handle = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(up.signers[0]!), "board:edge-kapae");
    const rawSeed = await loadPersonaGroupRootSeed(0);
    const raw = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "holder", parents: [] }, [{ signer: up.signers[0]!, sign: (bytes) => ed.signAsync(bytes, rawSeed).then(hex) }]);
    const poisoned = { ...raw, actCid: "f".repeat(64) };
    handle.change((d) => { d.tiddlers["wrong-id"] = mutableLarRecord("wrong-id", { text: JSON.stringify(poisoned) }, "test"); });
    await repo.flush();
    const next = await direct(runEdgeKapae)({ edgeId: EDGE, raised: false });
    expect(next.parents).toEqual([up.actCid]);
    await repo.rest();
  });

  it("keeps counted acts in the vessel ledger and restores a deleted raise", async () => {
    const rootDid = await loadPersonaGroupRootVerifyingKey(0), vessel = await loadVesselVerifyingKey();
    const raised = await direct(runEdgeKapae)({ edgeId: EDGE, raised: true });
    const repo = restingRepo(larDataDir());
    const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(rootDid!), "board:edge-kapae");
    board.change((d) => { delete d.tiddlers[edgeKapaeKey({ edgeId: EDGE, hand: "holder", raised: true, actCid: raised.actCid })]; });
    await repo.flush();
    const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vessel!), "ledger:edge");
    expect(keptFromLedger(ledger.doc(), rootDid!).acts.map((a) => a.actCid)).toContain(raised.actCid);
    const next = await direct(runEdgeKapae)({ edgeId: EDGE, raised: true });
    expect(next.parents).toEqual([raised.actCid]);
    expect(next.shadowStands).toBe(true);
    expect(rootDid).toBe(raised.signers[0]);
    await repo.rest();
    const restoredRepo = restingRepo(larDataDir());
    const restored = await materializeSharedLarDoc(restoredRepo, fleetEdgeBoardDocUrl(rootDid!), "board:edge-kapae");
    expect(edgeKapaeActsFromBoard(restored.doc()).some((a) => a.actCid === raised.actCid)).toBe(true);
    await restoredRepo.rest();
  });
});
