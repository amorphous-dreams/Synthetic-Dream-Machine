/**
 * handle-takeover.test — no reader accepts a Handle step it did not verify, and every Handle incepts armed.
 *
 * THE TAKEOVER. A Handle's owners stand in its chain as persona PREFIXES. Which key speaks for a prefix today
 * lives on the persona board, so a chain cannot prove its own rotation, graft or owner-burn: only a reader
 * holding an owner-head resolver can. A stranger who appends a rotation naming their own key as "the owner's
 * head", under any bytes for a signature, builds a chain that reads structurally whole.
 *
 * So a reader with NO resolver trusts the inception alone. Past it, the head, the owner set, a card and an
 * attestation each answer `handle-rotation-unverified`. One step carries its own proof: a self-burn standing
 * directly on the inception, which the inception's own Handle key signs.
 *
 * AND EVERY INCEPTION ARMS. A Handle stands as a rotating identifier: its inception commits the digest of the
 * next Handle key, each rotation reveals that key and commits a fresh one. An unarmed inception refuses at the
 * mint and at every read, by name.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { mintPersonaInception } from "../src/persona-kel.js";
import {
  attestUnderHead, currentOwnerSet, handleEventCidOf, handleKeyDigestOf, headHandleKey, mintHandleBurn, mintHandleInception,
  mintHandleInceptionSet, mintHandleRotation, resolvedHeadHandleKey, resolvedOwnerSet, verifyAttestation, verifyHandleKel,
  verifyHandleKelFull, type HandleKelEvent, type OwnerHeadResolver,
} from "../src/handle-kel.js";
import { acceptHandleUpdate, foldHandleCardsDetailed, recognizeHandle, signHandleCard, verifyHandleCard } from "../src/handle-card.js";
import { HandleBook } from "../src/handle-book.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const did = async (n: number): Promise<string> => `0x${hex(await ed.getPublicKeyAsync(seed(n)))}`;
const signer = (n: number) => async (b: Uint8Array): Promise<string> => hex(await ed.signAsync(b, seed(n)));
const RECOVERY = "ab".repeat(32);
const OWNER = 1, HANDLE = 2, NEXT = 3, AFTER = 4, STRANGER = 66;

/** A founded 1-of-1 Handle: owner persona, armed inception, and the resolver that knows the owner's head. */
async function founded() {
  const ownerDid = await did(OWNER);
  const owner = mintPersonaInception(ownerDid, RECOVERY);
  const inception = mintHandleInception(await did(HANDLE), owner.prefix, RECOVERY, handleKeyDigestOf(await did(NEXT)));
  const resolver: OwnerHeadResolver = async (member, key) => member === owner.prefix && key === ownerDid;
  return { owner, ownerDid, inception, resolver };
}

/** The stranger's appended rotation: structurally whole, naming the stranger's key as the owner's head. */
async function strangerRotation(inception: HandleKelEvent, ownerPrefix: string, revealedKeyDid: string): Promise<HandleKelEvent> {
  const stranger = await did(STRANGER);
  const core = {
    seq: 1, kind: "rotation" as const, prefix: inception.prefix, handleKeyDid: revealedKeyDid,
    genesisOwnerSetHash: inception.genesisOwnerSetHash, ownerSetHash: inception.ownerSetHash,
    recoverySetHash: inception.recoverySetHash, nextRecoverySetHash: inception.nextRecoverySetHash,
    nextHandleKeyDigest: handleKeyDigestOf(stranger),
    prevEventCid: inception.eventCid, ownerAuthMemberPrefix: ownerPrefix, ownerAuthKeyDid: stranger,
  };
  return { ...core, ownerSetMembers: [], ownerSetThreshold: 0, eventCid: handleEventCidOf(core), authSig: "00".repeat(64) } as HandleKelEvent;
}

const cardOver = (chain: readonly HandleKelEvent[], n: number) =>
  signHandleCard({ nym: chain[0]!.prefix, chain: [...chain], glamour: "a face", parents: [], standing: null, fleetProof: null }, signer(n));

describe("THE TAKEOVER: a stranger's appended rotation gains nothing", () => {
  test("★ the forged chain reads structurally whole, and every reader without a resolver refuses it by name ★", async () => {
    const { owner, inception, resolver } = await founded();
    // The stranger seats their OWN key. (Against an armed inception the structural read already refuses a key
    // the commitment never named; the second forgery below reveals the committed key instead.)
    const seatsStranger = [inception, await strangerRotation(inception, owner.prefix, await did(STRANGER))];
    expect(verifyHandleKel(seatsStranger)).toBe(false);
    // The stranger learned the committed next key (a public key, hidden only until its owner uses it) and
    // reveals it, committing the stranger's key as the one after. Structure alone reads this whole.
    const forged = [inception, await strangerRotation(inception, owner.prefix, await did(NEXT))];
    expect(verifyHandleKel(forged)).toBe(true);                                                  // KNOWN POSITIVE
    expect(await verifyHandleKelFull(forged, resolver)).toMatchObject({ ok: false });

    expect(headHandleKey(forged)).toBeNull();
    expect(currentOwnerSet(forged)).toBeNull();
    expect(await resolvedHeadHandleKey(forged, resolver)).toMatchObject({ ok: false, refusal: "owner-head-refused" });

    // Whoever holds the revealed key's secret signs the card; here the test does, as the worst case.
    const card = await cardOver(forged, NEXT);
    expect(await verifyHandleCard(card)).toEqual({ ok: false, reject: "handle-rotation-unverified" });
    expect(await recognizeHandle(card, inception.prefix)).toBe(false);                           // handle-card.ts recognizeHandle
    expect(await acceptHandleUpdate(card, { expectedNym: inception.prefix })).toEqual({ ok: false, reject: "handle-rotation-unverified" });
    expect((await foldHandleCardsDetailed([card])).status).toBe("rejected");                     // the fold
    expect(await new HandleBook().ingest(card)).toEqual({ ok: false, reject: "handle-rotation-unverified" });   // handle-book.ts ingest
    expect(await verifyHandleCard(card, resolver)).toEqual({ ok: false, reject: "owner-head-refused" });
  });

  test("an attestation under an unverified head refuses by name", async () => {
    const { owner, inception } = await founded();
    const forged = [inception, await strangerRotation(inception, owner.prefix, await did(NEXT))];
    const statement = await attestUnderHead(forged, { surface: "dns-control", domain: "example.net" }, signer(NEXT));
    expect(await verifyAttestation(forged, statement)).toEqual({
      ok: false, reason: "the chain carries a step this reader cannot verify without the owners' heads (handle-rotation-unverified)",
    });
  });

  test("CONTROL: the inception alone stands for every reader, and a LAWFUL rotation stands for a reader with a resolver", async () => {
    const { owner, ownerDid, inception, resolver } = await founded();
    expect(headHandleKey([inception])).toBe(await did(HANDLE));
    expect(currentOwnerSet([inception])!.members).toEqual([owner.prefix]);
    const first = await cardOver([inception], HANDLE);
    expect(await verifyHandleCard(first)).toMatchObject({ ok: true, tier: 1 });
    expect(await new HandleBook().ingest(first)).toMatchObject({ ok: true });

    const rotated = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await did(NEXT), ownerAuthMemberPrefix: owner.prefix, ownerHeadOpKeyDid: ownerDid,
      sign: signer(OWNER), nextHandleKeyDigest: handleKeyDigestOf(await did(AFTER)),
    });
    if (!rotated.ok) throw new Error(rotated.reason);
    const chain = [inception, rotated.event];
    expect(await resolvedHeadHandleKey(chain, resolver)).toEqual({ ok: true, key: await did(NEXT) });
    expect((await resolvedOwnerSet(chain, resolver))!.members).toEqual([owner.prefix]);
    const card = await cardOver(chain, NEXT);
    expect(await verifyHandleCard(card, resolver)).toMatchObject({ ok: true, tier: 2 });
    // The same lawful chain, read with no resolver: unverified, never trusted, never mistaken for the inception key.
    expect(await verifyHandleCard(card)).toEqual({ ok: false, reject: "handle-rotation-unverified" });
    expect(headHandleKey(chain)).toBeNull();
  });

  test("a self-burn standing on the inception carries its own proof; a forged one does not", async () => {
    const { owner, inception } = await founded();
    const burn = await mintHandleBurn({ head: inception, sign: signer(HANDLE) });
    if (!burn.ok) throw new Error(burn.reason);
    const card = await cardOver([inception, burn.event], HANDLE);
    expect(await verifyHandleCard(card)).toEqual({ ok: false, reject: "burned" });
    // A stranger cannot bury somebody's name for a resolver-less reader with bytes they made up...
    const forgedBurn = { ...burn.event, authSig: "00".repeat(64) } as HandleKelEvent;
    expect(await verifyHandleCard(await cardOver([inception, forgedBurn], HANDLE))).toEqual({ ok: false, reject: "handle-rotation-unverified" });
    // ...nor with an owner-burn naming their own key as the owner's head.
    const ownerBurn = await mintHandleBurn({ head: inception, ownerBurn: { ownerAuthMemberPrefix: owner.prefix, ownerAuthKeyDid: await did(STRANGER), sign: signer(STRANGER) } });
    if (!ownerBurn.ok) throw new Error(ownerBurn.reason);
    expect(await verifyHandleCard(await cardOver([inception, ownerBurn.event], HANDLE))).toEqual({ ok: false, reject: "handle-rotation-unverified" });
  });
});

describe("a reader WITH a resolver verifies before it believes a burial", () => {
  test("★ a forged owner-burn buries nobody: the step refuses before any verdict reads `burned` ★", async () => {
    const { owner, inception, resolver } = await founded();
    // A board writer appends an owner-burn naming their own key as the owner's head, under bytes they made up.
    const forgedBurn = await mintHandleBurn({ head: inception, ownerBurn: { ownerAuthMemberPrefix: owner.prefix, ownerAuthKeyDid: await did(STRANGER), sign: signer(STRANGER) } });
    if (!forgedBurn.ok) throw new Error(forgedBurn.reason);
    const chain = [inception, forgedBurn.event];
    expect(verifyHandleKel(chain)).toBe(true);                                                   // KNOWN POSITIVE: structure passes
    expect(await verifyHandleCard(await cardOver(chain, HANDLE), resolver)).toEqual({ ok: false, reject: "owner-head-refused" });
    expect(await resolvedHeadHandleKey(chain, resolver)).toMatchObject({ ok: false, refusal: "owner-head-refused" });
    // CONTROL: the owner's own burn, under the head the resolver knows, reads burned.
    const lawful = await mintHandleBurn({ head: inception, ownerBurn: { ownerAuthMemberPrefix: owner.prefix, ownerAuthKeyDid: await did(OWNER), sign: signer(OWNER) } });
    if (!lawful.ok) throw new Error(lawful.reason);
    expect(await verifyHandleCard(await cardOver([inception, lawful.event], HANDLE), resolver)).toEqual({ ok: false, reject: "burned" });
  });
});

describe("EVERY HANDLE INCEPTS ARMED", () => {
  test("★ an unarmed inception refuses at the mint, and at every read, by name ★", async () => {
    const { owner, resolver } = await founded();
    const handleKey = await did(HANDLE);
    const unarmedMint = mintHandleInception as unknown as (a: string, b: string, c: string, d?: string) => HandleKelEvent;
    expect(() => unarmedMint(handleKey, owner.prefix, RECOVERY)).toThrow(/handle-inception-unarmed/);
    expect(() => mintHandleInception(handleKey, owner.prefix, RECOVERY, "")).toThrow(/handle-inception-unarmed/);
    expect(() => mintHandleInceptionSet(handleKey, [owner.prefix], 1, RECOVERY, "not-a-digest")).toThrow(/handle-inception-unarmed/);

    // Hand-built past the minter, its cid re-derived: the readers refuse the same thing.
    const armed = mintHandleInception(handleKey, owner.prefix, RECOVERY, handleKeyDigestOf(await did(NEXT)));
    const { ownerSetMembers, ownerSetThreshold, eventCid: _cid, authSig, ...core } = armed;
    const bare = { ...core, nextHandleKeyDigest: "" };
    const unarmed = { ...bare, ownerSetMembers, ownerSetThreshold, authSig, eventCid: handleEventCidOf(bare) } as HandleKelEvent;
    expect(verifyHandleKel([armed])).toBe(true);                                                 // CONTROL
    expect(verifyHandleKel([unarmed])).toBe(false);
    expect(await verifyHandleKelFull([unarmed], resolver)).toEqual({
      ok: false, reason: "inception seq 0: the inception commits no next Handle key (handle-inception-unarmed)",
    });
    expect(headHandleKey([unarmed])).toBeNull();
    expect(await verifyHandleCard(await cardOver([unarmed], HANDLE))).toEqual({ ok: false, reject: "chain-invalid" });
  });

  test("★ a rotation commits a FRESH next key: it never carries the spent commitment forward ★", async () => {
    const { owner, ownerDid, inception, resolver } = await founded();
    const base = { head: inception, freshHandleKeyDid: await did(NEXT), ownerAuthMemberPrefix: owner.prefix, ownerHeadOpKeyDid: ownerDid, sign: signer(OWNER) };
    const unarmedRotation = mintHandleRotation as unknown as (input: typeof base & { nextHandleKeyDigest?: string }) => ReturnType<typeof mintHandleRotation>;
    expect(await unarmedRotation(base)).toMatchObject({ ok: false, reason: expect.stringMatching(/handle-rotation-unarmed/) });
    expect(await unarmedRotation({ ...base, nextHandleKeyDigest: inception.nextHandleKeyDigest })).toMatchObject({ ok: false, reason: expect.stringMatching(/handle-rotation-unarmed/) });
    const lawful = await mintHandleRotation({ ...base, nextHandleKeyDigest: handleKeyDigestOf(await did(AFTER)) });
    if (!lawful.ok) throw new Error(lawful.reason);
    expect(await verifyHandleKelFull([inception, lawful.event], resolver)).toEqual({ ok: true });   // CONTROL
    // Hand-built: the rotation re-commits the digest it just revealed. Structure refuses it.
    const { ownerSetMembers, ownerSetThreshold, eventCid: _cid, authSig, coSigs: _co, ...core } = lawful.event;
    const spent = { ...core, nextHandleKeyDigest: inception.nextHandleKeyDigest };
    const stale = { ...spent, ownerSetMembers, ownerSetThreshold, authSig, eventCid: handleEventCidOf(spent) } as HandleKelEvent;
    expect(verifyHandleKel([inception, stale])).toBe(false);
  });
});
