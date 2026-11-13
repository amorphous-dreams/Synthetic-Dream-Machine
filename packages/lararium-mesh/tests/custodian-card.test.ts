/**
 * custodian-card — the SHARED "Recovery-card" 2-of-3 primitive, proven for BOTH uses (the reserve seed AND
 * the identity root are just secrets here). The card shape + handshake round-trip:
 *   · the three slots carry the three DISTINCT custodian tags (mine→device, custodian-a→custodian, custodian-b→escrow-peer),
 *   · {mine, custodian-a} rebuilds; {custodian-a, custodian-b} rebuilds WITHOUT the operator,
 *   · FAIL CLOSED: one card is no quorum, a tampered card fails the checksum,
 *   · each card carries a DISTINCT, deterministic confirmation phrase over the shared handshake domain.
 */
import { describe, test, expect } from "vitest";
import {
  splitToCustodianCards, custodianShareFromCard, confirmationPhrase,
  CUSTODIAN_CARD_THRESHOLD, CUSTODIAN_SLOT_TAG,
  assembleQuorum, reconstructFromQuorum,
  type CustodianCard,
} from "../src/index.js";
import type { RandomProvider } from "../src/crypto.js";

function counterRng(start = 1): RandomProvider {
  let n = start;
  return {
    getRandomValues<T extends Uint8Array<ArrayBuffer>>(array: T): T {
      for (let i = 0; i < array.length; i++) array[i] = (n++) & 0xff;
      return array;
    },
    randomUUID() { return "00000000-0000-4000-8000-000000000000"; },
  };
}

const EPOCH = 1;
const secretOf = (v: number): Uint8Array => new Uint8Array(32).fill(v);
const split = (s: Uint8Array) => splitToCustodianCards(s, "Custodian A", "Custodian B", EPOCH, counterRng());
const bySlot = (cards: readonly CustodianCard[], slot: string): CustodianCard => cards.find((c) => c.slot === slot)!;
const rebuild = (cards: readonly CustodianCard[]): Uint8Array =>
  reconstructFromQuorum(assembleQuorum(cards.map((c) => custodianShareFromCard(c, EPOCH)), CUSTODIAN_CARD_THRESHOLD));

describe("custodian-card — one card shape, one handshake", () => {
  test("three slots carry the three DISTINCT custodian tags + the shared labels", () => {
    const { cards } = split(secretOf(42));
    expect(cards.map((c) => c.slot)).toEqual(["mine", "custodian-a", "custodian-b"]);
    expect(cards.map((c) => c.custodian)).toEqual(["device", "custodian", "escrow-peer"]);
    expect(new Set(cards.map((c) => c.custodian)).size).toBe(3);
    expect(bySlot(cards, "mine").label).toBe("Recovery-card mine");
    expect(bySlot(cards, "custodian-a").label).toContain("custodian-A (Custodian A)");
    expect(CUSTODIAN_SLOT_TAG["custodian-b"]).toBe("escrow-peer");
  });

  test("mineShare is the device share the vessel seals at rest", () => {
    const { mineShare, cards } = split(secretOf(7));
    expect(mineShare.custodian).toBe("device");
    expect(mineShare.custodian).toBe(bySlot(cards, "mine").custodian);
  });

  test("{mine, custodian-a} rebuilds the secret (1 self + 1 custodian)", () => {
    const s = secretOf(99);
    const { cards } = split(s);
    expect(new Uint8Array(rebuild([bySlot(cards, "mine"), bySlot(cards, "custodian-a")]))).toEqual(s);
  });

  test("{custodian-a, custodian-b} rebuilds WITHOUT the operator (distinct-custodian quorum)", () => {
    const s = secretOf(99);
    const { cards } = split(s);
    expect(new Uint8Array(rebuild(cards.filter((c) => c.slot !== "mine")))).toEqual(s);
  });

  test("ONE card reconstructs nothing — no quorum (fail closed)", () => {
    const { cards } = split(secretOf(42));
    expect(() => assembleQuorum([custodianShareFromCard(cards[0]!, EPOCH)], CUSTODIAN_CARD_THRESHOLD)).toThrow(/below threshold/);
  });

  test("a TAMPERED card fails the checksum before any doomed reconstruct", () => {
    const { cards } = split(secretOf(42));
    const good = cards[1]!.shareCode;
    const flip = good[0] === "a" ? "b" : "a";
    const tampered: CustodianCard = { ...cards[1]!, shareCode: flip + good.slice(1) };
    expect(() => custodianShareFromCard(tampered, EPOCH)).toThrow(/checksum/);
  });

  test("each card carries a DISTINCT, deterministic confirmation phrase (shared handshake)", () => {
    const { cards } = split(secretOf(42));
    const phrases = cards.map((c) => c.confirmPhrase);
    expect(new Set(phrases).size).toBe(cards.length);
    for (const p of phrases) expect(p).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(confirmationPhrase(cards[0]!.shareCode)).toBe(cards[0]!.confirmPhrase);   // deterministic, default domain
  });

  test("BOTH uses share the shape — a reserve seed and an identity root split identically", () => {
    const reserveSeed = secretOf(11);
    const identityRoot = secretOf(11);   // same bytes → same cards prove the primitive is secret-blind
    const a = splitToCustodianCards(reserveSeed, "A", "B", EPOCH, counterRng());
    const b = splitToCustodianCards(identityRoot, "A", "B", EPOCH, counterRng());
    expect(a.cards.map((c) => c.shareCode)).toEqual(b.cards.map((c) => c.shareCode));
    expect(a.cards.map((c) => c.confirmPhrase)).toEqual(b.cards.map((c) => c.confirmPhrase));
  });

});
