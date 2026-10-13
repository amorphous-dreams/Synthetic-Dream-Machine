/**
 * seal-reserve-store — the charter reserve's two rows rest under the vessel key.
 *
 *   V1  a provision seals the share (cold) and the state (hot); both files read as VK frames, neither holds a
 *       plaintext field, and both read back identically.      control: nothing at either path reads as none landed
 *   V2  RED: A WRONG KEY REPLACES NO SHARE. A share another vessel's key sealed stands at the path: the read
 *       refuses by name, a refresh's write refuses by name, the standing bytes never move, and the vessel that
 *       sealed them still opens them.                          control: under its own key the refresh lands
 *   V3  RED: a state row whose sealed bytes moved, bare bytes at either path, and a row of another shape each
 *       refuse the read and the write; nothing reads as an absent reserve and nothing lands over them.
 *   V4  RED: THE STATE COMMITS THE PAIR, AND A REFRESH THAT STOPS STRANDS NOTHING. A standing reserve (generation
 *       1) meets a refresh that stops after its first write, and again after its second: each time the state
 *       reads IN FLIGHT under the new generation (`reserveStands` false), never the earlier commit as sealed, and
 *       the same refresh run again lands all three writes.   control: an unbroken provision reads sealed
 *   V5  a share and a state of two generations refuse before either row moves.
 *   V6  a locked seat refuses by name and writes nothing.
 *   V7  THE DOOR'S TWO ROWS: `reserve.provision` takes one share and one state and answers nothing; `reserve.state`
 *       answers the state and no share byte; a frame that carries a second share, a seed, a stray key, a share
 *       of no shape or a state of no shape refuses `bad-args` before either row moves; no act of the table
 *       answers a share.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { readVkCarrier, type RecoveryShare } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { writeCustodyRow } from "../src/custody-seat.js";
import {
  RESERVE_SHARE_FILE, RESERVE_STATE_FILE, loadReserveMineShare, provisionCharterReserve, readCharterReserveState,
  reserveMineSharePath, reserveStands, reserveStatePath, sealReserveMineShare, writeCharterReserveState, type SealReserveState,
} from "../src/seal-reserve-store.js";
import { SEALED_ACT_NAMES, runSealedAct } from "../src/sealed-acts.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const share = (seed: number, recoveryEpoch = 1): RecoveryShare => ({
  bytes: { x: 1, ys: Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 5 + seed) & 0xff)) }, custodian: "device", recoveryEpoch,
});
const state = (reserveEpoch = 1): SealReserveState => ({
  reserveEpoch, nextKeyCommit: "ab".repeat(32), threshold: 2, kahuCount: 3, guardianA: "a-synthetic-guardian", guardianB: null,
  mineShareSealed: true, issuedAt: "a-synthetic-stamp",
});
const same = (a: RecoveryShare | null, b: RecoveryShare): boolean =>
  a !== null && a.bytes.x === b.bytes.x && Buffer.from(a.bytes.ys).equals(Buffer.from(b.bytes.ys)) && a.recoveryEpoch === b.recoveryEpoch;

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then(() => "landed", (e: unknown) => e);

describe("the charter reserve's rows at rest", () => {
  test("V1 — a provision seals both rows under the vessel key and they read back identically", async () => {
    await custody("reserve-v1");
    expect(await readCharterReserveState()).toBeNull();                         // control: nothing landed
    expect(await loadReserveMineShare()).toBeNull();
    await provisionCharterReserve(share(1), state());
    for (const path of [reserveMineSharePath(), reserveStatePath()]) {
      const file = readFileSync(path);
      expect(readVkCarrier(file)).toBe("sealed");
      for (const field of ['"custodian"', '"nextKeyCommit"', "a-synthetic-guardian"]) expect(file.includes(Buffer.from(field))).toBe(false);
    }
    expect(await readCharterReserveState()).toEqual(state());
    expect(same(await loadReserveMineShare(), share(1))).toBe(true);
  });

  test("V2 — a wrong key replaces no share", async () => {
    // Two vessels, each with its own key; a seat stands per identity home, so `LAR_ROOT` picks whose rows a call reads.
    const b = await custody("reserve-v2-b");
    const a = await custody("reserve-v2-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    as(b);
    await provisionCharterReserve(share(50), state());
    const foreignShare = readFileSync(reserveMineSharePath()), bSharePath = reserveMineSharePath();
    const foreignState = readFileSync(reserveStatePath()), bStatePath = reserveStatePath();
    as(a);
    await sealReserveMineShare(share(9));
    expect(readFileSync(reserveMineSharePath()).equals(foreignShare)).toBe(false);   // two keys, two encodings
    // B's SHARE row lands at A's path.
    copyFileSync(bSharePath, reserveMineSharePath());
    const read = await refusal(loadReserveMineShare());
    expect(read).toBeInstanceOf(CustodyRowUnavailable);
    expect(read).toMatchObject({ home: "identity", file: RESERVE_SHARE_FILE });
    expect(await refusal(sealReserveMineShare(share(77)))).toBeInstanceOf(CustodyRowUnavailable);      // a refresh under the wrong key
    expect(await refusal(provisionCharterReserve(share(77), state()))).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(reserveMineSharePath()).equals(foreignShare)).toBe(true);     // the standing bytes never moved
    expect(reserveStands(await readCharterReserveState())).toBe(false);               // and no state reads a share that never landed as sealed
    // B's STATE row lands at A's path: the read refuses, and a provision lands nothing over it.
    copyFileSync(bStatePath, reserveStatePath());
    expect(await refusal(readCharterReserveState())).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(provisionCharterReserve(share(77), state()))).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(reserveStatePath()).equals(foreignState)).toBe(true);
    // The vessel that sealed them still opens both: nothing here re-sealed or wrapped a row.
    const aShare = reserveMineSharePath(), aState = reserveStatePath();
    as(b);
    copyFileSync(aShare, reserveMineSharePath());
    copyFileSync(aState, reserveStatePath());
    expect(same(await loadReserveMineShare(), share(50))).toBe(true);
    expect(await readCharterReserveState()).toEqual(state());
    await sealReserveMineShare(share(77));                                             // CONTROL: under its own key the refresh lands
    expect(same(await loadReserveMineShare(), share(77))).toBe(true);
    as(a);
  });

  test("V3 — moved bytes, bare bytes and another shape refuse the read and the write", async () => {
    await custody("reserve-v3");
    await provisionCharterReserve(share(4), state());
    const sealed = readFileSync(reserveStatePath());
    const moved = Buffer.from(sealed);
    moved[moved.length - 1] = moved[moved.length - 1]! ^ 0x01;
    for (const standing of [moved, Buffer.from(JSON.stringify(state()))]) {
      writeFileSync(reserveStatePath(), standing);
      expect(await refusal(readCharterReserveState())).toBeInstanceOf(CustodyRowUnavailable);
      expect(await refusal(writeCharterReserveState(state(2)))).toBeInstanceOf(CustodyRowUnavailable);
      expect(readFileSync(reserveStatePath()).equals(standing)).toBe(true);
    }
    writeFileSync(reserveStatePath(), sealed);
    expect(await readCharterReserveState()).toEqual(state());                    // control: the true row still opens
    // Another shape under the right key: a state with no commit, a share with no bytes.
    await writeCustodyRow("identity", RESERVE_STATE_FILE, new TextEncoder().encode(JSON.stringify({ reserveEpoch: 1 })));
    expect(await refusal(readCharterReserveState())).toMatchObject({ reading: "malformed" });
    expect(await refusal(writeCharterReserveState(state()))).toMatchObject({ reading: "malformed" });
    await writeCustodyRow("identity", RESERVE_SHARE_FILE, new TextEncoder().encode(JSON.stringify({ x: 1, custodian: "device", recoveryEpoch: 1 })));
    expect(await refusal(loadReserveMineShare())).toMatchObject({ reading: "malformed" });
    expect(await refusal(sealReserveMineShare(share(5)))).toMatchObject({ reading: "malformed" });
    const bare = Buffer.from(JSON.stringify({ x: 1, ys: [1], custodian: "device", recoveryEpoch: 1 }));
    writeFileSync(reserveMineSharePath(), bare);                                  // an earlier lifecycle's cleartext share
    expect(await refusal(loadReserveMineShare())).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(sealReserveMineShare(share(5)))).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(reserveMineSharePath()).equals(bare)).toBe(true);        // nothing landed over it
  });

  test("V4 — a refresh that stops strands nothing: the state reads in flight until all three writes land", async () => {
    await custody("reserve-v4");
    await provisionCharterReserve(share(8, 1), state(1));
    expect(reserveStands(await readCharterReserveState())).toBe(true);           // control: an unbroken provision reads sealed
    const next = { ...state(2), nextKeyCommit: "cd".repeat(32) };
    // THE REFRESH STOPS AFTER ITS FIRST WRITE: the earlier share still rests, and the state already names the new
    // generation as in flight. No reader takes the earlier commit as sealed.
    await writeCharterReserveState({ ...next, mineShareSealed: false });
    let read = await readCharterReserveState();
    expect(read).toMatchObject({ reserveEpoch: 2, nextKeyCommit: next.nextKeyCommit, mineShareSealed: false });
    expect(reserveStands(read)).toBe(false);
    expect(same(await loadReserveMineShare(), share(8, 1))).toBe(true);
    // IT STOPS AFTER ITS SECOND WRITE: the new share rests, and the state still reads in flight.
    await sealReserveMineShare(share(9, 2));
    read = await readCharterReserveState();
    expect(reserveStands(read)).toBe(false);
    // The same refresh run again lands all three.
    await provisionCharterReserve(share(9, 2), next);
    expect(await readCharterReserveState()).toEqual({ ...next, mineShareSealed: true });
    expect(reserveStands(await readCharterReserveState())).toBe(true);
    expect(same(await loadReserveMineShare(), share(9, 2))).toBe(true);
    expect(reserveStands(null)).toBe(false);
  });

  test("V4b — a provision whose share write refuses leaves the state in flight, never sealed", async () => {
    await custody("reserve-v4b");
    await provisionCharterReserve(share(8, 1), state(1));
    writeFileSync(reserveMineSharePath(), Buffer.from("bare bytes where a sealed share stood"));
    const next = { ...state(2), nextKeyCommit: "cd".repeat(32) };
    expect(await refusal(provisionCharterReserve(share(9, 2), next))).toBeInstanceOf(CustodyRowUnavailable);
    const read = await readCharterReserveState();
    expect(read).toMatchObject({ reserveEpoch: 2, mineShareSealed: false });     // the first write landed; the commit never did
    expect(reserveStands(read)).toBe(false);
  });

  test("V5 — a share and a state of two generations refuse before either row moves", async () => {
    await custody("reserve-v5");
    await expect(provisionCharterReserve(share(1, 2), state(1))).rejects.toThrow(/two generations/);
    expect(existsSync(reserveMineSharePath()) || existsSync(reserveStatePath())).toBe(false);
  });

  test("V6 — a locked seat refuses by name and writes nothing, over nothing and over standing rows", async () => {
    const c = await custody("reserve-v6");
    await c.holder.lock();
    expect(await refusal(readCharterReserveState())).toBeInstanceOf(CustodyLocked);
    expect(await refusal(loadReserveMineShare())).toBeInstanceOf(CustodyLocked);
    expect(await refusal(provisionCharterReserve(share(1), state()))).toBeInstanceOf(CustodyLocked);
    expect(existsSync(reserveMineSharePath()) || existsSync(reserveStatePath())).toBe(false);
    await c.holder.unlock([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    await provisionCharterReserve(share(1), state());
    const rows = [readFileSync(reserveMineSharePath()), readFileSync(reserveStatePath())];
    await c.holder.lock();
    expect(await refusal(readCharterReserveState())).toBeInstanceOf(CustodyLocked);
    expect(await refusal(provisionCharterReserve(share(2), state()))).toBeInstanceOf(CustodyLocked);
    expect(readFileSync(reserveMineSharePath()).equals(rows[0]!) && readFileSync(reserveStatePath()).equals(rows[1]!)).toBe(true);
  });

  test("V7 — the door takes one share in and hands none out", async () => {
    await custody("reserve-v7");
    const ctx = { kelHead: null, personaSelves: null };
    const wire = (sh: RecoveryShare) => ({ x: sh.bytes.x, ys: [...sh.bytes.ys], custodian: sh.custodian, recoveryEpoch: sh.recoveryEpoch });
    const bad = async (args: unknown): Promise<string> => runSealedAct("reserve.provision", args, ctx).then(() => "ran", (e: { reason?: string }) => String(e.reason));
    for (const args of [
      { share: wire(share(1)), state: state(), second: wire(share(2)) },                      // a second share beside the first
      { share: wire(share(1)), state: state(), seed: "00".repeat(32) },                       // a seed
      { share: { ...wire(share(1)), extra: 1 }, state: state() },                              // a stray key inside the share
      { share: { x: 1, custodian: "device", recoveryEpoch: 1 }, state: state() },              // a share of no shape
      { share: wire(share(1)), state: { ...state(), nextKeyCommit: "not-a-commit" } },         // a state of no shape
      { share: wire(share(1)), state: { ...state(), shares: [wire(share(2))] } },              // a state that smuggles a share
      { share: wire(share(1)) },                                                               // no state
    ]) expect(await bad(args)).toBe("bad-args");
    expect(existsSync(reserveMineSharePath()) || existsSync(reserveStatePath())).toBe(false);  // nothing moved
    expect(await runSealedAct("reserve.state", {}, ctx)).toEqual({ state: null });            // control: no reserve stands
    expect(await runSealedAct("reserve.provision", { share: wire(share(1)), state: state() }, ctx)).toEqual({});
    const answered = await runSealedAct("reserve.state", {}, ctx);
    expect(answered).toEqual({ state: state() });
    const ys = JSON.stringify([...share(1).bytes.ys]);
    expect(JSON.stringify(answered).includes(ys.slice(1, -1))).toBe(false);                    // the state answers no share byte
    expect(same(await loadReserveMineShare(), share(1))).toBe(true);                           // control: the share rests
    expect(SEALED_ACT_NAMES.filter((n) => /share|seed|split/i.test(n))).toEqual([]);           // no act names a share to hand out
  });
});
