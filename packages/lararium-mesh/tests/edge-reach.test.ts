/**
 * edge-reach — the model of removal at the edge grain: two hands, rolls that carry shadows, a ledger that
 * keeps what a reader counted, and lineage standing.
 *
 * Every vector carries a CONTROL beside it, so a rule fences the hazard and never freezes the marker.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae (#/edge-hands · #/rolls · #/accretion · #/reach)
 */
import { describe, expect, test } from "vitest";
import {
  signEdgeKapae, edgeKapaeBytes, edgeKapaeActCid, edgeKapaeKey, writeEdgeKapae, edgeKapaeActsFromBoard, mergeEdgeActs,
  countEdgeActs, foldEdgeReadings, readEdgeBoard, shadowedEdges, edgeShadowStands, edgeLineHeads,
  signEdgeRollAnchor, edgeRollAnchorCid, edgeRollAnchorCounts, edgeRollAnchorParents, writeEdgeRollAnchor, mergeEdgeRollAnchors,
  edgeRollAnchorsFromBoard, EDGE_KAPAE_DOMAIN,
  keepInLedger, keptFromLedger, restoreToBoard, rolledRaises, markRaiseRolled, ledgerScopes, keptSeatRolls, raisesSeenThrough,
  memberEdgeId, realmEdgeAuthority, lineageStanding, memberStandsAside,
  signCabalInvite, vouchEdgeId, deviceEdgeId, fleetEdgeAuthority, edgeStandingOf,
  emptyLarDoc, mutableLarRecord,
  type EdgeKapae, type EdgeRollAnchor, type EdgeCharter, type EdgeAuthority, type EdgeHand, type LarDoc, type CabalInvite,
} from "../src/index.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, signSeatRoll, type SeatRoll, type SignedSeatRoll } from "../src/index.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import type { SealEpoch } from "../src/wax-stamp.js";
import { seatedCharter, charterSeatSeeds } from "./charter-fixture.js";
import { pubOf, kahuSigners, signerOf } from "./fixtures/carriage.js";

const FIX = 9041;
const G0 = charterSeatSeeds(FIX, 0, 3), G1 = charterSeatSeeds(FIX, 1, 3), G2 = charterSeatSeeds(FIX, 2, 3);
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const VOUCHER = seed(31), OTHER = seed(32), MALLORY = seed(33), ROOT = seed(34);
const REALM = "ab".repeat(32);
const SCOPE = REALM;
const EDGE = "e1".repeat(32);

const holderAct = async (edgeId: string, raised: boolean, parents: string[] = [], by = VOUCHER) =>
  signEdgeKapae({ edgeId, raised, hand: "holder", parents }, await kahuSigners([by]));
const quorumAct = async (edgeId: string, raised: boolean, epochCid: string, seats: readonly Uint8Array[], parents: string[] = []) =>
  signEdgeKapae({ edgeId, raised, hand: "quorum", parents, epochCid }, await kahuSigners(seats));
const boardOf = (acts: readonly EdgeKapae[], anchors: readonly EdgeRollAnchor[] = []): LarDoc => {
  const d = emptyLarDoc();
  for (const a of acts) writeEdgeKapae(d, a);
  for (const a of anchors) writeEdgeRollAnchor(d, a);
  return d;
};
const both = async (): Promise<(edgeId: string) => EdgeAuthority> => { const holder = await pubOf(VOUCHER); return () => ({ holder, quorum: true }); };
const charterOf = (head: KahuQuorumSeats, sealLineage: readonly SealEpoch[], scope = SCOPE): EdgeCharter => ({ scope, head, sealLineage });
const anchorOf = async (closing: KahuQuorumSeats, opens: SealEpoch, parents: string[], signers: readonly Uint8Array[], scope = SCOPE) =>
  signEdgeRollAnchor({ scope, prevEpochCid: closing.sealEpochCid, sealEpochCid: opens.epochCid, prevKeys: closing.keys, prevThreshold: closing.threshold, parents }, await kahuSigners(signers.slice(0, 2)));
const reading = async (acts: EdgeKapae[], anchors: EdgeRollAnchor[], charter: EdgeCharter | null, edge = EDGE) =>
  foldEdgeReadings((await countEdgeActs(acts, anchors, await both(), charter)).acts).get(edge);

async function rolled(rolls: 1 | 2) {
  const genesis = await seatedCharter({ seats: 3, threshold: 2, seed: FIX });
  const first = await genesis.roll();
  const second = rolls === 2 ? await first.roll() : null;
  return { r0: genesis.roster, r1: first.roster, r2: second?.roster ?? null, e1: first.head, e2: second?.head ?? null,
           lineage1: [...first.chain], lineage2: second ? [...second.chain] : [] };
}

describe("the act — its id binds hand, gesture, parents and epoch", () => {
  test("parent order and duplicates leave the bytes and the id alone; the hand moves both", async () => {
    const a = await holderAct(EDGE, true, ["b".repeat(64), "a".repeat(64)]);
    const b = await holderAct(EDGE, true, ["a".repeat(64), "b".repeat(64), "a".repeat(64)]);
    expect(a.actCid).toBe(b.actCid);
    expect(a.actCid).toMatch(/^[0-9a-f]{64}$/);
    const { signatures: _s, actCid: _c, ...unsigned } = a;
    expect(edgeKapaeActCid({ ...unsigned, hand: "quorum" })).not.toBe(a.actCid);
    expect(Buffer.from(edgeKapaeBytes(unsigned)).toString()).toContain(EDGE_KAPAE_DOMAIN);
  });

  test("a raise and a lower from one frontier land on distinct keys and both survive", async () => {
    const up = await holderAct(EDGE, true), down = await holderAct(EDGE, false);
    const doc = boardOf([up, down]);
    expect(edgeKapaeKey(up)).not.toBe(edgeKapaeKey(down));
    expect(edgeKapaeActsFromBoard(doc).map((a) => a.actCid).sort()).toEqual([up.actCid, down.actCid].sort());
    doc.tiddlers["torn"] = mutableLarRecord("torn", { text: "not-json" }, "test");
    doc.tiddlers["foreign"] = mutableLarRecord("foreign", { text: JSON.stringify({ ...up, kind: "foreign/act" }) }, "test");
    expect(edgeKapaeActsFromBoard(doc)).toHaveLength(2);
  });
});

describe("one act per id — a second signature joins the first and never replaces it", () => {
  test("★ a stranger who signs the bytes of a holder's act removes nothing, on the board and in the ledger ★", async () => {
    const authorityFor = await both();
    const real = await holderAct(EDGE, true);
    const echo = await holderAct(EDGE, true, [], MALLORY);
    expect(echo.actCid).toBe(real.actCid);
    for (const order of [[real, echo], [echo, real]]) {
      const board = emptyLarDoc();
      for (const a of order) writeEdgeKapae(board, a);
      expect(Object.keys(board.tiddlers)).toHaveLength(1);
      expect((await readEdgeBoard({ board, authorityFor })).readings.get(EDGE)?.verdict).toBe("held");
      // The ledger kept the stranger's copy first; the holder's signature still joins it.
      const ledger = emptyLarDoc();
      keepInLedger(ledger, SCOPE, { acts: [order[0]!], anchors: [] });
      keepInLedger(ledger, SCOPE, { acts: [order[1]!], anchors: [] });
      expect((await readEdgeBoard({ board: emptyLarDoc(), kept: keptFromLedger(ledger, SCOPE), authorityFor })).readings.get(EDGE)?.verdict).toBe("held");
    }
    // CONTROL: the stranger's signature alone counts for nothing.
    expect((await readEdgeBoard({ board: boardOf([echo]), authorityFor })).readings.get(EDGE)).toBeUndefined();
  });

  test("★ a quorum gathers its seats across separate writes ★", async () => {
    const { r1, lineage1 } = await rolled(1);
    const charter = charterOf(r1, lineage1);
    const first = await quorumAct(EDGE, true, r1.sealEpochCid, G1.slice(0, 1));
    const second = await quorumAct(EDGE, true, r1.sealEpochCid, G1.slice(1, 2));
    const board = boardOf([first]);
    expect((await readEdgeBoard({ board, authorityFor: await both(), charter })).readings.get(EDGE)).toBeUndefined();   // CONTROL: one seat
    writeEdgeKapae(board, second);
    const read = await readEdgeBoard({ board, authorityFor: await both(), charter });
    expect(read.readings.get(EDGE)?.verdict).toBe("held");
    expect(mergeEdgeActs([first, second, first])[0]!.signatures).toHaveLength(2);
    // A board that lost one seat's signature gets the kept act back whole.
    const ledger = emptyLarDoc();
    keepInLedger(ledger, SCOPE, read.counted);
    const thin = await readEdgeBoard({ board: boardOf([first]), kept: keptFromLedger(ledger, SCOPE), authorityFor: await both(), charter });
    expect(thin.readings.get(EDGE)?.verdict).toBe("held");
    expect(thin.missing.acts.map((a) => a.signatures.length)).toEqual([2]);
  });

  test("★ a false signature under a true signer's name displaces nothing, and a board copy with swapped signatures takes the true ones back ★", async () => {
    const authorityFor = await both();
    const up = await holderAct(EDGE, true);
    const down = await holderAct(EDGE, false, [up.actCid]);
    const poisoned: EdgeKapae = { ...down, signatures: [{ signer: down.signatures[0]!.signer, sig: "00".repeat(64) }] };
    // The false record arrives first; the true one joins it and the lower still lifts.
    for (const order of [[poisoned, down], [down, poisoned]]) {
      const board = emptyLarDoc();
      writeEdgeKapae(board, up);
      for (const a of order) writeEdgeKapae(board, a);
      expect((await readEdgeBoard({ board, authorityFor })).readings.get(EDGE)?.verdict).toBe("withdrawn");
    }
    expect((await readEdgeBoard({ board: boardOf([up, poisoned]), authorityFor })).readings.get(EDGE)?.verdict).toBe("held");   // CONTROL: the false record alone lifts nothing
    // What counts carries the verified signatures alone, so the ledger never keeps the false one.
    const read = await readEdgeBoard({ board: boardOf([up, poisoned, down]), authorityFor });
    expect(read.counted.acts.find((a) => a.actCid === down.actCid)?.signatures).toEqual(down.signatures);
    const ledger = emptyLarDoc();
    keepInLedger(ledger, SCOPE, read.counted);
    // A hand swaps the board copy's signature for a false one of the same count: the reading holds, and the
    // board takes the true signature back.
    const swapped = boardOf([up, poisoned]);
    const again = await readEdgeBoard({ board: swapped, kept: keptFromLedger(ledger, SCOPE), authorityFor });
    expect(again.readings.get(EDGE)?.verdict).toBe("withdrawn");
    expect(again.missing.acts.map((a) => a.actCid)).toEqual([down.actCid]);
    restoreToBoard(swapped, again.missing);
    expect((await readEdgeBoard({ board: swapped, authorityFor })).readings.get(EDGE)?.verdict).toBe("withdrawn");
  });

  test("★ a forged body that wears a true act's id never becomes the record its signatures land on ★", async () => {
    const authorityFor = await both();
    const real = await holderAct(EDGE, true);
    const forged: EdgeKapae = { ...real, raised: false, signatures: [{ signer: real.signatures[0]!.signer, sig: "11".repeat(64) }] };
    expect(mergeEdgeActs([forged, real])).toEqual([real]);
    expect(mergeEdgeActs([forged])).toEqual([]);
    for (const order of [[forged, real], [real, forged]]) {
      expect(foldEdgeReadings((await countEdgeActs(order, [], authorityFor)).acts).get(EDGE)?.verdict).toBe("held");
    }
  });

  test("★ a flood of false signatures under one seat's name stays bounded and displaces nothing kept ★", async () => {
    const authorityFor = await both();
    const real = await holderAct(EDGE, true);
    const signer = real.signatures[0]!.signer;
    const flood = (n: number): EdgeKapae => ({ ...real, signatures: Array.from({ length: n }, (_, i) => ({ signer, sig: i.toString(16).padStart(2, "0").repeat(64).slice(0, 128) })) });
    // The vessel's kept copy reads first, so the true signature survives any flood that arrives on the board.
    const merged = mergeEdgeActs([real, flood(40)]);
    expect(merged[0]!.signatures.length).toBeLessThanOrEqual(4);
    expect(merged[0]!.signatures).toContainEqual(real.signatures[0]);
    const ledger = emptyLarDoc();
    keepInLedger(ledger, SCOPE, { acts: [real], anchors: [] });
    expect((await readEdgeBoard({ board: boardOf([flood(40)]), kept: keptFromLedger(ledger, SCOPE), authorityFor })).readings.get(EDGE)?.verdict).toBe("held");
    // A record past the size a true act could reach reads as torn.
    const huge = emptyLarDoc();
    huge.tiddlers["x"] = mutableLarRecord("x", { text: JSON.stringify(flood(300)) }, "test");
    expect(edgeKapaeActsFromBoard(huge)).toEqual([]);
    expect(edgeKapaeActsFromBoard(boardOf([flood(4)]))).toHaveLength(1);   // CONTROL
  });

  test("★ an anchor gathers its seats across separate writes ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const first = await signEdgeRollAnchor({ scope: SCOPE, prevEpochCid: r0.sealEpochCid, sealEpochCid: e1.epochCid, prevKeys: r0.keys, prevThreshold: r0.threshold, parents: [up.actCid] }, await kahuSigners(G1.slice(0, 1)));
    const second = await signEdgeRollAnchor({ scope: SCOPE, prevEpochCid: r0.sealEpochCid, sealEpochCid: e1.epochCid, prevKeys: r0.keys, prevThreshold: r0.threshold, parents: [up.actCid] }, await kahuSigners(G1.slice(1, 2)));
    expect(edgeRollAnchorCid(first)).toBe(edgeRollAnchorCid(second));
    const charter = charterOf(r1, lineage1);
    expect(await reading([up], [first], charter)).toBeUndefined();                    // CONTROL: one seat anchors nothing
    expect((await reading([up], [first, second], charter))?.verdict).toBe("held");
    const board = boardOf([up], [first]);
    writeEdgeRollAnchor(board, second);
    expect(edgeRollAnchorsFromBoard(board)).toHaveLength(1);
    expect((await readEdgeBoard({ board, authorityFor: await both(), charter })).readings.get(EDGE)?.verdict).toBe("held");
    expect(mergeEdgeRollAnchors([first, second, first])[0]!.signatures).toHaveLength(2);
  });
});

describe("two hands — each folds its own heads, and a lower lifts only its own hand's raises", () => {
  test("★ a holder act counts only under the one key the edge names ★", async () => {
    const authority = await both();
    const forged = await holderAct(EDGE, true, [], MALLORY);
    expect((await countEdgeActs([forged], [], authority)).acts).toEqual([]);
    const real = await holderAct(EDGE, true);
    expect((await countEdgeActs([real], [], authority)).acts.map((a) => a.actCid)).toEqual([real.actCid]);   // CONTROL
    // An edge the reader names no authority for carries no act at all: ABSENT, never shadowed.
    expect((await countEdgeActs([real], [], () => undefined)).acts).toEqual([]);
    // A forged lower never takes a real raise down.
    const forgedLower = await holderAct(EDGE, false, [real.actCid], MALLORY);
    expect(foldEdgeReadings((await countEdgeActs([real, forgedLower], [], authority)).acts).get(EDGE)?.verdict).toBe("held");
  });

  test("★ a quorum act counts at the seated threshold and never below it ★", async () => {
    const { r1, lineage1 } = await rolled(1);
    const charter = charterOf(r1, lineage1);
    const one = await quorumAct(EDGE, true, r1.sealEpochCid, G1.slice(0, 1));
    expect(await reading([one], [], charter)).toBeUndefined();
    const two = await quorumAct(EDGE, true, r1.sealEpochCid, G1.slice(0, 2));
    expect((await reading([two], [], charter))?.verdict).toBe("held");                                          // CONTROL
    // An edge that takes no quorum hand (a dyad) drops a quorum act however many seats signed it.
    const holderOnly = (await countEdgeActs([two], [], () => ({ holder: "00".repeat(32) }), charter)).acts;
    expect(holderOnly).toEqual([]);
    // No charter in the reader's hands → no quorum act counts.
    expect(await reading([two], [], null)).toBeUndefined();
    // Seats of another generation sign nothing for this epoch.
    const stale = await quorumAct(EDGE, true, r1.sealEpochCid, G0.slice(0, 2));
    expect(await reading([stale], [], charter)).toBeUndefined();
  });

  test("★ a voucher's lower never lifts a quorum's raise, and a quorum's lower never returns a withdrawn stake ★", async () => {
    const { r1, lineage1 } = await rolled(1);
    const charter = charterOf(r1, lineage1);
    const qUp = await quorumAct(EDGE, true, r1.sealEpochCid, G1.slice(0, 2));
    const hDown = await holderAct(EDGE, false, [qUp.actCid]);
    const mixed = await reading([qUp, hDown], [], charter);
    expect(mixed?.stands).toBe(true);
    expect(mixed?.quorum).toBe("held");
    const hUp = await holderAct(EDGE, true);
    const qDown = await quorumAct(EDGE, false, r1.sealEpochCid, G1.slice(0, 2), [hUp.actCid]);
    const other = await reading([hUp, qDown], [], charter);
    expect(other?.stands).toBe(true);
    expect(other?.holder).toBe("held");
    // CONTROL: the same hand's causal lower lifts its own raise.
    const hDown2 = await holderAct(EDGE, false, [hUp.actCid]);
    expect((await reading([hUp, hDown2], [], charter))?.stands).toBe(false);
    const qDown2 = await quorumAct(EDGE, false, r1.sealEpochCid, G1.slice(1, 3), [qUp.actCid]);
    expect((await reading([qUp, qDown2], [], charter))?.stands).toBe(false);
    // Both hands raised: lifting one leaves the other's shadow up.
    expect((await reading([hUp, hDown2, qUp], [], charter))?.stands).toBe(true);
  });

  test("a hand swapped after signing fails its own id and drops", async () => {
    const real = await holderAct(EDGE, true);
    const swapped = { ...real, hand: "quorum" as EdgeHand };
    expect((await countEdgeActs([swapped], [], await both())).acts).toEqual([]);
    expect(foldEdgeReadings([swapped]).get(EDGE)?.verdict).toBe("rejected");   // the bare fold still stands it up
    // A signed raise copied under a fresh id stands as no second head: the lift that cites the real one still lifts.
    const down = await holderAct(EDGE, false, [real.actCid]);
    const copy = { ...real, actCid: "c".repeat(64) };
    expect(foldEdgeReadings((await countEdgeActs([real, down, copy], [], await both())).acts).get(EDGE)?.verdict).toBe("withdrawn");
  });

  test("only a frontier of lowers lifts: a racing lower, and a missing parent, leave the shadow up", async () => {
    const up = await holderAct(EDGE, true), race = await holderAct(EDGE, false);
    expect(foldEdgeReadings([up, race]).get(EDGE)?.verdict).toBe("unsettled");
    expect(foldEdgeReadings([race, up]).get(EDGE)?.stands).toBe(true);
    const down = await holderAct(EDGE, false, [up.actCid]);
    const again = await holderAct(EDGE, true, [down.actCid]);
    expect(foldEdgeReadings([up, again]).get(EDGE)?.verdict).toBe("unavailable");
    expect(foldEdgeReadings([down]).get(EDGE)?.stands).toBe(true);
    expect(foldEdgeReadings([up, down]).get(EDGE)?.stands).toBe(false);                                         // CONTROL
    const settle = await holderAct(EDGE, false, [up.actCid, race.actCid]);
    expect(foldEdgeReadings([up, race, settle]).get(EDGE)?.verdict).toBe("withdrawn");
    expect(edgeShadowStands(undefined)).toBe(false);
    expect(shadowedEdges(foldEdgeReadings([up, race]))).toEqual(new Set([EDGE]));
    expect(edgeLineHeads([up, race], EDGE, "holder").sort()).toEqual([up.actCid, race.actCid].sort());
    expect(edgeLineHeads([up, again], EDGE, "holder")).toEqual([up.actCid]);   // an act with a missing parent heads nothing
  });
});

describe("rolls carry shadows — a quorum act at an earlier epoch counts through the anchors", () => {
  test("★ a raise at the closed epoch stands at the new head once the roll's anchor cites it ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const counted0 = (await countEdgeActs([up], [], await both(), charterOf(r0, lineage1.slice(0, 1)))).acts;
    const anchor = await anchorOf(r0, e1, edgeRollAnchorParents({ acts: counted0, anchors: [] }, r0.sealEpochCid), G1);
    expect(anchor.parents).toEqual([up.actCid]);
    expect(await edgeRollAnchorCounts(anchor, r1)).toBe(true);
    expect((await reading([up], [anchor], charterOf(r1, lineage1)))?.verdict).toBe("held");
    // CONTROL: with no anchor the closed epoch's roster stays unknown at the new head, and the act carries no authority.
    expect(await reading([up], [], charterOf(r1, lineage1))).toBeUndefined();
  });

  test("★ a lift at the head cites a raise from the closed epoch, by id alone ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const anchor = await anchorOf(r0, e1, [up.actCid], G1);
    const lift = await quorumAct(EDGE, false, r1.sealEpochCid, G1.slice(0, 2), [up.actCid]);
    expect((await reading([up, lift], [anchor], charterOf(r1, lineage1)))?.verdict).toBe("withdrawn");
    // CONTROL: a lower at the head that cites nothing races the raise and lifts nothing.
    const blind = await quorumAct(EDGE, false, r1.sealEpochCid, G1.slice(0, 2));
    expect((await reading([up, blind], [anchor], charterOf(r1, lineage1)))?.verdict).toBe("unsettled");
    // CONTROL: the lift without the anchor cites a parent this reader cannot count → the shadow stands.
    expect((await reading([up, lift], [], charterOf(r1, lineage1)))?.verdict).toBe("unavailable");
  });

  test("★ a retired key-set mints nothing after its roll: neither a lift nor a raise ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const anchor = await anchorOf(r0, e1, [up.actCid], G1);
    const charter = charterOf(r1, lineage1);
    const staleLift = await quorumAct(EDGE, false, r0.sealEpochCid, G0.slice(0, 2), [up.actCid]);
    expect((await reading([up, staleLift], [anchor], charter))?.verdict).toBe("held");
    const OTHER_EDGE = "e2".repeat(32);
    const staleRaise = await quorumAct(OTHER_EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    expect(await reading([up, staleRaise], [anchor], charter, OTHER_EDGE)).toBeUndefined();
    // CONTROL: the same lift, minted before the roll and standing in the anchor's past, lifts.
    const anchored = await anchorOf(r0, e1, [staleLift.actCid], G1);
    expect((await reading([up, staleLift], [anchored], charter))?.verdict).toBe("withdrawn");
  });

  test("a forged anchor, an anchor for another board, and a spliced ancestry carry nothing", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const charter = charterOf(r1, lineage1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const byClosedKeys = await anchorOf(r0, e1, [up.actCid], G0);
    expect(await edgeRollAnchorCounts(byClosedKeys, r1)).toBe(false);
    expect(await reading([up], [byClosedKeys], charter)).toBeUndefined();
    const elsewhere = await anchorOf(r0, e1, [up.actCid], G1, "cd".repeat(32));
    expect(await reading([up], [elsewhere], charter)).toBeUndefined();
    const real = await anchorOf(r0, e1, [up.actCid], G1);
    const tampered = { ...real, prevKeys: [await pubOf(MALLORY), ...real.prevKeys.slice(1)] };
    expect(await reading([up], [tampered], charter)).toBeUndefined();
    // A relabeled copy that claims the anchored head's id and cites a stale lift never splices it into the past.
    const staleLift = await quorumAct(EDGE, false, r0.sealEpochCid, G0.slice(0, 2), [up.actCid]);
    const splice = { ...staleLift, actCid: up.actCid, parents: [staleLift.actCid] };
    expect((await reading([up, staleLift, splice as EdgeKapae], [real], charter))?.verdict).toBe("held");
    expect((await reading([up], [real], charter))?.verdict).toBe("held");                                       // CONTROL
    // An anchor the opened quorum signed over a key-set the charter never committed seats nobody at the closed epoch.
    const mallory = await pubOf(MALLORY);
    const hers = await signEdgeKapae({ edgeId: EDGE, raised: true, hand: "quorum", parents: [], epochCid: r0.sealEpochCid }, await kahuSigners([MALLORY]));
    const unbound = await signEdgeRollAnchor(
      { scope: SCOPE, prevEpochCid: r0.sealEpochCid, sealEpochCid: e1.epochCid, prevKeys: [mallory], prevThreshold: 1, parents: [hers.actCid] },
      await kahuSigners(G1.slice(0, 2)));
    expect(await edgeRollAnchorCounts(unbound, r1)).toBe(true);
    expect(await reading([hers], [unbound], charter)).toBeUndefined();
    // Such an anchor stays out of what a vessel keeps, even beside a true one that discloses the real seats.
    expect((await countEdgeActs([], [unbound, real], await both(), charter)).anchors.map(edgeRollAnchorCid)).toEqual([edgeRollAnchorCid(real)]);
  });

  test("★ a long span: a raise carries across two rolls, and a lift at the far head still cites it ★", async () => {
    const { r0, r1, r2, e1, e2, lineage2 } = await rolled(2);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const a1 = await anchorOf(r0, e1, [up.actCid], G1);
    const a2 = await anchorOf(r1, e2!, [edgeRollAnchorCid(a1)], G2);
    const charter = charterOf(r2!, lineage2);
    expect((await reading([up], [a1, a2], charter))?.verdict).toBe("held");
    const lift = await quorumAct(EDGE, false, r2!.sealEpochCid, G2.slice(0, 2), [up.actCid]);
    expect((await reading([up, lift], [a1, a2], charter))?.verdict).toBe("withdrawn");
    // THE ANCHORS CHAIN, head down. With the later roll's anchor missing, nothing vouches that the first anchor
    // stood before ITS signers retired: the raise shows no proof, and the lift that cites it proves nothing.
    expect(await reading([up], [a1], charter)).toBeUndefined();
    expect((await reading([up, lift], [a1], charter))?.verdict).toBe("unavailable");
    expect(await reading([up], [a2], charter)).toBeUndefined();
    // ★ Seats that retired at the second roll sign a FRESH first-roll anchor over a lift the closed keys minted
    //   late. The second roll's anchor never cited it, so it counts for nothing and the shadow stands.
    const lateLift = await quorumAct(EDGE, false, r0.sealEpochCid, G0.slice(0, 2), [up.actCid]);
    const lateAnchor = await anchorOf(r0, e1, [lateLift.actCid], G1.slice(1, 3));
    expect(edgeRollAnchorCid(lateAnchor)).not.toBe(edgeRollAnchorCid(a1));
    expect((await reading([up, lateLift], [a1, a2, lateAnchor], charter))?.verdict).toBe("held");
    // CONTROL: the same lift, cited by the anchor the second roll chained to, lifts.
    const a1b = await anchorOf(r0, e1, [lateLift.actCid], G1);
    const a2b = await anchorOf(r1, e2!, [edgeRollAnchorCid(a1b)], G2);
    expect((await reading([up, lateLift], [a1b, a2b], charter))?.verdict).toBe("withdrawn");
    // A reader whose charter stops at the first roll counts nothing minted at the second.
    expect((await reading([up, lift], [a1, a2], charterOf(r1, lineage2.slice(0, 2))))?.verdict).toBe("held");
  });

  test("the anchor's parents name the heads of counted quorum acts at the closing epoch alone", async () => {
    const { r0, r1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const down = await quorumAct(EDGE, false, r0.sealEpochCid, G0.slice(0, 2), [up.actCid]);
    const elsewhere = await quorumAct("e3".repeat(32), true, r1.sealEpochCid, G1.slice(0, 2));
    const holder = await holderAct(EDGE, true);
    expect(edgeRollAnchorParents({ acts: [up, down, elsewhere, holder], anchors: [] }, r0.sealEpochCid)).toEqual([down.actCid]);
    // The anchor that OPENED the closing epoch joins the heads, so each roll's anchor cites the one before it.
    const opener = await anchorOf({ ...r0, sealEpochCid: "older-epoch" }, { epochCid: r0.sealEpochCid } as SealEpoch, [], G0);
    expect(edgeRollAnchorParents({ acts: [up, down], anchors: [opener] }, r0.sealEpochCid)).toEqual([down.actCid, edgeRollAnchorCid(opener)].sort());
    const doc = boardOf([up]);
    const anchor = await anchorOf(r0, { epochCid: r1.sealEpochCid } as SealEpoch, [up.actCid], G1);
    writeEdgeRollAnchor(doc, anchor);
    expect(edgeRollAnchorsFromBoard(doc).map(edgeRollAnchorCid)).toEqual([edgeRollAnchorCid(anchor)]);
    expect(edgeKapaeActsFromBoard(doc)).toHaveLength(1);
  });
});

describe("a roll the roller never anchored — a vessel keeps counting the raise it counted at its head", () => {
  test("★ a raise this vessel counted before the roll stands after it, with no anchor on the board ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const authorityFor = await both();
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const board = boardOf([up]);
    const ledger = emptyLarDoc();
    const before = await readEdgeBoard({ board, authorityFor, charter: charterOf(r0, lineage1.slice(0, 1)) });
    keepInLedger(ledger, SCOPE, before.counted, r0.sealEpochCid);
    // The roll lands. Some anchor (here one that cites nothing) discloses the genesis seats; none cites the raise.
    const bare = await anchorOf(r0, e1, [], G1);
    writeEdgeRollAnchor(board, bare);
    const after = await readEdgeBoard({ board, kept: keptFromLedger(ledger, SCOPE), authorityFor, charter: charterOf(r1, lineage1) });
    expect(after.readings.get(EDGE)?.verdict).toBe("held");
    // CONTROL: a vessel that first meets the raise after the roll counts nothing — it holds no word of its own.
    expect((await readEdgeBoard({ board, authorityFor, charter: charterOf(r1, lineage1) })).readings.get(EDGE)).toBeUndefined();
    const late = emptyLarDoc();
    keepInLedger(late, SCOPE, { acts: [up], anchors: [] }, r1.sealEpochCid);
    expect(keptFromLedger(late, SCOPE).seenAtHead?.size).toBe(0);
    expect((await readEdgeBoard({ board, kept: keptFromLedger(late, SCOPE), authorityFor, charter: charterOf(r1, lineage1) })).readings.get(EDGE)).toBeUndefined();
  });

  test("★ a LOWER never rides the ledger's word across a roll ★", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const authorityFor = await both();
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const down = await quorumAct(EDGE, false, r0.sealEpochCid, G0.slice(0, 2), [up.actCid]);
    const ledger = emptyLarDoc();
    // A vessel that lagged behind the roll counted both acts at what it took for the head.
    const lagging = await readEdgeBoard({ board: boardOf([up, down]), authorityFor, charter: charterOf(r0, lineage1.slice(0, 1)) });
    expect(lagging.readings.get(EDGE)?.verdict).toBe("withdrawn");
    keepInLedger(ledger, SCOPE, lagging.counted, r0.sealEpochCid);
    // The roll's anchor cites the raise alone: the lift came from the closed keys after the roll.
    const anchor = await anchorOf(r0, e1, [up.actCid], G1);
    const caught = await readEdgeBoard({ board: boardOf([up, down], [anchor]), kept: keptFromLedger(ledger, SCOPE), authorityFor, charter: charterOf(r1, lineage1) });
    expect(caught.readings.get(EDGE)?.verdict).toBe("held");
  });
});

describe("acts only accrete — the reader keeps what it counted", () => {
  test("★ a raise deleted from the board still stands at a reader that counted it, and returns to the board ★", async () => {
    const authorityFor = await both();
    const up = await holderAct(EDGE, true);
    const board = boardOf([up]);
    const ledger = emptyLarDoc();
    const first = await readEdgeBoard({ board, kept: keptFromLedger(ledger, SCOPE), authorityFor });
    expect(first.readings.get(EDGE)?.verdict).toBe("held");
    expect(keepInLedger(ledger, SCOPE, first.counted)).toBe(1);
    expect(keepInLedger(ledger, SCOPE, first.counted)).toBe(0);
    delete (board.tiddlers as Record<string, unknown>)[edgeKapaeKey(up)];
    // CONTROL: a reader with no ledger reads the edge ABSENT — the hole the ledger closes.
    expect((await readEdgeBoard({ board, authorityFor })).readings.get(EDGE)).toBeUndefined();
    const second = await readEdgeBoard({ board, kept: keptFromLedger(ledger, SCOPE), authorityFor });
    expect(second.readings.get(EDGE)?.verdict).toBe("held");
    expect(second.missing.acts.map((a) => a.actCid)).toEqual([up.actCid]);
    expect(restoreToBoard(board, second.missing)).toBe(1);
    expect((await readEdgeBoard({ board, authorityFor })).readings.get(EDGE)?.verdict).toBe("held");
    // Another board's rows stay out of this board's read.
    expect(keptFromLedger(ledger, "ef".repeat(32)).acts).toEqual([]);
  });

  test("a row planted in the ledger carries nothing a signature does not", async () => {
    const forged = await holderAct(EDGE, true, [], MALLORY);
    const ledger = emptyLarDoc();
    keepInLedger(ledger, SCOPE, { acts: [forged], anchors: [] });
    const read = await readEdgeBoard({ board: emptyLarDoc(), kept: keptFromLedger(ledger, SCOPE), authorityFor: await both() });
    expect(read.readings.size).toBe(0);
    expect(read.missing.acts).toEqual([]);
  });

  test("the ledger keeps anchors and remembers which raises this vessel answered on the key side", async () => {
    const { r0, r1, e1, lineage1 } = await rolled(1);
    const up = await quorumAct(EDGE, true, r0.sealEpochCid, G0.slice(0, 2));
    const anchor = await anchorOf(r0, e1, [up.actCid], G1);
    const board = boardOf([up], [anchor]);
    const ledger = emptyLarDoc();
    const read = await readEdgeBoard({ board, authorityFor: await both(), charter: charterOf(r1, lineage1) });
    keepInLedger(ledger, SCOPE, read.counted);
    const again = await readEdgeBoard({ board: emptyLarDoc(), kept: keptFromLedger(ledger, SCOPE), authorityFor: await both(), charter: charterOf(r1, lineage1) });
    expect(again.readings.get(EDGE)?.verdict).toBe("held");
    expect(again.missing.anchors).toHaveLength(1);
    expect(again.readings.get(EDGE)?.raiseCids).toEqual([up.actCid]);
    const key = await ed25519VerifyingKeyFromSeed(OWN_SEED);
    expect(rolledRaises(ledger, SCOPE, key).size).toBe(0);
    markRaiseRolled(ledger, SCOPE, up.actCid, await ownRoll(up.actCid, EDGE, "revoked"), key);
    markRaiseRolled(ledger, SCOPE, up.actCid, await ownRoll(up.actCid, EDGE, "revoked"), key);
    expect(rolledRaises(ledger, SCOPE, key)).toEqual(new Set([up.actCid]));
    expect(ledgerScopes(ledger)).toEqual([SCOPE]);
    expect(ledgerScopes(emptyLarDoc())).toEqual([]);
  });
});

describe("lineage standing — a path of standing vouches to the seed, and a clear member edge", () => {
  const SEED = seed(41), A = seed(42), B = seed(43), C = seed(44);
  const invite = async (voucher: Uint8Array, joiner: Uint8Array): Promise<CabalInvite> => signCabalInvite(
    { realmDocIdHex: REALM, joinerIdentityHex: await pubOf(joiner), voucherDid: await pubOf(voucher), boundEpoch: "0" }, signerOf(voucher));

  test("★ a withdrawn vouch breaks the path beneath it, and a second path keeps the joiner standing ★", async () => {
    const sa = await invite(SEED, A), ab = await invite(A, B), sc = await invite(SEED, C), cb = await invite(C, B);
    const [seedKey, a, b, c] = await Promise.all([SEED, A, B, C].map(pubOf));
    const none = () => false;
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab], stands: none })).toEqual(new Set([seedKey, a, b]));
    const cut = (edgeId: string) => edgeId === vouchEdgeId(sa);
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab], stands: cut })).toEqual(new Set([seedKey]));
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab, sc, cb], stands: cut })).toEqual(new Set([seedKey, c, b]));
    // An invite into another realm lends no path here.
    const foreign = { ...sa, realmDocIdHex: "cd".repeat(32) };
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [foreign], stands: none })).toEqual(new Set([seedKey]));
  });

  test("★ the roots arrive authenticated: a key that merely signs a vouch roots nothing ★", async () => {
    const sa = await invite(SEED, A), ab = await invite(A, B), ba = await invite(B, A);
    const [seedKey, a, b] = await Promise.all([SEED, A, B].map(pubOf));
    const none = () => false;
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab], stands: none })).toEqual(new Set([seedKey, a, b]));
    // Withdrawn at the root's own vouch, the path below falls though no seed got named.
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab], stands: (e) => e === vouchEdgeId(sa) })).toEqual(new Set([seedKey]));
    // A hand nobody named as a root signs a vouch for a friend: valid signature, no standing for either.
    const forged = await invite(OTHER, C);
    const [stray, c] = await Promise.all([OTHER, C].map(pubOf));
    const withForged = lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab, forged], stands: none });
    expect(withForged.has(stray!) || withForged.has(c!)).toBe(false);
    expect(withForged).toEqual(new Set([seedKey, a, b]));
    expect(memberStandsAside({ realmDocIdHex: REALM, member: c!, roots: [seedKey!], invites: [forged], stands: none })).toBe(true);
    // CONTROL: two hands that vouch only for each other root on nobody; with no root named, nobody stands.
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [], invites: [ab, ba], stands: none }).size).toBe(0);
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [], invites: [sa, ab], stands: none }).size).toBe(0);
    expect(lineageStanding({ realmDocIdHex: REALM, roots: ["not-a-key", `0x${seedKey!.toUpperCase()}`], invites: [sa], stands: none })).toEqual(new Set([seedKey, a]));
    expect(memberStandsAside({ realmDocIdHex: REALM, member: b!, roots: [seedKey!], invites: [sa, ab], stands: none })).toBe(false);
    expect(memberStandsAside({ realmDocIdHex: REALM, member: b!, roots: [seedKey!], invites: [sa, ab], stands: (e) => e === vouchEdgeId(ab) })).toBe(true);
    // A root leaves only by a shadow over its own member edge; a face no vouch names reads no removal.
    expect(memberStandsAside({ realmDocIdHex: REALM, member: seedKey!, roots: [seedKey!], invites: [sa], stands: (e) => e === vouchEdgeId(sa) })).toBe(false);
    expect(memberStandsAside({ realmDocIdHex: REALM, member: seedKey!, roots: [seedKey!], invites: [sa], stands: (e) => e === memberEdgeId(REALM, seedKey!) })).toBe(true);
    expect(memberStandsAside({ realmDocIdHex: REALM, member: await pubOf(OTHER), roots: [seedKey!], invites: [sa], stands: none })).toBe(false);
  });

  test("★ a shadow over the member edge holds against every vouch, a fresh one included ★", async () => {
    const sa = await invite(SEED, A), ab = await invite(A, B), sb = await invite(SEED, B), bc = await invite(B, C);
    const [seedKey, a, b] = await Promise.all([SEED, A, B].map(pubOf));
    const evicted = (edgeId: string) => edgeId === memberEdgeId(REALM, b!);
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa, ab, sb, bc], stands: evicted })).toEqual(new Set([seedKey, a]));
    expect(memberEdgeId(REALM, b!)).toBe(memberEdgeId(REALM.toUpperCase(), `0x${b!.toUpperCase()}`));
    expect(memberEdgeId(REALM, b!)).not.toBe(vouchEdgeId(ab));
    // One key, one spelling: a vouch re-minted under another spelling of the same keys names the same edge.
    expect(vouchEdgeId({ ...ab, voucherDid: `0x${ab.voucherDid.toUpperCase()}`, joinerIdentityHex: ab.joinerIdentityHex.toUpperCase(), realmDocIdHex: REALM.toUpperCase() })).toBe(vouchEdgeId(ab));
    expect(vouchEdgeId({ ...ab, joinerIdentityHex: seedKey! })).not.toBe(vouchEdgeId(ab));   // CONTROL
    // A shadow over the seed's own member edge leaves nobody standing.
    expect(lineageStanding({ realmDocIdHex: REALM, roots: [seedKey!], invites: [sa], stands: (e) => e === memberEdgeId(REALM, seedKey!) }).size).toBe(0);
  });

  test("★ a vouch edge answers to its voucher and to the quorum; a member edge to the quorum alone ★", async () => {
    const { r1, lineage1 } = await rolled(1);
    const charter = charterOf(r1, lineage1);
    const sa = await invite(SEED, A);
    const a = await pubOf(A);
    const authority = realmEdgeAuthority([sa]);
    expect(authority(vouchEdgeId(sa))).toEqual({ holder: await pubOf(SEED), quorum: true });
    expect(authority(memberEdgeId(REALM, a))).toEqual({ quorum: true });
    expect(authority("ff".repeat(32))).toEqual({ quorum: true });   // any other edge on the board: the quorum's alone
    const member = memberEdgeId(REALM, a);
    const byVoucher = await holderAct(member, true, [], SEED);
    expect((await countEdgeActs([byVoucher], [], authority, charter)).acts).toEqual([]);
    const byQuorum = await quorumAct(member, true, r1.sealEpochCid, G1.slice(0, 2));
    expect((await countEdgeActs([byQuorum], [], authority, charter)).acts).toHaveLength(1);                     // CONTROL
    const withdraw = await holderAct(vouchEdgeId(sa), true, [], SEED);
    const strike = await quorumAct(vouchEdgeId(sa), true, r1.sealEpochCid, G1.slice(0, 2));
    expect((await countEdgeActs([withdraw, strike], [], authority, charter)).acts).toHaveLength(2);
    const notHers = await holderAct(vouchEdgeId(sa), true, [], A);
    expect((await countEdgeActs([notHers], [], authority, charter)).acts).toEqual([]);
    // A member no vouch names still answers to the quorum: the edge needs no vouch to exist.
    const stranger = await pubOf(OTHER);
    expect(realmEdgeAuthority([])(memberEdgeId(REALM, stranger))).toEqual({ quorum: true });
  });
});

describe("the fleet's edge — named by the fleet root and the device key", () => {
  test("the id reads one way under either spelling, and the fleet root alone holds it", async () => {
    const root = await pubOf(ROOT), device = await pubOf(OTHER);
    expect(deviceEdgeId(root, device)).toBe(deviceEdgeId(`0x${root.toUpperCase()}`, `0x${device}`));
    expect(deviceEdgeId(root, device)).not.toBe(deviceEdgeId(device, root));
    const edge = deviceEdgeId(root, device);
    const authority = fleetEdgeAuthority(`0x${root}`);
    const byRoot = await holderAct(edge, true, [], ROOT);
    expect((await countEdgeActs([byRoot], [], authority)).acts).toHaveLength(1);
    const byDevice = await holderAct(edge, false, [byRoot.actCid], OTHER);
    expect(foldEdgeReadings((await countEdgeActs([byRoot, byDevice], [], authority)).acts).get(edge)?.verdict).toBe("held");
  });
});


describe("edge standing", () => {
  test("an absent edge reads clear, a raise reads aside, and its lower reads returned", async () => {
    const up = await holderAct(EDGE, true);
    const down = await holderAct(EDGE, false, [up.actCid]);
    expect(edgeStandingOf(await reading([], [], null))).toBe("clear");
    expect(edgeStandingOf(await reading([up], [], null))).toBe("aside");
    expect(edgeStandingOf(await reading([up, down], [], null))).toBe("returned");
  });

  test("a raise beside a lower from one frontier remains aside", async () => {
    const up = await holderAct(EDGE, true), down = await holderAct(EDGE, false);
    expect(edgeStandingOf(await reading([up, down], [], null))).toBe("aside");
  });
});

/** This vessel's own seed: its island signs each roll's receipt with it (road `T33`). */
const OWN_SEED = new Uint8Array(32).fill(0x31);
const ownRoll = (cid: string, edgeId: string, how: SeatRoll["how"], seat?: { group: string; member: string }): Promise<SignedSeatRoll> =>
  signSeatRoll({ kind: "seat-roll", scope: SCOPE, edgeId, raiseCids: [cid], how, ...(seat ? { seat } : {}) }, ed25519SignerFromSeed(OWN_SEED));

describe("the ledger keeps each roll beside its mark", () => {
  test("a marked raise reads back as the roll the vessel kept, and the first answer stands", async () => {
    const up = await holderAct(EDGE, true), other = await holderAct("e2".repeat(32), true);
    const key = await ed25519VerifyingKeyFromSeed(OWN_SEED);
    const ledger = emptyLarDoc();
    const seat = { group: "0xgroup", member: "0xmember" };
    const first = await ownRoll(up.actCid, EDGE, "revoked", seat);
    markRaiseRolled(ledger, SCOPE, up.actCid, first, key);
    markRaiseRolled(ledger, SCOPE, up.actCid, await ownRoll(up.actCid, EDGE, "gone"), key);
    markRaiseRolled(ledger, SCOPE, other.actCid, await ownRoll(other.actCid, "e2".repeat(32), "no-authority"), key);
    const kept = keptSeatRolls(ledger, SCOPE, key);
    expect(kept).toHaveLength(2);
    expect(kept.find((r) => r.raiseCids[0] === up.actCid)).toEqual(first);
    expect(kept.find((r) => r.raiseCids[0] === other.actCid)?.how).toBe("no-authority");
    // One step up: a raise answered with no authority takes the later answer once its seat leaves, and reads
    // as owed until then.
    expect(raisesSeenThrough(ledger, SCOPE, key)).toEqual(new Set([up.actCid]));
    markRaiseRolled(ledger, SCOPE, other.actCid, await ownRoll(other.actCid, "e2".repeat(32), "gone"), key);
    expect(raisesSeenThrough(ledger, SCOPE, key)).toEqual(new Set([up.actCid, other.actCid]));
    markRaiseRolled(ledger, SCOPE, other.actCid, await ownRoll(other.actCid, "e2".repeat(32), "no-authority"), key);
    expect(keptSeatRolls(ledger, SCOPE, key).find((r) => r.raiseCids[0] === other.actCid)?.how).toBe("gone");
    // CONTROL: another board's rolls stay apart, and another key reads none of this vessel's marks.
    expect(keptSeatRolls(ledger, "cd".repeat(32), key)).toEqual([]);
    expect(rolledRaises(ledger, SCOPE, await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(0x77))).size).toBe(0);
  });

  test("a lifted raise this vessel has not answered reads owing, and returned once it has", async () => {
    const up = await holderAct(EDGE, true), down = await holderAct(EDGE, false, [up.actCid]);
    const lifted = await reading([up, down], [], null);
    expect(edgeStandingOf(lifted, new Set())).toBe("owing");
    expect(edgeStandingOf(lifted, new Set([up.actCid]))).toBe("returned");
    expect(edgeStandingOf(lifted)).toBe("returned");                 // a reader with no ledger
    expect(edgeStandingOf(await reading([up], [], null), new Set([up.actCid]))).toBe("aside");   // CONTROL: a mark lifts nothing
  });
});
