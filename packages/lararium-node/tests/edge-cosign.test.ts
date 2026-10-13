import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  DAEMON_BAG_ID, NEXUS_DOC_DOMAIN, genesisCharterEpoch, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  edgeKapaeActsFromBoard, foldEdgeReadings, countEdgeActs, hex,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { ownedStore } from "../src/owned-store.js";
import { vesselEdgeCharter } from "../src/edge-board.js";
import { runEdgePartial, runEdgeCosign, EdgeCosignError } from "../src/commands/edge-cosign.js";

let roots: string[];
let priorLarRoot: string | undefined;
const REALM = "af".repeat(32), MEMBER = "bc".repeat(32);
const kahu = (keys: readonly string[]) => keys.map((verifyingKey, i) => ({ displayName: `Seat ${i}`, verifyingKey }));

async function stand(index: number, seatIndex: number, keys: string[]) {
  process.env["LAR_ROOT"] = roots[index]!;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(seatIndex);
  await generateOrLoadPersonaGroupRoot(8);
  const epoch = genesisCharterEpoch(keys, 2, "");
  writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: epoch.epochCid, sealLineage: [epoch], kahu: kahu(keys) });
  await ownedStore(larDataDir(), async (repo) => {
    const daemon = await import("@lararium/mesh").then((m) => m.seedDaemonDoc(repo));
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: daemon.url, kind: "oracle" } } }) }), "utf8");
  });
}

async function withRepo<T>(index: number, run: (repo: Repo) => Promise<T>): Promise<T> {
  process.env["LAR_ROOT"] = roots[index]!;
  return ownedStore(larDataDir(), run);
}

beforeEach(async () => {
  priorLarRoot = process.env["LAR_ROOT"];
  roots = [mkdtempSync(join(tmpdir(), "lares-cosign-a-")), mkdtempSync(join(tmpdir(), "lares-cosign-b-"))];
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(0);
  const keyA = (await loadPersonaGroupRootVerifyingKey(0))!;
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity(); await generateOrLoadPersonaGroupRoot(1);
  const keyB = (await loadPersonaGroupRootVerifyingKey(1))!;
  const keys = [keyA, keyB];
  await stand(0, 0, keys); await stand(1, 1, keys);
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A person's confirmed cosign: the confirmation names the very act the partial carries. */
const cosign = (repo: Repo, p: unknown) =>
  runEdgeCosign({ partial: p, sealHome: larSealHome(), repo, confirmActCid: (p as { act?: { actCid?: string } } | null)?.act?.actCid ?? "none" });

async function partial(index: number, raised = true) {
  process.env["LAR_ROOT"] = roots[index]!;
  const sealHome = larSealHome();
  return withRepo(index, (repo) => runEdgePartial({ realm: REALM, member: MEMBER, raised, sealHome, repo }));
}

async function board(index: number) {
  return withRepo(index, async (repo) => {
    const handle = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    const acts = edgeKapaeActsFromBoard(handle.doc());
    const counted = await countEdgeActs(acts, [], () => ({ quorum: true }), vesselEdgeCharter(REALM, larSealHome()));
    await repo.flush();
    return { readings: foldEdgeReadings(counted.acts), acts };
  });
}

describe("the cross-vessel quorum cosign door", () => {
  it("carries a raise between separate seat vessels and refuses replay", async () => {
    const a = await partial(0);
    expect(a.signed).toHaveLength(1);
    expect((await board(0)).readings.get(a.edgeId)).toBeUndefined();
    // An act short of its threshold lands on NO board: the partial door wrote nothing.
    expect((await board(0)).acts.map((x) => x.actCid)).not.toContain(a.actCid);
    const bResult = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(bResult.landed).toBe(true); expect(bResult.shadowStands).toBe(true); expect(bResult.added).toEqual([await loadPersonaGroupRootVerifyingKey(1)]);
    const returned = await withRepo(0, (repo) => cosign(repo, JSON.parse(JSON.stringify(bResult.partial))));
    expect(returned.landed).toBe(true); expect(returned.added).toEqual([]);
    expect((await board(0)).readings.get(a.edgeId)?.stands).toBe(true);
    await expect(withRepo(1, (repo) => cosign(repo, bResult.partial))).rejects.toMatchObject({ verdict: "replay" });
    // CONTROL: the other member edge remains absent on both independent boards.
    const control = "de".repeat(32);
    expect((await board(1)).readings.get(control)).toBeUndefined();
  });

  it("requires a seat on another vessel to finish a fresh partial", async () => {
    const a = await partial(0);
    await expect(withRepo(0, (repo) => cosign(repo, a.partial))).rejects.toThrow(EdgeCosignError);
    // CONTROL: the complementary seat can cosign it.
    await expect(withRepo(1, (repo) => cosign(repo, a.partial))).resolves.toMatchObject({ landed: true });
  });

  it("refuses malformed and subject-swapped partial text", async () => {
    const a = await partial(0); const changed = JSON.parse(JSON.stringify(a.partial)) as { subject: { member: string } };
    changed.subject.member = "cd".repeat(32);
    await expect(withRepo(1, (repo) => cosign(repo, { nonsense: true }))).rejects.toMatchObject({ verdict: "invalid" });
    await expect(withRepo(1, (repo) => cosign(repo, changed))).rejects.toMatchObject({ verdict: "invalid" });
    // CONTROL: intact partial is accepted by the complementary vessel.
    await expect(withRepo(1, (repo) => cosign(repo, a.partial))).resolves.toMatchObject({ landed: true });
  });

  it("lowers a raised edge across the same two vessels", async () => {
    const up = await partial(0);
    const fullUp = await withRepo(1, (repo) => cosign(repo, up.partial));
    await withRepo(0, (repo) => cosign(repo, fullUp.partial));
    const down = await partial(0, false);
    const fullDown = await withRepo(1, (repo) => cosign(repo, down.partial));
    expect(fullDown.landed).toBe(true); expect(fullDown.shadowStands).toBe(false);
    const landedAtA = await withRepo(0, (repo) => cosign(repo, fullDown.partial));
    expect(landedAtA.landed).toBe(true);
    // CONTROL: the raised state was standing before the causal lower landed there.
    expect((await board(0)).readings.get(up.edgeId)?.stands).toBe(false);
  });

  it("refuses a whole quorum and a vessel with no seated key", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const own = (await loadPersonaGroupRootVerifyingKey(0))!;
    const oneSeat = genesisCharterEpoch([own], 1, "");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: oneSeat.epochCid, sealLineage: [oneSeat], kahu: kahu([own]) });
    await expect(partial(0)).rejects.toThrow(/whole quorum/);
    process.env["LAR_ROOT"] = roots[1]!;
    const outsiderKey = (await loadPersonaGroupRootVerifyingKey(1))!;
    process.env["LAR_ROOT"] = roots[0]!;
    const noSeat = genesisCharterEpoch([outsiderKey], 1, "");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: noSeat.epochCid, sealLineage: [noSeat], kahu: kahu([outsiderKey]) });
    await expect(partial(0)).rejects.toThrow(/holds no seat/);
    // CONTROL: restoring the two-seat charter lets A produce a partial again.
    process.env["LAR_ROOT"] = roots[1]!;
    const keyB = (await loadPersonaGroupRootVerifyingKey(1))!;
    process.env["LAR_ROOT"] = roots[0]!;
    const keys = [(await generateOrLoadPersonaGroupRoot(0)).verifyingKey, keyB];
    const restored = genesisCharterEpoch(keys, 2, "");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: restored.epochCid, sealLineage: [restored], kahu: kahu(keys) });
    await expect(partial(0)).resolves.toHaveProperty("signed");
  });
  it("refuses a partial cut before the edge's line moved, and one cut under a charter head this vessel rolled past", async () => {
    const land = async (p: unknown) => {
      const atB = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(p))));
      await withRepo(0, (repo) => cosign(repo, JSON.parse(JSON.stringify(atB.partial))));
      return atB;
    };
    const first = await partial(0);
    await land(first.partial);
    // A cuts a lower that cites the raise, and holds it. The line then moves: a second raise lands on both boards.
    const heldLower = await partial(0, false);
    const second = await partial(0);
    expect(second.actCid).not.toBe(first.actCid);
    await land(second.partial);
    await expect(withRepo(1, (repo) => cosign(repo, heldLower.partial)))
      .rejects.toMatchObject({ verdict: "stale" });
    // CONTROL: a lower cut from the moved frontier lands, and the shadow comes down.
    const fresh = await partial(0, false);
    expect((await land(fresh.partial)).shadowStands).toBe(false);

    // THE EPOCH ROAD. B's charter head moves to another epoch after A cut a partial under the earlier one.
    const underOldHead = await partial(0);
    process.env["LAR_ROOT"] = roots[1]!;
    const keys = [(await (async () => { process.env["LAR_ROOT"] = roots[0]!; const k = (await loadPersonaGroupRootVerifyingKey(0))!; process.env["LAR_ROOT"] = roots[1]!; return k; })()), (await loadPersonaGroupRootVerifyingKey(1))!];
    const other = genesisCharterEpoch(keys, 2, "another-charter");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: other.epochCid, sealLineage: [other], kahu: kahu(keys) });
    await expect(withRepo(1, (repo) => cosign(repo, underOldHead.partial)))
      .rejects.toMatchObject({ verdict: "stale" });
  });
  it("a cosign that still falls short hands the grown partial on and lands nothing", async () => {
    // Three seats, all three needed; the third seat's vessel never appears.
    process.env["LAR_ROOT"] = roots[0]!;
    const keyA = (await loadPersonaGroupRootVerifyingKey(0))!;
    process.env["LAR_ROOT"] = roots[1]!;
    const keyB = (await loadPersonaGroupRootVerifyingKey(1))!;
    const keys = [keyA, keyB, hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(0xc3)))];
    const three = genesisCharterEpoch(keys, 3, "");
    for (const index of [0, 1]) {
      process.env["LAR_ROOT"] = roots[index]!;
      writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 3, sealEpochCid: three.epochCid, sealLineage: [three], kahu: kahu(keys) });
    }
    const a = await partial(0);
    const atB = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(atB.landed).toBe(false);
    expect(atB.signed).toHaveLength(2);
    expect(atB.added).toEqual([keyB]);
    expect((await board(1)).acts.map((x) => x.actCid)).not.toContain(a.actCid);
    // The grown partial carries both signatures on: the same vessel has nothing more to add.
    await expect(withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(atB.partial))))).rejects.toThrow(EdgeCosignError);
  });
  it("a read with no confirmation signs nothing and writes nothing", async () => {
    const a = await partial(0);
    const read = await withRepo(1, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(a.partial)), sealHome: larSealHome(), repo }));
    expect(read).toMatchObject({ would: "cosign", landed: false, added: [], subject: { kind: "member", member: MEMBER }, raised: true });
    expect(read.partial.act.signatures).toHaveLength(1);
    expect((await board(1)).acts).toEqual([]);
    // CONTROL: the confirmed call signs and lands, and a whole act read on the first vessel reads as landable.
    const done = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(done.landed).toBe(true);
    const whole = await withRepo(0, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(done.partial)), sealHome: larSealHome(), repo }));
    expect(whole).toMatchObject({ would: "land", landed: false });
    expect((await board(0)).acts).toEqual([]);
    // A confirmation that names another act refuses: the partial changed between the read and the signature.
    await expect(withRepo(0, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(done.partial)), sealHome: larSealHome(), repo, confirmActCid: "0".repeat(64) })))
      .rejects.toThrow(/differs from the act the confirmation names/);
    expect((await board(0)).acts).toEqual([]);
  });
});
