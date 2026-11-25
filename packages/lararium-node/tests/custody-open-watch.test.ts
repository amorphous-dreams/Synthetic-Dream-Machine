/**
 * custody-open-watch — the custody open a composition hears (`watchCustodyOpened`). Under a pūlama the dial opens the
 * custody before the vessel composes, and a restand seats a holder the composition never saw: a watch taken once, on the
 * holder standing at composition, misses both. The watch hears an open that already stands, once, and follows each
 * holder a later seat stands, never a holder that left its seat.
 */
import { afterEach, describe, expect, test } from "vitest";
import type { CustodyHolder } from "../src/custody-holder.js";
import { seatCustody, watchCustodyOpened } from "../src/custody-seat.js";
import { larIdentityDir } from "../src/vessel-paths.js";

/** A holder stub for this home: it stands open or shut, and opens on the test's word. */
function stubHolder(unlocked: boolean) {
  const listeners = new Set<() => void>();
  let open = unlocked;
  const holder = {
    homes: { identity: larIdentityDir() },
    isUnlocked: () => open,
    onOpened(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  } as unknown as CustodyHolder;
  return { holder, open: () => { open = true; for (const l of [...listeners]) l(); }, listening: () => listeners.size };
}

afterEach(() => { seatCustody(null); });

describe("RED custody-open-watch", () => {
  test("a composition onto a custody already open rebooks once, at composition; CONTROL: onto a shut one, nothing until it opens", () => {
    const opened = stubHolder(true);
    seatCustody(opened.holder);
    let rebooks = 0;
    const stop = watchCustodyOpened(() => { rebooks++; });
    expect(rebooks).toBe(1);
    stop();
    // CONTROL: a shut custody rebooks only at its open.
    const shut = stubHolder(false);
    seatCustody(shut.holder);
    let later = 0;
    const stopShut = watchCustodyOpened(() => { later++; });
    expect(later).toBe(0);
    shut.open();
    expect(later).toBe(1);
    stopShut();
  });

  test("a restand seats a fresh holder: the watch follows it, hears its open, and no longer hears the holder that left", () => {
    const first = stubHolder(false);
    seatCustody(first.holder);
    let rebooks = 0;
    const stop = watchCustodyOpened(() => { rebooks++; });
    const second = stubHolder(false);
    seatCustody(second.holder);
    expect(first.listening()).toBe(0);
    first.open();
    expect(rebooks).toBe(0);
    second.open();
    expect(rebooks).toBe(1);
    // A restand onto a holder already open rebooks at the seat.
    const third = stubHolder(true);
    seatCustody(third.holder);
    expect(rebooks).toBe(2);
    stop();
    expect(third.listening()).toBe(0);
    seatCustody(stubHolder(true).holder);
    expect(rebooks).toBe(2);
  });
});
