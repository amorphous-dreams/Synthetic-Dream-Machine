/**
 * who-face.test.ts — announce onto the per-Nexus WHO board, which sits at a derived address.
 *
 * Proven over a real Automerge Repo: an announced card is recognised off the board `whoBoardDocUrl`
 * names, and a different nexus names a DISTINCT board (island scoping). Provable in-process before any
 * node/relay HTTP.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import { announceToWhoFace } from "../src/who-face.js";
import { ingestAnnounceDoc } from "../src/handle-announce.js";
import { HandleBook } from "../src/handle-book.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { signHandleCard, type HandleCard } from "../src/handle-card.js";
import { whoBoardDocUrl, materializeSharedLarDoc } from "../src/deterministic-doc.js";
import { hex } from "../src/crypto.js";

const FASTJACK_SEED = new Uint8Array(32).fill(9);
const NEXUS = "abcdef0123456789";
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const rawPub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const RECOVERY = "ab".repeat(32);
function chainOf(pub: string): HandleKelEvent[] { const d = `0x${pub}`; return [mintHandleInception(d, d, RECOVERY, `hkeynext-${"cd".repeat(32)}`)]; }
/** The identity a recogniser keys on — the handle-KEL PREFIX (the nym retired onto the chain). */
const pubOf  = async (seed: Uint8Array): Promise<string> => chainOf(await rawPub(seed))[0]!.prefix;

async function publish(seed: Uint8Array, glamour: string): Promise<HandleCard> {
  const chain = chainOf(await rawPub(seed));
  return signHandleCard({
    nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null,
  }, signer(seed));
}

describe("announce onto the per-Nexus WHO board at its derived address", () => {
  test("a card announced onto the derived board is recognised off it", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const who = await materializeSharedLarDoc(repo, whoBoardDocUrl(NEXUS), "board:who-face");

    const card = await publish(FASTJACK_SEED, "FastJack");
    announceToWhoFace(who, card);

    const book = new HandleBook();
    await ingestAnnounceDoc(book, who.doc()!);
    expect(book.get(await pubOf(FASTJACK_SEED))?.card.glamour).toBe("FastJack");
  });

  test("a different Nexus names a DISTINCT board — the WHO plane shards per island", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const boardA = await materializeSharedLarDoc(repo, whoBoardDocUrl("nexusA"), "board:who-face");
    const boardB = await materializeSharedLarDoc(repo, whoBoardDocUrl("nexusB"), "board:who-face");
    expect(boardB.url).not.toBe(boardA.url);
  });
});
