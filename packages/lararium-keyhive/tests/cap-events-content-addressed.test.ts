/**
 * A cap event's row is named by its own bytes. Keyhive fires its event handler again for every event a restored
 * Archive and a replay carry, so a row named by anything but the bytes (a clock reading and a random suffix)
 * lands the same event again under a new title at every boot: the browser vessel's second boot measured 51 of
 * its 90 new cap rows repeating an earlier row's bytes, and the third boot 90 of 129.
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const SEED = new Uint8Array(32).fill(0x5b);
const BAG = "lar:///second-boot.cap.bag";
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

describe("cap events are named by their bytes", () => {
  test("RED: every row's hash is the sha256 of its bytes, and a re-stand over the same events lands no event twice", async () => {
    const store = new InMemoryEventStore();
    const first = new KeyhiveProvider();
    await first.init({ seed: SEED, eventStore: store });
    await first.registerBag(BAG);
    await first.settleEvents();
    const archive = await first.exportArchive();
    await first.dispose();
    const before = await store.list();
    expect(before.length, "CONTROL: the first stand wrote cap events").toBeGreaterThan(0);
    for (const rec of before) expect(rec.hash, rec.variant).toBe(sha(rec.bytes));

    const again = new KeyhiveProvider();
    await again.init({ seed: SEED, eventStore: store, archiveBytes: archive });
    await again.hydrateFromEventStore();
    await again.settleEvents();
    const after = await store.list();
    await again.dispose();
    const byBytes = new Map<string, number>();
    for (const rec of after) byBytes.set(sha(rec.bytes), (byBytes.get(sha(rec.bytes)) ?? 0) + 1);
    expect([...byBytes.values()].filter((n) => n > 1), "no event's bytes stand under two rows").toEqual([]);
    for (const rec of after) expect(rec.hash, rec.variant).toBe(sha(rec.bytes));
  }, 60_000);
});
