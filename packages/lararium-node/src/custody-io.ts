/**
 * custody-io — THE PRODUCTION `CustodyIo`: the sealed writer's port over the real filesystem, spanning the three
 * homes one vessel's carriers rest in (identity, storage, seal).
 *
 * ── WHAT THE PORT PROMISES, AND HOW THIS ONE KEEPS IT ───────────────────────────────────────────
 *   `write`   — whole or not at all, durably: a sibling temp (mode 0600) → fsync the file → rename → fsync the
 *               directory. A fault removes the temp and rethrows; the prior bytes stand.
 *   `rename`  — one atomic `rename(2)`, then a directory fsync of the destination (and of the source's directory
 *               when it differs). A cross-device rename faults loudly (`EXDEV`), never copies: two files is not one
 *               atomic step.
 *   `remove`  — `rm -f`: nothing standing is no fault.
 *   `list`    — EVERY regular file under EVERY home, recursively, as absolute paths. The founding census and the
 *               rotation census read it, and both refuse on a VK-sealed file no row names; a list that skipped a
 *               subtree would let a stray seal hide there. A symlink is not followed (it lists as nothing, and its
 *               target is never read through it); an absent home lists nothing.
 *   `exclusive` — the ONE custody holder, across processes. A queue serializes callers inside this process; a lock
 *               file beside the slot tree (`<identity>/vk-slots.bin.lock`, created `O_EXCL`) serializes processes.
 *               Not reentrant.
 *
 * ── THE LOCK READS NO CLOCK ─────────────────────────────────────────────────────────────────────
 * The lock file names its holder (pid + a random token). A contender that finds it held waits, polling; it breaks the
 * lock ONLY when the holder's pid answers `ESRCH` (no such process) — a fact about a process, never an age. A wait
 * that outlasts `maxWaits` polls refuses by name rather than seizing a lock a live holder may still use. The one
 * residual window: two contenders that both see the same dead holder race to break it; the break is an atomic rename
 * of the lock aside and a re-read, and a break that finds it moved a LIVE holder's fresh lock puts it back unless a
 * third file has already taken the path, in which case it refuses. A dead holder's lock is the only one ever removed.
 *
 * The lock file is not a carrier and bears no seal magic, so the census never mistakes it for one.
 */

import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { CustodyIo } from "@lararium/mesh";
import { vesselCustodyHomes, vkSlotsPath, type CustodyHomes } from "./vault-carriers.js";

/** The lock file's name, beside the slot tree. */
export const CUSTODY_LOCK_SUFFIX = ".lock";

/** A custody holder that could not be taken: a live holder outlasted the wait, or the lock could not be broken safely. */
export class CustodyLockRefused extends Error {
  override readonly name = "CustodyLockRefused";
  constructor(readonly lockPath: string, detail: string) {
    super(`custody-io: ${detail} (${lockPath})`);
  }
}

export interface FsCustodyIoOptions {
  /** How many polls a contender makes against a live holder before it refuses. Default 600. */
  readonly maxWaits?: number;
  /** Milliseconds between polls. Default 50. Pacing only: no poll decides anything by elapsed time. */
  readonly pollMs?: number;
}

function syncDir(dir: string): void {
  try {
    const fd = openSync(dir, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  } catch { /* a platform without directory fsync lands the rename durably on its own */ }
}

function pidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (err) { return (err as NodeJS.ErrnoException).code === "EPERM"; }
}

function holderPid(text: string): number {
  const m = /^(\d+) /.exec(text);
  return m ? Number(m[1]) : 0;
}

/** The production port. Construct it over the vessel's homes; every method works on absolute paths. */
export class FsCustodyIo implements CustodyIo {
  private chain: Promise<unknown> = Promise.resolve();
  private readonly maxWaits: number;
  private readonly pollMs: number;

  constructor(readonly homes: CustodyHomes, opts: FsCustodyIoOptions = {}) {
    this.maxWaits = opts.maxWaits ?? 600;
    this.pollMs = opts.pollMs ?? 50;
  }

  /** The lock file this port's holder takes. */
  lockPath(): string { return `${vkSlotsPath(this.homes.identity)}${CUSTODY_LOCK_SUFFIX}`; }

  async read(path: string): Promise<Uint8Array | null> {
    try { return new Uint8Array(readFileSync(path)); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;   // an unreadable file is a fault to name, never an absence to write over
    }
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${path}.${process.pid}.${randomUUID()}.io-tmp`;
    try {
      const fd = openSync(tmp, "wx", 0o600);
      try { writeFileSyncAll(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(tmp, path);
      syncDir(dir);
    } catch (err) {
      try { rmSync(tmp, { force: true }); } catch { /* the write's error is the one owed */ }
      throw err;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    renameSync(from, to);
    syncDir(dirname(to));
    if (dirname(from) !== dirname(to)) syncDir(dirname(from));
  }

  async remove(path: string): Promise<void> {
    rmSync(path, { force: true });
    syncDir(dirname(path));
  }

  async list(): Promise<readonly string[]> {
    const out: string[] = [];
    const walk = (dir: string): void => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isFile()) out.push(p);
        else if (e.isDirectory()) walk(p);
      }
    };
    for (const home of new Set([this.homes.identity, this.homes.storage, this.homes.seal])) walk(home);
    return out.sort();
  }

  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(() => this.underFileLock(fn));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async underFileLock<T>(fn: () => Promise<T>): Promise<T> {
    const lock = this.lockPath();
    mkdirSync(dirname(lock), { recursive: true, mode: 0o700 });
    const mine = `${process.pid} ${randomUUID()}`;
    await this.acquire(lock, mine);
    try { return await fn(); }
    finally {
      // Release only a lock that still names this holder: a broken-and-retaken lock belongs to someone else.
      try { if (readFileSync(lock, "utf8") === mine) rmSync(lock, { force: true }); } catch { /* already gone */ }
    }
  }

  private async acquire(lock: string, mine: string): Promise<void> {
    for (let wait = 0; wait <= this.maxWaits; wait++) {
      try {
        const fd = openSync(lock, "wx", 0o600);
        try { writeFileSync(fd, mine); fsyncSync(fd); } finally { closeSync(fd); }
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      let held: string;
      try { held = readFileSync(lock, "utf8"); } catch { continue; }   // released between the open and the read
      if (!pidAlive(holderPid(held))) this.breakDead(lock, held);
      else await new Promise<void>((r) => setTimeout(r, this.pollMs));
    }
    throw new CustodyLockRefused(lock, `a live holder kept the custody lock through ${this.maxWaits} polls; nothing was seized`);
  }

  /** Break a lock whose named holder is a dead process. The lock moves aside atomically; a live holder's is put back. */
  private breakDead(lock: string, seen: string): void {
    const aside = `${lock}.broken-${process.pid}-${randomUUID()}`;
    try { renameSync(lock, aside); } catch { return; }   // someone else broke it first
    let moved = "";
    try { moved = readFileSync(aside, "utf8"); } catch { /* unreadable: treat as the dead holder's */ }
    if (moved !== seen && pidAlive(holderPid(moved))) {
      // The race: the path held a LIVE holder's fresh lock by the time we moved it. Put it back, never overwrite.
      try { linkSync(aside, lock); } catch (err) {
        rmSync(aside, { force: true });
        throw new CustodyLockRefused(lock, `a live holder's lock was displaced during a dead-holder break and another lock took its place: ${(err as Error).message}`);
      }
    }
    rmSync(aside, { force: true });
  }
}

function writeFileSyncAll(fd: number, bytes: Uint8Array): void {
  let off = 0;
  while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off);
}

/** The port over the running vessel's own homes. */
export function vesselCustodyIo(opts?: FsCustodyIoOptions): FsCustodyIo {
  return new FsCustodyIo(vesselCustodyHomes(), opts);
}
