/**
 * socket-sorter.test.ts — the vessel's ONE sorter classes every proven socket off its own carried readings.
 *
 * Proven:
 *   · a same-operator socket stands under both postures;
 *   · RED: under PRIVATE a proven stranger is SILENCE; CONTROL: the vessel's own charter or any carried Nexus
 *     reading OPEN answers it as a stranger;
 *   · a presented admit HELD against a carried Nexus is CONTRACTED, with the verdict's leaf and Nexus as its
 *     standing; the same admit proven under another vessel key is silence under PRIVATE;
 *   · a faceless PLACE whose wire key this board carries is CONTRACTED; a presentation that fails never falls
 *     through to the carrier read;
 *   · a refold drops a stranger once nothing answers strangers, and a contracted socket the membership no
 *     longer holds — never a same-operator or walker socket, and nothing at all under OPEN.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  hex, genesisSealEpochCid, signCarriageQuorum, signCarriageContract, signLeafProof,
  type CarriageEntry, type KahuQuorumSeats, type FederationPosture, type PeerClass,
} from "@lararium/mesh";
import { makeSocketSorter, socketsNoLongerHeld, gateAnswersStrangers } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import type { SortInput } from "../src/daemon-auth-gate.js";

const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const LEAF_SEED   = new Uint8Array(32).fill(5);
const VESSEL_SEED = new Uint8Array(32).fill(11);
const OTHER_SEED  = new Uint8Array(32).fill(12);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const GATE  = "ee".repeat(32);
const NONCE = "ab".repeat(32);

async function rosterAt(): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(SEEDS.map(pubOf));
  return { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
}
async function admitAt(epoch: string): Promise<CarriageEntry> {
  const nym = await pubOf(LEAF_SEED);
  const kahu = await Promise.all([SEEDS[0]!, SEEDS[1]!].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  return signCarriageQuorum({ nym, action: "admit", parents: [], sealEpochCid: epoch }, kahu, await signCarriageContract(nym, epoch, signerOf(LEAF_SEED)));
}
function reading(roster: KahuQuorumSeats, posture: FederationPosture = "private"): CarriedNexusReading {
  return { aid: "N", via: "consent", island: "island-N", roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, posture };
}
/** A sort input for a proven vessel key, optionally presenting `admit` with its leaf's proof over this socket. */
async function input(opts: { sameOperator?: boolean; admit?: CarriageEntry; vessel?: Uint8Array; proofVessel?: Uint8Array } = {}): Promise<SortInput> {
  const vesselKey = await pubOf(opts.vessel ?? VESSEL_SEED);
  const base = { identifier: `0x${vesselKey}`, vesselKey, sameOperator: opts.sameOperator ?? false, challenge: { nonce: NONCE, gatePubKey: GATE } };
  if (!opts.admit) return base;
  const leafProof = await signLeafProof({
    presented: { kind: "admit", admit: opts.admit, lineage: [] }, nonce: NONCE, gatePubKey: GATE,
    vesselKey: await pubOf(opts.proofVessel ?? opts.vessel ?? VESSEL_SEED), sign: signerOf(LEAF_SEED),
  });
  return { ...base, presented: { kind: "admit", admit: opts.admit, lineage: [], leafProof } };
}
const sorter = (readings: CarriedNexusReading[], primary: FederationPosture = "private", carriers: string[] = []) =>
  makeSocketSorter({ readings: async () => readings, carrier: (k) => carriers.includes(k), primaryPosture: () => primary });

describe("the sorter — four classes, and silence", () => {
  test("CONTROL: a same-operator socket stands under both postures", async () => {
    for (const p of ["private", "open"] as const) {
      expect(await sorter([], p)(await input({ sameOperator: true }))).toEqual({ class: "same-operator" });
    }
  });

  test("RED: under PRIVATE a proven stranger is silence; any OPEN Nexus the gate stands in answers it", async () => {
    const roster = await rosterAt();
    expect(await sorter([reading(roster)])(await input())).toBeNull();
    expect(await sorter([])(await input())).toBeNull();
    expect(await sorter([reading(roster, "open")])(await input())).toEqual({ class: "stranger" });
    expect(await sorter([reading(roster)], "open")(await input())).toEqual({ class: "stranger" });
  });

  test("a presented admit HELD against a carried Nexus is contracted, standing as the verdict's leaf", async () => {
    const roster = await rosterAt();
    const verdict = await sorter([reading(roster)])(await input({ admit: await admitAt(roster.sealEpochCid) }));
    expect(verdict).toEqual({ class: "contracted", standing: { nym: await pubOf(LEAF_SEED), aid: "N" } });
  });

  test("CONTROL: the same admit with its proof made for another vessel key is silence under PRIVATE", async () => {
    const roster = await rosterAt();
    expect(await sorter([reading(roster)])(await input({ admit: await admitAt(roster.sealEpochCid), proofVessel: OTHER_SEED }))).toBeNull();
  });

  test("a faceless PLACE whose key this board carries is contracted; a failed presentation never falls through to it", async () => {
    const roster = await rosterAt();
    const place = await pubOf(VESSEL_SEED);
    expect(await sorter([reading(roster)], "private", [place])(await input())).toEqual({ class: "contracted" });
    expect(await sorter([reading(roster)], "private", [place])(await input({ admit: await admitAt("another-epoch") }))).toBeNull();
  });

  test("gateAnswersStrangers folds the primary charter with every carried reading", async () => {
    const roster = await rosterAt();
    expect(gateAnswersStrangers("private", [])).toBe(false);
    expect(gateAnswersStrangers("open", [])).toBe(true);
    expect(gateAnswersStrangers("private", [reading(roster), reading(roster, "open")])).toBe(true);
  });
});

describe("a refold drops what it no longer holds", () => {
  const admitted = (pairs: Array<[string, PeerClass | undefined]>) => pairs.map(([peerId, cls]) => ({ peerId, socket: peerId, cls }));

  test("RED: under PRIVATE strangers and unheld contracted sockets drop; same-operator, walker and held stay", () => {
    const drop = socketsNoLongerHeld(admitted([
      ["self", "same-operator"], ["walk", "walker"], ["held", "contracted"], ["gone", "contracted"], ["str", "stranger"], ["none", undefined],
    ]), { holds: (id) => id === "held", answersStrangers: false });
    expect(drop.sort()).toEqual(["gone", "none", "str"]);
  });

  test("CONTROL: under OPEN nothing drops", () => {
    expect(socketsNoLongerHeld(admitted([["gone", "contracted"], ["str", "stranger"]]), { holds: () => false, answersStrangers: true })).toEqual([]);
  });
});
