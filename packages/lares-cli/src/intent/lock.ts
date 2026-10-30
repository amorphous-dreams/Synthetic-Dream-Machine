/**
 * intent/lock — the write lock for a target a host shares with its own live writers.
 *
 * Claude's settings carry a logged corruption-under-concurrency fault, and parallel sessions share
 * the file. The lock rides the house's socket claim (`claimName`): no pid is ever read, so neither pid
 * reuse nor a namespace split (a container, WSL beside Windows) can lie about a holder.
 */
import { claimName, NameHeld } from "@lararium/node";
import type { Locker } from "./engine.js";

export async function acquireLock(lockPath: string): Promise<{ release(): Promise<void> }> {
  const refuse = (): NameHeld => new NameHeld(`${lockPath} held by another writer; retry shortly`);
  for (let i = 0; i < 50; i++) {
    try { return await claimName(lockPath, { refuse }); }
    catch (err) {
      if (!(err instanceof NameHeld)) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw refuse();
}

const free = { release: async (): Promise<void> => {} };

/** Lock Claude's settings files; every other target writes without one. */
export const hostLocker: Locker = async (path) =>
  /[\\/]\.claude[\\/]settings\.json$/.test(path) ? acquireLock(`${path}.lock`) : free;
