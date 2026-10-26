/** The realm admission fence reads signed quorum advances on the daemon board, apart from the feed. */
import { describe, it, expect, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, charterHandLineage, leaseEpochPrefix, leaseEpochSlotUri, storedLarRecord,
  realmMaintenanceFromBoard, realmFeedWrite, type LarDoc } from "@lararium/mesh";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { rollQuorumLeaseOnBoard } from "../src/lease-rekey.js";
import { cabalAdmissionEpoch } from "../src/commands/cabal-join.js";

const REALM = "a".repeat(64), OTHER = "c".repeat(64), WRITER = "b".repeat(64);
const repos: Repo[] = [];
afterEach(async () => { await Promise.all(repos.splice(0).map((r) => r.shutdown())); });
async function setup() {
  const repo = new Repo({ network: [] }); repos.push(repo);
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 111 });
  const lineage = charterHandLineage(charter.chain)!.lineage;
  const signers = (await charter.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
  return { handle, lineage, signers };
}

describe("signed roll and realm fence meet on the daemon board", () => {
  it("a threshold roll raises the fence; an unsigned integer and stored old record do not", async () => {
    const { handle, lineage, signers } = await setup();
    const slot = leaseEpochSlotUri(REALM, WRITER);
    handle.change((d) => { d.tiddlers[slot] = storedLarRecord(slot, { text: "7" }, "old-roll"); });
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(0);
    await rollQuorumLeaseOnBoard(handle, REALM, { lineage, signers });
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(1);
  });

  it("a roll on another resource leaves this realm's fence at genesis", async () => {
    const { handle, lineage, signers } = await setup();
    await rollQuorumLeaseOnBoard(handle, OTHER, { lineage, signers });
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(0);
  });

  it("two valid advances climb and a subthreshold hand changes nothing", async () => {
    const { handle, lineage, signers } = await setup();
    await expect(rollQuorumLeaseOnBoard(handle, REALM, { lineage, signers: signers.slice(0, 1) })).rejects.toThrow(/quorum/);
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(0);
    await rollQuorumLeaseOnBoard(handle, REALM, { lineage, signers });
    await rollQuorumLeaseOnBoard(handle, REALM, { lineage, signers });
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(2);
  });

  it("a lease advance registers no realm maintainer", async () => {
    const { handle, lineage, signers } = await setup();
    await rollQuorumLeaseOnBoard(handle, REALM, { lineage, signers });
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(1);
    expect(realmMaintenanceFromBoard(handle.doc(), REALM).maintainers).toEqual([]);
  });

  it("a feed occupies its own address space and leaves the lease fence cold", async () => {
    const { handle, lineage } = await setup();
    const feed = realmFeedWrite(REALM, WRITER, new Map());
    expect(feed.slotUri.startsWith(leaseEpochPrefix(REALM))).toBe(false);
    expect(feed.first).toBe(true);
    expect(cabalAdmissionEpoch(handle.doc(), REALM, lineage)).toBe(0);
  });
});
