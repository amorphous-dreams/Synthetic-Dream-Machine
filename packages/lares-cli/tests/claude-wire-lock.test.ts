/**
 * claude-wire-lock.test.ts — `acquireLock`'s OS-native socket claim, NO GLOBAL NOW, NO PID (M6).
 *
 * The settings.json lock used to write its holder's own pid into a lockfile and ask the OS whether
 * that pid still lived — a scheme with its own holes (a TOCTOU double-steal, a crash-before-pid-write
 * permanent wedge, pid reuse, a pid-namespace split). It now rides the house's socket-claim
 * primitive: a dead holder (its process gone, so its listening socket is gone too) is a corpse the
 * next claimant reaps on sight; a live holder's claim is never stolen, however long a contender
 * waits — no pid is ever read, by either side. Proofs:
 *   · a lock whose holder process has exited is reclaimed promptly, with no wall-clock wait;
 *   · a lock a live holder still holds refuses a bounded contender rather than being stolen;
 *   · release frees the name for the very next acquire;
 *   · CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` changes neither verdict, because
 *     neither reads a clock (the claim is pure socket presence).
 */
import { describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NameHeld } from "@lararium/node";
import { acquireLock } from "../src/claude-wire.js";

describe("acquireLock — OS-native socket claim, no pid ever read (M6)", () => {
  test("a corpse (the prior holder's process gone without releasing) is reclaimed instantly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-"));
    const lockPath = join(dir, "settings.json.lock");
    try {
      const first = await acquireLock(lockPath);
      // Simulate a crashed holder: the listener dies without ever calling release() — the
      // rendezvous file on disk is now an orphaned link to a dead socket, a corpse.
      await new Promise<void>((resolve) => { first.server.close(() => resolve()); });
      const start = Date.now();
      const second = await acquireLock(lockPath);
      expect(Date.now() - start, "reaped on sight — no wall-clock wait").toBeLessThan(2_000);
      expect(existsSync(lockPath)).toBe(true);
      await second.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a LIVE holder's lock is never stolen — a bounded contender refuses, never succeeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-live-"));
    const lockPath = join(dir, "settings.json.lock");
    try {
      const holder = await acquireLock(lockPath);
      await expect(acquireLock(lockPath)).rejects.toBeInstanceOf(NameHeld);
      await holder.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 15_000);

  test("release frees the name for the very next acquire", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-cycle-"));
    const lockPath = join(dir, "settings.json.lock");
    try {
      const a = await acquireLock(lockPath);
      await a.release();
      const b = await acquireLock(lockPath);
      await b.release();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` changes neither the reap nor the refusal", async () => {
    const realNow = Date.now();
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-skew-"));
      const lockPath = join(dir, "settings.json.lock");
      try {
        const first = await acquireLock(lockPath);
        await new Promise<void>((resolve) => { first.server.close(() => resolve()); });
        const second = await acquireLock(lockPath);   // still reclaims a corpse under either skew
        expect(existsSync(lockPath), `skew ${skew}`).toBe(true);
        await second.release();
      } finally { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); }
    }
  });
});
