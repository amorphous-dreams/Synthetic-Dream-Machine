/**
 * hosting-store.test.ts — a hearth keeps two live epochs and one sealed row per spend, and nothing about anyone.
 *
 *   S1  THE ROLL: a roll keeps the new act current and the old one previous, re-derives both epochs from the leaf,
 *       and removes every spend row outside the two live epochs (rolling twice kills the epoch before).
 *   S2  THE BURN: a token burns once. The same claim again reads `retry` (refuse before destroy); a different
 *       claim reads `spent-other`; burns of one nonce that start together under different claims yield exactly one
 *       `fresh`.                                  control: another nonce burns `fresh` beside it
 *   S3  RED: EVERY ROW RESTS SEALED. The state row and each spend row read as face-key-sealed frames; no file's bytes
 *       spell the nonce, the claim digest, the act, the guest leaf, the lineage or the claim, and a spend row's
 *       name carries no nonce. The parent commit's store appended `n <nonce> <claim digest>` to a readable file.
 *                                                 control: the store's own read answers the act and the outcome
 *   S4  THE SPEND ROW COMMITS, AND WHAT RIDES AHEAD OF IT RE-DERIVES: a redemption whose answer never left replays
 *       as `retry`, and the count reads the rows standing (a row removed by hand lowers it; no counter stands beside).
 *   S5  RED: A WRONG KEY BURNS NOTHING AND ROLLS NOTHING. Rows another vessel sealed refuse the state read, the
 *       roll and the spend by name, and their bytes never move.
 *   S6  RED: a state or a spend row that opens to another shape refuses by name; a state whose two acts form no
 *       chain refuses.
 *   S7  RED: THE FLOOR READS NO HOSTING ROW: a locked seat refuses the read, the roll and the spend; the count reads names alone.
 *   S8  A ROLL ANOTHER ROLL OVERTOOK refuses `HostingStateMoved` and writes nothing over the newer state.
 *   S9  THE SWEEP removes only rows this face's key opens: a dead epoch's row sealed by another key stays, and
 *       the roll names it `unswept`.
 *   S10 THE STORE TAKES NO DIRECTORY: its rows rest under the seated custody face in identity.
 */
import { describe, test, expect, afterEach } from "vitest";
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostingActCid, claimDigest, lineageOf, mintHostingAct, readFckCarrier, redeemClaim } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable, FaceLocked } from "../src/custody-holder.js";
import { seatedCustody, writeCustodyRow } from "../src/custody-seat.js";
import {
  rollHosting, readHostingState, liveEpochs, spendToken, spendMintMarker, redeemedCount, mintedCount,
  DEFAULT_HOSTING_CAP, HostingStateMoved,
} from "../src/hosting-store.js";
import { hostingDirPath, hostingRowDir } from "../src/hosting-face.js";
import { FaceNotNamed } from "../src/face-selector.js";
import { FIXTURE_PASSPHRASE, holdSealsUntilBothArrive, seatHostingCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const AID  = "nexus-" + "a".repeat(64);
const LEAF = new Uint8Array(32).fill(51);
const GUEST_SEED = new Uint8Array(32).fill(52);
const GUEST_LEAF = "c".repeat(64);

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatHostingCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then(() => "landed", (e: unknown) => e);
const dirFiles = async (): Promise<string[]> => readdirSync(hostingDirPath(0, AID)!).sort();
const spendsOf = async (epoch: string): Promise<string[]> => (await dirFiles()).filter((f) => f.startsWith(`spent-${epoch}-`));
const fileBytes = async (name: string): Promise<Buffer> => readFileSync(join(hostingDirPath(0, AID)!, name));

describe("the roll — two live epochs, nothing older", () => {
  test("RED: two unlocked faces with none named refuse a first roll; CONTROL: naming face 1 binds and seals there", async () => {
    const c = await custody("host-face-choice");
    const other = await c.holder.foundFace({ ordinal: 1, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const first = await c.holder.faceStanding({ ordinal: 0 });
    expect(await refusal(rollHosting({ nexusAid: AID, leafSeed: LEAF }))).toBeInstanceOf(FaceNotNamed);
    expect(existsSync(hostingDirPath(0, AID)!)).toBe(false);
    expect(existsSync(hostingDirPath(1, AID)!)).toBe(false);
    const rolled = await rollHosting({ nexusAid: AID, leafSeed: LEAF, face: 1 });
    const row = hostingDirPath(1, AID)!;
    expect(row).toBe(join(c.homes.identity, "faces", other.fcid, ...hostingRowDir(1, AID).split("/")));
    expect(existsSync(join(row, "state.json"))).toBe(true);
    expect(readFckCarrier(readFileSync(join(row, "state.json")))).toBe("sealed");
    expect(existsSync(hostingDirPath(0, AID)!)).toBe(false);
    await c.holder.lockFace(other.fcid);
    expect(await refusal(readHostingState(AID))).toBeInstanceOf(FaceLocked);
    expect((await c.holder.faceStanding({ ordinal: 0 }))?.unlocked).toBe(true);
    expect(await c.holder.unlockFace({ ordinal: 1 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }])).toMatchObject({ reading: "opens" });
    await c.holder.lockFace(first!.fcid);
    expect((await readHostingState(AID))?.current).toEqual(rolled.act);
  });

  test("S1 — a roll keeps the old act as previous; rolling twice removes the spend rows two epochs back", async () => {
    await custody("host-s1");
    expect(await readHostingState(AID)).toBeNull();                                // control: hosts nowhere yet
    const first = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    expect(first.state).toMatchObject({ previous: null, depth: 1 });
    expect(first.act.cap).toBe(DEFAULT_HOSTING_CAP);
    const e1 = hostingActCid(first.act);
    await spendToken({ nexusAid: AID, epochCid: e1, n: "11".repeat(32), claimDigest: "22".repeat(32) });
    const second = await rollHosting({ nexusAid: AID, leafSeed: LEAF, cap: 2 });
    expect(second.act.prev).toBe(e1);
    expect(await readHostingState(AID)).toMatchObject({ previous: first.act, depth: 2 });
    expect((await readHostingState(AID))?.current.cap).toBe(2);
    expect(await spendsOf(e1)).toHaveLength(1);                                    // the previous epoch's row stays live
    const live = liveEpochs((await readHostingState(AID))!, LEAF)!;
    expect(live.previous?.cid).toBe(e1);
    expect(live.current.cid).toBe(hostingActCid(second.act));
    const third = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    expect(third.unswept).toEqual([]);
    expect(await spendsOf(e1)).toEqual([]);                                        // two rolls back: gone
    expect(liveEpochs((await readHostingState(AID))!, new Uint8Array(32).fill(9))).toBeNull();
  });

  test("S8 — a roll another roll overtook refuses and writes nothing over the newer state", async () => {
    await custody("host-s8");
    await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    // Two rolls read one state; the first to seal moves it, and the second refuses. The handshake holds the
    // overlap: neither seals until both have read. Which roll seals first stays the machine's own choice.
    const gate = holdSealsUntilBothArrive(seatedCustody()!, /state\.json$/);
    let outcomes: PromiseSettledResult<Awaited<ReturnType<typeof rollHosting>>>[];
    try { outcomes = await Promise.allSettled([rollHosting({ nexusAid: AID, leafSeed: LEAF, cap: 4 }), rollHosting({ nexusAid: AID, leafSeed: LEAF, cap: 5 })]); }
    finally { gate.release(); }
    expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    const won = outcomes.find((o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof rollHosting>>> => o.status === "fulfilled")!;
    expect(outcomes.find((o): o is PromiseRejectedResult => o.status === "rejected")!.reason).toBeInstanceOf(HostingStateMoved);
    // The state holds the winner's act and nothing of the roll it overtook.
    expect(await readHostingState(AID)).toMatchObject({ depth: 2 });
    expect((await readHostingState(AID))!.current.cap).toBe(won.value.act.cap);
    expect([4, 5]).toContain(won.value.act.cap);
    // CONTROL: with no overlap the second roll reads the moved state and stands as the next roll.
    await rollHosting({ nexusAid: AID, leafSeed: LEAF, cap: 6 });
    expect(await readHostingState(AID)).toMatchObject({ depth: 3 });
  });
});

describe("the burn — once, sealed, refuse before destroy", () => {
  test("S2 — the same claim retries; a different claim reads spent-other; burns that start together yield one fresh", async () => {
    await custody("host-s2");
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "ab".repeat(32);
    const claim = claimDigest(redeemClaim(GUEST_SEED, n), GUEST_LEAF);
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: claim })).toBe("fresh");
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: claim })).toBe("retry");
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "ff".repeat(32) })).toBe("spent-other");
    expect(await spendToken({ nexusAid: AID, epochCid: e, n: "ac".repeat(32), claimDigest: claim })).toBe("fresh");   // CONTROL: another nonce
    expect(await redeemedCount(AID, e)).toBe(2);
    // A mint marker burns the same way, in its own rows and its own count.
    expect(await spendMintMarker({ nexusAid: AID, epochCid: e, marker: "0a".repeat(32), batchDigest: "0b".repeat(32) })).toBe("fresh");
    expect(await spendMintMarker({ nexusAid: AID, epochCid: e, marker: "0a".repeat(32), batchDigest: "0b".repeat(32) })).toBe("retry");
    expect(await spendMintMarker({ nexusAid: AID, epochCid: e, marker: "0a".repeat(32), batchDigest: "0c".repeat(32) })).toBe("spent-other");
    expect(await spendMintMarker({ nexusAid: AID, epochCid: e, marker: n, batchDigest: claim })).toBe("fresh");       // a marker never meets a nonce's row
    expect([await redeemedCount(AID, e), await mintedCount(AID, e)]).toEqual([2, 2]);
    const m = "cd".repeat(32);
    const outcomes = await Promise.all(["01", "02", "03", "04"].map((c) => spendToken({ nexusAid: AID, epochCid: e, n: m, claimDigest: c.repeat(32) })));
    expect(outcomes.filter((o) => o === "fresh")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "spent-other")).toHaveLength(3);
    expect(String(await refusal(spendToken({ nexusAid: AID, epochCid: "not-an-epoch", n, claimDigest: claim })))).toMatch(/64-hex act id/);
  });

  test("S3 — every row rests sealed, and no file spells a nonce, a digest, an act, a leaf, a lineage or a claim", async () => {
    await custody("host-s3");
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "ef".repeat(32);
    const claim = redeemClaim(GUEST_SEED, n);
    const digest = claimDigest(claim, GUEST_LEAF);
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: digest })).toBe("fresh");
    const files = await dirFiles();
    expect(files).toHaveLength(2);
    expect(files.filter((f) => /^spent-[0-9a-f]{64}-n-[0-9a-f]{32}$/.test(f))).toHaveLength(1);
    for (const f of files) expect(readFckCarrier(await fileBytes(f)), f).toBe("sealed");
    const everything = Buffer.concat([Buffer.from(files.join("\n")), ...(await Promise.all(files.map(fileBytes)))]);
    for (const secret of [n, n.slice(0, 16), digest, claim, lineageOf(n, claim), GUEST_LEAF, act.sig, act.oprfPub, AID]) {
      expect(everything.includes(Buffer.from(secret)), secret.slice(0, 12)).toBe(false);
    }
    // CONTROL: the store's own read opens what the files hide.
    expect((await readHostingState(AID))!.current).toEqual(act);
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: digest })).toBe("retry");
  });

  test("S4 — the spend row commits: an answer that never left replays as retry, and the count reads the rows standing", async () => {
    await custody("host-s4");
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "aa".repeat(32);
    const digest = claimDigest(redeemClaim(GUEST_SEED, n), GUEST_LEAF);
    // The redemption burns and its process stops before any answer: the row stands, and nothing else records it.
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: digest })).toBe("fresh");
    // The same socket dials again: the row answers `retry`, which earns the identical grant.
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: digest })).toBe("retry");
    expect(await redeemedCount(AID, e)).toBe(1);
    // The count derives from the rows by name: with the row gone, no counter remembers it, and the nonce burns fresh.
    rmSync(join(hostingDirPath(0, AID)!, (await spendsOf(e))[0]!));
    expect(await redeemedCount(AID, e)).toBe(0);
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: digest })).toBe("fresh");
    expect(await redeemedCount(AID, "9".repeat(64))).toBe(0);                      // another epoch counts none of them
  });

  test("S5 — a wrong key burns nothing and rolls nothing", async () => {
    const b = await custody("host-s5-b");
    const a = await custody("host-s5-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    as(b);
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "bb".repeat(32);
    await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) });
    const bDir = hostingDirPath(0, AID)!;
    const foreign = new Map(readdirSync(bDir).map((f) => [f, readFileSync(join(bDir, f))]));
    as(a);
    // A's own state and spend, under A's face key: two face keys, two encodings of the same rows.
    await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) });
    const aDir = hostingDirPath(0, AID)!;
    for (const [f, bytes] of foreign) expect(readFileSync(join(aDir, f)).equals(bytes), f).toBe(false);
    for (const f of foreign.keys()) copyFileSync(join(bDir, f), join(aDir, f));     // B's rows, at A's paths
    expect(await refusal(readHostingState(AID))).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(rollHosting({ nexusAid: AID, leafSeed: LEAF }))).toBeInstanceOf(CustodyRowUnavailable);
    const spend = await refusal(spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "02".repeat(32) }));
    expect(spend).toBeInstanceOf(CustodyRowUnavailable);                            // a burn nobody can read never reads as unspent
    expect(spend).toMatchObject({ home: "identity" });
    for (const [f, bytes] of foreign) expect(readFileSync(join(aDir, f)).equals(bytes), f).toBe(true);
    as(b);
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) })).toBe("retry");   // the sealing face still opens them
    as(a);
  });

  test("S6 — a row that opens to another shape refuses by name", async () => {
    await custody("host-s6");
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const n = "cc".repeat(32);
    await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) });
    const enc = (v: unknown): Uint8Array => new TextEncoder().encode(typeof v === "string" ? v : JSON.stringify(v));
    const spendRow = `${hostingRowDir(0, AID)}/${(await spendsOf(e))[0]!}`;
    for (const line of ["n only-two", `m ${n} ${"01".repeat(32)}`, `n ${n} ${"01".repeat(32)} extra`, ""]) {
      await writeCustodyRow("identity", spendRow, enc(line));                         // sealed under the right key, of the wrong shape
      expect(await refusal(spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) })), JSON.stringify(line)).toMatchObject({ reading: "malformed" });
    }
    await writeCustodyRow("identity", spendRow, enc(`n ${n} ${"01".repeat(32)}`));    // control: the true shape answers again
    expect(await spendToken({ nexusAid: AID, epochCid: e, n, claimDigest: "01".repeat(32) })).toBe("retry");

    const stateRow = `${hostingRowDir(0, AID)}/state.json`;
    const other = (await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: "7".repeat(64), cap: 3 })).act;
    const shapes = [
      { current: act, previous: null },                                              // no depth
      { current: act, previous: null, depth: 0 },
      { current: act, previous: null, depth: 2 },                                    // a first act at a depth past one
      { current: { ...act, sig: "zz" }, previous: null, depth: 1 },
      { current: act, previous: "none", depth: 1 },
      { current: other, previous: act, depth: 2 },                                   // the current act rolls from another act than the previous
      { current: other, previous: null, depth: 1 },                                  // a rolled act with no previous
      { current: act, previous: null, depth: 1, extra: true },
      [act],
    ];
    for (const shape of shapes) {
      await writeCustodyRow("identity", stateRow, enc(shape));
      expect(await refusal(readHostingState(AID)), JSON.stringify(shape).slice(0, 60)).toMatchObject({ reading: "malformed" });
      expect(await refusal(rollHosting({ nexusAid: AID, leafSeed: LEAF }))).toMatchObject({ reading: "malformed" });
    }
    await writeCustodyRow("identity", stateRow, enc({ current: act, previous: null, depth: 1 }));
    expect((await readHostingState(AID))!.current).toEqual(act);
    // Bare bytes (an earlier build's cleartext state) refuse too, and nothing rolls over them.
    writeFileSync(join(hostingDirPath(0, AID)!, "state.json"), JSON.stringify({ current: act, previous: null, depth: 1 }));
    expect(await refusal(readHostingState(AID))).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(rollHosting({ nexusAid: AID, leafSeed: LEAF }))).toBeInstanceOf(CustodyRowUnavailable);
  });

  test("S7 — the floor reads no hosting row", async () => {
    const c = await custody("host-s7");
    const { act } = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e = hostingActCid(act);
    const before = await dirFiles();
    await c.holder.lock();
    expect(await refusal(readHostingState(AID))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(rollHosting({ nexusAid: AID, leafSeed: LEAF }))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(spendToken({ nexusAid: AID, epochCid: e, n: "dd".repeat(32), claimDigest: "01".repeat(32) }))).toBeInstanceOf(CustodyLocked);
    expect(await redeemedCount(AID, e)).toBe(0);                              // the count reads row names alone
    await c.holder.adopt(c.treeKey);
    expect(await dirFiles()).toEqual(before);
  });

  test("S9 — the sweep removes only rows this vessel's key opens", async () => {
    const b = await custody("host-s9-b");
    const a = await custody("host-s9-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    as(b);
    const first = await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const e1 = hostingActCid(first.act);
    await spendToken({ nexusAid: AID, epochCid: e1, n: "ee".repeat(32), claimDigest: "01".repeat(32) });
    const bDir = hostingDirPath(0, AID)!;
    const foreignName = (await spendsOf(e1))[0]!;
    as(a);
    await rollHosting({ nexusAid: AID, leafSeed: LEAF });                            // the same act, under A's key
    await spendToken({ nexusAid: AID, epochCid: e1, n: "ef".repeat(32), claimDigest: "01".repeat(32) });   // A's own row at that epoch
    copyFileSync(join(bDir, foreignName), join(hostingDirPath(0, AID)!, foreignName)); // a row B sealed, at that epoch
    const foreign = await fileBytes(foreignName);
    await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const third = await rollHosting({ nexusAid: AID, leafSeed: LEAF });              // e1 falls two rolls back
    expect(third.unswept).toEqual([`${hostingRowDir(0, AID)}/${foreignName}`]);
    expect(await spendsOf(e1)).toEqual([foreignName]);                               // A's own dead row left; the foreign one stays
    expect((await fileBytes(foreignName)).equals(foreign)).toBe(true);
  });

  test("S10 — the store takes no directory: its rows rest under the seated face in identity", async () => {
    const c = await custody("host-s10");
    expect(rollHosting.length).toBe(1);
    await rollHosting({ nexusAid: AID, leafSeed: LEAF });
    const face = await c.holder.faceStanding({ ordinal: 0 });
    expect(hostingDirPath(0, AID)!).toBe(join(c.homes.identity, "faces", face!.fcid, ...hostingRowDir(0, AID).split("/")));
    expect(existsSync(join(hostingDirPath(0, AID)!, "state.json"))).toBe(true);
    // A hosting directory that refuses its listing refuses the count by name: it never reads as zero.
    rmSync(hostingDirPath(0, AID)!, { recursive: true });
    writeFileSync(hostingDirPath(0, AID)!, "a file where the directory belongs");
    expect(await refusal(redeemedCount(AID, "1".repeat(64)))).toMatchObject({ home: "identity", file: hostingRowDir(0, AID) });
  });
});
