/**
 * sealed-store-fs tests: durable file names, atomic values and directory boundaries.
 * INVARIANTS: unsafe names form no path; only complete named values list and read.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fsSealedStoreRest, sealedStoreDir } from "../src/sealed-store-fs.js";
import { isRestKind, restDigest, SealedStore, type RestKind } from "@lararium/mesh";

const root = () => mkdtempSync(join(tmpdir(), "sealed-fs-"));
const tree = (path: string): string[] => {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? [item.name, ...tree(join(path, item.name)).map((n) => `${item.name}/${n}`)] : [item.name]).sort();
};

describe("filesystem store mirrors memory integrity laws", () => {
  it("tampered durable values vanish and a restart finds exactly one of each", async () => {
    const dir = join(root(), "sealed"), rest = fsSealedStoreRest(dir), store = new SealedStore(rest);
    try {
      const lockbox = { bag: "a".repeat(64), keyVersion: "b".repeat(64), wrap: "keyhive" as const, box: Uint8Array.of(1) };
      await store.putLockbox(lockbox); await store.putIndexRows([]);
      const [name] = await rest.list("lockbox"); const bytes = readFileSync(join(dir, "lockbox", name!));
      writeFileSync(join(dir, "lockbox", name!), Buffer.concat([bytes.subarray(0, -1), Buffer.from([bytes[bytes.length - 1]! ^ 1])]));
      expect(await store.lockboxes()).toEqual([]);
      await rest.put("lockbox", name!, new Uint8Array(bytes));
      const restarted = new SealedStore(fsSealedStoreRest(dir));
      await restarted.putLockbox(lockbox); expect(await restarted.lockboxes()).toHaveLength(1);
    } finally { rmSync(join(dir, ".."), { recursive: true, force: true }); }
  });

  it("tampered records and rows disappear while their untouched neighbors remain", async () => {
    const base = root(), dir = join(base, "sealed"), rest = fsSealedStoreRest(dir);
    try {
      const kind: RestKind = "index", good = Uint8Array.of(1, 2, 3), other = Uint8Array.of(4, 5, 6);
      const goodName = `row.${restDigest(good)}`, otherName = `row.${restDigest(other)}`;
      await rest.put(kind, goodName, good); await rest.put(kind, otherName, other);
      const before = readFileSync(join(dir, kind, goodName));
      const changed = Uint8Array.from(before); changed[0] ^= 1;
      writeFileSync(join(dir, kind, goodName), changed);
      expect([...readFileSync(join(dir, kind, goodName))]).not.toEqual([...before]);
      expect(await rest.get(kind, goodName)).toEqual(changed);
      expect(await rest.list(kind)).toEqual([goodName, otherName].sort());
      await rest.put(kind, goodName, good);
      expect(await rest.get(kind, goodName)).toEqual(good);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  it("keeps sound bytes, refuses unproven repair and accepts proven repair", async () => {
    const base = root(), dir = join(base, "sealed"), rest = fsSealedStoreRest(dir);
    try {
      const first = Uint8Array.of(1, 2, 3), stranger = Uint8Array.of(8, 8, 8), name = `value.${restDigest(first)}`;
      await rest.put("own", "own-note", first);
      await rest.put("index", name, first); await rest.put("index", name, stranger);
      expect(await rest.get("index", name)).toEqual(first);
      const altered = Uint8Array.of(2, 2, 3); writeFileSync(join(dir, "index", name), altered);
      await rest.put("index", name, stranger); expect(await rest.get("index", name)).toEqual(altered);
      await rest.put("index", name, first); expect(await rest.get("index", name)).toEqual(first);
      await rest.put("own", "own-note", stranger); expect(await rest.get("own", "own-note")).toEqual(stranger);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe("filesystem names never form unsafe paths", () => {
  it("rejects separators, traversal, capitals, dots, long names and unknown kinds before creating entries", async () => {
    const base = root(), dir = join(base, "sealed"), rest = fsSealedStoreRest(dir);
    try {
      for (const name of ["a/b", "..", "UPPER", ".lead", "a".repeat(600)]) {
        await expect(rest.put("lockbox", name, Uint8Array.of(1))).rejects.toThrow(TypeError);
        await expect(rest.get("lockbox", name)).rejects.toThrow(TypeError);
      }
      await expect(rest.put("unknown" as RestKind, "safe", Uint8Array.of(1))).rejects.toThrow(TypeError);
      expect(tree(dir)).toEqual([]);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe("temporary files never become listed values", () => {
  it("ignores leftover temporary files and lists absent shelves as empty", async () => {
    const base = root(), dir = join(base, "sealed"), rest = fsSealedStoreRest(dir);
    try {
      expect(await rest.list("index")).toEqual([]);
      mkdirSync(join(dir, "lockbox"), { recursive: true }); writeFileSync(join(dir, "lockbox", "TMP-deadbeef"), "dead");
      expect(await rest.list("lockbox")).toEqual([]); await expect(rest.get("lockbox", "TMP-deadbeef")).rejects.toThrow(TypeError);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe("filesystem writes land whole and portable", () => {
  it("writes one file, survives another rest instance and places every kind under its shelf", async () => {
    const base = root(), dir = join(base, "sealed"), rest = fsSealedStoreRest(dir), bytes = Uint8Array.of(8, 7, 6);
    try {
      for (const kind of ["lockbox", "key-version", "manifest", "checkpoint", "hand-over", "index", "own"] as const) await rest.put(kind, `${kind.replaceAll("-", "")}-safe`, bytes);
      for (const kind of ["lockbox", "key-version", "manifest", "checkpoint", "hand-over", "index", "own"] as const) {
        const name = `${kind.replaceAll("-", "")}-safe`;
        expect(readdirSync(join(dir, kind))).toEqual([name]); expect([...((await fsSealedStoreRest(dir).get(kind, name))!)]).toEqual([...bytes]);
      }
      expect(sealedStoreDir("/x/store")).toBe("/x/store/sealed");
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
