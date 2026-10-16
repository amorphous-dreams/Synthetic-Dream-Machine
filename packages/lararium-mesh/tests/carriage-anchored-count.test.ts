/**
 * carriage-anchored-count.test.ts — the registry's fold counts an act at a CLOSED epoch when a counted chain
 * of roll anchors carries it to the head, and the act stood in every such anchor's causal past.
 *
 * Proven:
 *   · an admit at the closed epoch, carried by a counted anchor, counts at the head WITH ancestry, and reads
 *     `wrong-charter-epoch` WITHOUT it (today's fold, byte for byte),
 *   · an admit minted under the closed keys AFTER the roll stands in no anchor's past and never counts,
 *   · an orphan anchor beside the real one blocks nothing, at one roll and across two,
 *   · an anchor whose key-set hash misses the lineage refuses,
 *   · a revoke at the head citing the carried admit revokes it,
 *   · CONTROL: an epoch off the lineage never counts, whatever anchor names it.
 */
import { describe, test, expect } from "vitest";
import {
  carriageEntryActCid, foldCarriageDetails, foldCarriageSet, foldCarrierSet, signRollAnchor, rollAnchorCid,
  rollAnchorParents, type CarriageEntry, type RollAnchor,
} from "../src/carriage-registry.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import type { SealEpoch } from "../src/wax-stamp.js";
import { seatedCharter, charterSeatSeeds } from "./charter-fixture.js";
import { pubOf, kahuSigners, carriageAct } from "./fixtures/carriage.js";

const fixtureSeed = 741;
const OLD = charterSeatSeeds(fixtureSeed, 0, 3);
const MID = charterSeatSeeds(fixtureSeed, 1, 3);
const NEW = charterSeatSeeds(fixtureSeed, 2, 3);
const FORK = charterSeatSeeds(fixtureSeed + 1, 0, 3);
const JOINER = new Uint8Array(32).fill(5);
const PLACE = new Uint8Array(32).fill(11);
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);

async function charter(rolls: 1 | 2) {
  const genesis = await seatedCharter({ seats: 3, threshold: 2, seed: fixtureSeed });
  const first = await genesis.roll();
  const second = rolls === 2 ? await first.roll() : null;
  return {
    lineage: second ? [...second.chain] : [...first.chain],
    r0: genesis.roster, r1: first.roster, r2: second?.roster ?? null,
  };
}

async function anchor(closing: KahuQuorumSeats, opens: SealEpoch, parents: string[], signers: readonly Uint8Array[]): Promise<RollAnchor> {
  return signRollAnchor(
    { prevEpochCid: closing.sealEpochCid, sealEpochCid: opens.epochCid, prevKeys: closing.keys,
      prevThreshold: closing.threshold, parents },
    await kahuSigners(signers.slice(0, 2)),
  );
}

const detailOf = (d: Awaited<ReturnType<typeof foldCarriageDetails>>, e: CarriageEntry) =>
  d.entries.find((x) => x.evidenceCid === carriageEntryActCid(e))!;

describe("an act at the closed epoch counts through anchored ancestry", () => {
  test("★ an admit carried by a counted anchor counts at the head WITH ancestry, and drops WITHOUT it ★", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    const nym = await pubOf(JOINER);

    const bare = await foldCarriageDetails([admit], c.r1);
    expect(detailOf(bare, admit)).toMatchObject({ counted: false, reason: "wrong-charter-epoch" });
    expect(bare.members.has(nym)).toBe(false);

    const ancestry = { sealLineage: c.lineage, anchors: [roll] };
    const held = await foldCarriageDetails([admit], c.r1, ancestry);
    expect(detailOf(held, admit)).toMatchObject({ counted: true, state: "accepted", reason: "causal-head-accepted-through-anchored-ancestry" });
    expect(held.members.has(nym)).toBe(true);
    expect(await foldCarriageSet([admit], c.r1, ancestry)).toEqual(new Set([nym]));
  });

  test("a closed-epoch revoke carried across closes its carried admit at the head", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const rev = await carriageAct(JOINER, "revoke", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid, parents: [carriageEntryActCid(admit)] });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(rev)], MID);
    const d = await foldCarriageDetails([admit, rev], c.r1, { sealLineage: c.lineage, anchors: [roll] });
    expect(detailOf(d, rev)).toMatchObject({ counted: true, state: "revoked", reason: "causal-head-revoked-through-anchored-ancestry" });
    expect(detailOf(d, admit)).toMatchObject({ state: "ignored", reason: "superseded-by-descendant-through-anchored-ancestry" });
    expect(d.members.size).toBe(0);
  });

  test("a carry at the closed epoch carries across too; an act no anchor's past holds reads not-in-anchor-past", async () => {
    const c = await charter(1);
    const carry = await carriageAct(PLACE, "carry", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(carry)], MID);
    const ancestry = { sealLineage: c.lineage, anchors: [roll] };
    expect(await foldCarrierSet([carry], c.r1, ancestry)).toEqual(new Set([await pubOf(PLACE)]));
    expect(await foldCarrierSet([carry], c.r1)).toEqual(new Set());
    const stray = await carriageAct(seed(6), "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const d = await foldCarriageDetails([carry, stray], c.r1, ancestry);
    expect(detailOf(d, stray)).toMatchObject({ counted: false, reason: "not-in-anchor-past" });
  });

  test("★ an admit minted under the closed keys AFTER the roll never counts ★", async () => {
    const c = await charter(1);
    const before = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(before)], MID);
    const after = await carriageAct(seed(6), "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const d = await foldCarriageDetails([before, after], c.r1, { sealLineage: c.lineage, anchors: [roll] });
    expect(detailOf(d, before)).toMatchObject({ counted: true, state: "accepted" });
    expect(detailOf(d, after)).toMatchObject({ counted: false, reason: "not-in-anchor-past" });
    expect(d.members).toEqual(new Set([await pubOf(JOINER)]));
  });

  test("★ an orphan anchor beside the real one blocks nothing ★", async () => {
    const c = await charter(1);
    const prior = await carriageAct(seed(8), "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const orphan = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(prior)], MID);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const retry = await anchor(c.r0, c.lineage[1]!, await rollAnchorParents([prior, admit], [], c.r0), MID);
    expect(rollAnchorCid(orphan)).not.toBe(rollAnchorCid(retry));
    for (const anchors of [[orphan, retry], [retry, orphan]]) {
      const d = await foldCarriageDetails([prior, admit], c.r1, { sealLineage: c.lineage, anchors });
      expect(d.members).toEqual(new Set([await pubOf(seed(8)), await pubOf(JOINER)]));
    }
  });

  test("★ across two rolls, the walk tries each candidate anchor at a step ★", async () => {
    const c = await charter(2);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const orphan = await anchor(c.r0, c.lineage[1]!, [], MID);                                   // cites nothing
    const real = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    // The second roll cites the REAL first anchor alone; the orphan stands in no later anchor's past.
    const second = await anchor(c.r1, c.lineage[2]!, [rollAnchorCid(real)], NEW);
    for (const anchors of [[orphan, real, second], [real, orphan, second], [second, orphan, real]]) {
      const d = await foldCarriageDetails([admit], c.r2!, { sealLineage: c.lineage, anchors });
      expect(detailOf(d, admit)).toMatchObject({ counted: true, state: "accepted" });
    }
    // CONTROL: the orphan alone at the first step cannot carry it.
    const d = await foldCarriageDetails([admit], c.r2!, { sealLineage: c.lineage, anchors: [orphan, second] });
    expect(detailOf(d, admit)).toMatchObject({ counted: false, reason: "epoch-not-anchored" });
  });

  test("★ an anchor whose key-set hash misses the lineage refuses ★", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: FORK.slice(0, 2), epoch: c.r0.sealEpochCid });
    const unbound = await signRollAnchor(
      { prevEpochCid: c.r0.sealEpochCid, sealEpochCid: c.r1.sealEpochCid,
        prevKeys: await Promise.all(FORK.map(pubOf)), prevThreshold: 2, parents: [carriageEntryActCid(admit)] },
      await kahuSigners(MID.slice(0, 2)),
    );
    const d = await foldCarriageDetails([admit], c.r1, { sealLineage: c.lineage, anchors: [unbound] });
    expect(detailOf(d, admit)).toMatchObject({ counted: false, reason: "epoch-not-anchored" });
    expect(d.members.size).toBe(0);
  });

  test("★ a revoke at the head citing the carried admit revokes it ★", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    const revoke = await carriageAct(JOINER, "revoke", { kahu: MID.slice(0, 2), epoch: c.r1.sealEpochCid, parents: [carriageEntryActCid(admit)] });
    const d = await foldCarriageDetails([admit, revoke], c.r1, { sealLineage: c.lineage, anchors: [roll] });
    expect(detailOf(d, revoke)).toMatchObject({ counted: true, state: "revoked", reason: "causal-head-revoked" });
    expect(detailOf(d, admit)).toMatchObject({ state: "ignored", reason: "superseded-by-descendant-through-anchored-ancestry" });
    expect(d.members.size).toBe(0);
    // Without ancestry the parent stands at another epoch: today's missing-parent, unchanged.
    const bare = await foldCarriageDetails([admit, revoke], c.r1);
    expect(detailOf(bare, revoke)).toMatchObject({ counted: false, reason: "missing-parent" });
  });

  test("a parent at a DESCENDANT epoch never stands as a valid parent", async () => {
    const c = await charter(1);
    const headAdmit = await carriageAct(JOINER, "admit", { kahu: MID.slice(0, 2), epoch: c.r1.sealEpochCid });
    // A closed-epoch revoke citing a head act cannot stand in any anchor's past either; it never counts.
    const backRevoke = await carriageAct(JOINER, "revoke", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid, parents: [carriageEntryActCid(headAdmit)] });
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(backRevoke)], MID);
    const d = await foldCarriageDetails([headAdmit, backRevoke], c.r1, { sealLineage: c.lineage, anchors: [roll] });
    expect(detailOf(d, backRevoke).counted).toBe(false);
    expect(d.members).toEqual(new Set([await pubOf(JOINER)]));
  });

  test("★ CONTROL: an epoch off the lineage never counts, whatever anchor names it ★", async () => {
    const c = await charter(1);
    const forkFixture = await seatedCharter({ seats: 3, threshold: 2, seed: fixtureSeed + 1 });
    const admit = await carriageAct(JOINER, "admit", { kahu: FORK.slice(0, 2), epoch: forkFixture.head.epochCid });
    const roll = await signRollAnchor(
      { prevEpochCid: forkFixture.head.epochCid, sealEpochCid: c.r1.sealEpochCid, prevKeys: forkFixture.roster.keys,
        prevThreshold: 2, parents: [carriageEntryActCid(admit)] },
      await kahuSigners(MID.slice(0, 2)),
    );
    const d = await foldCarriageDetails([admit], c.r1, { sealLineage: c.lineage, anchors: [roll] });
    expect(detailOf(d, admit)).toMatchObject({ counted: false, reason: "epoch-not-anchored" });
    // And a torn lineage carries nothing.
    const real = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const realRoll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(real)], MID);
    const torn = await foldCarriageDetails([real], c.r1, { sealLineage: [c.lineage[1]!], anchors: [realRoll] });
    expect(detailOf(torn, real)).toMatchObject({ counted: false, reason: "epoch-not-anchored" });
  });
});

describe("review finding F1: a flood of refused anchors spends no walk budget", () => {
  test("three hundred forged anchors ahead of the real one leave the carried admit counted", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const real = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    // Each forgery names the right epoch, carries no signature, and differs by one cited parent, so each has its own CID.
    const junk = Array.from({ length: 300 }, (_, i) => ({ ...real, signatures: [], parents: [...real.parents, i.toString(16).padStart(64, "0")] }) as RollAnchor);
    expect(new Set(junk.map((a) => rollAnchorCid(a))).size).toBe(300);
    const d = await foldCarriageDetails([admit], c.r1, { sealLineage: c.lineage, anchors: [...junk, real] });
    expect(detailOf(d, admit)).toMatchObject({ counted: true, reason: "causal-head-accepted-through-anchored-ancestry" });
    // CONTROL: the forgeries alone carry nothing.
    const alone = await foldCarriageDetails([admit], c.r1, { sealLineage: c.lineage, anchors: junk });
    expect(detailOf(alone, admit)).toMatchObject({ counted: false, reason: "epoch-not-anchored" });
  });

  test("a stripped copy of the real anchor, carried after it, never erases it (either board order)", async () => {
    const c = await charter(1);
    const admit = await carriageAct(JOINER, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const real = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    const stripped = { ...real, signatures: [] } as RollAnchor;
    expect(rollAnchorCid(stripped)).toBe(rollAnchorCid(real));
    for (const anchors of [[real, stripped], [stripped, real]]) {
      const d = await foldCarriageDetails([admit], c.r1, { sealLineage: c.lineage, anchors });
      expect(detailOf(d, admit)).toMatchObject({ counted: true, reason: "causal-head-accepted-through-anchored-ancestry" });
    }
  });
});
