/**
 * handle-card.test.ts — publish a face, recognise it, and prove the vault never leaks.
 *
 * The nym RETIRED off a bare key onto the handle-KEL chain (identity-classes#the-handle-chain). So a card now
 * proves four MORE things beside its old four: it verifies SELF-CONTAINED against its carried chain (Tier 1, no
 * board), a BURNED Handle's card refuses (recognition ends at the burn), a rotated head still verifies while a
 * SUPERSEDED presenter refuses at the strict tier, and the verdict's TIER keeps a self-contained pass from ever
 * reading as an owner-head-checked one.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  signHandleCard, verifyHandleCard, recognizeHandle, acceptHandleUpdate, handleCardId,
  HANDLE_CARD_DOMAIN, type HandleCard,
} from "../src/handle-card.js";
import {
  mintHandleInception, mintHandleRotation, mintHandleBurn, type HandleKelEvent, type OwnerHeadResolver,
} from "../src/handle-kel.js";
import { hex } from "../src/crypto.js";

/** FastJack and Dodger — two handles the same human holds, and MUST stay unlinkable. Fixed seeds. */
const FASTJACK_SEED = new Uint8Array(32).fill(9);
const DODGER_SEED   = new Uint8Array(32).fill(21);

const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf  = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

/** An opaque non-empty recovery digest — Tier 1 folds it into the prefix and never resolves it. */
const RECOVERY = "ab".repeat(32);

/** The 1-of-1 SELF-OWNED inception chain a personal face founds — the handle key is its own sole owner. */
function chainOf(pubHex: string): HandleKelEvent[] {
  const did = `0x${pubHex}`;
  return [mintHandleInception(did, did, RECOVERY)];
}
/** A seed's STABLE nym — its handle-KEL prefix, the identifier a petname points at (fixed across rotations). */
const nymOf = async (seed: Uint8Array): Promise<string> => chainOf(await pubOf(seed))[0]!.prefix;

async function publish(seed: Uint8Array, glamour: string, over: Partial<HandleCard> = {}): Promise<HandleCard> {
  const chain = over.chain ? [...over.chain] : chainOf(await pubOf(seed));
  return signHandleCard({
    nym: chain[0]!.prefix, chain, glamour, version: 1, prev: null,
    expiry: 4_000_000_000_000, standing: null, ...over,
  }, signer(seed));
}

describe("recognition is SELF-CONTAINED — the card verifies against its own chain (Tier 1, no board)", () => {
  test("a card verifies against its chain's head key, with no registry consulted — and reports Tier 1", async () => {
    const card = await publish(FASTJACK_SEED, "FastJack");
    const v = await verifyHandleCard(card);
    expect(v.ok).toBe(true);
    expect(v.nym).toBe(await nymOf(FASTJACK_SEED));       // the identifier IS the stable prefix
    expect(v.headKey).toBe(`0x${await pubOf(FASTJACK_SEED)}`);   // …and it names the current head key
    expect(v.tier).toBe(1);                              // a self-contained pass, honestly labelled
  });

  test("a card signed by the WRONG key certifies nothing — it names FastJack's chain but Dodger signed it", async () => {
    const fjChain = chainOf(await pubOf(FASTJACK_SEED));
    // craft a card that CLAIMS FastJack's chain/prefix but is signed by Dodger's seed
    const forged = await signHandleCard({
      nym: fjChain[0]!.prefix, chain: fjChain, glamour: "Not-FastJack", version: 1, prev: null, expiry: 4e12, standing: null,
    }, signer(DODGER_SEED));
    const v = await verifyHandleCard(forged);
    expect(v).toEqual({ ok: false, reject: "bad-signature" });
  });

  test("a rejection NAMES itself — a recogniser must know forgery from typo from lapse from burial", async () => {
    const card = await publish(FASTJACK_SEED, "FastJack");
    expect((await verifyHandleCard({ ...card, kind: "nostr" as never })).reject).toBe("wrong-domain");
    expect((await verifyHandleCard({ ...card, nym: "xyz" })).reject).toBe("malformed");
    expect((await verifyHandleCard({ ...card, chain: [] })).reject).toBe("malformed");
    expect((await verifyHandleCard({ ...card, glamour: "tampered" })).reject).toBe("bad-signature");
  });

  test("the presented nym MUST be the chain's own prefix — a swapped name refuses as nym-mismatch", async () => {
    const card    = await publish(FASTJACK_SEED, "FastJack");
    const strayer = await nymOf(DODGER_SEED);   // a well-shaped handle-prefix, but not THIS chain's
    // re-sign so the sig is valid; only the nym↔chain binding is broken
    const swapped = await signHandleCard({ ...card, nym: strayer } as Omit<HandleCard, "kind" | "sig">, signer(FASTJACK_SEED));
    expect((await verifyHandleCard(swapped)).reject).toBe("nym-mismatch");
  });
});

describe("★ a BURNED Handle's card refuses — recognition ENDS at the burn ★", () => {
  test("a self-burned chain seats no head, and its card refuses whatever the signature says", async () => {
    const pub   = await pubOf(FASTJACK_SEED);
    const chain = chainOf(pub);
    const burn  = await mintHandleBurn({ head: chain[0]!, sign: signer(FASTJACK_SEED) });   // the seated key buries its own name
    expect(burn.ok).toBe(true);
    const burnedChain = [...chain, (burn as { event: HandleKelEvent }).event];
    // a card carrying the burned chain — even freshly, honestly signed — refuses: the burn is terminal
    const card = await signHandleCard(
      { nym: chain[0]!.prefix, chain: burnedChain, glamour: "FastJack", version: 2, prev: null, expiry: 4e12, standing: null },
      signer(FASTJACK_SEED),
    );
    expect((await verifyHandleCard(card)).reject).toBe("burned");
    // and the strict tier agrees — a buried name is buried at every tier
    const resolver: OwnerHeadResolver = async () => true;
    expect((await verifyHandleCard(card, undefined, resolver)).reject).toBe("burned");
  });
});

describe("★ a rotated head verifies at Tier 1; a SUPERSEDED presenter refuses at Tier 2 ★", () => {
  const OWNER_SEED = new Uint8Array(32).fill(50);
  const FRESH_SEED = new Uint8Array(32).fill(77);
  const OWNER_PREFIX = "persona-owner-aid-1";   // an opaque persona AID — Tier 1 checks it structurally, Tier 2 resolves it

  async function rotatedCard(glamour: string): Promise<{ card: HandleCard; ownerKeyDid: string; freshKeyDid: string }> {
    const ownerKeyDid = `0x${await pubOf(OWNER_SEED)}`;
    const freshKeyDid = `0x${await pubOf(FRESH_SEED)}`;
    const inception   = mintHandleInception(`0x${await pubOf(FASTJACK_SEED)}`, OWNER_PREFIX, RECOVERY);
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: freshKeyDid,
      ownerAuthMemberPrefix: OWNER_PREFIX, ownerHeadOpKeyDid: ownerKeyDid, sign: signer(OWNER_SEED),
    });
    expect(rot.ok).toBe(true);
    const chain = [inception, (rot as { event: HandleKelEvent }).event];
    // the card is signed by the CURRENT head — the FRESH key the rotation seated, not the inception key
    const card = await signHandleCard(
      { nym: inception.prefix, chain, glamour, version: 1, prev: null, expiry: 4e12, standing: null },
      signer(FRESH_SEED),
    );
    return { card, ownerKeyDid, freshKeyDid };
  }

  test("Tier 1 accepts the rotated card and names the FRESH head key", async () => {
    const { card, freshKeyDid } = await rotatedCard("FastJack rotated");
    const v = await verifyHandleCard(card);
    expect(v.ok).toBe(true);
    expect(v.tier).toBe(1);
    expect(v.headKey).toBe(freshKeyDid);   // the rotating key moved; recognition followed it
  });

  test("Tier 2 accepts when the presenter STILL stands as its member's head", async () => {
    const { card, ownerKeyDid } = await rotatedCard("FastJack rotated");
    const stands: OwnerHeadResolver = async (member, key) => member === OWNER_PREFIX && key === ownerKeyDid;
    const v = await verifyHandleCard(card, undefined, stands);
    expect(v.ok).toBe(true);
    expect(v.tier).toBe(2);                 // an owner-head-CHECKED pass, distinct from Tier 1
  });

  test("Tier 2 REFUSES when the presenter's key is SUPERSEDED — the strict walk catches what Tier 1 cannot", async () => {
    const { card } = await rotatedCard("FastJack rotated");
    const superseded: OwnerHeadResolver = async () => false;   // the owner key no longer stands as that member's head
    expect((await verifyHandleCard(card)).ok).toBe(true);      // Tier 1 still passes — it never asked the board
    expect((await verifyHandleCard(card, undefined, superseded)).reject).toBe("owner-head-refused");
  });
});

describe("★ CardVerdict distinguishes Tier 1 from Tier 2 — a self-contained pass never masquerades ★", () => {
  test("no resolver → tier 1; a resolver → tier 2; the axis rides apart from ok/reject", async () => {
    const card = await publish(FASTJACK_SEED, "FastJack");
    const t1 = await verifyHandleCard(card);
    expect(t1).toMatchObject({ ok: true, tier: 1 });
    const resolver: OwnerHeadResolver = async () => true;   // an inception-only chain has no presentation to resolve
    const t2 = await verifyHandleCard(card, undefined, resolver);
    expect(t2).toMatchObject({ ok: true, tier: 2 });
    // the two verdicts agree on the identity but NOT on the assurance — a reader cannot read t1 as board-checked
    expect(t1.nym).toBe(t2.nym);
    expect(t1.tier).not.toBe(t2.tier);
  });
});

describe("a recogniser knows the handle AGAIN — persistence across encounters", () => {
  test("the petname check admits the known prefix and refuses a stranger", async () => {
    const fjNym  = await nymOf(FASTJACK_SEED);
    const fjCard = await publish(FASTJACK_SEED, "FastJack v2", { version: 2 });
    const stranger = await publish(DODGER_SEED, "FastJack");   // same glamour, different chain

    expect(await recognizeHandle(fjCard, fjNym)).toBe(true);
    // the GLAMOUR is not the identity — a stranger wearing the name is not recognised
    expect(await recognizeHandle(stranger, fjNym)).toBe(false);
  });

  test("recognition rests on the CHAIN, never the display name — impersonation by name fails", async () => {
    const impostor = await publish(DODGER_SEED, "FastJack");   // wears the famous glamour
    const v = await verifyHandleCard(impostor);
    expect(v.ok).toBe(true);                                    // the impostor's OWN card is valid
    expect(v.nym).not.toBe(await nymOf(FASTJACK_SEED));         // …but it is a different chain, so not FastJack
  });
});

describe("the lease + lineage — monotone, self-staling, followable", () => {
  test("a stale card is refused against the local clock — and only then", async () => {
    const NOW = 1_000_000;
    const fresh = await publish(FASTJACK_SEED, "FastJack", { expiry: NOW + 10_000 });
    const stale = await publish(FASTJACK_SEED, "FastJack", { expiry: NOW - 10_000 });
    expect((await verifyHandleCard(fresh, NOW)).ok).toBe(true);
    expect((await verifyHandleCard(stale, NOW)).reject).toBe("expired");
    // …but WITHOUT a clock, a stale-but-signed card still verifies as a last-known face (the recogniser's call)
    expect((await verifyHandleCard(stale)).ok).toBe(true);
  });

  test("re-leasing keeps the SAME card identity — the lineage survives heartbeats", async () => {
    // expiry rides OUTSIDE the signed identity, so a lease renewal is the same face, not a new one.
    const chain = chainOf(await pubOf(FASTJACK_SEED));
    const base = { nym: chain[0]!.prefix, chain, glamour: "FastJack", version: 3,
                   prev: null as string | null, standing: null as string | null, fleetProof: null };
    const a = await handleCardId({ ...base, kind: HANDLE_CARD_DOMAIN, expiry: 1000 });
    const b = await handleCardId({ ...base, kind: HANDLE_CARD_DOMAIN, expiry: 9999 });
    expect(a).toBe(b);
  });

  test("a card links to its predecessor — a recogniser can walk one face's history", async () => {
    const v1 = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v1id = await handleCardId(v1);
    const v2 = await publish(FASTJACK_SEED, "FastJack the Healer", { version: 2, prev: v1id });
    expect(v2.prev).toBe(v1id);
    expect((await verifyHandleCard(v2)).ok).toBe(true);
  });
});

describe("the ANNOUNCE reader rule — accept the newer face, refuse a rollback or a fork", () => {
  test("first recognition: with nothing held, the rule reduces to self-cert + the nym match", async () => {
    const nym = await nymOf(FASTJACK_SEED);
    const v1  = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    expect((await acceptHandleUpdate(v1, { expectedNym: nym })).ok).toBe(true);
    // a card naming a DIFFERENT chain is a stranger, never an update — however well it certifies itself
    const stranger = await publish(DODGER_SEED, "FastJack");
    expect((await acceptHandleUpdate(stranger, { expectedNym: nym })).reject).toBe("wrong-nym");
  });

  test("a fresh version supersedes; a stale one is refused as a rollback", async () => {
    const nym = await nymOf(FASTJACK_SEED);
    const v1  = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v1id = await handleCardId(v1);
    const v2  = await publish(FASTJACK_SEED, "FastJack the Healer", { version: 2, prev: v1id });
    // holding v1 (high-water 1), v2 links it and bumps the counter — accepted
    expect((await acceptHandleUpdate(v2, { expectedNym: nym, highWaterVersion: 1, lastCardId: v1id })).ok).toBe(true);
    // a copy of v1 re-arriving after v2 tries to roll the Handle back — refused
    expect((await acceptHandleUpdate(v1, { expectedNym: nym, highWaterVersion: 2, lastCardId: v1id })).reject).toBe("rollback");
  });

  test("re-delivering the CURRENT card is idempotent (gossip/merge replays it) — accepted, not a fork", async () => {
    const nym = await nymOf(FASTJACK_SEED);
    const v1  = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v1id = await handleCardId(v1);
    const v2  = await publish(FASTJACK_SEED, "FastJack v2", { version: 2, prev: v1id });
    const v2id = await handleCardId(v2);
    // holding v2 (high-water 2, last id = v2id), the SAME v2 arrives again — idempotent, accepted
    expect((await acceptHandleUpdate(v2, { expectedNym: nym, highWaterVersion: 2, lastCardId: v2id })).ok).toBe(true);
    // a DIFFERENT card at the same version (equivocation) is still a lineage break
    const twin = await publish(FASTJACK_SEED, "FastJack twin", { version: 2, prev: v1id });
    expect((await acceptHandleUpdate(twin, { expectedNym: nym, highWaterVersion: 2, lastCardId: v2id })).reject).toBe("lineage-break");
  });

  test("a card whose prev fails to link the last held card is a fork — refused as a lineage break", async () => {
    const nym = await nymOf(FASTJACK_SEED);
    const v1  = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v1id = await handleCardId(v1);
    const forkV2 = await publish(FASTJACK_SEED, "FastJack forked", { version: 2, prev: "0".repeat(64) });
    expect((await acceptHandleUpdate(forkV2, { expectedNym: nym, highWaterVersion: 1, lastCardId: v1id })).reject).toBe("lineage-break");
  });

  test("the reader rule still honours the local-clock lease — a stale update is refused before its lineage", async () => {
    const NOW = 1_000_000;
    const nym = await nymOf(FASTJACK_SEED);
    const stale = await publish(FASTJACK_SEED, "FastJack", { version: 5, expiry: NOW - 1 });
    expect((await acceptHandleUpdate(stale, { expectedNym: nym, now: NOW })).reject).toBe("expired");
  });
});

describe("★ UNLINKABILITY — publish one face, reveal none of the others ★", () => {
  test("FastJack's card carries nothing that reaches Dodger or the vault", async () => {
    const fj = await publish(FASTJACK_SEED, "FastJack", { standing: "cid-of-fastjack-thread" });

    const surface = JSON.stringify(fj);
    const dodgerNym = await nymOf(DODGER_SEED);
    expect(surface).not.toContain(dodgerNym);                 // Dodger's prefix never appears
    expect(surface).not.toContain(hex(FASTJACK_SEED));        // the SEED never appears
    expect(surface).not.toContain(hex(DODGER_SEED));

    // The two handles share NO key material — the whole basis of the vault's collect-not-merge.
    expect(fj.nym).not.toBe(dodgerNym);
  });

  test("two published faces are two independent cards — no join between them exists on the wire", async () => {
    const fj = await publish(FASTJACK_SEED, "FastJack");
    const dg = await publish(DODGER_SEED, "Dodger");
    expect((await verifyHandleCard(fj)).ok).toBe(true);
    expect((await verifyHandleCard(dg)).ok).toBe(true);
    expect(fj.nym).not.toBe(dg.nym);
    expect(fj.prev).toBeNull();
    expect(dg.prev).toBeNull();
  });
});
