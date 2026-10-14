/**
 * recovery-share-store — the device recovery share rests as one cold row per face under the vessel key.
 *
 *   D1  a share persists as a VK-sealed row in the identity home and reads back identically; its plaintext
 *       appears nowhere in the file.                          control: nothing at the path reads as none landed
 *   D2  RED: A WRONG KEY REPLACES NO SHARE. A row another vessel's key sealed stands at the path. The load refuses
 *       by name, the write refuses by name, the standing bytes never move, and the vessel that sealed them
 *       still opens them.                                     control: under its own key the same write lands
 *   D3  RED: a row whose sealed bytes moved (one byte of the frame) refuses the read and the write, and nothing
 *       lands over it; bare bytes at the path (an earlier lifecycle's cleartext share) refuse the same way.
 *   D4  a row that opens to another shape refuses `malformed` at the read and at the write.
 *   D5  one face, one row: h1's share lands beside h0's and neither reads as the other.
 *   D6  a locked seat refuses by name and writes nothing, over nothing and over a standing row.
 *   D7  RED: A SHARE LANDS ONCE PER GENERATION. A second split's share of the same generation refuses
 *       `RecoveryShareStands` and the standing bytes never move; an earlier generation refuses too; the same share
 *       again writes nothing; a LATER generation replaces the row.
 *   D8  a frame that opens with `LARK` at the path refuses the read and the write, and nothing lands over it.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { LARK_MAGIC, readVkCarrier, type RecoveryShare } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { seatCustody, writeCustodyRow } from "../src/custody-seat.js";
import {
  RecoveryShareStands, deviceShareFile, deviceSharePath, loadRecoveryDeviceShare, persistRecoveryDeviceShare,
} from "../src/recovery-share-store.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const share = (seed: number, custodian: RecoveryShare["custodian"] = "device"): RecoveryShare => ({
  bytes: { x: 3, ys: Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 7 + seed) & 0xff)) },
  custodian, recoveryEpoch: 1,
});
const same = (a: RecoveryShare | null, b: RecoveryShare): boolean =>
  a !== null && a.bytes.x === b.bytes.x && Buffer.from(a.bytes.ys).equals(Buffer.from(b.bytes.ys)) && a.custodian === b.custodian && a.recoveryEpoch === b.recoveryEpoch;

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then(() => "landed", (e: unknown) => e);

describe("the device recovery share at rest", () => {
  test("D1 — a share rests sealed under the vessel key and reads back identically", async () => {
    await custody("share-d1");
    expect(await loadRecoveryDeviceShare(0)).toBeNull();                       // control: nothing landed
    await persistRecoveryDeviceShare(share(1), 0);
    const file = readFileSync(deviceSharePath(0));
    expect(readVkCarrier(file)).toBe("sealed");
    expect(file.includes(Buffer.from('"custodian"'))).toBe(false);             // no plaintext field rests in the file
    expect(same(await loadRecoveryDeviceShare(0), share(1))).toBe(true);
  });

  test("D2 — a wrong key replaces no share: another vessel's row refuses the read and the write, and stands untouched", async () => {
    // Vessel B seals its own share, and that row file lands at vessel A's path.
    const b = await custody("share-d2-b");
    await persistRecoveryDeviceShare(share(50), 0);
    const foreign = readFileSync(deviceSharePath(0));
    const bPath = deviceSharePath(0);
    const a = await custody("share-d2-a");                                      // A's root and seat stand now
    await persistRecoveryDeviceShare(share(9), 0);
    expect(readFileSync(deviceSharePath(0)).equals(foreign)).toBe(false);      // the encodings differ: two keys, two rows
    copyFileSync(bPath, deviceSharePath(0));
    const read = await refusal(loadRecoveryDeviceShare(0));
    expect(read).toBeInstanceOf(CustodyRowUnavailable);
    expect(read).toMatchObject({ home: "identity", file: deviceShareFile(0) });
    const write = await refusal(persistRecoveryDeviceShare(share(77), 0));
    expect(write).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(deviceSharePath(0)).equals(foreign)).toBe(true);       // the standing bytes never moved
    // The vessel that sealed them still opens them: nothing here re-sealed or wrapped the row.
    const aRow = deviceSharePath(0);
    await a.holder.lock();
    process.env["LAR_ROOT"] = b.root;
    seatCustody(b.holder);
    copyFileSync(aRow, deviceSharePath(0));
    expect(same(await loadRecoveryDeviceShare(0), share(50))).toBe(true);
    // CONTROL: under its own key a write lands (a later generation of the share).
    await persistRecoveryDeviceShare({ ...share(77), recoveryEpoch: 2 }, 0);
    expect(same(await loadRecoveryDeviceShare(0), { ...share(77), recoveryEpoch: 2 })).toBe(true);
    process.env["LAR_ROOT"] = a.root;
  });

  test("D3 — a row whose sealed bytes moved, and bare bytes, refuse the read and the write", async () => {
    await custody("share-d3");
    await persistRecoveryDeviceShare(share(4), 0);
    const sealed = readFileSync(deviceSharePath(0));
    const moved = Buffer.from(sealed);
    moved[moved.length - 1] = moved[moved.length - 1]! ^ 0x01;
    expect(moved.equals(sealed)).toBe(false);
    for (const standing of [moved, Buffer.from(JSON.stringify({ x: 3, ys: [1, 2, 3], custodian: "device", recoveryEpoch: 1 }))]) {
      writeFileSync(deviceSharePath(0), standing);
      expect(await refusal(loadRecoveryDeviceShare(0))).toBeInstanceOf(CustodyRowUnavailable);
      expect(await refusal(persistRecoveryDeviceShare(share(5), 0))).toBeInstanceOf(CustodyRowUnavailable);
      expect(readFileSync(deviceSharePath(0)).equals(standing)).toBe(true);
    }
    writeFileSync(deviceSharePath(0), sealed);                                   // control: the true row still opens
    expect(same(await loadRecoveryDeviceShare(0), share(4))).toBe(true);
  });

  test("D4 — a row that opens to another shape refuses malformed at the read and at the write", async () => {
    await custody("share-d4");
    await writeCustodyRow("identity", deviceShareFile(0), new TextEncoder().encode(JSON.stringify({ x: 3, ys: "not-a-list", custodian: "device", recoveryEpoch: 1 })));
    const standing = readFileSync(deviceSharePath(0));
    expect(await refusal(loadRecoveryDeviceShare(0))).toMatchObject({ reading: "malformed" });
    expect(await refusal(persistRecoveryDeviceShare(share(6), 0))).toMatchObject({ reading: "malformed" });
    expect(readFileSync(deviceSharePath(0)).equals(standing)).toBe(true);
  });

  test("D5 — one face, one row", async () => {
    await custody("share-d5");
    await persistRecoveryDeviceShare(share(10), 0);
    await persistRecoveryDeviceShare(share(20), 1);
    expect(existsSync(deviceSharePath(1))).toBe(true);
    expect(same(await loadRecoveryDeviceShare(0), share(10))).toBe(true);
    expect(same(await loadRecoveryDeviceShare(1), share(20))).toBe(true);
    expect(await loadRecoveryDeviceShare(2)).toBeNull();
  });

  test("D6 — a locked seat refuses by name and writes nothing, over nothing and over a standing row", async () => {
    const c = await custody("share-d6");
    await c.holder.lock();
    expect(await refusal(loadRecoveryDeviceShare(0))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(persistRecoveryDeviceShare(share(1), 0))).toBeInstanceOf(CustodyLocked);
    expect(existsSync(deviceSharePath(0))).toBe(false);
    await c.holder.unlock([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    await persistRecoveryDeviceShare(share(1), 0);
    const standing = readFileSync(deviceSharePath(0));
    await c.holder.lock();
    expect(await refusal(loadRecoveryDeviceShare(0))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(persistRecoveryDeviceShare({ ...share(2), recoveryEpoch: 2 }, 0))).toBeInstanceOf(CustodyLocked);
    expect(readFileSync(deviceSharePath(0)).equals(standing)).toBe(true);
  });

  test("D7 — a share lands once per generation", async () => {
    await custody("share-d7");
    await persistRecoveryDeviceShare({ ...share(10), recoveryEpoch: 2 }, 0);
    const standing = readFileSync(deviceSharePath(0));
    // A second split of the SAME generation, and one of an EARLIER generation, replace nothing.
    for (const arriving of [{ ...share(11), recoveryEpoch: 2 }, { ...share(12), recoveryEpoch: 1 }]) {
      const refused = await refusal(persistRecoveryDeviceShare(arriving, 0));
      expect(refused).toBeInstanceOf(RecoveryShareStands);
      expect(refused).toMatchObject({ handleIndex: 0, standing: 2, arriving: arriving.recoveryEpoch });
      expect(readFileSync(deviceSharePath(0)).equals(standing)).toBe(true);
    }
    // The same share again writes nothing: the row's bytes stand as they stood.
    await persistRecoveryDeviceShare({ ...share(10), recoveryEpoch: 2 }, 0);
    expect(readFileSync(deviceSharePath(0)).equals(standing)).toBe(true);
    // CONTROL: a later generation replaces the row, and another face's row takes its first share freely.
    await persistRecoveryDeviceShare({ ...share(13), recoveryEpoch: 3 }, 0);
    expect(same(await loadRecoveryDeviceShare(0), { ...share(13), recoveryEpoch: 3 })).toBe(true);
    await persistRecoveryDeviceShare(share(14), 1);
    expect(same(await loadRecoveryDeviceShare(1), share(14))).toBe(true);
  });

  test("D8 — a frame that opens with LARK at the path refuses the read and the write", async () => {
    await custody("share-d8");
    const envelope = Buffer.from(Uint8Array.from([...LARK_MAGIC, 0x01, 0x01, ...new Array(90).fill(7)]));
    expect(readVkCarrier(envelope)).toBe("old-shape");                           // control: the reading that refuses
    writeFileSync(deviceSharePath(0), envelope);
    expect(await refusal(loadRecoveryDeviceShare(0))).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(persistRecoveryDeviceShare({ ...share(5), recoveryEpoch: 9 }, 0))).toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(deviceSharePath(0)).equals(envelope)).toBe(true);
  });
});
