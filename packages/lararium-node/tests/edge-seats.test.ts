import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  deviceEdgeId, edgeKapaeKey, fleetEdgeBoardDocUrl, materializeSharedLarDoc, edgeLedgerDocUrl, keptSeatRolls, signSeatRoll, ed25519SignerFromSeed, foldWithdrawals, hex,
} from "@lararium/mesh";
import { ownedStore } from "../src/owned-store.js";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey, loadVesselSigningSeed,
  loadPersonaGroupRootVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { runEdgeSeatFacts, runEdgeSeatMarks, EdgeSeatError } from "../src/commands/edge-seats.js";
import { assertDyadBinds } from "../src/commands/device-admit.js";
import { direct } from "./direct-store.js";

let root: string;
let priorLarRoot: string | undefined;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-edge-seats-"));
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

describe("runEdgeSeatFacts", () => {
  it("reports no edges before an act, and reports a raised device edge with its raise cid", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const device = "ab".repeat(32);
    await direct(runEdgeSeatFacts)({ fleetRoot });
    const before = await direct(runEdgeSeatFacts)({ fleetRoot });
    expect(before.fleets[0]!.edges).toEqual([]); // CONTROL: no act names this device
    const raise = await direct(runEdgeKapae)({ device, raised: true });
    const facts = await direct(runEdgeSeatFacts)({ fleetRoot });
    expect(facts.fleets[0]!.edges).toContainEqual({ edgeId: deviceEdgeId(fleetRoot, device), aside: true, raiseCids: [raise.actCid] });
    expect(facts.fleets[0]!.rolled).toEqual([]);
  });

  it("keeps the raise cid when the edge is lowered", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const device = "ac".repeat(32);
    const raise = await direct(runEdgeKapae)({ device, raised: true });
    await direct(runEdgeKapae)({ device, raised: false });
    const facts = await direct(runEdgeSeatFacts)({ fleetRoot });
    expect(facts.fleets[0]!.edges).toContainEqual({ edgeId: deviceEdgeId(fleetRoot, device), aside: false, raiseCids: [raise.actCid] });
  });

  it("reads selfAside true for its own edge and false for another device", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const own = (await loadVesselVerifyingKey())!;
    await direct(runEdgeKapae)({ device: own, raised: true });
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.selfAside).toBe(true);
    // CONTROL: before this vessel has an act, a different device raise leaves selfAside clear.
  });

  it("keeps selfAside clear when a raise names another device", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    await direct(runEdgeKapae)({ device: "ad".repeat(32), raised: true });
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.selfAside).toBe(false);
  });

  it("rejects a malformed named fleet", async () => {
    await expect(direct(runEdgeSeatFacts)({ fleetRoot: "not-hex" })).rejects.toThrow(EdgeSeatError);
  });

  it("keeps a counted raise after its board row is deleted", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const device = "ae".repeat(32);
    const raise = await direct(runEdgeKapae)({ device, raised: true });
    const repo = restingRepo(larDataDir());
    const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae");
    board.change((d) => { delete d.tiddlers[edgeKapaeKey({ edgeId: raise.edgeId, hand: "holder", raised: true, actCid: raise.actCid })]; });
    await repo.flush();
    const facts = await direct(runEdgeSeatFacts)({ fleetRoot });
    expect(facts.fleets[0]!.edges).toContainEqual({ edgeId: raise.edgeId, aside: true, raiseCids: [raise.actCid] });
    await repo.rest();
  });
});

describe("runEdgeSeatMarks", () => {
  /** A roll as this vessel's own daemon island hands it over: under a receipt the vessel key signed. */
  const rollOf = async (fleetRoot: string, edgeId: string, cid: string, how: "revoked" | "gone" | "no-authority" = "revoked", by?: Uint8Array) =>
    signSeatRoll({ kind: "seat-roll", scope: fleetRoot.toLowerCase(), edgeId, raiseCids: [cid], how, seat: { group: "0xgroup", member: "0xmember" } },
      ed25519SignerFromSeed(by ?? await loadVesselSigningSeed()));

  it("keeps a roll for a counted raise once, with the roll beside the mark, and refuses a cid the fold does not hold", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const raise = await direct(runEdgeKapae)({ device: "af".repeat(32), raised: true });
    const marked = await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [await rollOf(fleetRoot, raise.edgeId, raise.actCid)] });
    expect(marked.marked).toEqual([raise.actCid]);
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.rolled).toEqual([raise.actCid]);
    // The first answer stands: a second mark of the same raise changes nothing the ledger kept.
    await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [await rollOf(fleetRoot, raise.edgeId, raise.actCid, "gone")] });
    await ownedStore(larDataDir(), async (repo) => {
      const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl((await loadVesselVerifyingKey())!), "ledger:edge");
      expect(keptSeatRolls(ledger.doc(), fleetRoot.toLowerCase())).toEqual([
        { kind: "seat-roll", scope: fleetRoot.toLowerCase(), edgeId: raise.edgeId, raiseCids: [raise.actCid], how: "revoked", seat: { group: "0xgroup", member: "0xmember" } },
      ]);
    });
    const unknown = "0".repeat(64);
    const absent = await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [await rollOf(fleetRoot, raise.edgeId, unknown)] });
    expect(absent).toMatchObject({ marked: [], unknown: [unknown] });
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.rolled).toEqual([raise.actCid]);
  });

  it("a roll no receipt of this vessel covers marks nothing: typed, signed by another key, or altered after signing", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const raise = await direct(runEdgeKapae)({ device: "ab".repeat(32), raised: true });
    const typed = { kind: "seat-roll", scope: fleetRoot, edgeId: raise.edgeId, raiseCids: [raise.actCid], how: "gone" };
    const foreign = await rollOf(fleetRoot, raise.edgeId, raise.actCid, "gone", new Uint8Array(32).fill(0x77));
    const altered = { ...(await rollOf(fleetRoot, raise.edgeId, raise.actCid, "no-authority")), how: "gone" };
    const out = await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [typed, foreign, altered] });
    expect(out.marked).toEqual([]);
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.rolled).toEqual([]);
    // CONTROL: the same roll under the vessel's own receipt marks.
    expect((await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [await rollOf(fleetRoot, raise.edgeId, raise.actCid, "gone")] })).marked).toEqual([raise.actCid]);
  });

  it("marks nothing for a lower's cid, for a raise named on another edge, or for a roll scoped to another fleet", async () => {
    const fleetRoot = (await loadPersonaGroupRootVerifyingKey(0))!;
    const raise = await direct(runEdgeKapae)({ device: "ae".repeat(32), raised: true });
    const lower = await direct(runEdgeKapae)({ device: "ae".repeat(32), raised: false });
    const out = await direct(runEdgeSeatMarks)({ fleetRoot, rolls: [
      await rollOf(fleetRoot, raise.edgeId, lower.actCid), await rollOf(fleetRoot, "e".repeat(64), raise.actCid),
      await rollOf("f".repeat(64), raise.edgeId, raise.actCid),
    ] });
    expect(out.marked).toEqual([]);
    expect((await direct(runEdgeSeatFacts)({ fleetRoot })).fleets[0]!.rolled).toEqual([]);
  });

  it("keeps no roll for a fleet this vessel holds no face under", async () => {
    await expect(direct(runEdgeSeatMarks)({ fleetRoot: "f".repeat(64), rolls: [] })).rejects.toThrow(EdgeSeatError);
    await expect(direct(runEdgeSeatFacts)({ fleetRoot: "f".repeat(64) })).rejects.toThrow(EdgeSeatError);
  });
});

describe("the root's admit door reads the dyad's shadow", () => {
  it("binds nothing for a device its fleet board shows set aside, and binds again once the root lifts it", async () => {
    const device = "ad".repeat(32), other = "ac".repeat(32);
    await direct(runEdgeKapae)({ device, raised: true });
    await ownedStore(larDataDir(), async (repo) => {
      await expect(assertDyadBinds(repo, `0x${device.toUpperCase()}`)).rejects.toMatchObject({ name: "DeviceSetAside" });
      await expect(assertDyadBinds(repo, other)).resolves.toBeUndefined();                              // CONTROL
    });
    await direct(runEdgeKapae)({ device, raised: false });
    await ownedStore(larDataDir(), async (repo) => { await expect(assertDyadBinds(repo, device)).resolves.toBeUndefined(); });
  });

  it("the admit ceremony asks before it signs", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "commands", "device-admit.ts"), "utf8");
    const ask = src.indexOf("await assertDyadBinds(repo, opts.joineeVerifyingKey)");
    const sign = src.indexOf("await runDeviceAdmitEdge(");
    expect(ask).toBeGreaterThan(0);
    expect(sign).toBeGreaterThan(ask);
  });
});

describe("the device removal door signs the second act, or says which one it could not", () => {
  const scopeOf = (faceKey: string, nexus: string) => ({ faceKey, nexus }) as never;

  it("with no reader of the device's certificates it signs the marker alone and says so by name", async () => {
    const raise = await direct(runEdgeKapae)({ device: "aa".repeat(32), raised: true });
    expect(raise.shadowStands).toBe(true);
    expect(raise.withdrawals).toMatchObject({ signed: 0, unsigned: [] });
    expect(raise.withdrawals?.unread).toMatch(/signed no withdrawal/);
    // CONTROL: a lower, and a realm act, carry no withdrawal report at all.
    expect((await direct(runEdgeKapae)({ device: "aa".repeat(32), raised: false })).withdrawals).toBeUndefined();
  });

  it("it signs one withdrawal for each certificate handed in, keeps each, and names a face key that rests elsewhere", async () => {
    const faceSecret = new Uint8Array(32).fill(0x51), coldSecret = new Uint8Array(32).fill(0x52);
    const faceKey = hex(await ed.getPublicKeyAsync(faceSecret)), coldKey = hex(await ed.getPublicKeyAsync(coldSecret));
    const deviceFaceKey = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(0x53)));
    const memory = (faceKeyHex: string, nexus: string) => {
      const fold = foldWithdrawals(scopeOf(faceKeyHex, nexus), []);
      if (!("memory" in fold)) throw new Error("fixture: the history did not fold");
      return fold.memory;
    };
    const kept: unknown[] = [];
    const asked: string[][] = [];
    const device = "a9".repeat(32);
    const raise = await direct(runEdgeKapae)({
      device, raised: true,
      faceCertificates: {
        held: async (fleetRoot, deviceKey) => {
          asked.push([fleetRoot, deviceKey]);
          return [
            { vesselFaceKey: deviceFaceKey, history: memory(faceKey, "a1".repeat(32)), custody: { signAsFace: (_s, image) => ed.signAsync(image, faceSecret) } },
            { vesselFaceKey: deviceFaceKey, history: memory(coldKey, "b2".repeat(32)), custody: null },
          ];
        },
        keep: async (signed) => { kept.push(signed); },
      },
    });
    expect(raise.shadowStands).toBe(true);
    expect(raise.withdrawals).toMatchObject({ signed: 1, standing: 0, unsigned: [{ faceKey: coldKey, nexus: "b2".repeat(32), why: "face-key-rests-elsewhere" }] });
    expect(raise.withdrawals?.events).toHaveLength(1);
    expect(kept).toHaveLength(1);
    expect(asked).toEqual([[(await loadPersonaGroupRootVerifyingKey(0))!.toLowerCase(), device]]);
  });
  it("a read or a save that fails loses neither the marker nor the report", async () => {
    const unread = await direct(runEdgeKapae)({ device: "a7".repeat(32), raised: true,
      faceCertificates: { held: async () => { throw new Error("the face's state stands locked"); }, keep: async () => undefined } });
    expect(unread.shadowStands).toBe(true);
    expect(unread.withdrawals?.unread).toMatch(/could not read.*stands locked/);

    const faceSecret = new Uint8Array(32).fill(0x61);
    const faceKey = hex(await ed.getPublicKeyAsync(faceSecret));
    const fold = foldWithdrawals(scopeOf(faceKey, "a1".repeat(32)), []);
    if (!("memory" in fold)) throw new Error("fixture: the history did not fold");
    const unkept = await direct(runEdgeKapae)({ device: "a6".repeat(32), raised: true, faceCertificates: {
      held: async () => [{ vesselFaceKey: hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(0x62))), history: fold.memory, custody: { signAsFace: (_s, image) => ed.signAsync(image, faceSecret) } }],
      keep: async () => { throw new Error("the disk stands full"); },
    } });
    expect(unkept.shadowStands).toBe(true);
    expect(unkept.withdrawals?.events).toHaveLength(1);                       // the signed event rides out for a retry
    expect(unkept.withdrawals?.unsigned).toEqual([{ faceKey, nexus: "a1".repeat(32), why: "signed-and-not-kept: the disk stands full" }]);
  });
});
