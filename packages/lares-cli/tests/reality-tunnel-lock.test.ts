/**
 * reality-tunnel/lock — the write lock's wait ends on the holder's release; a holder wedged alive meets a named LIVENESS bound.
 */
import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NameHeld } from "@lararium/node";
import { acquireLock } from "../src/reality-tunnel/lock.js";

const never = (): Promise<void> => new Promise(() => {});

describe("acquireLock", () => {
  it("RED: a holder outlasting the paced retry window still hands the lock over", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lock-"));
    let first: Awaited<ReturnType<typeof acquireLock>> | undefined;
    try {
      const path = join(dir, ".lock");
      first = await acquireLock(path);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      let observed = false;
      const second = acquireLock(path, { pace: () => { observed = true; return never(); }, livenessMs: 60_000 });
      // The parent ignores the pace port: advance its entire retry window until it refuses.
      // The current implementation signals contention through the port instead.
      const outcome = second.then(value => ({ value }), error => ({ error }));
      void outcome.then(() => { observed = true; });
      while (!observed) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await vi.advanceTimersByTimeAsync(100);
      }
      await first.release();
      first = undefined;
      const result = await outcome;
      if ("error" in result) throw result.error;
      const got = result.value;
      await got.release();
    } finally {
      vi.useRealTimers();
      await first?.release();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it("CONTROL: a held lock refuses NameHeld once the LIVENESS bound passes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lock-"));
    try {
      const path = join(dir, ".lock");
      const first = await acquireLock(path);
      await expect(acquireLock(path, { pace: never, livenessMs: 150 })).rejects.toBeInstanceOf(NameHeld);
      await first.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
