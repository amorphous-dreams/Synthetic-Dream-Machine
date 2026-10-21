/**
 * edge-frontier (K17) — the widening reader acts only as of a qualifying signed frontier. Reds: a withheld
 * raise, a stale clean frontier, two conflicting frontiers, a missing snapshot, a hand with no frontier, an epoch
 * rollover, and a log that does not extend the reader's pin each answer `unknown`, naming the cause. Controls:
 * a genesis frontier qualifies an empty board; a registered raise qualifies once the hand counts it.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { frontierSnapshotCid, raiseFrontierPins, readWideningFrontier, signGenesisFrontier, signNextFrontier, type HandReading, type RaisingHand } from "../src/edge-frontier.js";
import { actCid } from "../src/signed-act.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const B = "board1";
const lin = (...epochs: { signers: string[]; threshold?: number }[]) =>
  makeHandLineage(epochs.map((e, i) => ({ epoch: i, signers: e.signers, threshold: e.threshold ?? 1 })))!;

async function setup() {
  const s = await who(1);
  const lineage = lin({ signers: [s.key] });
  const hand: RaisingHand = { hand: "fleet", lineage };
  const roster = lineage[0]!;
  const lng = { epoch: 0, rosterHash: roster.rosterHash };
  const g = await signGenesisFrontier({ board: B, hand: "fleet", ...lng }, [s]);
  const snaps = (...sets: string[][]) => new Map(sets.map((x) => [frontierSnapshotCid(x), x] as const));
  const reading = (frontiers: unknown[], snapshots: Map<string, string[]>, seenRaises: string[] = [], pinned: HandReading["pinned"] = null): Map<string, HandReading> =>
    new Map([["fleet", { frontiers, snapshots, seenRaises, pinned }]]);
  return { s, hand, g, lng, snaps, reading };
}

describe("edge-frontier", () => {
  test("CONTROL: the signed empty genesis qualifies an empty board; a registered raise qualifies once counted", async () => {
    const { s, hand, g, lng, snaps, reading } = await setup();
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]))).status).toBe("known");
    const f1 = await signNextFrontier(g, ["raiseA"], lng, [s]);
    expect(readWideningFrontier(B, [hand], reading([g, f1], snaps([], ["raiseA"]), ["raiseA"])))
      .toMatchObject({ status: "known", asOf: { fleet: { seq: 1, cid: actCid(f1.body) } }, counted: { fleet: ["raiseA"] } });
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

  test("RED: a frontier that counts a raise this reader never received reads unknown until the act arrives", async () => {
    const { s, hand, g, lng, snaps, reading } = await setup();
    const f1 = await signNextFrontier(g, ["raiseA"], lng, [s]);
    expect(readWideningFrontier(B, [hand], reading([g, f1], snaps([], ["raiseA"]), []))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "counts-unseen-raise" }] });
    expect(readWideningFrontier(B, [hand], reading([g, f1], snaps([], ["raiseA"]), ["raiseA"])).status).toBe("known");
  });

  test("RED: a deleted local raise cannot rewind the reader: a frontier that does not extend its pin is refused", async () => {
    const { s, hand, g, lng, snaps, reading } = await setup();
    const f1 = await signNextFrontier(g, ["raiseA"], lng, [s]);
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]), [], { seq: 1, cid: actCid(f1.body) }))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "does-not-extend-pin" }] });
  });

  test("RED: two conflicting frontiers at one seq read as a fork and answer unknown", async () => {
    const { s, hand, g, lng, snaps, reading } = await setup();
    const left = await signNextFrontier(g, ["raiseA"], lng, [s]);
    const right = await signNextFrontier(g, ["raiseB"], lng, [s]);
    expect(readWideningFrontier(B, [hand], reading([g, left, right], snaps([], ["raiseA"], ["raiseB"])))).toEqual({ status: "unknown", missing: [{ hand: "fleet", why: "fork" }] });
  });

  test("RED: a missing or forged snapshot answers unknown", async () => {
    const { s, hand, g, lng, reading } = await setup();
    const f1 = await signNextFrontier(g, ["raiseA"], lng, [s]);
    expect(readWideningFrontier(B, [hand], reading([g, f1], new Map()))).toMatchObject({ missing: [{ why: "missing-snapshot" }] });
    const forged = new Map([[frontierSnapshotCid(["raiseA"]), ["raiseZ"]]]);
    expect(readWideningFrontier(B, [hand], reading([g, f1], forged))).toMatchObject({ missing: [{ why: "missing-snapshot" }] });
  });

  test("RED: a frontier signed by a key outside the hand's roster counts for nothing", async () => {
    const { hand, lng, snaps, reading } = await setup();
    const mallory = await who(9);
    const g = await signGenesisFrontier({ board: B, hand: "fleet", ...lng }, [mallory]);
    expect(readWideningFrontier(B, [hand], reading([g], snaps([]))).status).toBe("unknown");
  });

  test("the reader's pins only rise", async () => {
    const { s, hand, g, lng, snaps, reading } = await setup();
    const f1 = await signNextFrontier(g, [], lng, [s]);
    const pins = raiseFrontierPins({}, readWideningFrontier(B, [hand], reading([g, f1], snaps([]))));
    expect(raiseFrontierPins(pins, readWideningFrontier(B, [hand], reading([g], snaps([]))))).toEqual(pins);
  });
});

describe("edge-frontier: a hand's roster lineage across a rotation", () => {
  async function rotated() {
    const oldKey = await who(1), newKey = await who(2);
    const lineage = lin({ signers: [oldKey.key] }, { signers: [newKey.key] });
    const hand: RaisingHand = { hand: "fleet", lineage };
    const at = (i: number) => ({ epoch: i, rosterHash: lineage[i]!.rosterHash });
    const g = await signGenesisFrontier({ board: B, hand: "fleet", ...at(0) }, [oldKey]);
    return { oldKey, newKey, hand, at, g };
  }
  const reading = (frontiers: unknown[], pinned: HandReading["pinned"] = null): Map<string, HandReading> =>
    new Map([["fleet", { frontiers, snapshots: new Map([[frontierSnapshotCid([]), []]]), seenRaises: [], pinned }]]);

  test("RED: old links under the old key and a new head under the new key read known", async () => {
    const { newKey, hand, at, g } = await rotated();
    const head = await signNextFrontier(g, [], at(1), [newKey]);
    expect(readWideningFrontier(B, [hand], reading([g, head]))).toMatchObject({ status: "known", asOf: { fleet: { seq: 1 } } });
  });

  test("CONTROL: a link signed by a key outside its own epoch's roster still refuses (the new key cannot sign the old epoch)", async () => {
    const { oldKey, newKey, hand, at } = await rotated();
    const forgedOld = await signGenesisFrontier({ board: B, hand: "fleet", ...at(0) }, [newKey]);   // epoch 0 names the old roster
    expect(readWideningFrontier(B, [hand], reading([forgedOld])).status).toBe("unknown");
    // and the retired key signs nothing after its epoch closed
    const g = await signGenesisFrontier({ board: B, hand: "fleet", ...at(0) }, [oldKey]);
    const sneak = await signNextFrontier(g, [], at(1), [oldKey]);
    expect(readWideningFrontier(B, [hand], reading([g, sneak])).status).toBe("unknown");
  });

  test("RED: a head left at the old epoch reads stale-lineage; a chain whose epochs fall is cut", async () => {
    const { newKey, hand, at, g } = await rotated();
    expect(readWideningFrontier(B, [hand], reading([g]))).toMatchObject({ missing: [{ why: "stale-lineage" }] });
    const head = await signNextFrontier(g, [], at(1), [newKey]);
    const back = await signNextFrontier(head, [], at(0), [newKey]);   // a later link claiming the closed epoch
    expect(readWideningFrontier(B, [hand], reading([g, head, back]))).toMatchObject({ status: "known", asOf: { fleet: { seq: 1 } } });
  });
});

describe("edge-frontier: a quorum hand signs as a quorum", () => {
  async function charter() {
    const seats = [await who(11), await who(12), await who(13)];
    const lineage = lin({ signers: seats.map((x) => x.key), threshold: 2 });
    const hand: RaisingHand = { hand: "realm", lineage };
    const lng = { epoch: 0, rosterHash: lineage[0]!.rosterHash };
    const reading = (frontiers: unknown[]): Map<string, HandReading> =>
      new Map([["realm", { frontiers, snapshots: new Map([[frontierSnapshotCid([]), []]]), seenRaises: [], pinned: null }]]);
    return { seats, hand, lng, reading };
  }
  test("RED: one seat's signature on a charter-hand frontier reads unknown", async () => {
    const { seats, hand, lng, reading } = await charter();
    const one = await signGenesisFrontier({ board: B, hand: "realm", ...lng }, [seats[0]!]);
    expect(readWideningFrontier(B, [hand], reading([one]))).toEqual({ status: "unknown", missing: [{ hand: "realm", why: "below-threshold" }] });
    // the same seat twice is still one seat
    const dup = await signGenesisFrontier({ board: B, hand: "realm", ...lng }, [seats[0]!, seats[0]!]);
    expect(readWideningFrontier(B, [hand], reading([dup])).status).toBe("unknown");
  });
  test("CONTROL: a threshold of seats reads known", async () => {
    const { seats, hand, lng, reading } = await charter();
    const two = await signGenesisFrontier({ board: B, hand: "realm", ...lng }, [seats[0]!, seats[2]!]);
    expect(readWideningFrontier(B, [hand], reading([two])).status).toBe("known");
  });
});
