/**
 * handle-kel.test — the Handle's SIBLING chain (identity-classes#the-handle-chain), reshaped for
 * ★ THE MU (2026-09-08): a Handle is a QUORUM-PRESENTED name, not a lone key. Its identifier binds a
 * GENESIS owner-SET at inception; a rolling `ownerSetHash` carries the CURRENT presenting set; a GRAFT
 * turns that set over (succession); presentation (rotate · burn · attest) is authorized by ANY current
 * member; 1-of-1 is the degenerate personal face.
 *
 * Proven (the red-first vectors):
 *   · ★ THE DREAD PIRATE ROBERTS — a 1-member Handle grafts its succession (new holder in, old out);
 *     the new holder presents validly, the PREFIX is byte-identical before and after, the OLD holder
 *     no longer presents,
 *   · ★ a 2-member Handle — EITHER member presents validly; a non-member's presentation refuses,
 *   · ★ the genesis set is fixed in the prefix (anti-swap) — re-writing it fails prefix derivation,
 *   · ★ a presentation by a SUPERSEDED member key refuses (the resolver),
 *   · ★ 1-of-1 still incepts and rotates as today (the degenerate case is unbroken),
 *   · a BURNED Handle refuses its successor forever; either hand may burn (Option C),
 *   · an attestation verifies end-to-end reader-locally; NO export takes a collection of handles,
 *   · inception incepts ARMED — an empty rolling recovery pre-commit refuses at the mint,
 *   · ★ TRUE k-of-n GRAFT GOVERNANCE — a threshold of the current set consenting: ONE hand cannot graft a
 *     2-of-2 guild, and BOTH hands can; the generalization beyond DPR, stood.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hex, hexToBytes } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  mintHandleInception, mintHandleInceptionSet, mintHandleRotation, mintHandleGraft, mintHandleBurn,
  handlePrefixOf, handleRotationSigningBytes, handleEventCidOf,
  verifyHandleKel, verifyHandleKelFull, currentOwnerSet,
  attestUnderHead, verifyAttestation, headHandleKey, isBurned,
  handleAttestationBytes, handleClaimSubject, HANDLE_CLAIM_SURFACES,
  type HandleKelEvent, type OwnerHeadResolver, type HandleClaim,
} from "../src/handle-kel.js";
import { mintPersonaInception } from "../src/persona-kel.js";

// Fixed seeds → deterministic run. hA/hB/hC seat the Handle's own keys; westley/roberts2/guildX/guildY
// stand the presenting personas' op-keys; ownerA/ownerB stand ONE persona across an owner rotation
// (A superseded by B); g1 arms the recovery pre-commit.
const SEEDS = {
  hA:      new Uint8Array(32).fill(51),
  hB:      new Uint8Array(32).fill(52),
  hC:      new Uint8Array(32).fill(53),
  westley: new Uint8Array(32).fill(61),   // the first Roberts (founding 1-of-1)
  succ:    new Uint8Array(32).fill(62),   // the grafted successor
  memberY: new Uint8Array(32).fill(63),   // a second co-holder in a 2-member Handle
  outside: new Uint8Array(32).fill(64),   // a non-member
  ownerA:  new Uint8Array(32).fill(71),   // one persona's op-key, superseded by B
  ownerB:  new Uint8Array(32).fill(72),
  g1:      new Uint8Array(32).fill(81),
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));

/** A founded 1-of-1 Handle — Westley's, the degenerate personal face. */
async function foundedHandle() {
  const handleKeyDid    = await didOf(SEEDS.hA);
  const recoverySetHash = sealKeySetHash([await pubOf(SEEDS.g1)], 1);
  // Westley's persona AID owns the name; its op-key A signs presentations.
  const westleyOpKeyA   = await didOf(SEEDS.westley);
  const westley         = mintPersonaInception(westleyOpKeyA, recoverySetHash);
  const inception       = mintHandleInception(handleKeyDid, westley.prefix, recoverySetHash);
  return { handleKeyDid, recoverySetHash, westleyPrefix: westley.prefix, westleyOpKeyA, inception };
}

/** A resolver that recognizes a fixed table of (memberPrefix → its standing head key); everything else
 *  reads superseded/unrecognized. */
const headsAre = (table: Record<string, string>): OwnerHeadResolver =>
  async (memberPrefix, authKeyDid) => table[memberPrefix] === authKeyDid;

describe("handle-kel — armed inception + the owner-SET binding", () => {
  test("inception incepts ARMED — an empty recovery pre-commit refuses at the mint", async () => {
    const handleKeyDid = await didOf(SEEDS.hA);
    const ownerPrefix  = "persona-" + "ab".repeat(32);
    expect(() => mintHandleInception(handleKeyDid, ownerPrefix, "")).toThrow(/unarmed/);
  });

  test("inception binds (handle key + GENESIS owner-set digest + recovery digest) into the prefix; structural verify accepts", async () => {
    const { inception, handleKeyDid, westleyPrefix, recoverySetHash } = await foundedHandle();
    expect(inception.seq).toBe(0);
    expect(inception.kind).toBe("inception");
    expect(inception.prevEventCid).toBeNull();
    const genesisDigest = sealKeySetHash([westleyPrefix], 1);
    expect(inception.genesisOwnerSetHash).toBe(genesisDigest);
    expect(inception.ownerSetHash).toBe(genesisDigest);                        // genesis seats ONE set in both slots
    expect(inception.prefix).toBe(handlePrefixOf(handleKeyDid, genesisDigest, recoverySetHash));
    expect(verifyHandleKel([inception])).toBe(true);
    expect(headHandleKey([inception])).toBe(handleKeyDid);
    expect(currentOwnerSet([inception])!.members).toEqual([westleyPrefix]);
  });

  test("★ the GENESIS set is fixed in the prefix (anti-swap) — re-writing the owner set fails prefix derivation", async () => {
    const { inception } = await foundedHandle();
    const other = "persona-" + "cd".repeat(32);
    // Re-writing the revealed genesis members no longer derives the pinned prefix → the founding quorum
    // is fixed in the name forever.
    const swapped = { ...inception, ownerSetMembers: [other] };
    expect(verifyHandleKel([swapped])).toBe(false);
    // Even a forger who RE-DIGESTS + RE-MINTS the cid over the swapped set fails — the prefix bound the
    // ORIGINAL genesis digest, so the derivation refuses (the cid check is not the only wall).
    const reDigested = { ...swapped, genesisOwnerSetHash: sealKeySetHash([other], 1), ownerSetHash: sealKeySetHash([other], 1) };
    const reMinted   = { ...reDigested, eventCid: handleEventCidOf(reDigested) };
    expect(verifyHandleKel([reMinted])).toBe(false);
    // And two different genesis sets derive two different identifiers from the SAME handle key + digest.
    const otherPrefix = handlePrefixOf(inception.handleKeyDid, sealKeySetHash([other], 1), inception.recoverySetHash);
    expect(otherPrefix).not.toBe(inception.prefix);
  });
});

describe("handle-kel — 1-of-1 is the degenerate personal face (unbroken)", () => {
  test("★ 1-of-1 still incepts and rotates as today — the single owner presents and renews the name", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const freshHandleKeyDid = await didOf(SEEDS.hB);
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid,
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(res.ok, res.ok ? "" : res.reason).toBe(true);
    if (!res.ok) return;
    const chain: HandleKelEvent[] = [inception, res.event];
    expect(res.event.prefix).toBe(inception.prefix);                 // the identifier survives
    expect(res.event.genesisOwnerSetHash).toBe(inception.genesisOwnerSetHash);   // the owner wall survives
    expect(res.event.handleKeyDid).toBe(freshHandleKeyDid);          // a fresh Handle key seats
    expect(verifyHandleKel(chain)).toBe(true);
    const full = await verifyHandleKelFull(chain, headsAre({ [westleyPrefix]: westleyOpKeyA }));
    expect(full.ok, full.ok ? "" : full.reason).toBe(true);
    expect(headHandleKey(chain)).toBe(freshHandleKeyDid);
    // handleRotationSigningBytes recomputes the exact bytes the mint signed.
    const bytes = handleRotationSigningBytes(inception, freshHandleKeyDid, westleyPrefix, westleyOpKeyA);
    expect(await ed.verifyAsync(hexToBytes(res.event.authSig!), bytes, hexToBytes(westleyOpKeyA.replace(/^0x/, "")))).toBe(true);
  });

  test("a rotation whose signature does not match its CLAIMED member key refuses at the mint", async () => {
    const { inception, westleyPrefix } = await foundedHandle();
    const claimedButNotSigner = await didOf(SEEDS.succ);
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: claimedButNotSigner, sign: signerOf(SEEDS.westley),   // signs as westley, claims succ's key
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/signature/i);
  });

  test("a tampered rotation (re-seated key under the old signature) refuses structurally", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const res = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const forged = { ...res.event, handleKeyDid: await didOf(SEEDS.hA) };
    expect(verifyHandleKel([inception, forged])).toBe(false);            // cid no longer recomputes
    const rebound = { ...forged, eventCid: res.event.eventCid };
    expect(verifyHandleKel([inception, rebound])).toBe(false);
  });
});

describe("handle-kel — ★ THE DREAD PIRATE ROBERTS: succession by graft", () => {
  test("★ Westley grafts his succession — new holder in, Westley out; the PREFIX is byte-identical, the OLD holder no longer presents ★", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const succPrefix = mintPersonaInception(await didOf(SEEDS.succ), inception.recoverySetHash).prefix;
    const succOpKey  = await didOf(SEEDS.succ);

    // Westley (the sole current member) grafts the succession: the successor set in, himself out.
    const graft = await mintHandleGraft({
      head: inception,
      newOwnerSetMembers: [succPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(graft.ok, graft.ok ? "" : graft.reason).toBe(true);
    if (!graft.ok) return;
    const chain: HandleKelEvent[] = [inception, graft.event];

    // THE NAME NEVER MOVES — the prefix is byte-identical before and after the succession.
    expect(graft.event.prefix).toBe(inception.prefix);
    expect(graft.event.genesisOwnerSetHash).toBe(inception.genesisOwnerSetHash);   // the founding quorum stays fixed forever
    expect(graft.event.ownerSetHash).toBe(sealKeySetHash([succPrefix], 1));        // the CURRENT set turned over

    expect(verifyHandleKel(chain)).toBe(true);
    expect(currentOwnerSet(chain)!.members).toEqual([succPrefix]);

    // The successor's persona-KEL head walks; Westley's key is no longer consulted for presentation.
    const resolver = headsAre({ [succPrefix]: succOpKey, [westleyPrefix]: westleyOpKeyA });
    expect((await verifyHandleKelFull(chain, resolver)).ok).toBe(true);

    // THE NEW HOLDER PRESENTS VALIDLY against the current set.
    const rot = await mintHandleRotation({
      head: graft.event, freshHandleKeyDid: await didOf(SEEDS.hC),
      ownerAuthMemberPrefix: succPrefix, ownerHeadOpKeyDid: succOpKey, sign: signerOf(SEEDS.succ),
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    const chain2 = [inception, graft.event, rot.event];
    expect(verifyHandleKel(chain2)).toBe(true);
    expect((await verifyHandleKelFull(chain2, resolver)).ok).toBe(true);

    // ★ THE OLD HOLDER NO LONGER PRESENTS — Westley left the set; his presentation refuses structurally.
    const westleyTries = await mintHandleRotation({
      head: graft.event, freshHandleKeyDid: await didOf(SEEDS.hC),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(westleyTries.ok).toBe(true);   // the mint signs against the claimed key…
    if (!westleyTries.ok) return;
    // …but Westley is no longer in the CURRENT owner set — the chain refuses him.
    expect(verifyHandleKel([inception, graft.event, westleyTries.event])).toBe(false);
  });

  test("a graft authorized by a NON-member refuses structurally (only a current holder cedes the name)", async () => {
    const { inception } = await foundedHandle();
    const outsiderPrefix = mintPersonaInception(await didOf(SEEDS.outside), inception.recoverySetHash).prefix;
    const succPrefix     = mintPersonaInception(await didOf(SEEDS.succ), inception.recoverySetHash).prefix;
    const graft = await mintHandleGraft({
      head: inception,
      newOwnerSetMembers: [succPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: outsiderPrefix, ownerHeadOpKeyDid: await didOf(SEEDS.outside), sign: signerOf(SEEDS.outside),
    });
    expect(graft.ok).toBe(true);   // the mint signs against the claimed key…
    if (!graft.ok) return;
    // …but the outsider never stood in the PRIOR set — the succession refuses.
    expect(verifyHandleKel([inception, graft.event])).toBe(false);
  });
});

describe("handle-kel — a 2-member Handle: either member presents; a non-member refuses", () => {
  test("★ EITHER member of a 2-member Handle presents validly; a non-member's presentation refuses ★", async () => {
    const handleKeyDid    = await didOf(SEEDS.hA);
    const recoverySetHash = sealKeySetHash([await pubOf(SEEDS.g1)], 1);
    const mAKey = await didOf(SEEDS.westley), mBKey = await didOf(SEEDS.memberY);
    const mA = mintPersonaInception(mAKey, recoverySetHash).prefix;
    const mB = mintPersonaInception(mBKey, recoverySetHash).prefix;
    const inception = mintHandleInceptionSet(handleKeyDid, [mA, mB], 1, recoverySetHash);
    expect(verifyHandleKel([inception])).toBe(true);
    expect(new Set(currentOwnerSet([inception])!.members)).toEqual(new Set([mA, mB]));

    const resolver = headsAre({ [mA]: mAKey, [mB]: mBKey });

    // Member A presents.
    const rotA = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
    });
    expect(rotA.ok).toBe(true);
    if (!rotA.ok) return;
    expect((await verifyHandleKelFull([inception, rotA.event], resolver)).ok).toBe(true);

    // Member B presents (a DIFFERENT hand, the same name — the cabal refuses "which member signed").
    const rotB = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hC),
      ownerAuthMemberPrefix: mB, ownerHeadOpKeyDid: mBKey, sign: signerOf(SEEDS.memberY),
    });
    expect(rotB.ok).toBe(true);
    if (!rotB.ok) return;
    expect((await verifyHandleKelFull([inception, rotB.event], resolver)).ok).toBe(true);

    // A NON-member presents → refuses structurally (never in the current set).
    const outsiderPrefix = mintPersonaInception(await didOf(SEEDS.outside), recoverySetHash).prefix;
    const rotX = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: outsiderPrefix, ownerHeadOpKeyDid: await didOf(SEEDS.outside), sign: signerOf(SEEDS.outside),
    });
    expect(rotX.ok).toBe(true);   // the mint signs against the claimed key…
    if (!rotX.ok) return;
    expect(verifyHandleKel([inception, rotX.event])).toBe(false);   // …but a non-member presents nothing
  });
});

describe("handle-kel — a SUPERSEDED member key refuses (the resolver)", () => {
  test("★ a presentation by a member's SUPERSEDED key rotates nothing — the resolver refuses the chain ★", async () => {
    const { inception, westleyPrefix } = await foundedHandle();
    const oldKey = await didOf(SEEDS.ownerA);   // the member's old op-key
    const newKey = await didOf(SEEDS.ownerB);   // the member rotated its persona-KEL to this head
    // Found the Handle owned by a persona whose op-key later rotates A → B.
    const recoverySetHash = inception.recoverySetHash;
    const memberPrefix = mintPersonaInception(oldKey, recoverySetHash).prefix;
    const handleKeyDid = await didOf(SEEDS.hA);
    const inc = mintHandleInception(handleKeyDid, memberPrefix, recoverySetHash);
    void westleyPrefix;

    // A thief holds the SUPERSEDED key (A) and mints a rotation naming it as authority.
    const res = await mintHandleRotation({
      head: inc, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: memberPrefix, ownerHeadOpKeyDid: oldKey, sign: signerOf(SEEDS.ownerA),
    });
    expect(res.ok).toBe(true);   // mint-side the sig verifies against the CLAIMED key…
    if (!res.ok) return;
    expect(verifyHandleKel([inc, res.event])).toBe(true);   // …and the member IS in the set (structural passes)…
    // …but the full walk asks the member's board: the member rotated to B, so A stands superseded.
    const full = await verifyHandleKelFull([inc, res.event], headsAre({ [memberPrefix]: newKey }));
    expect(full.ok).toBe(false);
    expect(full.reason).toMatch(/head|superseded/i);
  });
});

describe("handle-kel — the BURN is terminal, forever (Option C: either hand)", () => {
  test("★ a burned Handle refuses its successor, forever — rotation AND graft AND further burn AND attestation ★", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const burn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(burn.ok).toBe(true);
    if (!burn.ok) return;
    const chain: HandleKelEvent[] = [inception, burn.event];
    expect(verifyHandleKel(chain)).toBe(true);
    expect((await verifyHandleKelFull(chain, headsAre({ [westleyPrefix]: westleyOpKeyA }))).ok).toBe(true);
    expect(isBurned(chain)).toBe(true);
    expect(headHandleKey(chain)).toBeNull();                             // a buried name seats no key

    // No successor mints — even one a current member's live head signs.
    const after = await mintHandleRotation({
      head: burn.event, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toMatch(/burn/i);
    // A graft after a burn refuses too.
    const graftAfter = await mintHandleGraft({
      head: burn.event, newOwnerSetMembers: [westleyPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(graftAfter.ok).toBe(false);
    // A hand-forged successor spliced after the burn refuses structurally.
    const forged: HandleKelEvent = { ...inception, seq: 2, prevEventCid: burn.event.eventCid };
    expect(verifyHandleKel([inception, burn.event, forged])).toBe(false);
    // A second burn refuses too — terminal means terminal.
    const again = await mintHandleBurn({ head: burn.event, sign: signerOf(SEEDS.hA) });
    expect(again.ok).toBe(false);
    // And nothing attests under a buried name.
    await expect(attestUnderHead(chain, { surface: "dns-control", domain: "example.net" }, signerOf(SEEDS.hA))).rejects.toThrow(/burn/i);
  });

  test("★ A CURRENT MEMBER BURIES THE NAME — an owner-burn verifies, distinct from a self-burn; a superseded key cannot bury ★", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const burn = await mintHandleBurn({ head: inception, ownerBurn: { ownerAuthMemberPrefix: westleyPrefix, ownerAuthKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley) } });
    expect(burn.ok, burn.ok ? "" : burn.reason).toBe(true);
    if (!burn.ok) return;
    expect(burn.event.ownerAuthMemberPrefix).toBe(westleyPrefix);   // the record names the hand
    const buried = [inception, burn.event];
    expect(verifyHandleKel(buried)).toBe(true);
    expect(isBurned(buried)).toBe(true);
    expect((await verifyHandleKelFull(buried, headsAre({ [westleyPrefix]: westleyOpKeyA }))).ok).toBe(true);
    // a SUPERSEDED member key cannot bury the name (the resolver refuses).
    expect((await verifyHandleKelFull(buried, async () => false)).ok).toBe(false);
  });

  test("★ THE SELF-BURN STILL STANDS — the seated key closes its own name, ownerAuthMemberPrefix null ★", async () => {
    const { inception } = await foundedHandle();
    const selfBurn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(selfBurn.ok).toBe(true);
    if (!selfBurn.ok) return;
    expect(selfBurn.event.ownerAuthMemberPrefix).toBeNull();   // a self-burn names no member
    const full = await verifyHandleKelFull([inception, selfBurn.event], async () => false);
    expect(full.ok, "a self-burn needs no member-head — the resolver is never consulted").toBe(true);
  });
});

describe("handle-kel — attestation, reader-local, no board", () => {
  test("★ an attestation verifies end-to-end against the head key; a tampered claim or stale head refuses ★", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const stmt = await attestUnderHead([inception], { surface: "dns-control", domain: "example.net" }, signerOf(SEEDS.hA));
    expect((await verifyAttestation([inception], stmt)).ok).toBe(true);

    // A tampered claim refuses.
    const bent = { ...stmt, claim: { surface: "dns-control", domain: "example.org" } as HandleClaim };
    expect((await verifyAttestation([inception], bent)).ok).toBe(false);

    // A rotation moves the head — the OLD attestation reads stale against the NEW head (re-attest to renew).
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    expect((await verifyAttestation([inception, rot.event], stmt)).ok).toBe(false);
    // And the NEW head attests afresh under the fresh key.
    const stmt2 = await attestUnderHead([inception, rot.event], { surface: "dns-control", domain: "example.net" }, signerOf(SEEDS.hB));
    expect((await verifyAttestation([inception, rot.event], stmt2)).ok).toBe(true);
  });

  test("★ A BURN BURIES THE PAST CLAIMS — an attestation that held before the burn refuses after it ★", async () => {
    const { inception } = await foundedHandle();
    const stmt = await attestUnderHead([inception], { surface: "dns-control", domain: "example.net" }, signerOf(SEEDS.hA));
    // CONTROL — against the LIVE chain the very same statement holds, so the refusal below reads off the
    // burn alone and not off a malformed statement.
    expect((await verifyAttestation([inception], stmt)).ok).toBe(true);

    const burn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(burn.ok).toBe(true);
    if (!burn.ok) return;
    const verdict = await verifyAttestation([inception, burn.event], stmt);
    expect(verdict.ok, "a buried name claims nothing — even a claim it signed while alive").toBe(false);
    expect(verdict.reason).toMatch(/burn/i);
  });

  test("★ the registry-filter fence — no export accepts a collection of others' handles ★", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/handle-kel.ts", import.meta.url)), "utf8");
    const exportNames = [...src.matchAll(/export (?:async )?(?:function|const|type|interface) (\w+)/g)].map((m) => m[1]!);
    expect(exportNames.length).toBeGreaterThan(0);
    for (const name of exportNames) {
      expect(name).not.toMatch(/book|registry|roster|directory|list|collection|census/i);
    }
    expect(src).not.toMatch(/HandleKelEvent\[\]\[\]/);
    expect(src).not.toMatch(/readonly \(readonly HandleKelEvent\[\]\)\[\]/);
  });
});

describe("★ THE CLAIM READS AS A STRUCTURED CAUSAL-ISLAND EDGE, never as prose ★", () => {
  // The operator's ruling (2026-09-13): a claim must read as a STRUCTURED edge a peer sharing none of our
  // context can machine-read — a named SURFACE, a named foreign SUBJECT, and room for the RETURN-DIRECTION
  // locator the surface half reads. The adapter FAMILY (handle-card#the-chain) supplies the surface
  // vocabulary; a NEW adapter arrives as a NEW MEMBER of the union, never as a new field on one shape.

  test("★ every adapter-family row mints and verifies as its OWN union member ★", async () => {
    const { inception } = await foundedHandle();
    const claims: readonly HandleClaim[] = [
      { surface: "dns-control",      domain:  "example.net",            returnLocator: "_lares.example.net TXT" },
      { surface: "atproto-account",  account: "alice.bsky.social" },
      { surface: "kowloon-actor",    actorId: "@alice@kowloon.example", returnLocator: "profile.urls[]" },
      { surface: "loopback-address", address: "127.0.0.1:7777" },
    ];
    for (const claim of claims) {
      const stmt = await attestUnderHead([inception], claim, signerOf(SEEDS.hA));
      expect(stmt.claim.surface, "the statement carries the surface KIND, machine-readable").toBe(claim.surface);
      expect((await verifyAttestation([inception], stmt)).ok, `${claim.surface} verifies`).toBe(true);
      expect(handleClaimSubject(stmt.claim), "the subject reads off any member without a switch at the call site")
        .toBe(handleClaimSubject(claim));
    }
    // CONTROL — a claim whose SUBJECT moved refuses, so the passes above rest on the signature over the
    // structure and not on the shape alone.
    const bent = await attestUnderHead([inception], claims[0]!, signerOf(SEEDS.hA));
    const tampered = { ...bent, claim: { ...claims[0]!, domain: "example.org" } as HandleClaim };
    expect((await verifyAttestation([inception], tampered)).ok, "a moved subject refuses").toBe(false);
  });

  test("★ the bytes fold the structure CANONICALLY — key order at construction moves nothing ★", async () => {
    const { inception } = await foundedHandle();
    // Two honest signers assemble ONE claim in different field orders. Object key order differs; the signed
    // bytes must not, or the same claim yields two signatures that each refuse the other's rendering.
    const a = { surface: "dns-control", domain: "example.net", returnLocator: "_lares.example.net TXT" } as HandleClaim;
    const b = { returnLocator: "_lares.example.net TXT", domain: "example.net", surface: "dns-control" } as unknown as HandleClaim;
    expect(JSON.stringify(a), "the CONTROL: the two objects differ under a naive stringify").not.toBe(JSON.stringify(b));
    const bytesA = handleAttestationBytes(inception.prefix, inception.eventCid, a);
    const bytesB = handleAttestationBytes(inception.prefix, inception.eventCid, b);
    expect(hex(bytesA), "one claim, one canonical rendering").toBe(hex(bytesB));

    // And a statement signed over one ordering verifies against the other.
    const stmt = await attestUnderHead([inception], a, signerOf(SEEDS.hA));
    expect((await verifyAttestation([inception], { ...stmt, claim: b })).ok).toBe(true);
    // CONTROL — a DIFFERENT return locator is different bytes; canonicality never means indifference.
    const c = { surface: "dns-control", domain: "example.net", returnLocator: "_other.example.net TXT" } as HandleClaim;
    expect(hex(handleAttestationBytes(inception.prefix, inception.eventCid, c))).not.toBe(hex(bytesA));
  });

  test("★ an UNKNOWN surface, a missing subject, or an UNCOVERED field mints nothing and verifies nothing ★", async () => {
    const { inception } = await foundedHandle();
    const good: HandleClaim = { surface: "dns-control", domain: "example.net" };
    // CONTROL — the well-formed claim mints.
    await expect(attestUnderHead([inception], good, signerOf(SEEDS.hA))).resolves.toBeTruthy();

    const malformed = [
      { surface: "carrier-pigeon", domain: "example.net" },              // no adapter answers this surface
      { surface: "dns-control" },                                        // no subject — nothing to check against
      { surface: "dns-control", domain: "   " },                         // a blank subject names nothing
      { surface: "dns-control", domain: "example.net", note: "trust me" }, // an UNCOVERED field the sig never binds
      { surface: "atproto-account", domain: "example.net" },             // the WRONG member's subject field
    ];
    for (const bad of malformed) {
      await expect(
        attestUnderHead([inception], bad as unknown as HandleClaim, signerOf(SEEDS.hA)),
        `${JSON.stringify(bad)} attests nothing`,
      ).rejects.toThrow(/claim/i);
    }
    // A reader handed one refuses too — fail-closed on both halves of the wire.
    const stmt = await attestUnderHead([inception], good, signerOf(SEEDS.hA));
    for (const bad of malformed) {
      const verdict = await verifyAttestation([inception], { ...stmt, claim: bad as unknown as HandleClaim });
      expect(verdict.ok, `${JSON.stringify(bad)} verifies nothing`).toBe(false);
    }
  });

  test("the surface vocabulary names exactly the adapter family's rows", () => {
    expect([...HANDLE_CLAIM_SURFACES].sort()).toEqual(
      ["atproto-account", "dns-control", "kowloon-actor", "loopback-address"],
    );
  });
});

describe("handle-kel — TRUE k-of-n graft governance (a guild's membership change needs a threshold)", () => {
  // A graft turns the presenting set over — a membership change. Presentation (rotation/burn) answers to
  // ANY one current member, but SUCCESSION answers to the PRIOR set's THRESHOLD: k of the current n must
  // consent, gathered as k distinct current-member signatures over the graft bytes (the persona-KEL
  // QuorumSignature shape). A single willing hand stays the whole mechanism for a 1-of-1 (DPR); a 2-of-2
  // guild refuses a one-hand graft and accepts a two-hand one.
  async function found2of2() {
    const handleKeyDid    = await didOf(SEEDS.hA);
    const recoverySetHash = sealKeySetHash([await pubOf(SEEDS.g1)], 1);
    const mAKey = await didOf(SEEDS.westley), mBKey = await didOf(SEEDS.memberY);
    const mA = mintPersonaInception(mAKey, recoverySetHash).prefix;
    const mB = mintPersonaInception(mBKey, recoverySetHash).prefix;
    const inception = mintHandleInceptionSet(handleKeyDid, [mA, mB], 2, recoverySetHash);
    const succPrefix = mintPersonaInception(await didOf(SEEDS.succ), recoverySetHash).prefix;
    return { inception, mA, mB, mAKey, mBKey, succPrefix };
  }

  test("★ ONE hand cannot graft a 2-of-2 guild — succession refuses below the prior threshold ★", async () => {
    const { inception, mA, mAKey } = await found2of2();
    // Member A alone attempts the succession — a lone hand where the guild set two.
    const graft = await mintHandleGraft({
      head: inception,
      newOwnerSetMembers: [mA], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
    });
    expect(graft.ok, graft.ok ? "" : graft.reason).toBe(true);   // the mint gathers one hand…
    if (!graft.ok) return;
    // …but ONE of TWO consenting members is below the prior set's threshold — the chain refuses.
    expect(verifyHandleKel([inception, graft.event])).toBe(false);
  });

  test("★ BOTH hands graft the 2-of-2 guild — k distinct member signatures over the graft bytes verify ★", async () => {
    const { inception, mA, mB, mAKey, mBKey, succPrefix } = await found2of2();
    const graft = await mintHandleGraft({
      head: inception,
      newOwnerSetMembers: [succPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
      coSigners: [{ memberPrefix: mB, keyDid: mBKey, sign: signerOf(SEEDS.memberY) }],
    });
    expect(graft.ok, graft.ok ? "" : graft.reason).toBe(true);
    if (!graft.ok) return;
    const chain: HandleKelEvent[] = [inception, graft.event];
    expect(verifyHandleKel(chain)).toBe(true);                          // two distinct prior members consent
    expect(currentOwnerSet(chain)!.members).toEqual([succPrefix]);      // the set turned over
    const resolver = headsAre({ [mA]: mAKey, [mB]: mBKey, [succPrefix]: await didOf(SEEDS.succ) });
    expect((await verifyHandleKelFull(chain, resolver)).ok).toBe(true);  // both signatures + heads check
  });

  test("CONTROL — two hands but one from a NON-member cannot reach the threshold", async () => {
    const { inception, mA, mAKey, succPrefix } = await found2of2();
    const outsiderPrefix = mintPersonaInception(await didOf(SEEDS.outside), inception.recoverySetHash).prefix;
    // A presents; an OUTSIDER co-signs — two signatures, but only ONE stands in the prior set.
    const graft = await mintHandleGraft({
      head: inception,
      newOwnerSetMembers: [succPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
      coSigners: [{ memberPrefix: outsiderPrefix, keyDid: await didOf(SEEDS.outside), sign: signerOf(SEEDS.outside) }],
    });
    expect(graft.ok, graft.ok ? "" : graft.reason).toBe(true);
    if (!graft.ok) return;
    // One member + one outsider = one member of two — the succession refuses.
    expect(verifyHandleKel([inception, graft.event])).toBe(false);
  });

  test("the 1-of-1 (DPR) still grafts by one willing hand — the degenerate threshold-1 case unbroken", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    const succPrefix = mintPersonaInception(await didOf(SEEDS.succ), inception.recoverySetHash).prefix;
    const graft = await mintHandleGraft({
      head: inception, newOwnerSetMembers: [succPrefix], newOwnerSetThreshold: 1,
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(graft.ok, graft.ok ? "" : graft.reason).toBe(true);
    if (!graft.ok) return;
    expect(verifyHandleKel([inception, graft.event])).toBe(true);
  });
});

describe("handle-kel — ★ THE WITNESS THRESHOLD: rotation + owner-burn are QUORUM acts on a shared name", () => {
  // A movement's shared handle (the Luther-Blissett improper name) sets a WITNESS THRESHOLD on the two
  // MEMBER-authorized acts that seize or bury the name: a ROTATION seats a fresh signing key (the key that
  // speaks AS the handle), and an OWNER-BURN buries the shared name from above. Both must gather ≥ the
  // current owner-set's threshold of DISTINCT current-member signatures — the same distinct-authorizer
  // count the graft already reaches. A single turned member can no longer (a) rotate the signing key and
  // attest as the movement (a call to a trap issued in the movement's name) nor (b) bury the name alone.
  // 1-of-1 (the personal face, threshold 1) is UNCHANGED — one signature is the whole quorum.
  async function found2of2Movement() {
    const handleKeyDid    = await didOf(SEEDS.hA);
    const recoverySetHash = sealKeySetHash([await pubOf(SEEDS.g1)], 1);
    const mAKey = await didOf(SEEDS.westley), mBKey = await didOf(SEEDS.memberY);
    const mA = mintPersonaInception(mAKey, recoverySetHash).prefix;
    const mB = mintPersonaInception(mBKey, recoverySetHash).prefix;
    const inception = mintHandleInceptionSet(handleKeyDid, [mA, mB], 2, recoverySetHash);
    return { inception, mA, mB, mAKey, mBKey, recoverySetHash };
  }

  test("★ RED — ONE turned member cannot rotate the shared signing key of a 2-of-2 movement (seizing the name) ★", async () => {
    const { inception, mA, mB, mAKey, mBKey } = await found2of2Movement();
    // A single defector rotates the handle's own signing key — thereafter it would attest AS the movement.
    const solo = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
    });
    expect(solo.ok, solo.ok ? "" : solo.reason).toBe(true);   // the mint signs against A's claimed key…
    if (!solo.ok) return;
    // …but ONE of TWO members is below the witness threshold — a lone hand seizes no shared signing key.
    expect(verifyHandleKel([inception, solo.event])).toBe(false);

    // CONTROL — both members co-sign the SAME rotation bytes → the quorum consents, the rotation stands.
    const quorum = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
      coSigners: [{ memberPrefix: mB, keyDid: mBKey, sign: signerOf(SEEDS.memberY) }],
    });
    expect(quorum.ok, quorum.ok ? "" : quorum.reason).toBe(true);
    if (!quorum.ok) return;
    const chain: HandleKelEvent[] = [inception, quorum.event];
    expect(verifyHandleKel(chain)).toBe(true);
    expect(headHandleKey(chain)).toBe(await didOf(SEEDS.hB));
    const resolver = headsAre({ [mA]: mAKey, [mB]: mBKey });
    expect((await verifyHandleKelFull(chain, resolver)).ok).toBe(true);
  });

  test("★ RED — ONE turned member cannot owner-burn a 2-of-2 movement's shared name (silencing it) ★", async () => {
    const { inception, mA, mB, mAKey, mBKey } = await found2of2Movement();
    // A single defector buries the shared name from above.
    const solo = await mintHandleBurn({
      head: inception,
      ownerBurn: { ownerAuthMemberPrefix: mA, ownerAuthKeyDid: mAKey, sign: signerOf(SEEDS.westley) },
    });
    expect(solo.ok, solo.ok ? "" : solo.reason).toBe(true);   // the mint signs against A's key…
    if (!solo.ok) return;
    // …but a shared name is buried only by its quorum — one of two refuses.
    expect(verifyHandleKel([inception, solo.event])).toBe(false);

    // CONTROL — both members co-sign the burn → the quorum buries its own name.
    const quorum = await mintHandleBurn({
      head: inception,
      ownerBurn: { ownerAuthMemberPrefix: mA, ownerAuthKeyDid: mAKey, sign: signerOf(SEEDS.westley) },
      coSigners: [{ memberPrefix: mB, keyDid: mBKey, sign: signerOf(SEEDS.memberY) }],
    });
    expect(quorum.ok, quorum.ok ? "" : quorum.reason).toBe(true);
    if (!quorum.ok) return;
    const buried: HandleKelEvent[] = [inception, quorum.event];
    expect(verifyHandleKel(buried)).toBe(true);
    expect(isBurned(buried)).toBe(true);
    const resolver = headsAre({ [mA]: mAKey, [mB]: mBKey });
    expect((await verifyHandleKelFull(buried, resolver)).ok).toBe(true);
  });

  test("CONTROL — a 2-of-2 rotation co-signed by a NON-member cannot reach the witness threshold", async () => {
    const { inception, mA, mAKey } = await found2of2Movement();
    const outsiderPrefix = mintPersonaInception(await didOf(SEEDS.outside), inception.recoverySetHash).prefix;
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: mA, ownerHeadOpKeyDid: mAKey, sign: signerOf(SEEDS.westley),
      coSigners: [{ memberPrefix: outsiderPrefix, keyDid: await didOf(SEEDS.outside), sign: signerOf(SEEDS.outside) }],
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    // One member + one outsider = one member of two — below the threshold, the rotation refuses.
    expect(verifyHandleKel([inception, rot.event])).toBe(false);
  });

  test("CONTROL — the 1-of-1 personal face rotates AND self-burns with one signature, byte-unchanged", async () => {
    const { inception, westleyPrefix, westleyOpKeyA } = await foundedHandle();
    // threshold 1 → the sole owner presents alone, exactly as before the witness threshold.
    const rot = await mintHandleRotation({
      head: inception, freshHandleKeyDid: await didOf(SEEDS.hB),
      ownerAuthMemberPrefix: westleyPrefix, ownerHeadOpKeyDid: westleyOpKeyA, sign: signerOf(SEEDS.westley),
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    expect(verifyHandleKel([inception, rot.event])).toBe(true);
    expect((await verifyHandleKelFull([inception, rot.event], headsAre({ [westleyPrefix]: westleyOpKeyA }))).ok).toBe(true);
    // The seated key's own panic self-burn stays single-hand — a different hand from the members, never gated.
    const selfBurn = await mintHandleBurn({ head: rot.event, sign: signerOf(SEEDS.hB) });
    expect(selfBurn.ok).toBe(true);
    if (!selfBurn.ok) return;
    expect(verifyHandleKel([inception, rot.event, selfBurn.event])).toBe(true);
  });

  test("★ the SELF-BURN stays single-hand even on a k-of-n shared name — the seated key's own panic ★", async () => {
    const { inception } = await found2of2Movement();
    // The SEATED handle key (not a member) closes its own name — the terminal Shadowtalk panic burn.
    // A self-burn is a DIFFERENT hand from the member-authorized acts; the witness threshold does not gate it.
    const selfBurn = await mintHandleBurn({ head: inception, sign: signerOf(SEEDS.hA) });
    expect(selfBurn.ok, selfBurn.ok ? "" : selfBurn.reason).toBe(true);
    if (!selfBurn.ok) return;
    const chain: HandleKelEvent[] = [inception, selfBurn.event];
    expect(selfBurn.event.ownerAuthMemberPrefix).toBeNull();   // a self-burn names no member
    expect(verifyHandleKel(chain)).toBe(true);
    // the resolver is never consulted for a self-burn (no member head to walk).
    expect((await verifyHandleKelFull(chain, async () => false)).ok).toBe(true);
  });
});
