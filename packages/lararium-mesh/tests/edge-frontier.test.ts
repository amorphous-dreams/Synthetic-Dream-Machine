/**
 * edge-frontier (K17) — the widening reader acts only as of a qualifying signed frontier. Reds: a withheld
 * raise, a stale clean frontier, two conflicting frontiers, a missing snapshot, a hand with no frontier, an epoch
 * rollover, and a log that does not extend the reader's pin each answer `unknown`, naming the cause. Controls:
 * a genesis frontier qualifies an empty board; a registered raise qualifies once the hand counts it.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { frontierSnapshotCid, raiseFrontierPins, readWideningFrontier, signGenesisFrontier, signNextFrontier, type HandReading, type RaisingHand } from "../src/edge-frontier.js";
import { actCid } from "../src/signed-act.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const B = "board1";

async function setup() {
  const s = await who(1);
  const hand: RaisingHand = { hand: "fleet", signers: [s.key], epoch: 1, rosterHash: "r1" };
  const g = await signGenesisFrontier({ board: B, hand: "fleet", epoch: 1, rosterHash: "r1" }, s);
  const snaps = (...sets: string[][]) => new Map(sets.map((x) => [frontierSnapshotCid(x), x] as const));
  const reading = (frontiers: unknown[], snapshots: Map<string, string[]>, seenRaises: string[] = [], pinned: HandReading["pinned"] = null): Map<string, HandReading> =>
    new Map([["fleet", { frontiers, snapshots, seenRaises, pinned }]]);
  return { s, hand, g, snaps, reading };
}

describe("edge-frontier", () => {
  test("CONTROL: the signed empty genesis qualifies an empty board; a registered raise qualifies once counted", async () => {
    const { s, hand, g, snaps, reading } = await setup();
    const empty = readWideningFrontier(B, [hand], reading([g], snaps([])));
    expect(empty.status).toBe("known");
    const f1 = await signNextFrontier(g, ["raiseA"], { epoch: 1, rosterHash: "r1" }, s);
    const known = readWideningFrontier(B, [hand], reading([g, f1], snaps([], ["raiseA"]), ["raiseA"]));
    expect(known).toMatchObject({ status: "known", asOf: { fleet: { seq: 1, cid: actCid(f1.body) } }, counted: { fleet: ["raiseA"] } });
  });

  test("RED: no frontier at all reads unknown, never clear", async () => {
    const { hand, snaps, reading } = await setup();
    expect(readWideningFrontier(B, [hand], reading([], snaps()))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "no-frontier" }] });
    expect(readWideningFrontier(B, [hand], new Map())).toMatchObject({ status: "unknown" });
  });

  test("RED: a stale clean frontier cannot hide a raise the reader has seen", async () => {
    const { hand, g, snaps, reading } = await setup();
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]), ["seenRaise"]))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "withholds-seen-raise" }] });
  });

  test("RED: a deleted local raise cannot rewind the reader: a frontier that does not extend its pin is refused", async () => {
    const { s, hand, g, snaps, reading } = await setup();
    const f1 = await signNextFrontier(g, ["raiseA"], { epoch: 1, rosterHash: "r1" }, s);
    const pinned = { seq: 1, cid: actCid(f1.body) };
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]), [], pinned))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "does-not-extend-pin" }] });
  });

  test("RED: two conflicting frontiers at one seq read as a fork and answer unknown", async () => {
    const { s, hand, g, snaps, reading } = await setup();
    const left = await signNextFrontier(g, ["raiseA"], { epoch: 1, rosterHash: "r1" }, s);
    const right = await signNextFrontier(g, ["raiseB"], { epoch: 1, rosterHash: "r1" }, s);
    expect(readWideningFrontier(B, [hand], reading([g, left, right], snaps([], ["raiseA"], ["raiseB"])))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "fork" }] });
  });

  test("RED: a missing or forged snapshot answers unknown", async () => {
    const { s, hand, g, reading } = await setup();
    const f1 = await signNextFrontier(g, ["raiseA"], { epoch: 1, rosterHash: "r1" }, s);
    expect(readWideningFrontier(B, [hand], reading([g, f1], new Map()))).toMatchObject({ missing: [{ why: "missing-snapshot" }] });
    const forged = new Map([[frontierSnapshotCid(["raiseA"]), ["raiseZ"]]]);
    expect(readWideningFrontier(B, [hand], reading([g, f1], forged))).toMatchObject({ missing: [{ why: "missing-snapshot" }] });
  });

  test("RED: an epoch rollover leaves the old epoch's frontier stale until the hand signs at the new roster", async () => {
    const { s, hand, g, snaps, reading } = await setup();
    const rolled: RaisingHand = { ...hand, epoch: 2, rosterHash: "r2" };
    expect(readWideningFrontier(B, [rolled], reading([g], snaps([]))).status).toBe("unknown");
    const f1 = await signNextFrontier(g, [], { epoch: 2, rosterHash: "r2" }, s);
    expect(readWideningFrontier(B, [rolled], reading([g, f1], snaps([]))).status).toBe("known");
  });

  test("RED: a frontier signed by a key outside the hand's roster counts for nothing", async () => {
    const { hand, snaps, reading } = await setup();
    const mallory = await who(9);
    const g = await signGenesisFrontier({ board: B, hand: "fleet", epoch: 1, rosterHash: "r1" }, mallory);
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]))).status).toBe("unknown");
  });

  test("the reader's pins only rise", async () => {
    const { s, hand, g, snaps, reading } = await setup();
    const f1 = await signNextFrontier(g, [], { epoch: 1, rosterHash: "r1" }, s);
    const k1 = readWideningFrontier(B, [hand], reading([g, f1], snaps([])));
    const k0 = readWideningFrontier(B, [hand], reading([g], snaps([])));
    const pins = raiseFrontierPins({}, k1);
    expect(raiseFrontierPins(pins, k0)).toEqual(pins);
  });
});
