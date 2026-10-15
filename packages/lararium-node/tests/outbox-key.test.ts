/**
 * outbox-key — the outbox key mints once into its own hot row under the vessel key, opens the same at every later
 * unlock, and a locked vessel opens and mints nothing (custody#/the-table, the outbox).
 *
 *   O1  the first ask mints a row sealed under the vessel key; the census reads it `hot`, sealed, no fault.
 *   O2  every later ask, and two asks at once, answer the one key the first ask landed; the bytes never move.
 *   O3  a second holder over the same tree (the next unlock) opens the same key, and a parcel sealed before opens after.
 *   O4  a locked vessel refuses `CustodyLocked` and mints nothing; a row that opens to another width refuses by name.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { openOutboxParcel, readOutboxKey, readVkCarrier, sealOutboxParcel, writeSealedCarrier } from "@lararium/mesh";
import { openOutboxKey, outboxKeyPath, OutboxKeyUnreadable } from "../src/outbox-key.js";
import { CustodyLocked, makeCustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
import { custodyStatus } from "../src/custody-session.js";
import { vkSlotsPath } from "../src/vault-carriers.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("outbox-key"); });
afterEach(async () => { await c.drop(); });

describe("the outbox key's row", () => {
  test("O1 — the first ask mints one row sealed under the vessel key, and the census reads it hot, sealed, no fault", async () => {
    expect(existsSync(outboxKeyPath(c.homes.identity))).toBe(false);
    const key = await openOutboxKey();
    expect(readOutboxKey(key)).not.toBeNull();
    const resting = new Uint8Array(readFileSync(outboxKeyPath(c.homes.identity)));
    expect(readVkCarrier(resting)).toBe("sealed");
    expect(Buffer.from(resting).includes(Buffer.from(key))).toBe(false);   // the key rests nowhere in the clear
    const row = (await custodyStatus({ io: c.io, homes: c.homes })).rows.find((r) => r.row === "outbox-key");
    expect(row).toMatchObject({ custody: "hot", keyClass: "device-minted", reading: "sealed", bare: null, fault: false });
  });

  test("O2 — every later ask and two asks at once answer the key the first ask landed, and its bytes never move", async () => {
    const [a, b] = await Promise.all([openOutboxKey(), openOutboxKey()]);
    expect(Array.from(a)).toEqual(Array.from(b));
    const before = readFileSync(outboxKeyPath(c.homes.identity));
    expect(Array.from(await openOutboxKey())).toEqual(Array.from(a));
    expect(readFileSync(outboxKeyPath(c.homes.identity)).equals(before)).toBe(true);
  });

  test("O3 — the next unlock opens the same key, and a parcel sealed before it opens after it", async () => {
    const key = await openOutboxKey();
    const parcel = sealOutboxParcel(key, "reader-one", new TextEncoder().encode("a parcel"));
    await c.holder.lock();
    const next = makeCustodyHolder({ io: c.io, homes: c.homes });
    await next.adopt(c.vk);
    seatCustody(next);
    try {
      const again = await openOutboxKey();
      expect(Array.from(again)).toEqual(Array.from(key));
      expect(openOutboxParcel(again, parcel)?.reader).toBe("reader-one");
    } finally { await next.lock(); seatCustody(c.holder); }
  });

  test("O4 — a locked vessel refuses CustodyLocked and mints nothing; a row of another width refuses by name and stays", async () => {
    await c.holder.lock();
    await expect(openOutboxKey()).rejects.toBeInstanceOf(CustodyLocked);
    expect(existsSync(outboxKeyPath(c.homes.identity))).toBe(false);
    await c.holder.adopt(c.vk);
    await writeSealedCarrier({ io: c.io, vk: c.vk, treePath: vkSlotsPath(c.homes.identity), carrier: { name: "identity/outbox-key.bin", path: outboxKeyPath(c.homes.identity) }, plaintext: new Uint8Array(16) });
    const before = readFileSync(outboxKeyPath(c.homes.identity));
    await expect(openOutboxKey()).rejects.toBeInstanceOf(OutboxKeyUnreadable);
    expect(readFileSync(outboxKeyPath(c.homes.identity)).equals(before)).toBe(true);
  });
});
