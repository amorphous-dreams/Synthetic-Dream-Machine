/** The raise door reads a Nexus lease through its charter's verified seal lineage. */
import { describe, test, expect, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, charterHandLineage, leaseEpochSlotUri, storedLarRecord, type LarDoc } from "@lararium/mesh";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { rollQuorumLeaseOnBoard } from "../src/lease-rekey.js";
import { leaseEpochOnBoard } from "../src/vessel-raise.js";

const NEXUS = "nexus-" + "1".repeat(64), OTHER = "nexus-" + "2".repeat(64);
const repos: Repo[] = [];
afterEach(async () => { await Promise.all(repos.splice(0).map((r) => r.shutdown())); });

describe("the raise fence reads the signed lease epoch", () => {
  test("a verified lineage sees rolls; a null lineage never reads an epoch", async () => {
    const repo = new Repo({ network: [] }); repos.push(repo);
    const board = repo.create<LarDoc>(emptyLarDoc());
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 112 });
    const lineage = charterHandLineage(charter.chain)!.lineage;
    const signers = (await charter.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
    const old = leaseEpochSlotUri(NEXUS, "c".repeat(64));
    board.change((d) => { d.tiddlers[old] = storedLarRecord(old, { text: "9" }, "old-roll"); });
    expect(leaseEpochOnBoard(board, NEXUS, lineage)).toBe(0);
    expect(leaseEpochOnBoard(board, NEXUS, null)).toBeNull();
    await rollQuorumLeaseOnBoard(board, NEXUS, { lineage, signers });
    expect(leaseEpochOnBoard(board, NEXUS, lineage)).toBe(1);
    await rollQuorumLeaseOnBoard(board, NEXUS, { lineage, signers });
    expect(leaseEpochOnBoard(board, NEXUS, lineage)).toBe(2);
    await rollQuorumLeaseOnBoard(board, OTHER, { lineage, signers });
    expect(leaseEpochOnBoard(board, NEXUS, lineage)).toBe(2);
    expect(leaseEpochOnBoard(board, OTHER, lineage)).toBe(1);
    expect(leaseEpochOnBoard(board, OTHER, null)).toBeNull();
  });
});
