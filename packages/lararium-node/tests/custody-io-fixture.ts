/**
 * custody-io-fixture — a scratch-directory `CustodyIo` for the custody tests: the sealed writer's port over plain
 * `fs`, spanning the three homes one vessel's carriers rest in. Every test roots it under a fresh `mkdtemp`, so no
 * write here reaches a real identity home.
 *
 * `exclusive` queues every call behind the one before it, in this process; the cross-process holder belongs to the
 * production port.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CustodyIo } from "@lararium/mesh";
import type { CustodyHomes } from "../src/vault-carriers.js";

export class ScratchCustodyIo implements CustodyIo {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(readonly homes: CustodyHomes) {}

  async read(path: string): Promise<Uint8Array | null> {
    try { return new Uint8Array(readFileSync(path)); } catch { return null; }
  }
  async write(path: string, bytes: Uint8Array): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  async rename(from: string, to: string): Promise<void> { renameSync(from, to); }
  async remove(path: string): Promise<void> { rmSync(path, { force: true }); }
  async list(): Promise<readonly string[]> {
    const out: string[] = [];
    const walk = (dir: string): void => {
      let names: string[];
      try { names = readdirSync(dir); } catch { return; }
      for (const name of names) {
        const p = join(dir, name);
        try { readdirSync(p); walk(p); } catch { out.push(p); }
      }
    };
    for (const home of [this.homes.identity, this.homes.storage, this.homes.seal]) walk(home);
    return out;
  }
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }
}

/** Three fresh homes under one scratch root; `drop()` removes the root. */
export function scratchHomes(): { homes: CustodyHomes; root: string; drop: () => void } {
  const root = mkdtempSync(join(tmpdir(), "lar-custody-"));
  const homes = { identity: join(root, "identity"), storage: join(root, "vessel"), seal: join(root, "nexus") };
  return { homes, root, drop: () => rmSync(root, { recursive: true, force: true }) };
}
