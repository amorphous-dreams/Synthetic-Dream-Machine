/**
 * reality-tunnel/lock — the write lock for a target a host shares with its own live writers.
 *
 * Claude's settings carry a logged corruption-under-concurrency fault, and parallel sessions share
 * the file. The lock rides the house's socket claim (`claimName`): no pid is ever read, so neither pid
 * reuse nor a namespace split (a container, WSL beside Windows) can lie about a holder.
 */
import { claimName, NameHeld } from "@lararium/node";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Locker } from "./engine.js";

/**
 * The socket a lock claims: a short name under the temp dir, keyed by the target it guards. A Unix
 * socket name caps near 108 bytes, and a checkout's path plus a ledger dir plus the claim's suffix
 * overflows it on a deep runner path; the hash keeps every lock the same short length.
 */
export const lockSocket = (lockPath: string): string =>
  join(tmpdir(), `lares-lock-${createHash("sha256").update(lockPath).digest("hex").slice(0, 16)}`);

export async function acquireLock(lockPath: string): Promise<{ release(): Promise<void> }> {
  const refuse = (): NameHeld => new NameHeld(`${lockPath} held by another writer; retry shortly`);
  const socket = lockSocket(lockPath);
  for (let i = 0; i < 50; i++) {
    try { return await claimName(socket, { refuse }); }
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
