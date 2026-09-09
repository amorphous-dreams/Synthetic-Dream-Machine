/**
 * handle-kel.test — the Handle's SIBLING chain (identity-classes#the-handle-chain): a nym that can
 * BURN, ROTATE, and ATTEST, its identifier binding its OWNER at inception.
 *
 * Proven (the red-first vectors):
 *   · a BURNED Handle refuses its successor, forever — no rotation, no burn, no attestation after,
 *   · rotation authority walks the OWNER's persona-KEL head — a rotation signed by a SUPERSEDED
 *     owner key rotates nothing (mint-side sig gate + full-verify resolver gate),
 *   · an attestation verifies end-to-end against the head key, reader-locally; the module exposes
 *     NO export accepting a collection of others' handles (the registry filter),
 *   · the OWNER-BINDING survives rotation — the ownerPrefix rides INSIDE the prefix bytes and a
 *     detached / swapped owner refuses structurally,
 *   · inception incepts ARMED — an empty rolling recovery pre-commit refuses at the mint.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  mintHandleInception, mintHandleRotation, mintHandleBurn,
  handlePrefixOf, handleRotationSigningBytes, handleEventCidOf,
  verifyHandleKel, verifyHandleKelFull,
  attestUnderHead, verifyAttestation, headHandleKey, isBurned,
  type HandleKelEvent, type OwnerHeadResolver,
} from "../src/handle-kel.js";
import { mintPersonaInception } from "../src/persona-kel.js";

// Fixed seeds → deterministic run. hA/hB seat the Handle's own keys; ownerA/ownerB stand the owning
// persona's op-keys across ONE owner rotation (A superseded by B); g1 arms the recovery pre-commit.
const SEEDS = {
  hA:     new Uint8Array(32).fill(51),
  hB:     new Uint8Array(32).fill(52),
  ownerA: new Uint8Array(32).fill(61),
  ownerB: new Uint8Array(32).fill(62),
  g1:     new Uint8Array(32).fill(71),
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));

/** A founded Handle: armed inception under ownerA's persona prefix. */
async function foundedHandle() {
  const handleKeyDid    = await didOf(SEEDS.hA);
  const ownerOpKeyDidA  = await didOf(SEEDS.ownerA);
  const ownerOpKeyDidB  = await didOf(SEEDS.ownerB);
  const recoverySetHash = sealKeySetHash([await pubOf(SEEDS.g1)], 1);
  const owner           = mintPersonaInception(ownerOpKeyDidA, recoverySetHash);
  const inception       = mintHandleInception(handleKeyDid, owner.prefix, recoverySetHash);
  return { handleKeyDid, ownerOpKeyDidA, ownerOpKeyDidB, ownerPrefix: owner.prefix, recoverySetHash, inception };
}

/** A resolver that recognizes ONE key as the owner's standing head — every other key reads superseded. */
const headOnly = (ownerPrefix: string, headKey: string): OwnerHeadResolver =>
  async (prefix, authKeyDid) => prefix === ownerPrefix && authKeyDid === headKey;

describe("handle-kel — armed inception + the owner-binding", () => {
  test("★ inception incepts ARMED — an empty recovery pre-commit refuses at the mint", async () => {
    const handleKeyDid = await didOf(SEEDS.hA);
    const ownerPrefix  = "persona-" + "ab".repeat(32);
    expect(() => mintHandleInception(handleKeyDid, ownerPrefix, "")).toThrow(/unarmed/);
  });

  test("inception binds (handle key + OWNER prefix + recovery digest) into the prefix; structural verify accepts", async () => {
    const { inception, handleKeyDid, ownerPrefix, recoverySetHash } = await foundedHandle();
    expect(inception.seq).toBe(0);
    expect(inception.kind).toBe("inception");
    expect(inception.prevEventCid).toBeNull();
    expect(inception.prefix).toBe(handlePrefixOf(handleKeyDid, ownerPrefix, recoverySetHash));
    expect(verifyHandleKel([inception])).toBe(true);
    expect(headHandleKey([inception])).toBe(handleKeyDid);
  });

  test("★ a SWAPPED owner refuses — the ownerPrefix rides inside the prefix bytes, no re-parenting", async () => {
    const { inception } = await foundedHandle();
    // Re-writing the ownerPrefix no longer derives the pinned prefix → the proof never detaches.
    expect(verifyHandleKel([{ ...inception, ownerPrefix: "persona-" + "cd".repeat(32) }])).toBe(false);
    // Even a forger who RE-MINTS the cid over the swapped owner fails — the prefix derivation alone
    // refuses it (the cid check must not be the only wall standing).
    const swapped = { ...inception, ownerPrefix: "persona-" + "cd".repeat(32) };
    const recid   = { ...swapped, eventCid: handleEventCidOf(swapped) };
    expect(verifyHandleKel([recid])).toBe(false);
    // And two different owners derive two different identifiers from the SAME handle key + digest.
    const other = handlePrefixOf(inception.handleKeyDid, "persona-" + "cd".repeat(32), inception.recoverySetHash);
    expect(other).not.toBe(inception.prefix);
  });
});

describe("handle-kel — rotation walks the OWNER's head", () => {
  test("the owner's CURRENT head op-key rotates the Handle; the prefix + ownerPrefix carry forward unchanged", async () => {
    const { inception, ownerOpKeyDidA, ownerPrefix } = await foundedHandle();
    const freshHandleKeyDid = await didOf(SEEDS.hB);
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid,
      ownerHeadOpKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const chain: HandleKelEvent[] = [inception, res.event];
    expect(res.event.prefix).toBe(inception.prefix);           // the identifier survives
    expect(res.event.ownerPrefix).toBe(ownerPrefix);           // ★ the owner-binding survives rotation
    expect(res.event.handleKeyDid).toBe(freshHandleKeyDid);    // a fresh Handle key seats
    expect(verifyHandleKel(chain)).toBe(true);
    const full = await verifyHandleKelFull(chain, headOnly(ownerPrefix, ownerOpKeyDidA));
    expect(full.ok).toBe(true);
    expect(headHandleKey(chain)).toBe(freshHandleKeyDid);
  });

  test("★ a rotation signed by a SUPERSEDED owner key rotates nothing — the resolver refuses the chain", async () => {
    const { inception, ownerOpKeyDidA, ownerOpKeyDidB, ownerPrefix } = await foundedHandle();
    const freshHandleKeyDid = await didOf(SEEDS.hB);
    // The thief holds ownerA (the superseded key) and mints a rotation naming it as authority.
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid,
      ownerHeadOpKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA),
    });
    expect(res.ok).toBe(true);   // mint-side the sig verifies against the CLAIMED key…
    if (!res.ok) return;
    // …and the full walk asks the OWNER's board: the owner rotated to B, so A stands superseded.
    const full = await verifyHandleKelFull([inception, res.event], headOnly(ownerPrefix, ownerOpKeyDidB));
    expect(full.ok).toBe(false);
    expect(full.reason).toMatch(/owner/i);
  });

  test("a rotation whose signature does not match its CLAIMED owner key refuses at the mint", async () => {
    const { inception, ownerOpKeyDidB } = await foundedHandle();
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerHeadOpKeyDid: ownerOpKeyDidB, sign: signerOf(SEEDS.ownerA),   // signs with A, claims B
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/signature/i);
  });

  test("a tampered rotation (re-seated key under the old signature) refuses structurally", async () => {
    const { inception, ownerOpKeyDidA, ownerPrefix } = await foundedHandle();
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerHeadOpKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const forged = { ...res.event, handleKeyDid: await didOf(SEEDS.hA) };
    expect(verifyHandleKel([inception, forged])).toBe(false);            // cid no longer recomputes
    const rebound = { ...forged, eventCid: res.event.eventCid };
    expect(verifyHandleKel([inception, rebound])).toBe(false);
  });
});

describe("handle-kel — the BURN is terminal, forever", () => {
  test("★ a burned Handle refuses its successor, forever — rotation AND further burn AND attestation", async () => {
    const { inception, ownerOpKeyDidA, ownerPrefix } = await foundedHandle();
    const burn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(burn.ok).toBe(true);
    if (!burn.ok) return;
    const chain: HandleKelEvent[] = [inception, burn.event];
    expect(verifyHandleKel(chain)).toBe(true);
    expect((await verifyHandleKelFull(chain, headOnly(ownerPrefix, ownerOpKeyDidA))).ok).toBe(true);
    expect(isBurned(chain)).toBe(true);
    expect(headHandleKey(chain)).toBeNull();                             // a buried name seats no key

    // No successor verifies — even one the OWNER's live head signs.
    const after = await mintHandleRotation({
      head: burn.event, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerHeadOpKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA),
    });
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toMatch(/burn/i);
    // A hand-forged successor spliced after the burn refuses structurally.
    const forged: HandleKelEvent = { ...inception, seq: 2, prevEventCid: burn.event.eventCid };
    expect(verifyHandleKel([inception, burn.event, forged])).toBe(false);
    // A second burn refuses too — terminal means terminal.
    const again = await mintHandleBurn({ head: burn.event, sign: signerOf(SEEDS.hA) });
    expect(again.ok).toBe(false);
    // And nothing attests under a buried name.
    await expect(attestUnderHead(chain, "this Handle controls example.net", signerOf(SEEDS.hA))).rejects.toThrow(/burn/i);
  });
});

describe("handle-kel — attestation, reader-local, no board", () => {
  test("★ an attestation verifies end-to-end against the head key; a tampered claim or stale head refuses", async () => {
    const { inception, ownerOpKeyDidA } = await foundedHandle();
    const stmt = await attestUnderHead([inception], "this Handle controls example.net", signerOf(SEEDS.hA));
    expect((await verifyAttestation([inception], stmt)).ok).toBe(true);

    // A tampered claim refuses.
    const bent = { ...stmt, claim: "this Handle controls example.org" };
    expect((await verifyAttestation([inception], bent)).ok).toBe(false);

    // A rotation moves the head — the OLD attestation reads stale against the NEW head (re-attest to renew).
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerHeadOpKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA),
    });
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    expect((await verifyAttestation([inception, rot.event], stmt)).ok).toBe(false);
    // And the NEW head attests afresh under the fresh key.
    const stmt2 = await attestUnderHead([inception, rot.event], "this Handle controls example.net", signerOf(SEEDS.hB));
    expect((await verifyAttestation([inception, rot.event], stmt2)).ok).toBe(true);
  });

  test("★ the registry-filter fence — no export accepts a collection of others' handles", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/handle-kel.ts", import.meta.url)), "utf8");
    // Every export takes ONE chain (one Handle's own lineage). No export names a book/registry/roster/
    // directory shape, and no signature takes an array-of-chains.
    const exportNames = [...src.matchAll(/export (?:async )?(?:function|const|type|interface) (\w+)/g)].map((m) => m[1]!);
    expect(exportNames.length).toBeGreaterThan(0);
    for (const name of exportNames) {
      expect(name).not.toMatch(/book|registry|roster|directory|list|collection|census/i);
    }
    expect(src).not.toMatch(/HandleKelEvent\[\]\[\]/);
    expect(src).not.toMatch(/readonly \(readonly HandleKelEvent\[\]\)\[\]/);
  });
describe("Option C — either hand may burn, the record says which (ruling 2026-09-08)", () => {
  test("★ THE OWNER BURIES ITS OWN NAME — an owner-op-key burn verifies, distinct from a self-burn ★", async () => {
    const { inception, ownerPrefix, ownerOpKeyDidA } = await foundedHandle();

    // the OWNER buries the name from above — signed by the owner op-key, naming it in the burn core
    const burn = await mintHandleBurn({ head: inception, ownerBurn: { ownerAuthKeyDid: ownerOpKeyDidA, sign: signerOf(SEEDS.ownerA) } });
    expect(burn.ok, burn.ok ? "" : burn.reason).toBe(true);
    if (!burn.ok) return;
    expect(burn.event.ownerAuthKeyDid, "the record names the owner as the hand").toBe(ownerOpKeyDidA);

    const buried = [inception, burn.event];
    expect(verifyHandleKel(buried), "an owner burn passes structural").toBe(true);
    expect(isBurned(buried)).toBe(true);
    const full = await verifyHandleKelFull(buried, headOnly(ownerPrefix, ownerOpKeyDidA));
    expect(full.ok, full.ok ? "" : full.reason).toBe(true);
    // a SUPERSEDED owner key cannot bury the name (the resolver refuses)
    const stale = await verifyHandleKelFull(buried, async () => false);
    expect(stale.ok).toBe(false);
  });

  test("★ THE SELF-BURN STILL STANDS — the seated key closes its own name, ownerAuthKeyDid null ★", async () => {
    const { inception, handleKeyDid } = await foundedHandle();
    void handleKeyDid;
    const selfBurn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(selfBurn.ok).toBe(true);
    if (!selfBurn.ok) return;
    expect(selfBurn.event.ownerAuthKeyDid, "a self-burn names no owner").toBeNull();
    const full = await verifyHandleKelFull([inception, selfBurn.event], async () => false);
    expect(full.ok, "a self-burn needs no owner-head — the resolver is never consulted").toBe(true);
  });
});

});
