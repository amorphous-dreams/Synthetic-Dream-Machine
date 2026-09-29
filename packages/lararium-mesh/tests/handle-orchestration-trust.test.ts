import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { resolveOwnHandleChain } from "../src/handle-orchestration.js";
import { writeHandleAnnounce } from "../src/handle-announce.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { signHandleCard, type HandleCard } from "../src/handle-card.js";
import { hex } from "../src/crypto.js";
import type { LarDoc } from "../src/base-doc.js";

const SEED = new Uint8Array(32).fill(42);
const OTHER = new Uint8Array(32).fill(43);
const RECOVERY = "ab".repeat(32);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);

function board(): LarDoc { return { schemaVersion: "0.1", tiddlers: {} }; }

async function rootCard(seed = SEED, glamour = "root"): Promise<HandleCard> {
  const did = `0x${await ed.getPublicKeyAsync(seed).then(hex)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, RECOVERY)];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null, fleetProof: null }, signer(seed));
}

async function childCard(root: HandleCard, glamour: string, seed = SEED, parent = root.actCid): Promise<HandleCard> {
  return signHandleCard({
    nym: root.nym, chain: root.chain, glamour, parents: [parent], standing: null, fleetProof: null,
  }, signer(seed));
}

describe("handle orchestration trust boundary", () => {
  test("resolves only a unique verified causal head", async () => {
    const root = await rootCard();
    const child = await childCard(root, "child");
    const doc = board();
    writeHandleAnnounce(doc, child);
    writeHandleAnnounce(doc, root);
    const chain = await resolveOwnHandleChain(doc, root.nym);
    expect(chain?.[0]?.prefix).toBe(root.nym);
  });

  test("a forged sibling, bad semantic CID, or bad signature never chooses a writer chain", async () => {
    const root = await rootCard();
    const child = await childCard(root, "child");
    const sibling = await childCard(root, "sibling");

    const fork = board();
    writeHandleAnnounce(fork, root); writeHandleAnnounce(fork, child); writeHandleAnnounce(fork, sibling);
    expect(await resolveOwnHandleChain(fork, root.nym)).toBeNull();

    const badCid = board();
    writeHandleAnnounce(badCid, root); writeHandleAnnounce(badCid, { ...child, actCid: "0".repeat(64) });
    expect(await resolveOwnHandleChain(badCid, root.nym)).toBeNull();

    const badSig = board();
    writeHandleAnnounce(badSig, root); writeHandleAnnounce(badSig, { ...child, sig: "00".repeat(64) });
    expect(await resolveOwnHandleChain(badSig, root.nym)).toBeNull();
  });

  test("a valid descendant without its grandparent stays unavailable", async () => {
    const root = await rootCard();
    const child = await childCard(root, "child", SEED, "f".repeat(64));
    const doc = board();
    writeHandleAnnounce(doc, child);
    expect(await resolveOwnHandleChain(doc, root.nym)).toBeNull();
  });

  test("a card carrying another nym's parent cannot settle the fold", async () => {
    const root = await rootCard();
    const foreign = await rootCard(OTHER, "foreign");
    const cross = await childCard(foreign, "cross", OTHER, root.actCid);
    const doc = board();
    writeHandleAnnounce(doc, foreign);
    writeHandleAnnounce(doc, cross);
    expect(await resolveOwnHandleChain(doc, foreign.nym)).toBeNull();
  });
});
