/**
 * walker-grant.test.ts — H8: a walker's grant the hearth SIGNS under its epoch's grant key, read by a SERVING checker
 * that holds the public half alone. Pure; no socket, no store.
 *
 * Proven, each axis apart:
 *   · CLASS — a walker-class grant re-labelled `host` refuses;
 *   · NEXUS — a grant read under another Nexus's half refuses, and a grant re-labelled to it refuses;
 *   · EPOCH — a grant re-labelled to another epoch refuses;
 *   · LEAF and LINEAGE — either moved refuses;
 *   · ROLL — a grant from the epoch before refuses under the rolled half; its renewal reads there, one epoch more
 *     survived, and no longer under the old half;
 *   · REVOCATION — a grant whose leaf the reader holds revoked refuses by name, and the same grant reads without it;
 *   · the serving checker holds no minting secret: the half carries three public fields and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/ember#/the-tiers
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { mintDelegatedHostingAct, signHostingDelegation, type DelegatedHostingEpoch } from "../src/hosting-delegation.js";
import { grantPublicHalf, issueWalkerGrant, readWalkerGrant, renewWalkerGrant, verifyWalkerGrant } from "../src/walker-grant.js";
import { hex } from "../src/crypto.js";

const AID     = "nexus-" + "a".repeat(64);
const OTHER_N = "nexus-" + "b".repeat(64);
const SEAT    = new Uint8Array(32).fill(51);
const HOSTING = new Uint8Array(32).fill(52);
// A REAL verifying key (RFC 8032 §7.1 test 1), and a second (§7.1 test 2): a grant names only a leaf the door accepts.
const GUEST   = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const GUEST_2 = "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c";
const LINEAGE = "d".repeat(64);
const DIALS   = { openIntroductions: 1, preAnswered: 3, strangersHeld: 0 };

async function epochIn(nexusAid: string, prev: string | null): Promise<DelegatedHostingEpoch> {
  const hostingKey = hex(await ed.getPublicKeyAsync(HOSTING));
  const delegation = await signHostingDelegation({ seatSeed: SEAT, nexusAid, hostingKey });
  return mintDelegatedHostingAct({ hostingSeed: HOSTING, delegation, prev, dials: DIALS });
}

describe("the serving checker holds the public half alone", () => {
  test("the half carries the Nexus, the epoch and the grant key, and no secret", async () => {
    const epoch = await epochIn(AID, null);
    const half = grantPublicHalf(epoch);
    expect(Object.keys(half).sort()).toEqual(["epoch", "grantKey", "nexusAid"]);
    expect(half).toEqual({ nexusAid: AID, epoch: epoch.cid, grantKey: epoch.grantKey });
    expect(Object.isFrozen(half)).toBe(true);
  });

  test("CONTROL: an issued grant reads under the half, deterministically", async () => {
    const epoch = await epochIn(AID, null);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(grantPublicHalf(epoch), grant)).toEqual({ ok: true, grant });
    expect(await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" })).toEqual(grant);
  });
});

describe("each axis refuses apart", () => {
  test("RED: CLASS — a walker grant re-labelled host refuses", async () => {
    const epoch = await epochIn(AID, null);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(grantPublicHalf(epoch), { ...grant, from: "host" })).toEqual({ ok: false, refusal: "grant-signature-refused" });
  });

  test("RED: NEXUS — another Nexus's half, or a grant re-labelled to it, refuses", async () => {
    const epoch = await epochIn(AID, null);
    const other = await epochIn(OTHER_N, null);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(grantPublicHalf(other), grant)).toEqual({ ok: false, refusal: "grant-nexus-foreign" });
    expect(readWalkerGrant(grantPublicHalf(other), { ...grant, nexusAid: OTHER_N, epoch: other.cid })).toEqual({ ok: false, refusal: "grant-signature-refused" });
  });

  test("RED: EPOCH — a grant re-labelled to another epoch refuses", async () => {
    const first = await epochIn(AID, null);
    const second = await epochIn(AID, first.cid);
    const grant = await issueWalkerGrant(first, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(grantPublicHalf(second), grant)).toEqual({ ok: false, refusal: "grant-epoch-foreign" });
    expect(readWalkerGrant(grantPublicHalf(second), { ...grant, epoch: second.cid })).toEqual({ ok: false, refusal: "grant-signature-refused" });
  });

  test("RED: LEAF and LINEAGE — either moved refuses", async () => {
    const epoch = await epochIn(AID, null);
    const half = grantPublicHalf(epoch);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(half, { ...grant, leaf: GUEST_2 })).toEqual({ ok: false, refusal: "grant-signature-refused" });
    expect(readWalkerGrant(half, { ...grant, lineage: "e".repeat(64) })).toEqual({ ok: false, refusal: "grant-signature-refused" });
    expect(readWalkerGrant(half, { ...grant, survived: 5 })).toEqual({ ok: false, refusal: "grant-signature-refused" });
  });

  test("RED: ROLL — the old grant refuses under the rolled half; its renewal reads there and not under the old", async () => {
    const first = await epochIn(AID, null);
    const second = await epochIn(AID, first.cid);
    const grant = await issueWalkerGrant(first, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    const renewed = await renewWalkerGrant(second, grant);
    expect(readWalkerGrant(grantPublicHalf(second), grant).ok).toBe(false);
    expect(readWalkerGrant(grantPublicHalf(second), renewed)).toEqual({ ok: true, grant: renewed });
    expect(renewed).toMatchObject({ epoch: second.cid, survived: 1, lineage: LINEAGE, from: "walker" });
    expect(readWalkerGrant(grantPublicHalf(first), renewed)).toEqual({ ok: false, refusal: "grant-epoch-foreign" });
  });

  test("RED: REVOCATION — a revoked leaf refuses by name; CONTROL: the same grant reads without it", async () => {
    const epoch = await epochIn(AID, null);
    const half = grantPublicHalf(epoch);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(half, grant, { revokedLeaves: new Set([GUEST]) })).toEqual({ ok: false, refusal: "grant-revoked" });
    expect(readWalkerGrant(half, grant, { revokedLeaves: new Set([GUEST_2]) }).ok).toBe(true);
  });

  test("RED: a malformed grant, a stray field and a walker leaf the Ed25519 door refuses", async () => {
    const epoch = await epochIn(AID, null);
    const half = grantPublicHalf(epoch);
    const grant = await issueWalkerGrant(epoch, { leaf: GUEST, lineage: LINEAGE, survived: 0, from: "walker" });
    expect(readWalkerGrant(half, null)).toEqual({ ok: false, refusal: "grant-malformed" });
    expect(readWalkerGrant(half, { ...grant, tag: "0".repeat(128) })).toEqual({ ok: false, refusal: "grant-malformed" });
    expect(verifyWalkerGrant(half, { ...grant, sig: "0".repeat(128) })).toBe(false);
    await expect(issueWalkerGrant(epoch, { leaf: "00".repeat(32), lineage: LINEAGE, survived: 0, from: "walker" })).rejects.toThrow(/walker-grant-leaf-refused/);
  });
});
