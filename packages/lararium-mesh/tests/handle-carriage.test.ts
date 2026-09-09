/**
 * handle-carriage.test.ts — the CARD-ARRIVAL front door (C3): decode a carried HandleCard so a follow can
 * admit an unmet nym WITHOUT the CLI's `--card <file>`.
 *
 * Proven:
 *   · round-trip — toHandleCardCarriage → parseHandleCardCarriage returns the SAME card (a `#card=<base64url>`
 *     fragment, a bare token, and a whitespace-wrapped paste all decode),
 *   · the front door — decode a carriage → HandleBook.ingest (TOFU) → composeFollow WITHOUT a card succeeds
 *     (the nym is now recognised), where before the ingest the same follow REFUSES (unknown-nym),
 *   · WITHHOLD-not-forge — a garbled / wrong-domain / absent carriage decodes to null (never a throw),
 *   · the decoder only SHAPES — a tampered signature still decodes (the trust gate is `ingest`, not the parser).
 */
import { describe, test, expect } from "vitest";
import {
  HandleBook, signHandleCard, ed25519SignerFromSeed,
  parseHandleCardCarriage, toHandleCardCarriage, carriageMode, fitsQrCarriage, QR_CARRIAGE_MAX_EVENTS,
  composeFollow, FollowRefused,
  type CircleStore, type HandleCard,
} from "../src/index.js";
import { mintHandleInception, mintHandleRotation, type HandleKelEvent } from "../src/handle-kel.js";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";

function spyCircleStore(): CircleStore {
  const map = new Map<string, Set<string>>();
  return {
    add(circleId, nym) { (map.get(circleId) ?? map.set(circleId, new Set()).get(circleId)!).add(nym); },
    remove(circleId, nym) { map.get(circleId)?.delete(nym); },
    members(circleId) { return [...(map.get(circleId) ?? [])].sort(); },
    circles() { return [...map.keys()].sort(); },
  };
}

const RECOVERY = "ab".repeat(32);
function chainOf(pub: string): HandleKelEvent[] { const d = `0x${pub}`; return [mintHandleInception(d, d, RECOVERY)]; }

async function makeCard(seed: Uint8Array, glamour: string): Promise<{ nym: string; card: HandleCard }> {
  const chain = chainOf(await ed.getPublicKeyAsync(seed).then(hex));
  const nym = chain[0]!.prefix;   // the recognised identity is the handle-KEL prefix, not the raw key
  const card = await signHandleCard(
    { nym, chain, glamour, version: 1, prev: null, expiry: Date.now() + 86_400_000, standing: null },
    ed25519SignerFromSeed(seed),
  );
  return { nym, card };
}

describe("handle-carriage — the card-arrival front door", () => {
  test("round-trips a card through the carriage form (fragment, bare token, wrapped paste)", async () => {
    const { card } = await makeCard(new Uint8Array(32).fill(7), "Eris");
    const carriage = toHandleCardCarriage(card);
    expect(carriage.startsWith("#card=")).toBe(true);

    expect(parseHandleCardCarriage(carriage)).toEqual(card);                    // the `#card=…` fragment
    const bare = carriage.slice("#card=".length);
    expect(parseHandleCardCarriage(bare)).toEqual(card);                        // a bare base64url token
    expect(parseHandleCardCarriage(`  ${carriage}\n`)).toEqual(card);          // a whitespace-wrapped paste
  });

  test("THE FRONT DOOR: decode → ingest → a follow with NO card succeeds (before ingest it refuses)", async () => {
    const book = new HandleBook();
    const circles = spyCircleStore();
    const { nym, card } = await makeCard(new Uint8Array(32).fill(11), "Discordia");

    // Before the card arrives, the nym is UNMET → a follow with no card fails closed.
    await expect(composeFollow({ book, circles, nym, circleId: "following" }))
      .rejects.toBeInstanceOf(FollowRefused);

    // The card arrives by paste (`#card=…`) — decode + ingest (TOFU) into the LOCAL book.
    const decoded = parseHandleCardCarriage(toHandleCardCarriage(card));
    expect(decoded).not.toBeNull();
    const verdict = await book.ingest(decoded!);
    expect(verdict.ok).toBe(true);

    // NOW the follow needs NO card — the nym is recognised.
    const result = await composeFollow({ book, circles, nym, circleId: "following" });
    expect(result.recognized).toBe(true);
    expect(result.federated).toBe(false);       // still LOCAL — the card arrival crossed no wire
    expect(circles.members("following")).toEqual([nym]);
  });

  test("WITHHOLD-not-forge: a garbled / wrong-domain / absent carriage decodes to null (never a throw)", async () => {
    expect(parseHandleCardCarriage("")).toBeNull();
    expect(parseHandleCardCarriage("#card=@@@not-base64@@@")).toBeNull();       // decodes to non-JSON
    expect(parseHandleCardCarriage("#admit=deadbeef")).toBeNull();             // a different carriage key
    // A well-formed base64url of the WRONG domain is refused at the shape gate.
    const wrongDomain = toHandleCardCarriage({ ...(await makeCard(new Uint8Array(32).fill(5), "x")).card, kind: "not-a-handle-card" as HandleCard["kind"] });
    expect(parseHandleCardCarriage(wrongDomain)).toBeNull();
  });

  test("the parser only SHAPES — a tampered card still decodes; the trust gate is ingest", async () => {
    const { card } = await makeCard(new Uint8Array(32).fill(13), "Aneris");
    const tampered = { ...card, sig: "00".repeat(64) };                        // a forged signature
    const decoded = parseHandleCardCarriage(toHandleCardCarriage(tampered));
    expect(decoded).not.toBeNull();                                            // the parser shapes, never verifies
    // The book is the trust gate — it REJECTS the forged signature on ingest.
    const verdict = await new HandleBook().ingest(decoded!);
    expect(verdict.ok).toBe(false);
  });
});

describe("★ THE QR CARRIAGE CEILING — a NAMED boundary, not one discovered at the shrine ★", () => {
  // A self-owned N-event chain: inception, then (N-1) rotations under the sole owner (the handle key itself).
  async function chainOfLength(seed: Uint8Array, n: number): Promise<HandleKelEvent[]> {
    const pub = await ed.getPublicKeyAsync(seed).then(hex);
    const did = `0x${pub}`;
    const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32))];
    for (let i = 1; i < n; i++) {
      const rot = await mintHandleRotation({
        head: chain[chain.length - 1]!, freshHandleKeyDid: did,
        ownerAuthMemberPrefix: did, ownerHeadOpKeyDid: did,
        sign: (b) => ed.signAsync(b, seed).then(hex),
      });
      if (!rot.ok) throw new Error(rot.reason);
      chain.push(rot.event);
    }
    return chain;
  }
  async function cardWithChain(seed: Uint8Array, n: number): Promise<HandleCard> {
    const chain = await chainOfLength(seed, n);
    return signHandleCard(
      { nym: chain[0]!.prefix, chain, glamour: "Eris", version: 1, prev: null, expiry: Date.now() + 86_400_000, standing: null },
      ed25519SignerFromSeed(seed),
    );
  }

  test("the ceiling is a DECLARED constant (2), never a magic number in a branch", () => {
    expect(QR_CARRIAGE_MAX_EVENTS).toBe(2);
  });

  test("a card AT or UNDER the ceiling rides a QR; one PAST it is paste-or-file", async () => {
    const SEED = new Uint8Array(32).fill(19);
    const inception = await cardWithChain(SEED, 1);
    const rotated   = await cardWithChain(SEED, 2);   // at the ceiling
    const grown     = await cardWithChain(SEED, 3);   // one past it

    expect(carriageMode(inception)).toBe("qr");
    expect(fitsQrCarriage(inception)).toBe(true);
    expect(carriageMode(rotated)).toBe("qr");
    expect(fitsQrCarriage(rotated)).toBe(true);
    expect(carriageMode(grown)).toBe("paste-or-file");
    expect(fitsQrCarriage(grown)).toBe(false);

    // …and past the ceiling the carriage STILL round-trips verbatim — only the printed QR stops being right.
    expect(parseHandleCardCarriage(toHandleCardCarriage(grown))).toEqual(grown);
  });
});
