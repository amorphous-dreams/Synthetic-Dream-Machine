/**
 * node-cas-whole-write — a CAS entry's FIRST write lands whole and flushed.
 *
 * A sealed value rests in the `cad/` tier through `writeCasEntriesFs`, and its lockbox rests beside it by a
 * rename plus a directory flush. A value written straight onto its final name, with no flush, trails its lockbox:
 * a power cut leaves a lockbox whose value reads torn or absent. So every write of an entry, the first one too,
 * goes temp file, file flush, rename, directory flush.
 *
 *   W1  RED: a first write never opens the final name for writing: the bytes land on a temp name beside it, get
 *       flushed, and reach the final name by one rename, followed by a flush of the directory.
 *       CONTROL: the entry reads back whole under its address, and a second write of the same entry writes nothing.
 *   W2  a write that cannot finish leaves no temp file behind and nothing under the final name.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

const calls: Array<{ op: string; path: string }> = [];
const fds = new Map<number, string>();
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (path: unknown, ...rest: unknown[]) => { calls.push({ op: "write", path: String(path) }); return (actual.writeFileSync as (...a: unknown[]) => void)(path, ...rest); },
    openSync: (path: unknown, ...rest: unknown[]) => { const fd = (actual.openSync as (...a: unknown[]) => number)(path, ...rest); fds.set(fd, String(path)); return fd; },
    fsyncSync: (fd: number) => { calls.push({ op: "flush", path: fds.get(fd) ?? `fd:${fd}` }); return actual.fsyncSync(fd); },
    renameSync: (from: unknown, to: unknown) => { calls.push({ op: "rename", path: `${String(from)} -> ${String(to)}` }); return actual.renameSync(from as string, to as string); },
  };
});

// A setup file may have loaded the writer already: every module under test loads again, over the recording fs.
vi.resetModules();
const { writeCasEntriesFs, readVerifiedCasBlobFromFs } = await import("../src/node-cas.js");
const { sha256HexBytesSync } = await import("@lararium/mesh");

const roots: string[] = [];
afterEach(() => { calls.length = 0; fds.clear(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

describe("a CAS entry's first write", () => {
  test("W1 — lands on a temp name, gets flushed, reaches its name by one rename, and the directory gets flushed", () => {
    const dir = mkdtempSync(join(tmpdir(), "node-cas-whole-")); roots.push(dir);
    const bytes = new TextEncoder().encode("a synthetic sealed value");
    const cid = sha256HexBytesSync(bytes);
    const final = join(dir, cid);
    calls.length = 0;
    expect(writeCasEntriesFs([{ cid, bytes }], dir)).toBe(1);
    expect(calls.filter((c) => c.op === "write" && c.path === final), "the final name never opens for a write").toEqual([]);
    const temp = calls.find((c) => c.op === "write")!.path;
    expect(temp).not.toBe(final);
    expect(temp.startsWith(`${final}.`)).toBe(true);
    const order = calls.map((c) => (c.op === "flush" ? `flush ${c.path === temp ? "file" : c.path === dir ? "dir" : c.path}` : c.op === "rename" ? `rename ${c.path === `${temp} -> ${final}` ? "temp->final" : c.path}` : "write temp"));
    expect(order).toEqual(["write temp", "flush file", "rename temp->final", "flush dir"]);
    // CONTROL: the entry reads back whole, and writing it again writes nothing.
    expect(Buffer.from(readVerifiedCasBlobFromFs(cid, dir)!).equals(Buffer.from(bytes))).toBe(true);
    calls.length = 0;
    expect(writeCasEntriesFs([{ cid, bytes }], dir)).toBe(0);
    expect(calls.filter((c) => c.op !== "flush")).toEqual([]);
    expect(readdirSync(dir)).toEqual([cid]);
  });

  test("W2 — a write that cannot finish leaves no temp file and nothing under the final name", () => {
    const dir = mkdtempSync(join(tmpdir(), "node-cas-whole-")); roots.push(dir);
    const bytes = new TextEncoder().encode("a second synthetic value");
    const cid = sha256HexBytesSync(bytes);
    mkdirSync(join(dir, cid, "planted"), { recursive: true });               // a directory stands where the entry belongs: the rename fails
    rmSync(join(dir, cid), { recursive: true });
    mkdirSync(join(dir, `${cid}.${process.pid}.tmp`));                       // and one stands where the temp belongs: the write fails
    expect(() => writeCasEntriesFs([{ cid, bytes }], dir)).toThrow();
    expect(existsSync(join(dir, cid))).toBe(false);
  });
});
