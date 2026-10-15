/**
 * roll-circle — a roll whose seats rest in several vaults crosses as a circle: each holder contributes its chair,
 * then each signs the one image, and the roll law judges the epoch it mints.
 *
 *   C1  A 2-of-2 roll: both committed successors reveal with fresh successor digests; one signature reads `ready`,
 *       both read `complete`, and the epoch verifies as the next link of the lineage.
 *   C2  An added chair: a third seat joins with a key no head committed; unsigned it reads `ready` (possession owed),
 *       signed it reads `complete` at two of three.
 *   C3  RED: a chair joins no signed circle; a seat or a successor digest twice refuses; a signer outside the chairs
 *       refuses; a forged signature counts for nothing.
 *   C4  RED: a circle off another head reads `stale`; one that re-seats a genesis key, or re-spends a committed
 *       digest as a successor, reads `invalid` whatever signs it; another Nexus reads `invalid`.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed } from "../src/auth-wire.js";
import { seatNextDigest } from "../src/cold-key-card.js";
import { sha256BytesSync, utf8Bytes } from "../src/crypto.js";
import {
  joinRollCircle, judgeRollCircle, openRollCircle, readRollCircle, rollCircleBytes, signRollCircle, RollCircleRefusal, type RollCircle,
} from "../src/roll-circle.js";
import { bookSeat, heldCharter } from "./charter-fixture.js";

const seed = (name: string): Uint8Array => sha256BytesSync(utf8Bytes(`roll-circle|${name}`));
const key = (name: string): string => bookSeat(seed(name));
/** A fresh successor's digest, as a holder's new card would commit it. */
const fresh = (name: string): string => seatNextDigest(key(`next|${name}`));
const sign = async (circle: RollCircle, name: string) =>
  ({ signer: key(name), sig: await ed25519SignerFromSeed(seed(name))(rollCircleBytes(circle)) });

/** A 2-of-2 genesis over A0, B0, committing A1, B1. */
function twoOfTwo() {
  const charter = heldCharter({ keys: [key("A0"), key("B0")], threshold: 2, successors: { keys: [key("A1"), key("B1")], threshold: 2 } });
  return { aid: charter.head.epochCid, lineage: charter.chain, head: charter.head };
}

const refusal = (run: () => unknown): string => {
  try { run(); return "ran"; } catch (e) { return e instanceof RollCircleRefusal ? e.code : `${(e as Error).name}: ${(e as Error).message}`; }
};

describe("a roll crosses its vaults as a circle", () => {
  test("C1 — two committed successors reveal, both sign, and the epoch verifies", async () => {
    const { aid, lineage, head } = twoOfTwo();
    const opened = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    const joined = joinRollCircle(JSON.parse(JSON.stringify(opened)), { seat: key("B1"), next: fresh("B2") });
    expect(joined.chairs.map((c) => c.seat)).toEqual([key("A1"), key("B1")].sort());
    expect(judgeRollCircle(joined, lineage).verdict).toBe("ready");
    const once = signRollCircle(joined, [await sign(joined, "B1")]);
    const halfway = judgeRollCircle(once, lineage);
    expect(halfway).toMatchObject({ verdict: "ready", signed: [key("B1")], why: "roll-short-of-revealed-quorum" });
    const twice = signRollCircle(JSON.parse(JSON.stringify(once)), [await sign(once, "A1")]);
    const done = judgeRollCircle(twice, lineage);
    expect(done.verdict).toBe("complete");
    expect(done.signed).toEqual([key("A1"), key("B1")].sort());
    expect(done.epoch?.predecessors).toEqual([head.epochCid]);
    // The minted epoch extends the lineage: a circle stepping from it reads against a three-link history.
    const next = openRollCircle({ aid, predecessor: done.epoch!.epochCid, threshold: 2, chair: { seat: key("A2"), next: fresh("A3") } });
    expect(judgeRollCircle(next, [...lineage, done.epoch!]).verdict).toBe("ready");
  });

  test("C2 — an added chair proves possession, and the roll seats three at two", async () => {
    const { aid, lineage, head } = twoOfTwo();
    let circle = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    circle = joinRollCircle(circle, { seat: key("B1"), next: fresh("B2") });
    circle = joinRollCircle(circle, { seat: key("C0"), next: fresh("C1") });
    circle = signRollCircle(circle, [await sign(circle, "A1"), await sign(circle, "B1")]);
    expect(judgeRollCircle(circle, lineage)).toMatchObject({ verdict: "ready", why: "seat-change-without-proof-of-possession" });
    circle = signRollCircle(circle, [await sign(circle, "C0")]);
    const done = judgeRollCircle(circle, lineage);
    expect(done.verdict).toBe("complete");
    expect(done.epoch?.roll?.keys).toHaveLength(3);
    expect(done.epoch?.roll?.threshold).toBe(2);
  });

  test("C3 — RED: a signed circle takes no chair; a seat, a successor or a signer twice refuses; a forged signature counts for nothing", async () => {
    const { aid, lineage, head } = twoOfTwo();
    const opened = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    expect(refusal(() => joinRollCircle(opened, { seat: key("A1"), next: fresh("X") }))).toBe("seat-twice");
    expect(refusal(() => joinRollCircle(opened, { seat: key("B1"), next: fresh("A2") }))).toBe("successor-twice");
    const joined = joinRollCircle(opened, { seat: key("B1"), next: fresh("B2") });
    const signed = signRollCircle(joined, [await sign(joined, "A1")]);
    expect(refusal(() => joinRollCircle(signed, { seat: key("C0"), next: fresh("C1") }))).toBe("circle-signed");
    expect(refusal(() => signRollCircle(signed, [{ signer: key("C0"), sig: "ab".repeat(64) }]))).toBe("signer-unseated");
    expect(refusal(() => signRollCircle(signed, [{ signer: key("A1"), sig: "ab".repeat(64) }]))).toBe("signer-twice");
    // A forged signature in a B slot counts for nothing; CONTROL: B's own does.
    const forged = signRollCircle(signed, [{ signer: key("B1"), sig: "cd".repeat(64) }]);
    expect(judgeRollCircle(forged, lineage).verdict).toBe("ready");
    expect(judgeRollCircle(signRollCircle(signed, [await sign(signed, "B1")]), lineage).verdict).toBe("complete");
    expect(readRollCircle({ ...JSON.parse(JSON.stringify(signed)), extra: 1 })).toBeNull();
    // A signed circle that reveals one committed successor of the head's two never completes: invalid, not ready.
    let frozen = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    frozen = joinRollCircle(frozen, { seat: key("C0"), next: fresh("C1") });
    frozen = signRollCircle(frozen, [await sign(frozen, "A1")]);
    expect(judgeRollCircle(frozen, lineage)).toMatchObject({ verdict: "invalid", why: "roll-frozen-short-of-revealed-quorum" });
    // A seat key no Ed25519 door reads never throws the judge: the roll law refuses it by name.
    const weak = signRollCircle(joinRollCircle(openRollCircle({ aid, predecessor: head.epochCid, threshold: 1, chair: { seat: key("A1"), next: fresh("A2") } }),
      { seat: "ee".repeat(32), next: fresh("W") }), []);
    expect(judgeRollCircle(weak, lineage).verdict).toBe("invalid");
  });

  test("C4 — RED: another head reads stale; a returning key or a spent digest reads invalid whatever signs", async () => {
    const { aid, lineage, head } = twoOfTwo();
    const stale = openRollCircle({ aid, predecessor: `${head.epochCid}x`, threshold: 1, chair: { seat: key("A1"), next: fresh("A2") } });
    expect(judgeRollCircle(stale, lineage).verdict).toBe("stale");
    expect(judgeRollCircle({ ...stale, aid: `nexus-${"cd".repeat(32)}` }, lineage).verdict).toBe("invalid");

    let back = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    back = joinRollCircle(back, { seat: key("B1"), next: fresh("B2") });
    back = joinRollCircle(back, { seat: key("A0"), next: fresh("A0-again") });
    back = signRollCircle(back, [await sign(back, "A1"), await sign(back, "B1"), await sign(back, "A0")]);
    expect(judgeRollCircle(back, lineage)).toMatchObject({ verdict: "invalid", why: "roll-reuses-a-seated-key" });

    // B arms its successor with A1's committed digest: a digest the head already spent.
    let spent = openRollCircle({ aid, predecessor: head.epochCid, threshold: 2, chair: { seat: key("A1"), next: fresh("A2") } });
    spent = joinRollCircle(spent, { seat: key("B1"), next: seatNextDigest(key("A1")) });
    spent = signRollCircle(spent, [await sign(spent, "A1"), await sign(spent, "B1")]);
    expect(judgeRollCircle(spent, lineage)).toMatchObject({ verdict: "invalid", why: "roll-respends-a-digest" });
  });
});
