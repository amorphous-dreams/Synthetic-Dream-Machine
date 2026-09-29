import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { signHandleCard, verifyHandleCard, handleCardId, foldHandleCards, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { hex } from "../src/crypto.js";

const SEED = new Uint8Array(32).fill(9);
const OTHER = new Uint8Array(32).fill(21);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const RECOVERY = "ab".repeat(32);

async function chain(seed = SEED): Promise<HandleKelEvent[]> {
  const did = `0x${await pub(seed)}`;
  return [mintHandleInception(did, did, RECOVERY)];
}
async function publish(glamour: string, parents: readonly string[] = [], seed = SEED, over: Partial<HandleCard> = {}): Promise<HandleCard> {
  const c = await chain(seed);
  return signHandleCard({ nym: c[0]!.prefix, chain: c, glamour, parents, standing: null, fleetProof: null, ...over }, signer(seed));
}

describe("causal self-certifying HandleCard", () => {
  test("genesis act verifies and has no scalar or wall-clock authority", async () => {
    const card = await publish("FastJack");
    expect((await verifyHandleCard(card)).ok).toBe(true);
    expect(card.parents).toEqual([]);
    expect("version" in card).toBe(false);
    expect("prev" in card).toBe(false);
    expect("expiry" in card).toBe(false);
  });

  test("parents canonicalize and define the semantic act", async () => {
    const a = "a".repeat(64), b = "b".repeat(64);
    const c = await chain();
    const x = await signHandleCard({ nym: c[0]!.prefix, chain: c, glamour: "same", parents: [b, a, b], standing: null, fleetProof: null }, signer(SEED));
    const y = await signHandleCard({ nym: c[0]!.prefix, chain: c, glamour: "same", parents: [a, b], standing: null, fleetProof: null }, signer(SEED));
    expect(x.parents).toEqual([a, b]);
    expect(x.actCid).toBe(y.actCid);
    expect(x.sig).toBe(y.sig);
  });

  test("descendant verifies, while missing parent is unavailable", async () => {
    const root = await publish("root");
    const child = await publish("child", [await handleCardId(root)]);
    expect((await verifyHandleCard(child)).ok).toBe(true);
    expect(await foldHandleCards([child])).toBe("unavailable");
    expect(await foldHandleCards([root, child])).toBe("held");
  });

  test("concurrent heads are unsettled independent of arrival order", async () => {
    const root = await publish("root");
    const id = await handleCardId(root);
    const a = await publish("raise", [id]);
    const b = await publish("lower", [id]);
    expect(await foldHandleCards([root, a, b])).toBe("unsettled");
    expect(await foldHandleCards([b, a, root])).toBe("unsettled");
  });

  test("causal fold rejects cross-nym and self-parent edges", async () => {
    const root = await publish("root");
    const foreign = await publish("foreign", [], OTHER);
    const crossNym = await publish("cross", [await handleCardId(root)], OTHER);
    expect(await foldHandleCards([root, crossNym])).toBe("rejected");
    expect(await foldHandleCards([root, { ...foreign, parents: [foreign.actCid] }])).toBe("rejected");
  });

  test("forged semantic identity, signature, and foreign publisher fail closed", async () => {
    const card = await publish("FastJack");
    expect((await verifyHandleCard({ ...card, actCid: "0".repeat(64) })).reject).toBe("rejected");
    expect((await verifyHandleCard({ ...card, glamour: "forged" })).reject).toBe("rejected");
    const foreign = await publish("FastJack", [], OTHER);
    expect((await verifyHandleCard(foreign)).ok).toBe(true);
    expect(foreign.nym).not.toBe(card.nym);
  });

  test("KEL chain remains a separate integrity fence", async () => {
    const card = await publish("FastJack");
    const broken = { ...card, chain: [] };
    expect((await verifyHandleCard(broken)).reject).toBe("malformed");
  });
});
