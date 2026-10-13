/**
 * Provider ciphertext rest laws.
 * INVARIANTS: CHUNK REST SEES HASHED SHELVES; WRAPS NEVER ENTER IT.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider, memoryProviderChunkRest, keyhiveLockboxShore } from "../src/index.js";
import { mintContentKey, bagLocatorOf, keyVersionIdOf, wrapLockbox } from "@lararium/mesh";

const bytes = (s: string) => new TextEncoder().encode(s);
async function stand(seed: number, chunkRest?: ReturnType<typeof memoryProviderChunkRest>) {
  const p = new KeyhiveProvider(); await p.init({ seed: new Uint8Array(32).fill(seed), eventStore: new InMemoryEventStore(), ...(chunkRest ? { chunkRest } : {}) }); return p;
}

describe("durable chunk rest follows the archive", () => {
  test("encryptContent writes through before a restored provider reseals", async () => {
    const rest = memoryProviderChunkRest(), writer = await stand(0x81, rest), bag = "lar:///provider/chunk-rest";
    const { docId } = await writer.registerBag(bag), plaintext = bytes("tracked chunk"), ciphertext = await writer.encryptContent(bag, plaintext), archive = await writer.exportArchive();
    const restored = new KeyhiveProvider(); await restored.init({ seed: new Uint8Array(32).fill(0x81), eventStore: new InMemoryEventStore(), archiveBytes: archive, chunkRest: rest }); restored.adoptBag(bag, docId);
    const rows = await restored.reSealBag(bag); expect(rows).toHaveLength(1); expect(await restored.decryptContent(bag, rows[0]!.ciphertext)).toEqual(plaintext);
    expect(await restored.decryptContent(bag, ciphertext)).toEqual(plaintext);
  });
  test("without the port an archive restore has no tracked chunks", async () => {
    const writer = await stand(0x82), bag = "lar:///provider/no-port", { docId } = await writer.registerBag(bag); await writer.encryptContent(bag, bytes("chunk"));
    const restored = new KeyhiveProvider(); await restored.init({ seed: new Uint8Array(32).fill(0x82), eventStore: new InMemoryEventStore(), archiveBytes: await writer.exportArchive() }); restored.adoptBag(bag, docId);
    expect(await restored.reSealBag(bag)).toEqual([]);
  });
});

describe("remint separates chunk shelves", () => {
  test("remint empties the departing document shelf", async () => {
    const rest = memoryProviderChunkRest(), p = await stand(0x83, rest), bag = "lar:///provider/remint"; await p.registerBag(bag); await p.encryptContent(bag, bytes("tracked"));
    expect(await p.reSealBag(bag)).toHaveLength(1); await p.remintBag(bag); expect(await p.reSealBag(bag)).toEqual([]);
  });
});

describe("the rest port receives no bag locator", () => {
  test("all rest calls use opaque shelves and shelves have 64 lowercase hex characters", async () => {
    const args: unknown[] = [], shelves: string[] = [], rows = new Map<string, { refHex: string; ciphertext: Uint8Array }[]>();
    const rest = { put: async (s: string, ref: string, ct: Uint8Array) => { args.push(s, ref, ct); shelves.push(s); rows.set(s, [...(rows.get(s) ?? []), { refHex: ref, ciphertext: ct }]); }, list: async (s: string) => { args.push(s); shelves.push(s); return rows.get(s) ?? []; }, drop: async (s: string) => { args.push(s); shelves.push(s); rows.delete(s); } };
    const p = await stand(0x84, rest), bag = "lar:///provider/private-long-url-fragment"; await p.registerBag(bag); await p.encryptContent(bag, bytes("c")); await p.reSealBag(bag); await p.remintBag(bag);
    expect(shelves.every(s => /^[0-9a-f]{64}$/.test(s))).toBe(true);
    expect(JSON.stringify(args).includes(bag)).toBe(false);
    for (let i = 0; i + 8 <= bag.length; i++) expect(JSON.stringify(args).includes(bag.slice(i, i + 9))).toBe(false);
  });
});

describe("lockbox wraps do not rest bag chunks", () => {
  test("wrapToReaders makes zero chunk rest calls", async () => {
    const calls: unknown[] = [], rest = { put: async (...a: unknown[]) => { calls.push(a); }, list: async (...a: unknown[]) => { calls.push(a); return []; }, drop: async (...a: unknown[]) => { calls.push(a); } };
    const f = await stand(0x85, rest), r = await stand(0x86); await f.receiveContactCard(await r.contactCard()); await r.receiveContactCard(await f.contactCard());
    const key = mintContentKey(), bagId = "lar:///lockbox/rest", payload = { bagId, locator: bagLocatorOf(key, bagId), keyVersion: keyVersionIdOf(key, bagId), key };
    await wrapLockbox({ payload, readers: [await r.vesselIdentifierHex()], shore: keyhiveLockboxShore([f]) }); expect(calls).toEqual([]);
  });
});
