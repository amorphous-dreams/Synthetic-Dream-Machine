/**
 * seal-fork — a fork stays a fork. A seal record names a sorted set of one or two predecessors; ABANDON closes a
 * branch under its own head's quorum and touches no sibling; REUNION signs one image both branch quorums share,
 * and its verifier stands unbuilt, so every two-predecessor record refuses `REUNION_UNBUILT`.
 */
import { describe, expect, test } from "vitest";
import { canonicalJson } from "../src/crypto.js";
import { CHARTER_ABANDON_DOMAIN, CHARTER_REUNION_DOMAIN } from "../src/domains.js";
import {
  detectDuplicity, mintCharterEpoch, readSealLineage, sealAbandonBytes, sealReunionBytes, verifySealAbandon,
  verifySealReunion, verifySealRoll, type SealAbandon, type SealReunionImage,
} from "../src/wax-stamp.js";
import { seatedCharter } from "./charter-fixture.js";

/** One genesis, and two branches rolled off it: the same committed successors seated under two different rules. */
async function forked() {
  const genesis = await seatedCharter({ seats: 2, threshold: 2, seed: 31 });
  const left = await genesis.roll({ threshold: 2 });
  const right = await genesis.roll({ threshold: 1 });
  return { genesis, left, right };
}

async function abandon(branch: Awaited<ReturnType<typeof forked>>["left"], scope = branch.aid, head = branch.head.epochCid, signers?: number[]): Promise<SealAbandon> {
  const bytes = sealAbandonBytes({ scope, head });
  const hands = await branch.signers(signers);
  return { kind: CHARTER_ABANDON_DOMAIN, scope, head, signatures: await Promise.all(hands.map(async (h) => ({ signer: h.signer, sig: await h.sign(bytes) }))) };
}

describe("predecessors", () => {
  test("a roll names its one predecessor; two branches off one head read as duplicity, and neither verifier picks one", async () => {
    const { genesis, left, right } = await forked();
    expect(left.head.predecessors).toEqual([genesis.head.epochCid]);
    expect(right.head.predecessors).toEqual([genesis.head.epochCid]);
    expect(left.head.epochCid).not.toBe(right.head.epochCid);
    expect(readSealLineage(left.chain)).toBeNull();
    expect(readSealLineage(right.chain)).toBeNull();
    expect(detectDuplicity(left.chain, right.chain)).toBe(genesis.head.epochCid);
  });

  test("REUNION_UNBUILT: a record naming both heads refuses at the lineage reader and the roll verifier", async () => {
    const { left, right } = await forked();
    const heads = [left.head.epochCid, right.head.epochCid].sort();
    const reunion = mintCharterEpoch({ keySetHash: left.head.keySetHash, nextKeyDigests: left.head.nextKeyDigests,
      nextThreshold: left.head.nextThreshold, predecessors: heads }, left.head.roll);
    expect(readSealLineage([...left.chain, reunion])).toBe("REUNION_UNBUILT");
    expect(verifySealRoll(left.head, reunion)).toBe("REUNION_UNBUILT");
    // CONTROL: the same record with one predecessor reads by the roll law, never by the reunion name.
    expect(verifySealRoll(left.head, { ...reunion, predecessors: [left.head.epochCid] })).not.toBe("REUNION_UNBUILT");
  });
});

describe("abandon", () => {
  test("a branch's own quorum at its head closes it; another scope, a passed head, a short quorum or a sibling's hands refuse", async () => {
    const { genesis, left, right } = await forked();
    expect(verifySealAbandon(left.chain, await abandon(left))).toBeNull();
    expect(verifySealAbandon(left.chain, { ...(await abandon(left)), extra: 1 } as SealAbandon)).toBe("abandon-malformed");
    expect(verifySealAbandon(left.chain, await abandon(left, `nexus-${"00".repeat(32)}`))).toBe("abandon-another-scope");
    expect(verifySealAbandon(left.chain, await abandon(left, left.aid, genesis.head.epochCid))).toBe("abandon-not-the-head");
    expect(verifySealAbandon(left.chain, await abandon(left, left.aid, left.head.epochCid, [0]))).toBe("abandon-short-of-quorum");
    // The right branch's own abandon names the right head: it never closes the left branch.
    expect(verifySealAbandon(right.chain, await abandon(right))).toBeNull();
    expect(verifySealAbandon(left.chain, await abandon(right))).toBe("abandon-not-the-head");
    // Bytes the record does not name verify nothing: a signature moved onto another head counts no seat.
    const moved = { ...(await abandon(left)), head: right.head.epochCid };
    expect(verifySealAbandon(right.chain, moved)).toBe("abandon-short-of-quorum");
  });
});

describe("reunion", () => {
  test("one image, both heads sorted, identical bytes in either order; its verifier refuses by name until it lands", async () => {
    const { left, right } = await forked();
    const image: SealReunionImage = { kind: CHARTER_REUNION_DOMAIN, scope: left.aid, heads: [left.head.epochCid, right.head.epochCid],
      keys: [...left.keys], threshold: 2, nextKeyDigests: [...left.head.nextKeyDigests], nextThreshold: 2 };
    const swapped: SealReunionImage = { ...image, heads: [right.head.epochCid, left.head.epochCid], keys: [...left.keys].reverse() };
    expect(Buffer.from(sealReunionBytes(swapped)).equals(Buffer.from(sealReunionBytes(image)))).toBe(true);
    expect(new TextDecoder().decode(sealReunionBytes(image))).toContain(CHARTER_REUNION_DOMAIN);
    expect(canonicalJson(JSON.parse(new TextDecoder().decode(sealReunionBytes(image))).heads)).toBe(canonicalJson([left.head.epochCid, right.head.epochCid].sort()));
    expect(verifySealReunion([left.chain, right.chain], image, [])).toBe("REUNION_UNBUILT");
  });
});
