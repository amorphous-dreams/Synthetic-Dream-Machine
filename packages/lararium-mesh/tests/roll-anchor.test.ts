/**
 * roll-anchor.test.ts — ANCHORED ANCESTRY: an admit carries across a seal roll only if it stood in the
 * board's causal past at the roll.
 *
 * Proven:
 *   · an admit in the anchor's past reads HELD at the new head (one roll, and two),
 *   · CONTROL: an admit minted under the closed epoch's keys AFTER the anchor reads WRONG-EPOCH,
 *   · CONTROL: a forged anchor (signed by the CLOSED keys, or tampered), an anchor whose key-set the charter
 *     does not bind, a missing link, an unchained link, and an admit at a non-ancestor epoch read WRONG-EPOCH,
 *   · CONTROL: a revoke at the closed epoch descending from the admit reads DENIED after the roll, whether it
 *     landed before the roll or after it,
 *   · the presenter derives the anchored presentation off the board, the wire guard accepts it, and the
 *     board's roll-anchor parents leave out acts at any other epoch,
 *   · ORPHAN ANCHOR: when two anchors open one epoch, the presenter tries each and presents through the one
 *     whose chain carries the admit, and surfaces the fork as an informational finding — never a refusal.
 */
import { describe, test, expect } from "vitest";
import {
  carriageEntryActCid, verifyPresentedAdmit, signRollAnchor, rollAnchorCid,
  rollAnchorCounts, rollAnchorParents, isRollAnchor, CARRIAGE_ROLL_ANCHOR_DOMAIN,
  type CarriageEntry, type RollAnchor, type PresentedLineageAct,
} from "../src/carriage-registry.js";
import {
  rollAnchorsFromBoard, writeRollAnchor, writeCarriageEntry, carriageEntriesFromBoard, presentationFromBoardDoc,
} from "../src/carriage-board.js";
import { isPresentedAdmit } from "../src/auth-wire.js";
import { makeMultiSigQuorumVerifier, type KahuQuorumSeats } from "../src/kapae-antigen.js";
import { genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, type SealEpoch } from "../src/wax-stamp.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { pubOf, kahuSigners, carriageAct } from "./fixtures/carriage.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const OLD  = [seed(1), seed(2), seed(3)];     // the epoch-0 kahu
const MID  = [seed(21), seed(22), seed(23)];  // the epoch-1 kahu
const NEW  = [seed(31), seed(32), seed(33)];  // the epoch-2 kahu
const JOINER = seed(5);
const FORK   = [seed(41), seed(42), seed(43)];

const keysOf = (seeds: readonly Uint8Array[]): Promise<string[]> => Promise.all(seeds.map(pubOf));

/** A real pre-rotated charter: genesis under OLD, rolled to MID, then (optionally) to NEW. */
async function charter(rolls: 1 | 2) {
  const [oldK, midK, newK] = await Promise.all([keysOf(OLD), keysOf(MID), keysOf(NEW)]);
  const e0 = genesisCharterEpoch(oldK, 2, sealKeySetHash(midK, 2));
  const r1 = await rotateSealEpoch(e0, { keys: midK, threshold: 2 }, sealKeySetHash(newK, 2), await kahuSigners(MID));
  if (!r1.ok) throw new Error(r1.reason);
  const lineage: SealEpoch[] = [e0, r1.epoch];
  if (rolls === 2) {
    const r2 = await rotateSealEpoch(r1.epoch, { keys: newK, threshold: 2 }, "", await kahuSigners(NEW));
    if (!r2.ok) throw new Error(r2.reason);
    lineage.push(r2.epoch);
  }
  const roster = (keys: string[], e: SealEpoch): KahuQuorumSeats => ({ keys, threshold: 2, sealEpochCid: e.epochCid });
  return {
    lineage,
    r0: roster(oldK, lineage[0]!), r1: roster(midK, lineage[1]!),
    r2: rolls === 2 ? roster(newK, lineage[2]!) : null,
  };
}

async function admitAt(epoch: string, kahu: readonly Uint8Array[], parents: string[] = []): Promise<CarriageEntry> {
  return carriageAct(JOINER, "admit", { kahu: kahu.slice(0, 2), epoch, parents });
}
async function revokeAt(epoch: string, kahu: readonly Uint8Array[], parents: string[]): Promise<CarriageEntry> {
  return carriageAct(JOINER, "revoke", { kahu: kahu.slice(0, 2), epoch, parents });
}
async function anchor(
  closing: KahuQuorumSeats, opens: SealEpoch, parents: string[], signers: readonly Uint8Array[],
): Promise<RollAnchor> {
  return signRollAnchor(
    { prevEpochCid: closing.sealEpochCid, sealEpochCid: opens.epochCid, prevKeys: closing.keys,
      prevThreshold: closing.threshold, parents },
    await kahuSigners(signers.slice(0, 2)),
  );
}

async function verify(admit: CarriageEntry, lineage: PresentedLineageAct[], head: KahuQuorumSeats,
                      sealLineage: SealEpoch[] | undefined, denyBoard: CarriageEntry[] = []) {
  return verifyPresentedAdmit({
    admit, lineage, roster: head, ...(sealLineage ? { sealLineage } : {}), denyBoard,
    antigen: [], antigenRoster: head, antigenVerifier: makeMultiSigQuorumVerifier(),
  });
}

describe("an admit in the anchor's past carries across the roll", () => {
  test("★ an admit in the anchor's past reads HELD at the new head ★", async () => {
    const c = await charter(1);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const roll  = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    // CONTROL: without the anchor the same admit stays off the head — the roll alone carries nothing.
    expect(await verify(admit, [], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch" });
    expect(await verify(admit, [roll], c.r1, c.lineage)).toMatchObject({ state: "held" });
  });

  test("★ CONTROL: an admit minted at the closed epoch AFTER the anchor reads WRONG-EPOCH ★", async () => {
    const c = await charter(1);
    const before = await admitAt(c.r0.sealEpochCid, OLD);
    const roll   = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(before)], MID);
    // The closed keys still sign at the closed epoch — the act counts there, and stands in no anchor's past.
    const other  = seed(6);
    const after  = await carriageAct(other, "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    expect(await verify(before, [roll], c.r1, c.lineage)).toMatchObject({ state: "held" });
    expect(await verify(after, [roll], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "admit-not-in-anchor-past" });
  });

  test("★ CONTROL: a forged anchor reads WRONG-EPOCH ★", async () => {
    const c = await charter(1);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const parents = [carriageEntryActCid(admit)];
    // Signed by the CLOSED keys — the keys a roll may exist to retire.
    const byOld = await anchor(c.r0, c.lineage[1]!, parents, OLD);
    expect(await verify(admit, [byOld], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "anchor-not-counted" });
    // A tampered signature.
    const honest = await anchor(c.r0, c.lineage[1]!, parents, MID);
    const flip = (s: string) => (s[0] === "0" ? "1" : "0") + s.slice(1);
    const tampered: RollAnchor = { ...honest, signatures: honest.signatures.map((s) => ({ ...s, sig: flip(s.sig) })) };
    expect(await verify(admit, [tampered], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch" });
    // A key-set the charter does not bind to the closed epoch, signed by the honest new quorum.
    const unbound = await signRollAnchor(
      { prevEpochCid: c.r0.sealEpochCid, sealEpochCid: c.r1.sealEpochCid, prevKeys: await keysOf(FORK),
        prevThreshold: 2, parents },
      await kahuSigners(MID.slice(0, 2)),
    );
    expect(await verify(admit, [unbound], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "anchor-key-set-unbound" });
    // CONTROL: the honest anchor holds.
    expect(await verify(admit, [honest], c.r1, c.lineage)).toMatchObject({ state: "held" });
  });

  test("★ CONTROL: a non-ancestor chain reads WRONG-EPOCH ★", async () => {
    const c = await charter(1);
    // A FORKED genesis: internally valid, never on this charter's lineage.
    const forkKeys = await keysOf(FORK);
    const fork = genesisCharterEpoch(forkKeys, 2, sealKeySetHash(await keysOf(MID), 2));
    const forkRoster: KahuQuorumSeats = { keys: forkKeys, threshold: 2, sealEpochCid: fork.epochCid };
    const admit = await admitAt(fork.epochCid, FORK);
    const roll = await signRollAnchor(
      { prevEpochCid: fork.epochCid, sealEpochCid: c.r1.sealEpochCid, prevKeys: forkRoster.keys,
        prevThreshold: 2, parents: [carriageEntryActCid(admit)] },
      await kahuSigners(MID.slice(0, 2)),
    );
    expect(await verify(admit, [roll], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "admit-epoch-not-an-ancestor" });
    // No charter lineage at all: fail closed.
    const real = await admitAt(c.r0.sealEpochCid, OLD);
    const realRoll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(real)], MID);
    expect(await verify(real, [realRoll], c.r1, undefined)).toMatchObject({ state: "wrong-epoch", reason: "no-charter-lineage" });
  });

  test("★ CONTROL: a revoke at the closed epoch descending from the admit reads DENIED after the roll ★", async () => {
    const c = await charter(1);
    const admit  = await admitAt(c.r0.sealEpochCid, OLD);
    const revoke = await revokeAt(c.r0.sealEpochCid, OLD, [carriageEntryActCid(admit)]);
    // Landed BEFORE the roll: the anchor cites the revoke, and the admit sits in its past through it.
    const rollOverRevoke = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(revoke)], MID);
    expect(await verify(admit, [rollOverRevoke], c.r1, c.lineage, [revoke])).toMatchObject({ state: "denied" });
    // Landed AFTER the roll, under the closed keys: a denial still closes — only a grant needs the anchor.
    const rollOverAdmit = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    expect(await verify(admit, [rollOverAdmit], c.r1, c.lineage)).toMatchObject({ state: "held" });       // control
    expect(await verify(admit, [rollOverAdmit], c.r1, c.lineage, [revoke])).toMatchObject({ state: "denied" });
    // A revoke at the NEW epoch citing the old admit closes it too.
    const newRevoke = await revokeAt(c.r1.sealEpochCid, MID, [carriageEntryActCid(admit)]);
    expect(await verify(admit, [rollOverAdmit], c.r1, c.lineage, [newRevoke])).toMatchObject({ state: "denied" });
  });
});

describe("a chain of rolls", () => {
  test("two rolls carry an epoch-0 admit HELD; a missing or unchained link reads WRONG-EPOCH", async () => {
    const c = await charter(2);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const a1 = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    const a2 = await anchor(c.r1, c.lineage[2]!, [rollAnchorCid(a1)], NEW);
    expect(await verify(admit, [a1, a2], c.r2!, c.lineage)).toMatchObject({ state: "held" });
    expect(await verify(admit, [a2], c.r2!, c.lineage)).toMatchObject({ state: "wrong-epoch" });
    // a2' does not cite a1: the chain breaks.
    const loose = await anchor(c.r1, c.lineage[2]!, [carriageEntryActCid(admit)], NEW);
    expect(await verify(admit, [a1, loose], c.r2!, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "anchor-chain-broken" });
  });
});

describe("the presenter, the wire guard, and the board", () => {
  test("the one presenter carries the anchor; the wire guard accepts it; HELD end-to-end", async () => {
    const c = await charter(1);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const board = emptyLarDoc();
    writeCarriageEntry(board, admit);
    const parents = await rollAnchorParents(carriageEntriesFromBoard(board), rollAnchorsFromBoard(board), c.r0);
    expect(parents).toEqual([carriageEntryActCid(admit)]);
    const roll = await anchor(c.r0, c.lineage[1]!, parents, MID);
    expect(await rollAnchorCounts(roll, c.r1)).toBe(true);
    // CONTROL: before the board carries the anchor, the presenter finds nothing at the new head.
    expect((await presentationFromBoardDoc(board, await pubOf(JOINER), c.r1)).presentation).toBeNull();
    writeRollAnchor(board, roll);
    // The entry extractor skips the anchor; the anchor extractor reads it whole.
    expect(carriageEntriesFromBoard(board)).toHaveLength(1);
    expect(rollAnchorsFromBoard(board).map(rollAnchorCid)).toEqual([rollAnchorCid(roll)]);

    const { presentation: p } = await presentationFromBoardDoc(board, await pubOf(JOINER), c.r1);
    expect(p).not.toBeNull();
    expect(p!.lineage.filter(isRollAnchor)).toHaveLength(1);
    expect(isPresentedAdmit({ admit: p!.admit, lineage: p!.lineage })).toBe(true);
    expect(await verify(p!.admit, [...p!.lineage], c.r1, c.lineage, carriageEntriesFromBoard(board))).toMatchObject({ state: "held" });
  });

  test("the roll's parents leave out acts at other epochs, and a stale-key act after the roll", async () => {
    const c = await charter(2);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const a1 = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    const stale = await carriageAct(seed(6), "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    const atMid = await carriageAct(seed(7), "admit", { kahu: MID.slice(0, 2), epoch: c.r1.sealEpochCid });
    const parents = await rollAnchorParents([admit, stale, atMid], [a1], c.r1);
    expect(parents).toEqual([carriageEntryActCid(atMid), rollAnchorCid(a1)].sort());
  });

  test("the anchor names its own domain and a malformed anchor fails the wire guard", async () => {
    const c = await charter(1);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const roll = await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID);
    expect(roll.kind).toBe(CARRIAGE_ROLL_ANCHOR_DOMAIN);
    expect(isPresentedAdmit({ admit, lineage: [roll] })).toBe(true);
    expect(isPresentedAdmit({ admit, lineage: [{ ...roll, parents: ["not-a-cid"] }] })).toBe(false);
    // A carriage act at another epoch is still refused by the guard: only an anchor crosses epochs.
    const elsewhere = await revokeAt(c.r1.sealEpochCid, MID, [carriageEntryActCid(admit)]);
    expect(isPresentedAdmit({ admit, lineage: [elsewhere] })).toBe(false);
  });
});

describe("the orphan anchor — two anchors open one epoch", () => {
  /**
   * A rotate retried over one commitment: the first attempt landed its anchor and wrote no head; between the
   * attempts an admit landed at the closing epoch; the retry's anchor cites it. Both anchors open the SAME new
   * epoch and both count there. The orphan's past lacks the admit.
   */
  async function retriedRoll(otherSeed = 8) {
    const c = await charter(1);
    const board = emptyLarDoc();
    // A standing act on another nym, so the orphan cites something.
    const priorOther = await carriageAct(seed(otherSeed), "admit", { kahu: OLD.slice(0, 2), epoch: c.r0.sealEpochCid });
    writeCarriageEntry(board, priorOther);
    const orphan = await anchor(c.r0, c.lineage[1]!, await rollAnchorParents(carriageEntriesFromBoard(board), [], c.r0), MID);
    writeRollAnchor(board, orphan);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);   // lands between the attempts
    writeCarriageEntry(board, admit);
    const retry = await anchor(c.r0, c.lineage[1]!, await rollAnchorParents(carriageEntriesFromBoard(board), [], c.r0), MID);
    writeRollAnchor(board, retry);
    return { c, board, admit, orphan, retry };
  }

  test("★ the presenter carries the admit through the anchor whose past holds it, though the ORPHAN sorts first ★", async () => {
    // Pick a fixture whose orphan sorts BEFORE the retry, so a presenter taking the lowest CID would pick it.
    let fixture = await retriedRoll(8);
    for (let n = 9; rollAnchorCid(fixture.orphan) > rollAnchorCid(fixture.retry) && n < 40; n++) fixture = await retriedRoll(n);
    const { c, board, admit, orphan, retry } = fixture;
    expect(rollAnchorCid(orphan) < rollAnchorCid(retry), "the fixture never put the orphan first").toBe(true);
    expect(await rollAnchorCounts(orphan, c.r1)).toBe(true);
    expect(await rollAnchorCounts(retry, c.r1)).toBe(true);
    const nym = await pubOf(JOINER);
    // The orphan sorts first, and the presentation still never depends on it.
    {
      const { presentation, findings } = await presentationFromBoardDoc(board, nym, c.r1);
      expect(presentation, "an orphan anchor hid a carried admit").not.toBeNull();
      expect(presentation!.lineage.filter(isRollAnchor).map(rollAnchorCid)).toEqual([rollAnchorCid(retry)]);
      expect(await verify(presentation!.admit, [...presentation!.lineage], c.r1, c.lineage)).toMatchObject({ state: "held" });
      // The fork SURFACES — informational, naming the epoch and both anchors.
      expect(findings).toEqual([{
        kind: "anchors-open-one-epoch", epochCid: c.r1.sealEpochCid,
        anchorCids: [rollAnchorCid(orphan), rollAnchorCid(retry)].sort(),
      }]);
    }
    // CONTROL: presenting through the orphan alone is exactly what the verifier refuses.
    expect(await verify(admit, [orphan], c.r1, c.lineage)).toMatchObject({ state: "wrong-epoch", reason: "admit-not-in-anchor-past" });
  });

  test("CONTROL — an act in BOTH anchors' past presents, and the fork still surfaces without refusing", async () => {
    const { c, board, orphan } = await retriedRoll();
    const both = await presentationFromBoardDoc(board, await pubOf(seed(8)), c.r1);   // the act both anchors cite
    expect(both.presentation).not.toBeNull();
    expect(both.findings).toHaveLength(1);
    void orphan;
  });

  test("CONTROL — one anchor per epoch surfaces no finding", async () => {
    const c = await charter(1);
    const board = emptyLarDoc();
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    writeCarriageEntry(board, admit);
    writeRollAnchor(board, await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID));
    const read = await presentationFromBoardDoc(board, await pubOf(JOINER), c.r1);
    expect(read.presentation).not.toBeNull();
    expect(read.findings).toEqual([]);
  });

  test("the one presenter reads the anchors off the SAME doc — an admit minted before the roll presents at the new head", async () => {
    const c = await charter(1);
    const board = emptyLarDoc();
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    writeCarriageEntry(board, admit);
    writeRollAnchor(board, await anchor(c.r0, c.lineage[1]!, [carriageEntryActCid(admit)], MID));
    const { presentation } = await presentationFromBoardDoc(board, await pubOf(JOINER), c.r1);
    expect(presentation).not.toBeNull();
    expect(await verify(presentation!.admit, [...presentation!.lineage], c.r1, c.lineage)).toMatchObject({ state: "held" });
  });
});
