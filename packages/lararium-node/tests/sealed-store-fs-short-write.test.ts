/**
 * sealed-store-fs — a write that the file system takes in pieces still lands whole, and a directory the rest
 * creates reaches the disk before the write that needed it answers.
 *
 * A KEY REACHES REST BEFORE ANY VALUE SEALS UNDER IT, so a lockbox the rest acknowledged must hold every byte:
 * a write call may take fewer bytes than it got handed, and the rest keeps writing until none remain. Here the
 * file system's own `writeSync` takes at most seven bytes a call.
 *
 * A NEW DIRECTORY'S OWN ENTRY LIVES IN ITS PARENT. A rename reaches the disk once its directory does, and a
 * directory made for the first write reaches the disk once ITS parent does. The vector records which
 * directories the rest flushes.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it, vi } from "vitest";

const short = vi.hoisted(() => ({ cap: 7, calls: 0, opened: new Map<number, string>(), flushed: [] as string[] }));
vi.mock("node:fs", async (original) => {
  const real = await original<typeof import("node:fs")>();
  return {
    ...real,
    openSync: (path: string, flags?: string | number, mode?: number): number => { const fd = real.openSync(path, flags, mode); short.opened.set(fd, String(path)); return fd; },
    fsyncSync: (fd: number): void => { short.flushed.push(short.opened.get(fd) ?? "?"); real.fsyncSync(fd); },
    writeSync: (fd: number, bytes: Uint8Array, offset?: number, length?: number): number => {
      short.calls += 1;
      const from = offset ?? 0;
      return real.writeSync(fd, bytes, from, Math.min(length ?? bytes.length - from, short.cap));
    },
  };
});

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fsProviderChunkRest, fsSealedStoreRest } from "../src/sealed-store-fs.js";

describe("a write the file system takes in pieces", () => {
  it("rests every byte of a store value and of a tracked chunk before it answers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sealed-fs-short-"));
    try {
      const bytes = Uint8Array.from({ length: 100 }, (_, i) => i);
      const rest = fsSealedStoreRest(join(dir, "sealed"));
      await rest.put("own", "note.one", bytes);
      expect(short.calls).toBeGreaterThan(1);                          // CONTROL: the file system did take the value in pieces
      expect(Array.from(readFileSync(join(dir, "sealed", "own", "note.one")))).toEqual(Array.from(bytes));
      expect(Array.from((await rest.get("own", "note.one"))!)).toEqual(Array.from(bytes));
      const chunks = fsProviderChunkRest(join(dir, "chunks"));
      await chunks.put("ab", "cd", bytes);
      expect((await chunks.list("ab")).map((c) => Array.from(c.ciphertext))).toEqual([Array.from(bytes)]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("the first write flushes each directory it made into that directory's parent; a later write flushes its shelf alone", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sealed-fs-dirs-"));
    try {
      const sealed = join(dir, "vessel", "sealed");
      const rest = fsSealedStoreRest(sealed);
      short.flushed.length = 0;
      await rest.put("own", "note.one", Uint8Array.of(1, 2, 3));
      const dirs = () => short.flushed.filter((path) => !path.includes("TMP-"));
      // `vessel/`, `sealed/` and `own/` each got made: their entries live in `dir`, `vessel/` and `sealed/`.
      expect(dirs().sort()).toEqual([dir, join(dir, "vessel"), sealed, join(sealed, "own")].sort());
      short.flushed.length = 0;
      await rest.put("own", "note.two", Uint8Array.of(4));
      expect(dirs()).toEqual([join(sealed, "own")]);                   // CONTROL: nothing new got made
      const home = join(dir, "chunks");
      const chunks = fsProviderChunkRest(home);
      short.flushed.length = 0;
      await chunks.put("ab", "cd", Uint8Array.of(9));
      expect(dirs().sort()).toEqual([dir, home, join(home, "ab")].sort());
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
