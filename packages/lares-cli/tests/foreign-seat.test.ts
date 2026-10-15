/**
 * foreign-seat — a local seat must never build on a charter it did not found.
 *
 * ── THE DEFECT THIS CLOSES, MEASURED ────────────────────────────────────────────────────────────
 * A joining operator must hold the founding operator's charter before she can consent to carriage —
 * she cannot consent to a charter she has never seen — and canon puts it in HER OWN seal home. She
 * also seats her own charter in that same place. Those two facts collide.
 *
 * Measured end to end on two real vessels: B imports A's charter, then seats her own cabal. The seat
 * reads the standing doc as its base and APPENDS, so B's charter ends carrying six seated kahu —
 * A's three and B's three — at a threshold of two.
 *
 * A therefore holds quorum over B's Nexus, using A's own keys, with no further act by B. That is an
 * escalation the partner can perform alone, and it arrives disguised as the ordinary handoff the
 * runbook instructs.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────────
 * A SEATED chair whose key this vessel's vault cannot produce is FOREIGN. A seat refuses to build on
 * one. An UNSEATED chair carries no key and no authority, so it is not foreign and keeping it stays
 * exactly what `unstood: "keep"` is for.
 */
import { describe, it, expect } from "vitest";
import { foreignSeats } from "../src/seal-import.js";
import { seatFingerprint } from "@lararium/mesh";

const held = ["aa".repeat(32), "bb".repeat(32), "cc".repeat(32)];

describe("foreign-seat — what this vessel did not found, it does not seat onto", () => {
  it("★ a charter seating keys this vault cannot produce is FOREIGN ★", () => {
    const r = foreignSeats(
      [{ chairLabel: "private", verifyingKey: "dd".repeat(32) }, { chairLabel: "mine", verifyingKey: held[0]! }], held);
    expect(r.foreign).toEqual([seatFingerprint("dd".repeat(32))]);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/quorum|did not found|foreign/i);
  });

  it("★ a charter of only this vessel's own keys seats cleanly ★", () => {
    const r = foreignSeats([{ chairLabel: "mine", verifyingKey: held[1]! }], held);
    expect(r.ok).toBe(true);
    expect(r.foreign).toEqual([]);
  });

  it("★ an UNSEATED chair is not foreign — it carries no key and no authority ★", () => {
    // `unstood: "keep"` exists for exactly this: a declared chair nobody has stood for yet.
    const r = foreignSeats([{ chairLabel: "declared", verifyingKey: null }], held);
    expect(r.ok).toBe(true);
  });

  it("★ an empty charter seats cleanly — a fresh vessel founds on nothing ★", () => {
    expect(foreignSeats([], held).ok).toBe(true);
  });

  it("★ the refusal names EVERY foreign chair, not just the first ★", () => {
    const r = foreignSeats(
      [{ chairLabel: "A0", verifyingKey: "dd".repeat(32) }, { chairLabel: "A1", verifyingKey: "ee".repeat(32) },
       { chairLabel: "mine", verifyingKey: held[2]! }], held);
    expect(r.foreign).toEqual([seatFingerprint("dd".repeat(32)), seatFingerprint("ee".repeat(32))]);
    expect(r.why).toContain(r.foreign[1]!);
  });

  it("★ key comparison ignores case — hex from two sources need not agree on it ★", () => {
    expect(foreignSeats([{ chairLabel: "mine", verifyingKey: held[0]!.toUpperCase() }], held).ok).toBe(true);
  });
});
