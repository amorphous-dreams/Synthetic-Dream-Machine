/**
 * sealed-store-fs — A LOOKUP BY ONE ID READS NO WHOLE SHELF.
 *
 * `SealedStore.record(kind, id)` asks the rest for the names under the prefix `<id>.`. The file rest read the whole
 * shelf's directory for every such ask (8,797 manifests: ~10.6 ms a listing), so any walk that looked manifests up one
 * by one ran quadratic. The rest now holds each shelf's names in memory, keyed by the directory's own stamp, and a
 * prefix lookup reads that list. A shelf another writer moved re-reads, and a lookup that finds nothing in the held
 * list reads the directory once more before it answers empty, so a name some other writer rested never reads as absent.
 *
 * Each vector counts the directory reads, so none reads a clock.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ reads: 0 }));
vi.mock("node:fs", async (original) => {
  const real = await original<typeof import("node:fs")>();
  return { ...real, readdirSync: ((...args: Parameters<typeof real.readdirSync>) => { seen.reads += 1; return real.readdirSync(...args); }) as typeof real.readdirSync };
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { restDigest } from "@lararium/mesh";
import { fsSealedStoreRest } from "../src/sealed-store-fs.js";

const value = (i: number): Uint8Array => Uint8Array.from([i & 0xff, (i >> 8) & 0xff, 7]);
const nameOf = (i: number, bytes: Uint8Array): string => `${i.toString(16).padStart(8, "0")}.${restDigest(bytes)}`;

describe("a lookup by one id reads no whole shelf", () => {
  it("RED: a hundred prefix lookups over a hundred names read the shelf's directory a constant number of times", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sealed-fs-finds-"));
    try {
      const rest = fsSealedStoreRest(dir);
      for (let i = 0; i < 100; i++) await rest.put("manifest", nameOf(i, value(i)), value(i));
      const from = seen.reads;
      for (let i = 0; i < 100; i++) expect(await rest.list("manifest", `${i.toString(16).padStart(8, "0")}.`)).toEqual([nameOf(i, value(i))]);
      expect(seen.reads - from).toBeLessThanOrEqual(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("a name another writer rests beside this rest lists at the next lookup, and a full listing reads the directory itself", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sealed-fs-finds-"));
    try {
      const rest = fsSealedStoreRest(dir), other = fsSealedStoreRest(dir);
      await rest.put("manifest", nameOf(1, value(1)), value(1));
      expect(await rest.list("manifest", "00000001.")).toHaveLength(1);
      // Another writer over the same directory: this rest never saw the put.
      await other.put("manifest", nameOf(2, value(2)), value(2));
      expect(await rest.list("manifest", "00000002.")).toEqual([nameOf(2, value(2))]);
      // A file that lands with no rest's put at all (a copy dropped in by hand) lists too.
      const dropped = value(3);
      writeFileSync(join(dir, "manifest", nameOf(3, dropped)), dropped);
      expect(await rest.list("manifest", "00000003.")).toEqual([nameOf(3, dropped)]);
      expect(await rest.list("manifest")).toEqual([nameOf(1, value(1)), nameOf(2, value(2)), nameOf(3, dropped)]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("CONTROL: the held list keeps the rule: a temporary or upper-case name never lists, and a prefix past every name lists none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sealed-fs-finds-"));
    try {
      const rest = fsSealedStoreRest(dir);
      await rest.put("manifest", nameOf(1, value(1)), value(1));
      writeFileSync(join(dir, "manifest", "TMP-leftover"), "x");
      expect(await rest.list("manifest", "TMP")).toEqual([]);
      expect(await rest.list("manifest", "zz")).toEqual([]);
      expect(await rest.list("manifest")).toEqual([nameOf(1, value(1))]);
      expect(await rest.list("index", "a")).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
