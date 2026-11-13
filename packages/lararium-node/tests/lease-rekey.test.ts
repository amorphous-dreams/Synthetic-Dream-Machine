/** A Nexus lease rises only on a signed charter quorum advance. */
import { describe, test, expect, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { init as amInit, from as amFrom, clone as amClone, change as amChange, merge as amMerge, getConflicts, type Doc } from "@automerge/automerge";
import {
  emptyLarDoc, charterHandLineage, quorumLeaseEpochOnBoard, leaseEpochSlotUri, storedLarRecord,
  type LarDoc,
} from "@lararium/mesh";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { rollQuorumLeaseOnBoard } from "../src/lease-rekey.js";

const RESOURCE = "nexus-" + "a".repeat(64);
const REALM = "b".repeat(64);
const WRITER = "c".repeat(64);

function rawHandle(initial: Doc<LarDoc>): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void; readonly raw: Doc<LarDoc> } {
  let d = initial;
  return { doc: () => d, change: (fn) => { d = amChange(d, fn as (x: LarDoc) => void); }, get raw() { return d; } };
}

const setup = async () => {
  const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 110 });
  const lineage = charterHandLineage(charter.chain)!.lineage;
  const signers = (await charter.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
  return { charter, lineage, signers };
};

describe("quorum lease rekey", () => {
  const repos: Repo[] = [];
  afterEach(async () => { for (const r of repos.splice(0)) await r.shutdown(); });

  test("a threshold roll raises the signed epoch; a single seat signs nothing", async () => {
    const { lineage, signers } = await setup();
    const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
    const board = repo.create<LarDoc>(emptyLarDoc());
    await expect(rollQuorumLeaseOnBoard(board, RESOURCE, { lineage, signers: signers.slice(0, 1) })).rejects.toThrow(/quorum/);
    expect(quorumLeaseEpochOnBoard(board.doc(), RESOURCE, lineage)).toBe(0);
    const r = await rollQuorumLeaseOnBoard(board, RESOURCE, { lineage, signers });
    expect(r).toMatchObject({ resource: RESOURCE, signers: signers.map((s) => s.key), effective: 0, rolled: 1 });
    expect(quorumLeaseEpochOnBoard(board.doc(), RESOURCE, lineage)).toBe(1);
    const second = await rollQuorumLeaseOnBoard(board, RESOURCE, { lineage, signers });
    expect(second.rolled).toBe(2);
    expect(quorumLeaseEpochOnBoard(board.doc(), RESOURCE, lineage)).toBe(2);
  });

  test("a bare integer and old stored writer record on a realm raise nothing; a threshold roll does", async () => {
    const { lineage, signers } = await setup();
    const board = rawHandle(amFrom(emptyLarDoc() as LarDoc));
    const slot = leaseEpochSlotUri(REALM, WRITER);
    board.change((d) => { d.tiddlers[slot] = storedLarRecord(slot, { text: "9" }, "old-roll"); });
    expect(quorumLeaseEpochOnBoard(board.doc(), REALM, lineage)).toBe(0);
    const r = await rollQuorumLeaseOnBoard(board as never, REALM, { lineage, signers });
    expect(r.rolled).toBe(1);
    expect(quorumLeaseEpochOnBoard(board.doc(), REALM, lineage)).toBe(1);
  });

  test("concurrent signed rolls survive merge, and a later roll climbs", async () => {
    const { lineage, signers } = await setup();
    const base = amFrom(emptyLarDoc() as LarDoc);
    const a = rawHandle(amClone(base)), b = rawHandle(amClone(base));
    await rollQuorumLeaseOnBoard(a as never, RESOURCE, { lineage, signers });
    await rollQuorumLeaseOnBoard(b as never, RESOURCE, { lineage, signers });
    const merged = rawHandle(amMerge(amClone(a.raw), b.raw));
    expect(quorumLeaseEpochOnBoard(merged.doc(), RESOURCE, lineage)).toBe(1);
    await rollQuorumLeaseOnBoard(merged as never, RESOURCE, { lineage, signers });
    expect(quorumLeaseEpochOnBoard(merged.doc(), RESOURCE, lineage)).toBe(2);
    const stale = rawHandle(amClone(base));
    await rollQuorumLeaseOnBoard(stale as never, RESOURCE, { lineage, signers });
    expect(quorumLeaseEpochOnBoard(amMerge(amClone(merged.raw), stale.raw), RESOURCE, lineage)).toBe(2);
  });

  test("CONTROL: a shared scalar can discard a higher concurrent value", () => {
    const key = "scalar-control";
    const write = (actor: string, value: number) => amChange(amInit<Record<string, unknown>>(actor), (d) => { d[key] = String(value); });
    const a = write("aaaaaaaa", 111), b = write("bbbbbbbb", 222);
    const probe = amMerge(amMerge(amInit<Record<string, unknown>>(), a), b);
    const bWins = probe[key] === "222";
    expect(Object.keys(getConflicts(probe, key as never) ?? {})).toHaveLength(2);
    const high = write("aaaaaaaa", bWins ? 9 : 1), low = write("bbbbbbbb", bWins ? 1 : 9);
    const merged = amMerge(amMerge(amInit<Record<string, unknown>>(), high), low);
    expect(Number(merged[key])).toBe(1);
  });
});
