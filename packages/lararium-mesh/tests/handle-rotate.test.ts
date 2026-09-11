/**
 * handle-rotate.test — the Handle's ROTATE write-side: the CONTEXT-LADDER fresh-key scheme (Option A) and
 * the KERI pre-rotation hardening that defeats the dead-key thief.
 *
 * THE LADDER (Increment 1): a face derives its presentation key at
 * `deriveVeiledUserKey(seed, handleIndex, contextBase + rotationCount)` — inception rides contextBase
 * (rotationCount 0), rotation N rides contextBase + N. The seated key is ALWAYS re-derivable from
 * (seed, handleIndex, chain-rotation-count), reusing the exact veiled-key derivation the whole face speaks.
 *
 * THE PRE-COMMITMENT (Increment 2): inception commits H(the context-1 key). A rotation must REVEAL a
 * handleKeyDid whose digest matches the PRIOR event's `nextHandleKeyDigest`, and itself commit the next
 * digest. A thief holding only the current handle key lacks the next preimage (it lives behind the seed),
 * so a rotation they mint reveals a wrong key and the chain REFUSES.
 *
 * Proven (red-first):
 *   · a rotated chain verifies (verifyHandleKel + verifyHandleKelFull); the head handle key ADVANCES; the
 *     prefix stays FIXED; the card re-derives its stable nym,
 *   · the seated key at rotation N re-derives from (seed, handleIndex, N) — the ladder is reproducible,
 *   · [Increment 2] an armed inception commits H(context-1 key); a rotation revealing a WRONG next-key
 *     REFUSES (mint-side and verify-side); a nonsense-key control fails where the correct key passes,
 *   · an UNARMED chain (empty nextHandleKeyDigest) still verifies — the guarantee is opt-in per chain.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import { deriveVeiledUserKey } from "../src/persona-identity.js";
import { didFromVerifyingKey } from "../src/lar-did.js";
import { mintPersonaInception } from "../src/persona-kel.js";
import { writeHandleAnnounce, readHandleAnnounces } from "../src/handle-announce.js";
import { mintPersonaGlamour, PERSONA_GLAMOUR_CONTEXT, type OwnPublicHandleStore, type PersonaPublicHandleRecord } from "../src/persona-glamour.js";
import { rotateOwnHandle } from "../src/handle-orchestration.js";
import {
  mintHandleInception, mintHandleRotation, handleKeyDigestOf,
  verifyHandleKel, verifyHandleKelFull, headHandleKey, currentOwnerSet,
  type HandleKelEvent, type OwnerHeadResolver,
} from "../src/handle-kel.js";
import { HANDLE_CARD_DOMAIN, type HandleCard } from "../src/handle-card.js";
import type { LarDoc } from "../src/base-doc.js";

const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));
const headsAre = (table: Record<string, string>): OwnerHeadResolver =>
  async (memberPrefix, authKeyDid) => table[memberPrefix] === authKeyDid;

function makeFakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}

/** An in-memory OwnPublicHandleStore — one record per handle-index. */
function memStore(): OwnPublicHandleStore {
  const m = new Map<number, PersonaPublicHandleRecord>();
  return {
    async load(i) { return m.get(i) ?? null; },
    async save(r) { m.set(r.handleIndex, r); },
    async list() { return [...m.keys()].sort((a, b) => a - b); },
  };
}

const SEED  = new Uint8Array(32).fill(5);   // the persona master-seed the face derives from
const OWNER  = new Uint8Array(32).fill(61); // the owning persona's op-key seed

/** Found an armed 1-of-1 face on a fake board; return the board, its owning persona, and the record. */
async function foundedFaceOnBoard(handleIndex = 0) {
  const ownerOpKeyDid = await didOf(OWNER);
  const recoverySetHash = sealKeySetHash([ownerOpKeyDid], 1);
  const ownerPrefix = mintPersonaInception(ownerOpKeyDid, recoverySetHash).prefix;
  const store = memStore();
  const { card, record } = await mintPersonaGlamour({
    seed: SEED, handleIndex, glamour: "Guru-Josh", now: 1_000, store, ownerPersonaKelPrefix: ownerPrefix,
  });
  await store.save(record);
  const board = makeFakeBoard();
  board.change((d) => writeHandleAnnounce(d, card));
  return { board, store, record, card, ownerPrefix, ownerOpKeyDid, handleIndex };
}

/** Re-sign a rotated card under the fresh head handle key — the mint yields the signer to the builder. */
const buildRotatedCard = (record: PersonaPublicHandleRecord, glamour: string, now: number) =>
  async (_e: HandleKelEvent, newChain: HandleKelEvent[], freshSign: (b: Uint8Array) => Promise<string>): Promise<HandleCard> => {
    const { signHandleCard } = await import("../src/handle-card.js");
    return signHandleCard(
      { nym: record.nym, chain: newChain, glamour, version: record.version + 1, prev: record.cardId, expiry: now + 86_400_000, standing: null, fleetProof: null },
      freshSign,
    );
  };

describe("handle-kel — KERI pre-rotation: the next-handle-key pre-commitment", () => {
  test("★ an armed inception commits H(the context-1 key); the prefix does NOT bind the commitment ★", async () => {
    const inceptionKeyDid = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, PERSONA_GLAMOUR_CONTEXT)).verifyingKey);
    const ctx1Did = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, PERSONA_GLAMOUR_CONTEXT + 1)).verifyingKey);
    const ownerPrefix = "persona-" + "ab".repeat(32);
    const recoverySetHash = sealKeySetHash([inceptionKeyDid], 1);
    const armed   = mintHandleInception(inceptionKeyDid, ownerPrefix, recoverySetHash, handleKeyDigestOf(ctx1Did));
    const unarmed = mintHandleInception(inceptionKeyDid, ownerPrefix, recoverySetHash);
    expect(armed.nextHandleKeyDigest).toBe(handleKeyDigestOf(ctx1Did));
    expect(unarmed.nextHandleKeyDigest).toBe("");
    // The commitment rides the cid (a moved commitment moves the cid) but NOT the prefix (stable identifier).
    expect(armed.prefix).toBe(unarmed.prefix);
    expect(armed.eventCid).not.toBe(unarmed.eventCid);
    expect(verifyHandleKel([armed])).toBe(true);
    expect(verifyHandleKel([unarmed])).toBe(true);   // an unarmed chain still verifies (opt-in per chain)
  });

  test("★ a rotation revealing a WRONG next-key REFUSES — mint-side and verify-side ★", async () => {
    const inceptionKeyDid = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, 0)).verifyingKey);
    const ctx1Did = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, 1)).verifyingKey);
    const ownerOpKeyDid = await didOf(OWNER);
    const recoverySetHash = sealKeySetHash([inceptionKeyDid], 1);
    const ownerPrefix = mintPersonaInception(ownerOpKeyDid, recoverySetHash).prefix;
    const inception = mintHandleInception(inceptionKeyDid, ownerPrefix, recoverySetHash, handleKeyDigestOf(ctx1Did));

    // A thief seats a key that is NOT the pre-committed context-1 key — the reveal fails the prior commitment.
    const thiefKeyDid = await didOf(new Uint8Array(32).fill(99));
    const wrong = await mintHandleRotation({
      head: inception, freshHandleKeyDid: thiefKeyDid,
      ownerAuthMemberPrefix: ownerPrefix, ownerHeadOpKeyDid: ownerOpKeyDid, sign: signerOf(OWNER),
      nextHandleKeyDigest: handleKeyDigestOf(await didOf(new Uint8Array(32).fill(98))),
    });
    expect(wrong.ok, "the mint refuses a reveal that does not match the prior commitment").toBe(false);
    if (wrong.ok) return;
    expect(wrong.reason).toMatch(/pre-?commit|reveal|next|digest/i);

    // CONTROL — the CORRECT context-1 key reveals cleanly and the chain verifies.
    const right = await mintHandleRotation({
      head: inception, freshHandleKeyDid: ctx1Did,
      ownerAuthMemberPrefix: ownerPrefix, ownerHeadOpKeyDid: ownerOpKeyDid, sign: signerOf(OWNER),
      nextHandleKeyDigest: handleKeyDigestOf(didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, 2)).verifyingKey)),
    });
    expect(right.ok, right.ok ? "" : right.reason).toBe(true);
    if (!right.ok) return;
    expect(verifyHandleKel([inception, right.event])).toBe(true);

    // A hand-forged reveal (correct sig, wrong seated key spliced under the commitment) refuses structurally.
    const forged = { ...right.event, handleKeyDid: thiefKeyDid };
    expect(verifyHandleKel([inception, forged])).toBe(false);
  });
});

describe("handle-orchestration — rotateOwnHandle: the context ladder end-to-end", () => {
  test("★ a rotation advances the head key along the ladder; the prefix stays fixed; the chain verifies ★", async () => {
    const { board, record, ownerPrefix, ownerOpKeyDid } = await foundedFaceOnBoard();
    const incChain = readHandleAnnounces(board.doc()).find((c) => c.nym === record.nym)!.chain as HandleKelEvent[];
    const headCid = incChain[incChain.length - 1]!.eventCid;
    const resolver = headsAre({ [ownerPrefix]: ownerOpKeyDid });

    const res = await rotateOwnHandle({
      board: board as never, nym: record.nym, expectedHeadCid: headCid,
      seed: SEED, handleIndex: 0,
      ownerAuthMemberPrefix: ownerPrefix, ownerHeadOpKeyDid: ownerOpKeyDid, sign: signerOf(OWNER),
      buildCard: buildRotatedCard(record, "Guru-Josh", 2_000),
    });
    expect(res.ok, res.ok ? "" : res.reason).toBe(true);
    if (!res.ok) return;

    const chain = res.card.chain as HandleKelEvent[];
    expect(chain.length).toBe(2);
    expect(res.card.nym).toBe(record.nym);                          // the stable nym re-derives
    expect(chain[1]!.prefix).toBe(chain[0]!.prefix);               // the prefix never moves
    // THE HEAD ADVANCES to the context-1 key.
    const ctx1Did = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, 1)).verifyingKey);
    expect(headHandleKey(chain)).toBe(ctx1Did);
    expect(chain[1]!.handleKeyDid).not.toBe(chain[0]!.handleKeyDid);
    expect(verifyHandleKel(chain)).toBe(true);
    expect((await verifyHandleKelFull(chain, resolver)).ok).toBe(true);
    expect(currentOwnerSet(chain)!.members).toEqual([ownerPrefix]);
  });

  test("★ a SECOND rotation rides context 2; the head re-derives from (seed, handleIndex, rotation-count) ★", async () => {
    const { board, record, ownerPrefix, ownerOpKeyDid } = await foundedFaceOnBoard();
    const c0 = readHandleAnnounces(board.doc()).find((c) => c.nym === record.nym)!.chain as HandleKelEvent[];
    const r1 = await rotateOwnHandle({
      board: board as never, nym: record.nym, expectedHeadCid: c0[c0.length - 1]!.eventCid,
      seed: SEED, handleIndex: 0, ownerAuthMemberPrefix: ownerPrefix, ownerHeadOpKeyDid: ownerOpKeyDid, sign: signerOf(OWNER),
      buildCard: buildRotatedCard(record, "Guru-Josh", 2_000),
    });
    expect(r1.ok, r1.ok ? "" : r1.reason).toBe(true);
    if (!r1.ok) return;
    const c1 = r1.card.chain as HandleKelEvent[];

    // The second rotation links the first rotation's card as its prev and bumps the version.
    const { handleCardId } = await import("../src/handle-card.js");
    const { sig: _sig, ...unsigned1 } = r1.card;
    const record2: PersonaPublicHandleRecord = { ...record, version: record.version + 1, cardId: await handleCardId(unsigned1) };
    const r2 = await rotateOwnHandle({
      board: board as never, nym: record.nym, expectedHeadCid: c1[c1.length - 1]!.eventCid,
      seed: SEED, handleIndex: 0, ownerAuthMemberPrefix: ownerPrefix, ownerHeadOpKeyDid: ownerOpKeyDid, sign: signerOf(OWNER),
      buildCard: buildRotatedCard(record2, "Guru-Josh", 3_000),
    });
    expect(r2.ok, r2.ok ? "" : r2.reason).toBe(true);
    if (!r2.ok) return;
    const c2 = r2.card.chain as HandleKelEvent[];
    expect(c2.length).toBe(3);
    const ctx2Did = didFromVerifyingKey((await deriveVeiledUserKey(SEED, 0, 2)).verifyingKey);
    expect(headHandleKey(c2)).toBe(ctx2Did);   // rotation 2 → context 2, re-derivable from the count
    expect(verifyHandleKel(c2)).toBe(true);
    expect((await verifyHandleKelFull(c2, headsAre({ [ownerPrefix]: ownerOpKeyDid }))).ok).toBe(true);
  });
});
