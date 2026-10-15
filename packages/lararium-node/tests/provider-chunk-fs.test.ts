/**
 * provider-chunk-fs — the node's rest for the Keyhive chunks a provider tracks per bag: after a restart an
 * identity finds what it held, and nothing on disk names a bag.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import { hex, utf8Bytes } from "@lararium/mesh";
import { fsProviderChunkRest } from "../src/sealed-store-fs.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-chunks";
const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
const scratch = (): string => { const dir = mkdtempSync(join(tmpdir(), "chunk-fs-")); dirs.push(dir); return dir; };
function tree(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? tree(path) : [path]; });
}

describe("the provider's tracked chunks rest on the node", () => {
  test("a creator that stands again finds the chunk it sealed, and re-seals it; with no rest it finds none", async () => {
    const dir = scratch();
    const first = new KeyhiveProvider();
    await first.init({ seed: new Uint8Array(32).fill(0x91), eventStore: new InMemoryEventStore(), chunkRest: fsProviderChunkRest(dir) });
    await first.registerBag(BAG);
    await first.encryptContent(BAG, utf8Bytes("a tracked chunk"));
    const files = tree(dir);
    expect(files.length).toBe(1);
    // Nothing at rest names the bag: no path, and no byte.
    expect(files.some((path) => path.includes("SEARCH-ME"))).toBe(false);
    expect(hex(readFileSync(files[0]!)).includes(hex(utf8Bytes("SEARCH-ME")))).toBe(false);
    expect(hex(readFileSync(files[0]!)).includes(hex(utf8Bytes("a tracked chunk")))).toBe(false);
    const archive = await first.exportArchive();

    const again = new KeyhiveProvider();
    await again.init({ seed: new Uint8Array(32).fill(0x91), eventStore: new InMemoryEventStore(), archiveBytes: archive, chunkRest: fsProviderChunkRest(dir) });
    again.adoptBag(BAG, (await first.registerBag(BAG)).docId);
    const resealed = await again.reSealBag(BAG);
    expect(resealed.length).toBe(1);
    expect(new TextDecoder().decode(await again.decryptContent(BAG, resealed[0]!.ciphertext))).toBe("a tracked chunk");

    // CONTROL: the same restart with no rest finds nothing to re-seal.
    const bare = new KeyhiveProvider();
    await bare.init({ seed: new Uint8Array(32).fill(0x91), eventStore: new InMemoryEventStore(), archiveBytes: archive });
    bare.adoptBag(BAG, (await first.registerBag(BAG)).docId);
    expect(await bare.reSealBag(BAG)).toEqual([]);
  });

  test("a shelf lists what it holds, drops whole, and reads as hex alone: no name forms a path", async () => {
    const dir = scratch();
    const rest = fsProviderChunkRest(dir);
    await rest.put("ab".repeat(32), "0x" + "cd".repeat(32), new Uint8Array([1, 2, 3]));
    await rest.put("ab".repeat(32), "ef".repeat(32), new Uint8Array([4]));
    await rest.put("12".repeat(32), "cd".repeat(32), new Uint8Array([5]));
    expect(await rest.list("ab".repeat(32))).toEqual([
      { refHex: "0x" + "cd".repeat(32), ciphertext: new Uint8Array([1, 2, 3]) },
      { refHex: "0x" + "ef".repeat(32), ciphertext: new Uint8Array([4]) },
    ]);
    expect(await rest.list("99".repeat(32))).toEqual([]);
    // A leftover temporary file never lists.
    writeFileSync(join(dir, "ab".repeat(32), "TMP-deadbeef"), new Uint8Array([9]));
    expect((await rest.list("ab".repeat(32))).length).toBe(2);
    await rest.drop("ab".repeat(32));
    expect(await rest.list("ab".repeat(32))).toEqual([]);
    expect((await rest.list("12".repeat(32))).length).toBe(1);      // the neighbouring shelf stays
    for (const bad of ["../escape", "a/b", "", "zz", "AB/..", "ab".repeat(80)]) {
      await expect(rest.put(bad, "cd".repeat(32), new Uint8Array([1])), bad).rejects.toThrow(TypeError);
      await expect(rest.put("ab".repeat(32), bad, new Uint8Array([1])), bad).rejects.toThrow(TypeError);
      await expect(rest.list(bad), bad).rejects.toThrow(TypeError);
      await expect(rest.drop(bad), bad).rejects.toThrow(TypeError);
    }
    expect(tree(dir).every((path) => path.startsWith(dir))).toBe(true);
    expect(existsSync(join(dir, "..", "escape"))).toBe(false);
  });
});
