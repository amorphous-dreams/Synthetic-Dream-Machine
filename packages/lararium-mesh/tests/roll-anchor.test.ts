/**
 * roll-anchor.test.ts — Q3, ANCHORED ANCESTRY: an admit carries across a seal roll only if it stood in the
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
 *     board's roll-anchor parents leave out acts at any other epoch.
 */
import { describe, test, expect } from "vitest";
import {
  carriageEntryActCid, verifyPresentedAdmit, presentedAdmitFromBoard, signRollAnchor, rollAnchorCid,
  rollAnchorCounts, rollAnchorParents, isRollAnchor, CARRIAGE_ROLL_ANCHOR_DOMAIN,
  type CarriageEntry, type RollAnchor, type PresentedLineageAct,
} from "../src/carriage-registry.js";
import { rollAnchorsFromBoard, writeRollAnchor, writeCarriageEntry, carriageEntriesFromBoard } from "../src/carriage-board.js";
import { isPresentedAdmit } from "../src/auth-wire.js";
import { makeMultiSigQuorumVerifier, type KahuRoster } from "../src/kapae-antigen.js";
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
  const r1 = rotateSealEpoch(e0, midK, 2, sealKeySetHash(newK, 2));
  if (!r1.ok) throw new Error(r1.reason);
  const lineage: SealEpoch[] = [e0, r1.epoch];
  if (rolls === 2) {
    const r2 = rotateSealEpoch(r1.epoch, newK, 2, "");
    if (!r2.ok) throw new Error(r2.reason);
    lineage.push(r2.epoch);
  }
  const roster = (keys: string[], e: SealEpoch): KahuRoster => ({ keys, threshold: 2, sealEpochCid: e.epochCid });
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
  closing: KahuRoster, opens: SealEpoch, parents: string[], signers: readonly Uint8Array[],
): Promise<RollAnchor> {
  return signRollAnchor(
    { prevEpochCid: closing.sealEpochCid, sealEpochCid: opens.epochCid, prevKeys: closing.keys,
      prevThreshold: closing.threshold, parents },
    await kahuSigners(signers.slice(0, 2)),
  );
}

async function verify(admit: CarriageEntry, lineage: PresentedLineageAct[], head: KahuRoster,
                      sealLineage: SealEpoch[] | undefined, denyBoard: CarriageEntry[] = []) {
  return verifyPresentedAdmit({
    admit, lineage, roster: head, ...(sealLineage ? { sealLineage } : {}), denyBoard,
    antigen: [], antigenRoster: head, antigenVerifier: makeMultiSigQuorumVerifier(),
  });
}

describe("Q3 — an admit in the anchor's past carries across the roll", () => {
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
    const forkRoster: KahuRoster = { keys: forkKeys, threshold: 2, sealEpochCid: fork.epochCid };
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

describe("Q3 — a chain of rolls", () => {
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
  test("presentedAdmitFromBoard carries the anchor; the wire guard accepts it; HELD end-to-end", async () => {
    const c = await charter(1);
    const admit = await admitAt(c.r0.sealEpochCid, OLD);
    const board = emptyLarDoc();
    writeCarriageEntry(board, admit);
    const parents = await rollAnchorParents(carriageEntriesFromBoard(board), rollAnchorsFromBoard(board), c.r0);
    expect(parents).toEqual([carriageEntryActCid(admit)]);
    const roll = await anchor(c.r0, c.lineage[1]!, parents, MID);
    expect(await rollAnchorCounts(roll, c.r1)).toBe(true);
    writeRollAnchor(board, roll);
    // The entry extractor skips the anchor; the anchor extractor reads it whole.
    expect(carriageEntriesFromBoard(board)).toHaveLength(1);
    expect(rollAnchorsFromBoard(board).map(rollAnchorCid)).toEqual([rollAnchorCid(roll)]);

    // CONTROL: without the board's anchors the presenter finds nothing at the new head.
    expect(await presentedAdmitFromBoard(carriageEntriesFromBoard(board), await pubOf(JOINER), c.r1)).toBeNull();
    const p = await presentedAdmitFromBoard(carriageEntriesFromBoard(board), await pubOf(JOINER), c.r1, rollAnchorsFromBoard(board));
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
