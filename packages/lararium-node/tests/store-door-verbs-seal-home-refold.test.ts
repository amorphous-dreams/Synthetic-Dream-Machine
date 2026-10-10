/**
 * store-door-verbs-seal-home-refold.test.ts — H2: a write landed beside the seal home, never on the Repo
 * (`accept-carriage`'s consent, `carry-for`'s carrier seal, a carried `seal import`'s grown set), pokes a
 * standing vessel's refold through this one no-op row rather than leaving its live readings stale.
 *
 * Proven:
 *   · RED→GREEN: with a vessel standing (`onRolled` wired), the row fires it and reports `refolded: true`
 *     only when the hook itself claims success — never merely because the hook exists (the exact L2 shape
 *     this door's rows must never repeat for a NEW row either);
 *   · CONTROL: with no vessel standing (`onRolled` absent, `storeDoorDirect`'s shape), the row answers
 *     `refolded: false, attempted: false` — nothing to poke, and it says so rather than pretending.
 */
import { describe, expect, it, vi } from "vitest";
import { storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";

const baseDeps = (onRolled?: StoreDoorDeps["onRolled"]): StoreDoorDeps => ({
  storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal",
  repo: {} as StoreDoorDeps["repo"], dialGate: () => null,
  ...(onRolled ? { onRolled } : {}),
});

describe("seal-home-refold — the no-op poke row (H2)", () => {
  it("a standing vessel whose hook claims success is read as refolded", async () => {
    const onRolled = vi.fn(() => true);
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["seal-home-refold"]({}, {} as never);
    expect(onRolled).toHaveBeenCalledTimes(1);
    expect(out["attempted"]).toBe(true);
    expect(out["refolded"]).toBe(true);
  });

  it("a standing vessel whose hook exists but gives no claim is read as ATTEMPTED, never refolded", async () => {
    const onRolled = vi.fn(() => { /* fire-and-forget, as the real vessel's afterRoll is */ });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["seal-home-refold"]({}, {} as never);
    expect(out["attempted"]).toBe(true);
    expect(out["refolded"]).toBe(false);
  });

  it("CONTROL: no vessel standing — nothing attempted, nothing refolded", async () => {
    const rows = storeDoorReactors(baseDeps(undefined));
    const out = await rows["seal-home-refold"]({}, {} as never);
    expect(out["attempted"]).toBe(false);
    expect(out["refolded"]).toBe(false);
  });
});
