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

/**
 * LIVENESS: a holder alive past this span reads as wedged and the wait refuses `NameHeld`. A write lock covers one
 * read-modify-write of a settings file or one radius tend (milliseconds to a few seconds of file work); 30 s leaves a
 * slow disk its turn while a hung writer still surfaces as a refusal. No event can say "this holder never lets go".
 */
export const LOCK_LIVENESS_MS = 30_000;

const never = (): Promise<void> => new Promise(() => {});

export interface AcquireLockOptions {
  /** The wedged-holder bound (default {@link LOCK_LIVENESS_MS}). */
  readonly livenessMs?: number;
  /** The look's pacing port (a test passes one that never ends, so only the holder's release can hand the lock over). */
  readonly pace?: (ms: number) => Promise<void>;
}

/** The wait ends on the holder's release (its connection closes, or its death unlinks the name), never on a paced retry. */
export async function acquireLock(lockPath: string, opts: AcquireLockOptions = {}): Promise<{ release(): Promise<void> }> {
  const refuse = (): NameHeld => new NameHeld(`${lockPath} held by another writer; retry shortly`);
  const bound = new AbortController();
  // LIVENESS: see LOCK_LIVENESS_MS.
  const timer = setTimeout(() => bound.abort(), opts.livenessMs ?? LOCK_LIVENESS_MS);
  try {
    // The holder keeps every connection open until it releases (or dies), so a waiter's connection closing IS the
    // release; the look carries no pacing clock of its own.
    return await claimName(lockSocket(lockPath), { refuse, await: true, signal: bound.signal, onConnection: () => {}, pace: opts.pace ?? never });
  } finally { clearTimeout(timer); }
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
