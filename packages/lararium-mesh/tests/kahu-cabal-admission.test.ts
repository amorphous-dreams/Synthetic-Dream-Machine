/**
 * kahu-cabal-admission.test.ts — admission into a Nexus's Kahu cabal stands as its own authority act at the
 * seat quorum, a vouch admits nobody, and the cabal's access path to shared canon reads both the counted
 * admission and the sentinel membership.
 *
 * Pinned:
 *   · an admission counts at the high-impact threshold the charter's seats set, and one seat short reads
 *     `below-seat-quorum` (at five seats, three; at two seats, both; a single seat never admits at n ≥ 2),
 *   · a removal counts at the admission's own threshold,
 *   · a vouch, or any record of another kind, reads `not-an-admission` and folds nothing,
 *   · an unseated signer (a persona's own key) never signs and never counts,
 *   · access holds only for admitted AND joined; a sentinel member with no counted admission reads
 *     `joined-without-admission`; concurrent admit and remove heads read `unsettled`,
 *   · the nonsense control: a roster from another epoch counts nothing.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { CABAL_INVITE_DOMAIN } from "../src/domains.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import {
  openKahuCabalAct, signKahuCabalAct, kahuCabalActCounts, kahuCabalActCid, kahuCabalStanding,
  kahuCabalCanonAccess, readKahuCabalAct,
} from "../src/kahu-cabal-admission.js";

const EPOCH = "epoch-cid-charter-1";
const NEXUS = "nexus-" + "ab".repeat(32);
const GROUP = "cd".repeat(32);
const seed  = (n: number) => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signerOf = async (n: number) => ({ signer: await pubOf(seed(n)), sign: (b: Uint8Array) => ed.signAsync(b, seed(n)).then(hex) });

async function rosterOf(n: number, threshold: number, epoch = EPOCH): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(Array.from({ length: n }, (_, i) => pubOf(seed(i + 1))));
  return { keys, threshold, sealEpochCid: epoch };
}

async function act(roster: KahuQuorumSeats, seats: number[], action: "admit" | "remove" = "admit", parents: string[] = []) {
  const open = openKahuCabalAct({ nexus: NEXUS, group: GROUP, action, parents, roster });
  return signKahuCabalAct(open, await Promise.all(seats.map(signerOf)), roster);
}

describe("an admission takes the seat quorum", () => {
  test("five seats at threshold two: three seats admit, two fall short (high-impact rides the majority)", async () => {
    const roster = await rosterOf(5, 2);
    expect(kahuCabalActCounts(await act(roster, [1, 2, 3]), roster, NEXUS)).toMatchObject({ counted: true, seated: 3, threshold: 3 });
    expect(kahuCabalActCounts(await act(roster, [1, 2]), roster, NEXUS)).toMatchObject({ counted: false, reason: "below-seat-quorum", seated: 2, threshold: 3 });
  });

  test("at three seats, ONE seat never admits though the ordinary class takes one", async () => {
    const roster = await rosterOf(3, 1);
    expect(kahuCabalActCounts(await act(roster, [1]), roster, NEXUS)).toMatchObject({ counted: false, reason: "below-seat-quorum", threshold: 2 });
    expect(kahuCabalActCounts(await act(roster, [1, 2]), roster, NEXUS).counted).toBe(true);
  });

  test("at two seats both sign; one seat alone admits nobody", async () => {
    const roster = await rosterOf(2, 2);
    expect(kahuCabalActCounts(await act(roster, [1]), roster, NEXUS).counted).toBe(false);
    expect(kahuCabalActCounts(await act(roster, [1, 2]), roster, NEXUS).counted).toBe(true);
  });

  test("a removal counts at the admission's own threshold", async () => {
    const roster = await rosterOf(5, 2);
    const admit = await act(roster, [1, 2, 3]);
    expect(kahuCabalActCounts(await act(roster, [4, 5], "remove", [kahuCabalActCid(admit)]), roster, NEXUS).counted).toBe(false);
    expect(kahuCabalActCounts(await act(roster, [3, 4, 5], "remove", [kahuCabalActCid(admit)]), roster, NEXUS).counted).toBe(true);
  });

  test("an unseated signer never signs, and a smuggled signature counts nothing", async () => {
    const roster  = await rosterOf(3, 2);
    const persona = await signerOf(42);
    const open = openKahuCabalAct({ nexus: NEXUS, group: GROUP, action: "admit", roster });
    await expect(signKahuCabalAct(open, [persona], roster)).rejects.toThrow(/signer-not-seated/);
    const one = await act(roster, [1]);
    const smuggled = { ...one, signatures: [...one.signatures, { signer: persona.signer, sig: await persona.sign(new Uint8Array([1])) }] };
    expect(kahuCabalActCounts(smuggled, roster, NEXUS)).toMatchObject({ counted: false, seated: 1 });
  });

  test("nonsense control: the same act under a roster of another epoch counts nothing", async () => {
    const roster = await rosterOf(3, 2);
    const other  = await rosterOf(3, 2, "epoch-cid-elsewhere");
    expect(kahuCabalActCounts(await act(roster, [1, 2, 3]), other, NEXUS)).toMatchObject({ counted: false, reason: "wrong-charter-epoch" });
  });

  test("an act for another Nexus counts nothing here", async () => {
    const roster = await rosterOf(3, 2);
    expect(kahuCabalActCounts(await act(roster, [1, 2]), roster, "nexus-" + "ef".repeat(32))).toMatchObject({ counted: false, reason: "foreign-nexus" });
  });
});

describe("a vouch admits nobody", () => {
  test("a record of another kind reads not-an-admission and folds nothing", async () => {
    const roster = await rosterOf(3, 2);
    const vouch = { kind: CABAL_INVITE_DOMAIN, group: GROUP, nexus: NEXUS, action: "admit", parents: [], sealEpochCid: EPOCH, signatures: [] };
    expect(readKahuCabalAct(vouch)).toBeNull();
    expect(kahuCabalActCounts(vouch, roster, NEXUS)).toMatchObject({ counted: false, reason: "not-an-admission" });
    expect(kahuCabalStanding([vouch], GROUP, roster, NEXUS).standing).toBe("absent");
  });
});

describe("standing and the access path to shared canon", () => {
  test("admitted and joined holds; admitted alone and joined alone each refuse", async () => {
    const roster = await rosterOf(3, 2);
    const admit = await act(roster, [1, 2]);
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [admit], sentinelMember: true }))
      .toEqual({ held: true, standing: "admitted", reason: "admitted-and-joined" });
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [admit], sentinelMember: false }))
      .toMatchObject({ held: false, reason: "admitted-not-joined" });
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [], sentinelMember: true }))
      .toMatchObject({ held: false, reason: "joined-without-admission" });
  });

  test("a sub-quorum admission never stands behind a sentinel membership", async () => {
    const roster = await rosterOf(3, 2);
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [await act(roster, [1])], sentinelMember: true }))
      .toMatchObject({ held: false, reason: "joined-without-admission" });
  });

  test("a removal descending from the admission closes access", async () => {
    const roster = await rosterOf(3, 2);
    const admit = await act(roster, [1, 2]);
    const remove = await act(roster, [2, 3], "remove", [kahuCabalActCid(admit)]);
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [admit, remove], sentinelMember: true }))
      .toMatchObject({ held: false, standing: "removed", reason: "removed" });
  });

  test("an admit and a remove standing concurrent read unsettled, never held", async () => {
    const roster = await rosterOf(3, 2);
    const admit = await act(roster, [1, 2]);
    const remove = await act(roster, [2, 3], "remove");
    expect(kahuCabalStanding([admit, remove], GROUP, roster, NEXUS).standing).toBe("unsettled");
    expect(kahuCabalCanonAccess({ group: GROUP, nexus: NEXUS, roster, acts: [remove, admit], sentinelMember: true }).held).toBe(false);
  });

  test("an act whose parent stands absent drops out of the fold", async () => {
    const roster = await rosterOf(3, 2);
    const orphan = await act(roster, [1, 2], "admit", ["00".repeat(32)]);
    expect(kahuCabalStanding([orphan], GROUP, roster, NEXUS).standing).toBe("absent");
  });
});

describe("the board", () => {
  test("an act lands on the carriage board, reads back, and the carriage reader skips it", async () => {
    const { writeKahuCabalAct, kahuCabalActsFromBoard } = await import("../src/kahu-cabal-admission.js");
    const { carriageEntriesFromBoard } = await import("../src/carriage-board.js");
    const roster = await rosterOf(3, 2);
    const admit = await act(roster, [1, 2]);
    const doc = { tiddlers: {} } as unknown as import("../src/base-doc.js").LarDoc;
    writeKahuCabalAct(doc, admit);
    expect(Object.keys(doc.tiddlers)).toHaveLength(1);
    expect(kahuCabalActsFromBoard(doc)).toEqual([readKahuCabalAct(admit)]);
    expect(carriageEntriesFromBoard(doc)).toEqual([]);
    expect(kahuCabalStanding(kahuCabalActsFromBoard(doc), GROUP, roster, NEXUS).standing).toBe("admitted");
  });
});

describe("review findings carried from P4", () => {
  test("a forged signature under a seat never wedges that seat's real signature out", async () => {
    const roster = await rosterOf(3, 2);
    const open = openKahuCabalAct({ nexus: NEXUS, group: GROUP, action: "admit", roster });
    const seat1 = await signerOf(1);
    const wedged = { ...open, signatures: [{ signer: seat1.signer, sig: "00".repeat(64) }] };
    const signed = await signKahuCabalAct(wedged, [seat1, await signerOf(2)], roster);
    expect(kahuCabalActCounts(signed, roster, NEXUS)).toMatchObject({ counted: true, seated: 2 });
  });
});
