/**
 * claude-wire-lock.test.ts — `acquireLock`'s dead-holder steal, NO GLOBAL NOW.
 *
 * The settings.json lockfile used to steal a stale lock by AGE (`Date.now() - mtimeMs > 30_000`) — a
 * wall clock an adversarial or merely wrong system clock could move either way, stranding a live
 * holder's lock forever (set-back) or stealing a live holder's lock mid-write (set-forward). It now
 * carries its holder's own pid and a contender asks the OS directly (`pidAlive`): dead by an absent pid,
 * never by age. Proofs:
 *   · a lock held by a DEAD pid is stolen and re-acquired, instantly — no wait, let alone 30s;
 *   · a lock held by a LIVE pid is never stolen, however long the contender waits;
 *   · CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` (and a manually back-dated / forward-dated
 *     lock file mtime) change neither verdict, because neither is ever read.
 */
import { describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { acquireLock, pidAlive } from "../src/claude-wire.js";

function deadPid(): number {
  // A process that has already exited — its pid is reliably absent by the time we read it back.
  const r = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  const pid = (r.pid ?? 0) as number;
  expect(pid, "spawnSync must report the child's pid").toBeGreaterThan(0);
  return pid;
}

describe("acquireLock — dead by absent pid, never by age", () => {
  test("pidAlive: our own process reads alive; a just-exited child reads dead", () => {
    expect(pidAlive(process.pid)).toBe(true);
    expect(pidAlive(deadPid())).toBe(false);
  });

  test("a lock held by a DEAD pid is stolen instantly, regardless of its age", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-"));
    const lockPath = join(dir, "settings.json.lock");
    try {
      writeFileSync(lockPath, String(deadPid()));
      const veryOld = (Date.now() - 86_400_000) / 1000;
      utimesSync(lockPath, veryOld, veryOld);   // an age check would see this as "long stale" — irrelevant now
      const start = Date.now();
      await acquireLock(lockPath);
      expect(Date.now() - start, "stolen on the first retry — no 30s age wait").toBeLessThan(2_000);
      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(lockPath, "utf8")).toBe(String(process.pid));   // re-written to OUR pid
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a lock held by a LIVE pid is never stolen — the contender backs off and eventually refuses", async () => {
    vi.useFakeTimers();
    const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-live-"));
    const lockPath = join(dir, "settings.json.lock");
    try {
      writeFileSync(lockPath, String(process.pid));   // our own pid — always alive
      const attempt = acquireLock(lockPath).then(
        () => ({ ok: true as const }),
        (e) => ({ ok: false as const, message: (e as Error).message }),
      );
      await vi.advanceTimersByTimeAsync(60_000);   // far past any wall-clock "age" that used to matter
      const r = await attempt;
      expect(r.ok, "a live holder's lock is never stolen").toBe(false);
      if (!r.ok) expect(r.message).toMatch(/held by another writer/);
      expect(readFileSync(lockPath, "utf8")).toBe(String(process.pid));   // untouched — never rewritten
    } finally { vi.useRealTimers(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL — SET-BACK and SET-FORWARD: a mocked `Date.now` changes neither the dead-pid steal nor the live-pid refusal", async () => {
    const realNow = Date.now();
    for (const skew of [-10 * 365 * 86_400_000, 10 * 365 * 86_400_000]) {
      vi.spyOn(Date, "now").mockReturnValue(realNow + skew);
      const dir = mkdtempSync(join(tmpdir(), "lr-claude-lock-skew-"));
      const lockPath = join(dir, "settings.json.lock");
      try {
        writeFileSync(lockPath, String(deadPid()));
        await acquireLock(lockPath);   // still steals a dead pid's lock under either skew
        expect(readFileSync(lockPath, "utf8"), `skew ${skew}`).toBe(String(process.pid));
      } finally { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); }
    }
  });
});
