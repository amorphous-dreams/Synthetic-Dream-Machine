import { placeSeed } from "./browser-place-seed.fixture.js";
/**
 * browser-place-kel.test.ts — the leaf's place KEL over REAL IndexedDB + WebCrypto.
 *
 * The browser founds its armed inception through the same mesh grammar the node does, reads the cold card back through the
 * same `PlaceFoundingCard` port, and reads heads through the one mesh fold.
 *   · RED: with no card seated the explicit door refuses `PlaceFoundingCardUnread` and lands nothing; a read-back that refuses
 *     lands nothing. CONTROL: the identity open with no card seated still founds the device key and no KEL.
 *   · POSITIVE: a seated card arms the chain (seq 0, committed next key, the device key as signer), the cold seed rests in
 *     no stored byte, and a rotation the card's key signs reads as the head through `readBrowserPlaceHead`; a fork refuses and
 *     an unrotated head reads unchanged.
 */
import { describe, test, expect, afterEach } from "vitest";
import {
  PlaceFoundingCardUnread, coldKeyCode, mintPlaceRotation, mintColdKey, placeSignerFromSeed, type PlaceKelEvent, type RandomProvider,
} from "@lararium/mesh";
import {
  foundBrowserPlaceKel, generateOrLoadBrowserVesselIdentity, loadBrowserPlaceKel, readBrowserPlaceHead,
  openVesselIdb, idbGet,
} from "../src/browser-vessel-identity.js";

let created = 0;
const opened = new Set<string>();
const idb = (): string => { const n = `lares:test-place-kel:${created++}:${Math.random().toString(36).slice(2)}`; opened.add(n); return n; };
const deleteIdb = (name: string): Promise<void> => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase(name);
  req.onsuccess = req.onerror = req.onblocked = () => resolve();
});
afterEach(async () => {
  for (const n of opened) await deleteIdb(n);
  opened.clear();
  localStorage.clear();
});

const entropy = (start: number): RandomProvider => {
  let n = start;
  return { getRandomValues<T extends Uint8Array<ArrayBuffer>>(a: T): T { for (let i = 0; i < a.length; i++) a[i] = n++ & 255; return a; }, randomUUID: () => "deterministic" };
};
const seatedCard = () => {
  const seen: { seed: Uint8Array } = { seed: new Uint8Array() };
  return { seen, card: { readBack: async (c: { seed: Uint8Array }) => { seen.seed = new Uint8Array(c.seed); } } };
};

describe("the browser place KEL", () => {
  test("with no card seated the door refuses by name and lands nothing; the identity open founds the key and no KEL", async () => {
    const name = idb();
    await generateOrLoadBrowserVesselIdentity(name);
    await expect(foundBrowserPlaceKel(name)).rejects.toBeInstanceOf(PlaceFoundingCardUnread);
    expect(await loadBrowserPlaceKel(name)).toBeNull();
    const refused = { readBack: async () => { throw new Error("the card read back otherwise"); } };
    await expect(foundBrowserPlaceKel(name, { placeFoundingCard: refused })).rejects.toThrow("read back otherwise");
    expect(await loadBrowserPlaceKel(name)).toBeNull();
  });

  test("a seated card arms the chain through the identity open, the cold seed rests nowhere, and the one fold reads the head", async () => {
    const name = idb();
    const { seen, card } = seatedCard();
    await generateOrLoadBrowserVesselIdentity(name, undefined, { placeFoundingCard: card, entropy: entropy(5) });
    const armed = await loadBrowserPlaceKel(name);
    expect(armed?.ok).toBe(true);
    if (!armed?.ok) return;
    const device = await placeSeed(name);
    expect(armed.seq).toBe(0);
    expect(armed.signerKey).toBe(placeSignerFromSeed(device).key);
    expect(armed.nextDigest).toMatch(/^[0-9a-f]{64}$/);

    const db = await openVesselIdb(name);
    const stored = JSON.stringify(await idbGet(db, "bootstrap", "place-kel"));
    db.close();
    const coldHex = Array.from(seen.seed, (b) => b.toString(16).padStart(2, "0")).join("");
    expect(coldHex).toHaveLength(64);
    expect(stored.includes(coldHex)).toBe(false);
    expect(JSON.stringify({ planted: coldHex }).includes(coldHex)).toBe(true);   // a known positive: the scan finds a planted seed
    expect(coldKeyCode(seen.seed)).toMatch(/^[0-9a-f-]+$/);

    // The unrotated head reads unchanged (control), then the card's key rotates and the same fold reads the new head.
    const held = await readBrowserPlaceHead(name, [], null);
    expect(held.ok && held.seq).toBe(0);
    const next = await mintColdKey(entropy(77));
    const rotation = mintPlaceRotation({ chain: armed.chain as PlaceKelEvent[], coldSeed: seen.seed, newSignerKey: placeSignerFromSeed(new Uint8Array(32).fill(9)).key, nextColdVerifyingKey: next.verifyingKey });
    const caught = await readBrowserPlaceHead(name, [rotation], held.ok ? { aid: held.aid, seq: held.seq, headDigest: held.headDigest } : null);
    expect(caught.ok && caught.seq).toBe(1);
    const other = mintPlaceRotation({ chain: armed.chain as PlaceKelEvent[], coldSeed: seen.seed, newSignerKey: placeSignerFromSeed(new Uint8Array(32).fill(10)).key, nextColdVerifyingKey: (await mintColdKey(entropy(99))).verifyingKey });
    const forked = await readBrowserPlaceHead(name, [rotation, other], null);
    expect(forked.ok ? null : forked.refusal).toBe("fork");
    // A rollback to the seq-0 head after seq 1 was accepted refuses.
    const rolled = await readBrowserPlaceHead(name, [], caught.ok ? { aid: caught.aid, seq: caught.seq, headDigest: caught.headDigest } : null);
    expect(rolled.ok ? null : rolled.refusal).toBe("rollback");
  });
});
