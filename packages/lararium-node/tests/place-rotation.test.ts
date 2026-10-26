import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, coldKeyFromSeed, mintColdKey, mintPlaceRotation, placeSignerFromSeed, type RandomProvider } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundDirect } from "./found-route.js";
import { loadPlaceKelChain, loadVesselSigningSeed, loadVesselVerifyingKey, reconcilePlaceRotation, rotatePlace } from "../src/node-vessel-identity.js";
import { larIdentityDir } from "../src/vessel-paths.js";

vi.setConfig({ testTimeout: 240_000 });
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function root() {
  const r = mkdtempSync(join(tmpdir(), "lar-place-rotation-"));
  cpSync(join(import.meta.dirname, "../../../genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r); return r;
}
function entropy(start: number): RandomProvider {
  let n = start;
  return { getRandomValues<T extends Uint8Array<ArrayBuffer>>(a: T): T { for (let i = 0; i < a.length; i++) a[i] = n++ & 255; return a; }, randomUUID: () => "deterministic" };
}
const at = (r: string) => ({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") });

describe("place rotation", () => {
  test("a read-back rotates twice and a fresh read sees each committed head", async () => {
    const r = root(); let card = new Uint8Array();
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); } } });
      const old = await loadVesselSigningSeed();
      let next = new Uint8Array();
      const one = await rotatePlace({ card, entropy: entropy(90), placeFoundingCard: { readBack: async (c) => { next = new Uint8Array(c.seed); } } });
      expect(one.seq).toBe(1);
      expect((await loadPlaceKelChain()).length).toBe(2);
      expect(await loadVesselVerifyingKey()).toBe(one.event.key);
      expect(await loadVesselSigningSeed()).not.toEqual(old);
      const two = await rotatePlace({ card: next, entropy: entropy(180), placeFoundingCard: { readBack: async () => {} } });
      expect(two.seq).toBe(2);
      expect((await loadPlaceKelChain()).length).toBe(3);
    });
  });

  test("wrong card and failed replacement read-back leave the head and both files whole", async () => {
    const r = root(); let card = new Uint8Array();
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); } } });
      const dir = larIdentityDir();
      const files = readdirSync(dir).filter((n) => n.startsWith(".vessel-key") || n.startsWith(".vessel-kel"));
      const before = files.map((n) => readFileSync(join(dir, n)));
      await expect(rotatePlace({ card: new Uint8Array(32).fill(9), entropy: entropy(90), placeFoundingCard: { readBack: async () => {} } })).rejects.toThrow("place-card-refused");
      await expect(rotatePlace({ card, entropy: entropy(90), placeFoundingCard: { readBack: async () => { throw new Error("read-back refused"); } } })).rejects.toThrow("read-back refused");
      expect(files.map((n) => readFileSync(join(dir, n)))).toEqual(before);
      expect((await loadPlaceKelChain()).length).toBe(1);
    });
  });

  /** A crash between the stage and the publish: the staged file stands, the chain and key file still name the old head. */
  async function stageOnly(card: Uint8Array, signerByte: number, cardRead: boolean) {
    const chain = await loadPlaceKelChain();
    const nextCold = await mintColdKey(entropy(signerByte));
    const signingKey = Buffer.from(new Uint8Array(32).fill(signerByte)).toString("hex");
    const event = mintPlaceRotation({ chain, coldSeed: card, newSignerKey: placeSignerFromSeed(new Uint8Array(32).fill(signerByte)).key, nextColdVerifyingKey: nextCold.verifyingKey });
    const path = join(larIdentityDir(), readdirSync(larIdentityDir()).find((n) => n.startsWith(".vessel-key"))!.replace(".vessel-key", ".vessel-rotating"));
    writeFileSync(path, canonicalJson(cardRead ? { event, signingKey, cardRead: true } : { event, signingKey }));
    return { path, event };
  }

  test("a staged rotation finishes on restart; a staged rotation of another head or without its card never publishes", async () => {
    const r = root(); let card = new Uint8Array();
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); } } });
      const unread = await stageOnly(card, 77, false);
      await expect(reconcilePlaceRotation()).rejects.toThrow("place-rotation-torn");
      await expect(rotatePlace({ card, entropy: entropy(90), placeFoundingCard: { readBack: async () => {} } })).rejects.toThrow("place-rotation-torn");
      expect((await loadPlaceKelChain().catch(() => [])).length).toBe(0);   // the torn stage refuses every read until it is cleared
      rmSync(unread.path);
      expect((await loadPlaceKelChain()).length).toBe(1);
      const staged = await stageOnly(card, 78, true);
      await reconcilePlaceRotation();                                         // the restart's reconcile finishes the publish
      expect(existsSync(staged.path)).toBe(false);
      expect((await loadPlaceKelChain()).length).toBe(2);
      expect(await loadVesselVerifyingKey()).toBe(staged.event.key);
      // a stage naming an event the chain already holds finishes idempotently
      writeFileSync(staged.path, canonicalJson({ event: staged.event, signingKey: Buffer.from(new Uint8Array(32).fill(78)).toString("hex"), cardRead: true }));
      await expect(reconcilePlaceRotation()).resolves.toBeUndefined();     
      expect(existsSync(staged.path)).toBe(false);
    });
  });

  test("a reused commitment refuses at the mint", async () => {
    const r = root(); let card = new Uint8Array(); let cold = "";
    await withLarRoot(r, async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async (c) => { card = new Uint8Array(c.seed); cold = c.verifyingKey; } } });
      const chain = await loadPlaceKelChain();
      const same = await coldKeyFromSeed(card);
      expect(() => mintPlaceRotation({ chain, coldSeed: card, newSignerKey: placeSignerFromSeed(new Uint8Array(32).fill(5)).key, nextColdVerifyingKey: same.verifyingKey })).toThrow();
      expect(cold).toBe(same.verifyingKey);
    });
  });
});
