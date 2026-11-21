/** A lease reader takes the roster history from this vessel's own charter document. */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { charterHandLineage, emptyLarDoc, quorumLeaseEpochOnBoard, type LarDoc } from "@lararium/mesh";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { leaseCharterOf, LeaseCharterError } from "../src/lease-charter.js";
import { rollQuorumLeaseOnBoard } from "../src/lease-rekey.js";

const dirs: string[] = [], repos: Repo[] = [];
afterEach(async () => { await Promise.all(repos.splice(0).map((r) => r.shutdown())); for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function setup() {
  const home = mkdtempSync(join(tmpdir(), "lease-charter-")); dirs.push(home);
  const repo = new Repo({ network: [] }); repos.push(repo);
  return { home, repo };
}

describe("lease charter resolution", () => {
  test("an advance signed at an older seal epoch still counts through the rolled charter doc", async () => {
    const { home, repo } = setup();
    const first = await seatedCharter({ seats: 3, threshold: 2, seed: 119 });
    writeNexusDoc(home, first.doc());
    const resource = first.aid;
    const before = await leaseCharterOf({ repo, vesselKey: "a".repeat(64), sealHome: home, resource });
    const board = repo.create<LarDoc>(emptyLarDoc());
    const signers = (await first.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
    await rollQuorumLeaseOnBoard(board, resource, { lineage: before.lineage, signers });
    const rolled = await first.roll();
    writeNexusDoc(home, rolled.doc());
    const after = await leaseCharterOf({ repo, vesselKey: "a".repeat(64), sealHome: home, resource });
    expect(after.roster.sealEpochCid).toBe(rolled.head.epochCid);
    expect(quorumLeaseEpochOnBoard(board.doc(), resource, after.lineage)).toBe(1);
  });

  test("forged seal ancestry refuses by name; an honest charter supplies the control", async () => {
    const { home, repo } = setup();
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 120 });
    const resource = charter.aid;
    writeNexusDoc(home, charter.doc());
    expect((await leaseCharterOf({ repo, vesselKey: "a".repeat(64), sealHome: home, resource })).lineage)
      .toEqual(charterHandLineage(charter.chain)!.lineage);
    const doc = charter.doc();
    writeNexusDoc(home, { ...doc, sealLineage: [{ ...doc.sealLineage![0]!, keySetHash: "f".repeat(64) }] });
    await expect(leaseCharterOf({ repo, vesselKey: "a".repeat(64), sealHome: home, resource }))
      .rejects.toThrow(/forged-or-unreadable-lineage/);
  });
});
