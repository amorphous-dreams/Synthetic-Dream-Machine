/**
 * hosting-store.test.ts — a hearth keeps two live epochs and one spent-set each, and nothing about anyone.
 *
 * Proven:
 *   · a roll keeps the new act current and the old one previous, re-derives both epochs from the leaf, and
 *     deletes every spent-set outside the two live epochs (rolling twice kills the epoch before);
 *   · a token burns once: the same claim again reads `retry` (refuse before destroy), a different claim reads
 *     `spent-other`; CONCURRENT burns with different claims yield exactly one `fresh`;
 *   · a burn is durable before it returns (the line is on disk);
 *   · RED: the store holds no guest leaf, no lineage, no claim — only random nonces and claim digests;
 *     CONTROL: the claim's digest and the nonce DO appear (the scan can see what is there);
 *   · the operator's count reads the redemptions as a number.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostingActCid, claimDigest, lineageOf, redeemClaim } from "@lararium/mesh";
import { rollHosting, readHostingState, liveEpochs, spendToken, redeemedCount, hostingDir, DEFAULT_HOSTING_CAP } from "../src/hosting-store.js";

const AID  = "epoch0-" + "a".repeat(64);
const LEAF = new Uint8Array(32).fill(51);
const GUEST_SEED = new Uint8Array(32).fill(52);
const GUEST_LEAF = "c".repeat(64);
let storageDir = "";
beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "hosting-store-")); });
afterEach(() => { rmSync(storageDir, { recursive: true, force: true }); });

const dirFiles = (): string[] => readdirSync(hostingDir(storageDir, AID)).sort();

describe("the roll — two live epochs, nothing older", () => {
  test("a roll keeps the old act as previous; rolling twice deletes the spent-set two epochs back", async () => {
    const first = await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF });
    expect(first.state).toMatchObject({ previous: null });
    expect(first.act.cap).toBe(DEFAULT_HOSTING_CAP);
    const e1 = hostingActCid(first.act);
    await spendToken({ storageDir, nexusAid: AID, epochCid: e1, n: "11".repeat(32), claimDigest: "22".repeat(32) });
    const second = await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF, cap: 2 });
    expect(second.act.prev).toBe(e1);
    expect(readHostingState(storageDir, AID)).toMatchObject({ previous: first.act });
    expect(readHostingState(storageDir, AID)?.current.cap).toBe(2);
    expect(dirFiles()).toContain(`spent-${e1}`);                 // the previous epoch's set stays live
    const live = liveEpochs(readHostingState(storageDir, AID)!, LEAF)!;
    expect(live.previous?.cid).toBe(e1);
    expect(live.current.cid).toBe(hostingActCid(second.act));
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF });
    expect(dirFiles()).not.toContain(`spent-${e1}`);             // two rolls back: gone
    expect(liveEpochs(readHostingState(storageDir, AID)!, new Uint8Array(32).fill(9))).toBeNull();
  });
});

describe("the burn — once, durably, refuse before destroy", () => {
  test("the same claim retries; a different claim on a burned nonce reads spent-other", async () => {
    const { act } = await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "ab".repeat(32);
    const claim = claimDigest(redeemClaim(GUEST_SEED, n));
    expect(await spendToken({ storageDir, nexusAid: AID, epochCid: e, n, claimDigest: claim })).toBe("fresh");
    // Durable before return: the line already stands on disk.
    expect(readFileSync(join(hostingDir(storageDir, AID), `spent-${e}`), "utf8")).toContain(`n ${n} ${claim}`);
    expect(await spendToken({ storageDir, nexusAid: AID, epochCid: e, n, claimDigest: claim })).toBe("retry");
    expect(await spendToken({ storageDir, nexusAid: AID, epochCid: e, n, claimDigest: "ff".repeat(32) })).toBe("spent-other");
    expect(redeemedCount(storageDir, AID, e)).toBe(1);
  });

  test("RED: concurrent burns of one nonce under different claims yield exactly one fresh", async () => {
    const { act } = await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "cd".repeat(32);
    const outcomes = await Promise.all(["01", "02", "03", "04"].map((c) =>
      spendToken({ storageDir, nexusAid: AID, epochCid: e, n, claimDigest: c.repeat(32) })));
    expect(outcomes.filter((o) => o === "fresh")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "spent-other")).toHaveLength(3);
  });

  test("RED: the store holds no guest leaf, lineage or claim; CONTROL: the nonce and the claim digest are there", async () => {
    const { act } = await rollHosting({ storageDir, nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "ef".repeat(32);
    const claim = redeemClaim(GUEST_SEED, n);
    await spendToken({ storageDir, nexusAid: AID, epochCid: e, n, claimDigest: claimDigest(claim) });
    const everything = dirFiles().map((f) => readFileSync(join(hostingDir(storageDir, AID), f), "utf8")).join("\n");
    expect(everything).toContain(n);
    expect(everything).toContain(claimDigest(claim));
    expect(everything).not.toContain(claim);
    expect(everything).not.toContain(lineageOf(n, claim));
    expect(everything).not.toContain(GUEST_LEAF);
  });
});
