/**
 * store-door-verbs-seal-home-refold.test.ts — H2: a write landed beside the seal home, never on the Repo
 * (`accept-carriage`'s consent, `carry-for`'s carrier seal, a carried `seal import`'s grown set), pokes a
 * standing vessel's refold through this one no-op row rather than leaving its live readings stale.
 *
 * Proven:
 *   · RED→GREEN: with a vessel standing (`onRolled` wired), the row fires it and reports `refolded: true`
 *     only when the hook itself claims success — never merely because the hook exists (the exact L2 shape
 *     this door's rows must never repeat for a NEW row either);
 *   · F2-1 (H2): an ASYNC hook is awaited to its own settle; no clock answers for it (the caller's socket
 *     wait bounds a wedged refold);
 *   · CONTROL: with no vessel standing (`onRolled` absent, `storeDoorDirect`'s shape), the row answers
 *     `refolded: false, attempted: false` — nothing to poke, and it says so rather than pretending.
 */
import { describe, expect, it, vi } from "vitest";
import { storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";

const baseDeps = (onRolled?: StoreDoorDeps["onRolled"]): StoreDoorDeps => ({
  storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal",
  repo: {} as StoreDoorDeps["repo"],
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
    const onRolled = vi.fn(() => { /* a hook that merely EXISTS and gives no claim — the real vessel's
      `afterRoll` now returns a serialized `Promise<boolean>` (F1's `fcc2bd5e5`), so this models a
      caller that stands but still claims nothing, never the shape `afterRoll` itself is anymore */ });
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

  it("an ASYNC hook resolving `true` within the budget reads as refolded", async () => {
    const onRolled = vi.fn(async () => true);
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["seal-home-refold"]({}, {} as never);
    expect(out["attempted"]).toBe(true);
    expect(out["refolded"]).toBe(true);
  });

  it("a SLOW hook reads its OWN settle, never a clock's \"pending\"", async () => {
    vi.useFakeTimers();
    try {
      let settle: (v: boolean) => void = () => {};
      const onRolled = vi.fn(() => new Promise<boolean>((resolve) => { settle = resolve; }));
      const rows = storeDoorReactors(baseDeps(onRolled));
      let out: Record<string, unknown> | undefined;
      const outP = rows["seal-home-refold"]({}, {} as never).then((o) => { out = o; });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(out).toBeUndefined();
      settle(true);
      await outP;
      expect(out?.["attempted"]).toBe(true);
      expect(out?.["refolded"]).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
