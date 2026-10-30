/**
 * reality-tunnel/lock — the write lock for a target a host shares with its own live writers.
 *
 * Claude's settings carry a logged corruption-under-concurrency fault, and parallel sessions share
 * the file. The lock rides the house's socket claim (`claimName`): no pid is ever read, so neither pid
 * reuse nor a namespace split (a container, WSL beside Windows) can lie about a holder.
 */
import { claimName, NameHeld } from "@lararium/node";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locker } from "./engine.js";

export async function acquireLock(lockPath: string): Promise<{ release(): Promise<void> }> {
  const refuse = (): NameHeld => new NameHeld(`${lockPath} held by another writer; retry shortly`);
  for (let i = 0; i < 50; i++) {
    try { return await claimName(lockPath, { refuse }); }
    catch (err) {
      if (!(err instanceof NameHeld)) throw err;
      // An async backoff never blocks the main thread (no Atomics.wait / SharedArrayBuffer).
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw refuse();
}

const free = { release: async (): Promise<void> => {} };

/** One tend or undo per radius at a time: the lock rests in the radius's own ledger dir. */
export const radiusLock: Locker = async (ledgerDir) => {
  mkdirSync(ledgerDir, { recursive: true });
  return acquireLock(join(ledgerDir, ".lock"));
};

/** Lock Claude's settings files; every other target writes without one. */
export const hostLocker: Locker = async (path) =>
  /[\\/]\.claude[\\/]settings\.json$/.test(path) ? acquireLock(`${path}.lock`) : free;
