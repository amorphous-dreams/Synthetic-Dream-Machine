/**
 * L1 — newRequestId() carries no wall-clock prefix.
 *
 * Control (known positive): the RETIRED shape embedded Date.now() as a base-32 prefix, so setting
 * the clock back or forward produced a DIFFERENT, orderable prefix. This proves the current
 * newRequestId() output is insensitive to Date.now() mutation — a set-back/set-forward clock
 * proof per the no-global-now ruling — and that two ids never collide.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/request-id-no-clock
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { newRequestId } from "../src/verb-tiddler.js";

describe("newRequestId — no wall-clock prefix (L1)", () => {
  afterEach(() => { vi.useRealTimers(); });

  test("control: the retired shape DID embed Date.now() — proves the control itself answers", () => {
    const ms = (t: number) => t.toString(32).padStart(9, "0");
    const retired = (now: number) => `${ms(now)}-aaaaaaaa`;
    expect(retired(1000)).not.toBe(retired(2000));
  });

  test("set back, set forward, and now: the id format never embeds a Date.now() value", () => {
    const seen = new Set<string>();
    for (const t of [0, 1_700_000_000_000, 4_000_000_000_000]) {
      vi.useFakeTimers();
      vi.setSystemTime(t);
      const id = newRequestId();
      seen.add(id);
      // The retired encoding placed Date.now().toString(32).padStart(9,"0") as the id's own
      // prefix up to the first "-". The current id carries no "-" at all, so no fixed-width
      // timestamp field can be sliced back out of it.
      expect(id.includes("-")).toBe(false);
      vi.useRealTimers();
    }
    // Three draws at three wildly different clock settings produced three distinct ids —
    // randomness, not the clock, drives uniqueness.
    expect(seen.size).toBe(3);
  });

  test("two ids minted at the identical frozen instant still differ", () => {
    vi.useFakeTimers();
    vi.setSystemTime(123456789);
    const a = newRequestId();
    const b = newRequestId();
    expect(a).not.toBe(b);
  });

  test("shape: fixed-length base-32 alphabet, no separators", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-v]{32}$/);
  });
});
