/**
 * outbox-key — the outbox key mints once into its own face-hot row under the face key, opens the same at every later
 * unlock, and a locked vessel opens and mints nothing (custody#/the-table, the outbox).
 *
 *   O1  the first ask mints a row sealed under the face key; the census reads it `face-hot`, sealed, no fault.
 *   O2  every later ask, and two asks at once, answer the one key the first ask landed; the bytes never move.
 *   O3  a second holder over the same tree (the next unlock) opens the same key, and a parcel sealed before opens after.
 *   O4  a locked vessel refuses `CustodyLocked` and mints nothing; a row that opens to another width refuses by name.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { openOutboxParcel, readOutboxKey, readFckCarrier, sealOutboxParcel } from "@lararium/mesh";
import { openOutboxKey, outboxKeyFile, OutboxKeyUnreadable } from "../src/outbox-key.js";
import { CustodyLocked, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { custodyStatus } from "../src/custody-session.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { handleRowPathIn } from "./face-paths.js";

let c: SeatedScratchCustody;
const path = () => handleRowPathIn(c.homes.identity, outboxKeyFile(0));
beforeEach(async () => { c = await seatScratchCustody("outbox-key"); });
afterEach(async () => { await c.drop(); });

describe("the outbox key's row", () => {
  test("O1 — the first ask mints one row sealed under the face key, and the census reads it face-hot, sealed, no fault", async () => {
    expect(existsSync(path())).toBe(false);
    const key = await openOutboxKey(0);
    expect(readOutboxKey(key)).not.toBeNull();
    const resting = new Uint8Array(readFileSync(path()));
    expect(readFckCarrier(resting)).toBe("sealed");
    expect(Buffer.from(resting).includes(Buffer.from(key))).toBe(false);   // the key rests nowhere in the clear
    const row = (await custodyStatus({ io: c.io, homes: c.homes })).rows.find((r) => r.row === "outbox-key");
    expect(row).toMatchObject({ custody: "face-hot", keyClass: "device-minted", reading: "sealed", bare: null, fault: false });
  });

  test("O2 — every later ask and two asks at once answer the key the first ask landed, and its bytes never move", async () => {
    const [a, b] = await Promise.all([openOutboxKey(0), openOutboxKey(0)]);
    expect(Array.from(a)).toEqual(Array.from(b));
    const before = readFileSync(path());
    expect(Array.from(await openOutboxKey(0))).toEqual(Array.from(a));
    expect(readFileSync(path()).equals(before)).toBe(true);
  });

  test("O3 — the next unlock opens the same key, and a parcel sealed before it opens after it", async () => {
    const key = await openOutboxKey(0);
    const parcel = sealOutboxParcel(key, "reader-one", new TextEncoder().encode("a parcel"));
    await c.holder.lock();
    const next = makeCustodyHolder({ io: c.io, homes: c.homes });
    await next.adopt(c.vk);
    await next.unlockFace({ ordinal: 0 }, [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }]);
    seatCustody(next);
    try {
      const again = await openOutboxKey(0);
      expect(Array.from(again)).toEqual(Array.from(key));
      expect(openOutboxParcel(again, parcel)?.reader).toBe("reader-one");
    } finally { await next.lock(); seatCustody(c.holder); }
  });

  test("O4 — a locked vessel refuses CustodyLocked and mints nothing; a row of another width refuses by name and stays", async () => {
    await c.holder.lock();
    await expect(openOutboxKey(0)).rejects.toBeInstanceOf(CustodyLocked);
    expect(existsSync(path())).toBe(false);
    await c.holder.adopt(c.vk);
    await c.holder.writeRow("identity", outboxKeyFile(0), new Uint8Array(16));
    const before = readFileSync(path());
    await expect(openOutboxKey(0)).rejects.toBeInstanceOf(OutboxKeyUnreadable);
    expect(readFileSync(path()).equals(before)).toBe(true);
  });
});
