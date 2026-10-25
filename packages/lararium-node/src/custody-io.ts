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
 *   `exclusive` — the ONE custody holder, across processes. A queue serializes callers inside this process; a socket
 *               claim beside the slot tree (`<identity>/s-slots.claim`) serializes processes, containers included.
 *               Not reentrant.
 *
 * ── THE CLAIM READS NO CLOCK AND NO PID ─────────────────────────────────────────────────────────
 * The holder is a socket claim (`claimName`) on `<identity>/s-slots.claim`, spelled through an open descriptor on the
 * identity home so a deep home fits `sun_path`. The kernel's own listener state decides live vs dead, so a reused pid,
 * a pid namespace split (a container beside a host process on the same bind mount) and a SIGKILLed holder's corpse all
 * read true: a corpse is reaped by exactly one claimant, a live holder in any namespace is waited on. A contender
 * waits through `maxWaits` looks (a COUNT, never an age) and then refuses by name rather than seize a live holder's claim.
 * Each look against a live holder takes one wait from the `pace` port, so the budget reads as that many waits on any machine.
 *
 * The claim is a socket, not a carrier: `list()` takes regular files only, so the census never meets it.
 */

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { CustodyIo } from "@lararium/mesh";
import { anchoredName, answers, claimName, letGo, NameHeld } from "./socket-claim.js";
import { vesselCustodyHomes, type CustodyHomes } from "./vault-carriers.js";

/** The claim's name, in the identity home beside the slot tree. */
export const CUSTODY_CLAIM_NAME = "s-slots.claim";

/** A custody holder that could not be taken: a live holder outlasted the wait, or the claim could not be taken. */
export class CustodyLockRefused extends Error {
  override readonly name = "CustodyLockRefused";
  constructor(readonly lockPath: string, detail: string) {
    super(`custody-io: ${detail} (${lockPath})`);
  }
}

export interface FsCustodyIoOptions {
  /** How many looks a contender gives a live holder before it refuses. Default 600. */
  readonly maxWaits?: number;
  /** Milliseconds between polls. Default 50. Pacing only: no poll decides anything by elapsed time. */
  readonly pollMs?: number;
  /** The wait one look takes against a live holder. Default: a timer of `pollMs`. A port, so a test counts looks and reads no clock. */
  readonly pace?: (pollMs: number) => Promise<void>;
}

function syncDir(dir: string): void {
  try {
    const fd = openSync(dir, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
  } catch { /* a platform without directory fsync lands the rename durably on its own */ }
}

/** The production port. Construct it over the vessel's homes; every method works on absolute paths. */
export class FsCustodyIo implements CustodyIo {
  private chain: Promise<unknown> = Promise.resolve();
  private readonly maxWaits: number;
  private readonly pollMs: number;
  private readonly pace: (pollMs: number) => Promise<void>;

  constructor(readonly homes: CustodyHomes, opts: FsCustodyIoOptions = {}) {
    this.maxWaits = opts.maxWaits ?? 600;
    this.pollMs = opts.pollMs ?? 50;
    this.pace = opts.pace ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  }

  /** The claim this port's holder takes, spelled by absolute path (for reading; the claim itself rides an anchored spelling). */
  claimPath(): string { return join(this.homes.identity, CUSTODY_CLAIM_NAME); }

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
    const anchor = anchoredName(this.homes.identity, CUSTODY_CLAIM_NAME);
    try {
      const claim = await this.acquire(anchor.path);
      try { return await fn(); } finally { await claim.release(); }
    } finally { anchor.release(); }
  }

  /**
   * Claim the name, or look again while a live holder answers; `maxWaits` looks, then refuse by name. A LOOK counts
   * only when a holder still answers once its wait ends: a holder that leaves inside the wait, or between the claim
   * and the look, spends nothing, and the next claim takes the quiet name. A name that keeps changing hands between
   * the claim and the look (a holder answers the claim and none answers the look) gets `HANDOFF_PATIENCE` tries and
   * then refuses as such, never as a holder that kept it.
   */
  private async acquire(path: string) {
    let looks = 0;
    let handoffs = 0;
    for (;;) {
      try { return await claimName(path); }
      catch (err) {
        if (!(err instanceof NameHeld)) throw err;
        if (!(await answers(path))) {
          if (++handoffs > HANDOFF_PATIENCE) {
            throw new CustodyLockRefused(this.claimPath(), `the custody claim changed hands ${HANDOFF_PATIENCE} times between a claim and its look; nothing was seized`);
          }
          continue;
        }
        // Pacing only: one wait per look, cut short when the holder releases or dies. A holder hangs up on every
        // caller at once, so a closed connection alone says nothing: the look ends early only when the name
        // stopped answering. A look that returned on the hang-up alone would spend the whole budget in the time
        // the kernel takes to connect `maxWaits` times, and refuse a holder that had barely begun.
        const paced = this.pace(this.pollMs);
        await Promise.race([letGo(path), paced]);
        if (!(await answers(path))) continue;
        await paced;
        if (++looks > this.maxWaits) {
          throw new CustodyLockRefused(this.claimPath(), `a live holder kept the custody claim through ${this.maxWaits} looks; nothing was seized`);
        }
      }
    }
  }
}

/** Tries a contender gives a name that a holder answered at the claim and none answered at the look. A count, never an age. */
const HANDOFF_PATIENCE = 200;

function writeFileSyncAll(fd: number, bytes: Uint8Array): void {
  let off = 0;
  while (off < bytes.length) off += writeSync(fd, bytes, off, bytes.length - off);
}

/** The port over the running vessel's own homes. */
export function vesselCustodyIo(opts?: FsCustodyIoOptions): FsCustodyIo {
  return new FsCustodyIo(vesselCustodyHomes(), opts);
}
