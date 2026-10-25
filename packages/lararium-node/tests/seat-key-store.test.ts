/**
 * seat-key-store — a seat's own key, one cold row per key, on the custody seat.
 *
 *   S1  a minted seat key rests SEALED and COLD under a name that carries the face and a digest of its public
 *       half, and no key byte in the clear; `signAsSeat` signs exactly the image and the signature verifies under
 *       the minted public key.                    control: a moved image byte fails the same verify
 *   S2  two mints yield two keys that share nothing; a mint derives from no secret handed in.
 *   S3  the listing and the held-key test read names alone: they answer at the floor, with the vessel locked,
 *       and name every row.                       control: a key no row holds reads null
 *   S4  a key no row holds refuses `absent` at the door and signs nothing.
 *   S5  a store never lands over a standing key that differs; the same key again changes nothing; one key rests
 *       under ONE face.
 *   S6  a row that stands and does not open (one byte moved, a bare 32 bytes) refuses by name at the door and at
 *       the store; one that opens to another length refuses `malformed`; one whose secret answers another key
 *       than its name commits to refuses `names-another-key`.
 *   S7  at the floor the door, the mint, the store and the retirement refuse `CustodyLocked` and no file moves.
 *   S8  TAMPER PROBE. VK rotation leaves the face-sealed seat key byte-identical; a holder over the
 *       retired VK can still sign and store the same key. Control: a holder over the current VK signs and retires
 *   S9  a retirement removes the row and the key then reads `absent`; retiring a key no row holds answers false.
 *   S10 the carrier table names the row `seat-key`: face-cold, a seed, of ONE face, and no bundle carries it.
 *   S11 a retirement reads the row first: a row that holds another key, or another length, under this key's name
 *       refuses by name and stays.                control: the row's own key retires it
 *   S12 two stores of one key under two faces, started together, land ONE row; the look and the write share one
 *       custody hold, so the outcome reads the same on any machine.   control: two different keys both land
 *   S13 a store seals the bytes it received, whatever the caller does to its array afterwards.
 */
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFckCarrier } from "@lararium/mesh";
import {
  SEAT_KEY_FILE, heldSeatKey, listSeatKeys, mintSeatKey, retireSeatKey, seatKeyFile, seatKeyName, signAsSeat, storeSeatKey,
} from "../src/seat-key-store.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { rotateCustody } from "../src/custody-session.js";
import { bundleRows, carrierCensus, carrierTable } from "../src/vault-carriers.js";
import { faceRowNames, handleRowPathIn } from "./face-paths.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const publicOf = (secret: Uint8Array): string => {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]);
  return Buffer.from((createPublicKey(createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
};
const verifies = (publicHex: string, image: Uint8Array, signature: Uint8Array): boolean =>
  verify(null, image, createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicHex, "hex")]), format: "der", type: "spki" }), signature);
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 11 + fill) & 0xff);

const SECRET = secretOf(5);
const KEY = publicOf(SECRET);
const IMAGE = new TextEncoder().encode("synthetic image a chair signs");

let c: SeatedScratchCustody;
const at = (file: string): string => handleRowPathIn(c.homes.identity, file);
const seatFiles = (): string[] => faceRowNames().filter((f) => SEAT_KEY_FILE.test(f)).sort();
beforeEach(async () => { c = await seatScratchCustody("seat-key"); });
afterEach(async () => { await c.drop(); });

describe("a seat's own key on the custody seat", () => {
  test("S1 — a minted seat key rests sealed and cold; the door signs exactly the image", async () => {
    const key = await mintSeatKey(2);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    const file = seatKeyFile(key, 2);
    expect(file).toBe(`seat-key-h2-${seatKeyName(key)}.bin`);
    expect(seatFiles()).toEqual([file]);
    // The name commits to the key by a digest and carries none of it.
    expect(file.includes(key.slice(0, 16))).toBe(false);
    const rest = readFileSync(at(file));
    expect(readFckCarrier(rest)).toBe("sealed");
    const signature = await signAsSeat(key, IMAGE);
    expect(signature).toHaveLength(64);
    expect(verifies(key, IMAGE, signature)).toBe(true);
    const moved = Uint8Array.from(IMAGE); moved[0]! ^= 1;
    expect(verifies(key, moved, signature)).toBe(false);
    // An upper-case spelling of the same key reaches the same row.
    expect(verifies(key, IMAGE, await signAsSeat(key.toUpperCase(), IMAGE))).toBe(true);
    // cold: a hot read of the row refuses; it opens per act alone
    await expect(c.holder.readRow("identity", file)).rejects.toThrow(/cold rows require openColdRow/);
    // A stored secret rests sealed too, and no byte of it reads in the clear.
    await storeSeatKey(0, SECRET);
    expect(readFileSync(at(seatKeyFile(KEY, 0))).includes(Buffer.from(SECRET))).toBe(false);
  });

  test("S2 — two mints yield two keys that share nothing", async () => {
    const a = await mintSeatKey(0), b = await mintSeatKey(0);
    expect(a).not.toBe(b);
    expect(seatKeyName(a)).not.toBe(seatKeyName(b));
    expect(seatFiles()).toHaveLength(2);
    expect(verifies(a, IMAGE, await signAsSeat(b, IMAGE))).toBe(false);
  });

  test("S3 — the listing and the held-key test read names alone and answer at the floor", async () => {
    const a = await mintSeatKey(0);
    await storeSeatKey(3, SECRET);
    const expected = [{ handleIndex: 0, name: seatKeyName(a), file: seatKeyFile(a, 0) }, { handleIndex: 3, name: seatKeyName(KEY), file: seatKeyFile(KEY, 3) }]
      .sort((x, y) => (x.file < y.file ? -1 : 1));
    expect(listSeatKeys()).toEqual(expected);
    await c.holder.lock();
    expect(listSeatKeys()).toEqual(expected);
    expect(heldSeatKey(KEY)).toEqual({ handleIndex: 3, name: seatKeyName(KEY), file: seatKeyFile(KEY, 3) });
    expect(heldSeatKey(publicOf(secretOf(90)))).toBeNull();
    expect(() => heldSeatKey("not-a-key")).toThrow(/64 hex/);
  });

  test("S4 — a key no row holds refuses absent and signs nothing", async () => {
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(CustodyRowUnavailable);
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(/reads absent/);
    expect(seatFiles()).toEqual([]);
  });

  test("S5 — a store never lands over a different standing key, and one key rests under one face", async () => {
    expect(await storeSeatKey(0, SECRET)).toBe(KEY);
    const file = seatKeyFile(KEY, 0);
    const standing = readFileSync(at(file));
    expect(await storeSeatKey(0, SECRET)).toBe(KEY);
    expect(readFileSync(at(file)).equals(standing), "the same key again changes nothing").toBe(true);
    await expect(storeSeatKey(1, SECRET)).rejects.toThrow(/stands under another face/);
    expect(seatFiles()).toEqual([file]);
    // Other bytes standing under this key's own name refuse, and stay.
    await c.holder.writeRow("identity", file, secretOf(60));
    const planted = readFileSync(at(file));
    await expect(storeSeatKey(0, SECRET)).rejects.toThrow(/reads names-another-key/);
    expect(readFileSync(at(file)).equals(planted)).toBe(true);
    await expect(storeSeatKey(0, new Uint8Array(31))).rejects.toThrow(/32 secret bytes/);
    await expect(storeSeatKey(-1, SECRET)).rejects.toThrow(/handle-index out of range/);
  });

  test("S6 — a row that stands and does not open, opens short, or answers another key refuses by name", async () => {
    await storeSeatKey(0, SECRET);
    const file = seatKeyFile(KEY, 0);
    const intact = readFileSync(at(file));
    const moved = Buffer.from(intact); moved[Math.floor(moved.length / 2)]! ^= 1;
    expect(moved.equals(intact)).toBe(false);
    for (const [damaged, reading] of [[moved, /reads (key-fails|torn)/], [Buffer.from(SECRET), /reads bare/]] as const) {
      writeFileSync(at(file), damaged);
      await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(CustodyRowUnavailable);
      await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(reading);
      await expect(storeSeatKey(0, SECRET)).rejects.toThrow(reading);
      await expect(retireSeatKey(KEY)).rejects.toThrow(CustodyRowUnavailable);
      expect(readFileSync(at(file)).equals(damaged)).toBe(true);
    }
    writeFileSync(at(file), intact);
    expect(verifies(KEY, IMAGE, await signAsSeat(KEY, IMAGE)), "control: the intact row signs again").toBe(true);
    await c.holder.writeRow("identity", file, new Uint8Array(31));
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(/reads malformed/);
    // A whole secret of ANOTHER key under this key's name: the door signs nothing under it.
    await c.holder.writeRow("identity", file, secretOf(60));
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(/reads names-another-key/);
  });

  test("S7 — at the floor the door, the mint, the store and the retirement refuse CustodyLocked", async () => {
    await storeSeatKey(0, SECRET);
    const file = seatKeyFile(KEY, 0);
    const standing = readFileSync(at(file));
    await c.holder.lock();
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(signAsSeat(publicOf(secretOf(90)), IMAGE)).rejects.toThrow(CustodyLocked);
    await expect(mintSeatKey(0)).rejects.toThrow(CustodyLocked);
    await expect(storeSeatKey(0, SECRET)).rejects.toThrow(CustodyLocked);
    await expect(storeSeatKey(1, SECRET)).rejects.toThrow(CustodyLocked);
    await expect(retireSeatKey(KEY)).rejects.toThrow(CustodyLocked);
    await expect(retireSeatKey(publicOf(secretOf(90)))).rejects.toThrow(CustodyLocked);
    expect(seatFiles()).toEqual([file]);
    expect(readFileSync(at(file)).equals(standing)).toBe(true);
  });

  test("S8 — VK rotation leaves a seat's face-sealed key usable and unchanged", async () => {
    await storeSeatKey(0, SECRET);
    const file = seatKeyFile(KEY, 0);
    const before = readFileSync(at(file));
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = readFileSync(at(file));
    expect(standing.equals(before), "VK rotation leaves the face-sealed row untouched").toBe(true);
    // The seated holder kept the retired VK, but the seat key opens under its face's key.
    expect(verifies(KEY, IMAGE, await signAsSeat(KEY, IMAGE))).toBe(true);
    expect(await storeSeatKey(0, SECRET)).toBe(KEY);
    expect(readFileSync(at(file)).equals(standing)).toBe(true);
    // A holder over the current VK still opens the same face key and retires it.
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    await fresh.unlockFaces([{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(fresh);
    expect(verifies(KEY, IMAGE, await signAsSeat(KEY, IMAGE))).toBe(true);
    expect(await retireSeatKey(KEY)).toBe(true);
    expect(existsSync(at(file))).toBe(false);
    expect(seatFiles()).toEqual([]);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("S9 — a retirement removes the row; the key then reads absent", async () => {
    const keep = await mintSeatKey(1);
    await storeSeatKey(0, SECRET);
    expect(await retireSeatKey(KEY)).toBe(true);
    expect(seatFiles()).toEqual([seatKeyFile(keep, 1)]);
    expect(heldSeatKey(KEY)).toBeNull();
    await expect(signAsSeat(KEY, IMAGE)).rejects.toThrow(/reads absent/);
    expect(await retireSeatKey(KEY)).toBe(false);
    expect(verifies(keep, IMAGE, await signAsSeat(keep, IMAGE)), "control: the other seat's key still signs").toBe(true);
  });

  test("S11 — a retirement leaves a row that holds another key, or another length, under this key's name", async () => {
    await storeSeatKey(0, SECRET);
    const file = seatKeyFile(KEY, 0);
    for (const [planted, reading] of [[secretOf(60), /reads names-another-key/], [new Uint8Array(31), /reads malformed/]] as const) {
      await c.holder.writeRow("identity", file, planted);
      const standing = readFileSync(at(file));
      await expect(retireSeatKey(KEY)).rejects.toThrow(CustodyRowUnavailable);
      await expect(retireSeatKey(KEY)).rejects.toThrow(reading);
      expect(readFileSync(at(file)).equals(standing), "the planted row stays, byte for byte").toBe(true);
    }
    // control: the row's own key retires it
    await c.holder.writeRow("identity", file, SECRET);
    expect(await retireSeatKey(KEY)).toBe(true);
    expect(seatFiles()).toEqual([]);
  });

  test("S12 — two stores of one key under two faces, started together, land one row", async () => {
    const outcomes = await Promise.allSettled([storeSeatKey(0, SECRET), storeSeatKey(1, SECRET)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    const refused = outcomes.find((o): o is PromiseRejectedResult => o.status === "rejected")!;
    expect(String((refused.reason as Error).message)).toMatch(/stands under another face/);
    expect(seatFiles()).toHaveLength(1);
    expect(verifies(KEY, IMAGE, await signAsSeat(KEY, IMAGE))).toBe(true);
    // control: two DIFFERENT keys under two faces, started together, both land
    const both = await Promise.allSettled([storeSeatKey(0, secretOf(70)), storeSeatKey(1, secretOf(80))]);
    expect(both.map((o) => o.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(seatFiles()).toHaveLength(3);
  });

  test("S13 — a store seals the bytes it received, whatever the caller does to its array afterwards", async () => {
    const handed = Uint8Array.from(SECRET);
    const landing = storeSeatKey(0, handed);
    handed.set(secretOf(60));                       // the caller moves its own array before the write lands
    expect(await landing).toBe(KEY);
    expect(verifies(KEY, IMAGE, await signAsSeat(KEY, IMAGE)), "the row answers the key its name commits to").toBe(true);
    // The store never writes into the caller's array: it holds what the caller put there.
    expect(Buffer.from(handed).equals(Buffer.from(secretOf(60)))).toBe(true);
  });

  test("S10 — the carrier table names the row: cold, a seed, of one face, in no bundle", async () => {
    const file = seatKeyFile(KEY, 4);
    const row = carrierTable().find((r) => r.home === "identity" && (r.faceRow?.inner.test(file) ?? r.match.test(file)))!;
    expect([row.row, row.custody, row.keyClass, row.bundle, row.bare]).toEqual(["seat-key", "face-cold", "seed", "stays", null]);
    // The table spells the file as the store does (the table cannot import the store: the store stands on the seat).
    expect(row.match.test(`faces/${"ab".repeat(16)}/${file}`)).toBe(true);
    expect(SEAT_KEY_FILE.test(file)).toBe(true);
    expect(row.face(row.match.exec(`faces/${"ab".repeat(16)}/${file}`)!)).toBe(4);
    expect(row.name(row.match.exec(`faces/${"ab".repeat(16)}/${file}`)!)).toBe(`seat-key-h4-${seatKeyName(KEY)}`);
    expect(bundleRows().map((r) => r.row)).not.toContain("seat-key");
    await storeSeatKey(4, SECRET);
    expect(carrierCensus(c.homes).find((e) => e.file.endsWith(`/${file}`))).toMatchObject({ row: "seat-key", custody: "face-cold", keyClass: "seed", face: 4 });
  });
});
