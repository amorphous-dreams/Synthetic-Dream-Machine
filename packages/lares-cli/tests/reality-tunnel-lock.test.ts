/**
 * reality-tunnel/lock — the write lock's wait ends on the holder's release; a holder wedged alive meets a named LIVENESS bound.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NameHeld } from "@lararium/node";
import { acquireLock } from "../src/reality-tunnel/lock.js";

const never = (): Promise<void> => new Promise(() => {});

describe("acquireLock", () => {
  it("RED: a holder that releases at an arbitrary moment hands the lock over with no paced retry", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lock-"));
    try {
      const path = join(dir, ".lock");
      const first = await acquireLock(path);
      const second = acquireLock(path, { pace: never, livenessMs: 60_000 });
      await new Promise((r) => setTimeout(r, 317));
      await first.release();
      const got = await second;
      await got.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

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
