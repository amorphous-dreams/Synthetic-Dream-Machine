/**
 * hosting.test.ts — the hearth's hosting act, the bearer invite token, the keyed grant, and the claim a newcomer
 * redeems with. Pure; no socket, no store.
 *
 * Proven:
 *   · the POPRF is RFC 9497 ristretto255-SHA512 (the A.1.3 POPRF key vector, and a VOPRF key that differs —
 *     the instrument can see a difference);
 *   · a hosting act is signed by its own leaf, its CID names the epoch, and every roll re-keys (no counter);
 *     an equivocating second act signed from the same act reads as a fork; a forged one raises none;
 *   · a token verifies at its own epoch under its own CLASS only; a tampered output, another epoch, or the
 *     other class reads false;
 *   · LABEL SEPARATION: a token evaluation presented as a grant tag never verifies, nor the reverse;
 *   · a grant verifies at its epoch alone, names its Nexus and its class, and renews deterministically;
 *   · a claim is derived from the leaf seed (a retry re-derives it), and the lineage moves with the claim — the
 *     claim digest a hearth keeps does not stand in for the claim.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */
import { describe, expect, test } from "vitest";
import { ristretto255_oprf } from "@noble/curves/ed25519.js";
import * as ed from "@noble/ed25519";
import {
  mintHostingAct, hostingActCid, hostingActBytes, verifyHostingAct, hostingEpochOf, hostingForks, hostingActsFromBoard, writeHostingAct,
  mintHostToken, tokenVerifiesAt, evaluateToken, issueGrant, grantVerifiesAt, renewGrant,
  redeemClaim, claimDigest, lineageOf, encodeInvite, decodeInvite, tokenInfo,
  allowance, mintMarker, batchDigest, blindWalkerBatch, evaluateWalkerBatch, finalizeWalkerBatch,
  type HostingEpoch, type InviteToken,
} from "../src/hosting.js";
import { carriageEntriesFromBoard } from "../src/carriage-board.js";
import { ALL_DOMAINS, DOMAIN_ROOT } from "../src/domains.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { hex, base64UrlDecode, base64UrlEncode } from "../src/crypto.js";

const AID   = "epoch0-" + "a".repeat(64);
const LEAF  = new Uint8Array(32).fill(41);
const OTHER = new Uint8Array(32).fill(42);
const GUEST = "c".repeat(64);
const enc = new TextEncoder();

async function epochs(): Promise<{ first: HostingEpoch; second: HostingEpoch }> {
  const first = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: null, cap: 3 });
  const second = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: first.cid, cap: 3 });
  return { first, second };
}

describe("the POPRF is RFC 9497 ristretto255-SHA512", () => {
  test("CONTROL: the A.1.3 POPRF key vector, and a VOPRF key that differs", () => {
    const seed = new Uint8Array(32).fill(0xa3);
    expect(hex(ristretto255_oprf.poprf(enc.encode("test info")).deriveKeyPair(seed, enc.encode("test key")).secretKey))
      .toBe("145c79c108538421ac164ecbe131942136d5570b16d8bf41a24d4337da981e07");
    expect(hex(ristretto255_oprf.voprf.deriveKeyPair(seed, enc.encode("test key")).secretKey))
      .toBe("e6f73f344b79b379f1a0dd37e07ff62e38d9f71345ce62ae3a9bc60b04ccd909");
  });
});

describe("the hosting act — the epoch is its CID", () => {
  test("the act is signed by its leaf, re-derives its epoch, and every roll re-keys", async () => {
    const { first, second } = await epochs();
    expect(await verifyHostingAct(first.act)).toBe(true);
    expect(first.cid).toBe(hostingActCid(first.act));
    expect(second.act.prev).toBe(first.cid);
    expect(second.act.oprfPub).not.toBe(first.act.oprfPub);                   // a new key per act, no counter
    expect(hostingEpochOf(first.act, LEAF)?.cid).toBe(first.cid);
    expect(hostingEpochOf(first.act, OTHER)).toBeNull();                      // another leaf derives another key
    expect(await verifyHostingAct({ ...first.act, prev: "f".repeat(64) })).toBe(false);
  });

  test("CONTROL: a straight lineage, an unsigned forgery and another Nexus raise no fork; RED: an equivocating second act does", async () => {
    const { first, second } = await epochs();
    const twin = await mintHostingAct({ leafSeed: LEAF, nexusAid: AID, prev: first.cid, cap: 3 });
    expect(await hostingForks([first.act, second.act])).toEqual([]);
    expect(twin.cid).toBe(second.cid);                                        // deterministic: the same roll is the same act
    const forged = { ...second.act, oprfPub: "b".repeat(64) };
    expect(await hostingForks([first.act, second.act, forged])).toEqual([]);
    const otherKeyRoll = await mintHostingAct({ leafSeed: LEAF, nexusAid: "epoch0-" + "b".repeat(64), prev: first.cid, cap: 3 });
    expect(await hostingForks([first.act, second.act, otherKeyRoll.act])).toEqual([]);   // another Nexus, no fork
    // RED: an EQUIVOCATING hearth signs a second act from the same act under another key — one fork surfaces.
    const unsigned = { ...second.act, oprfPub: "e".repeat(64) };
    const { sig: _drop, ...body } = unsigned;
    const equivocal = { ...unsigned, sig: hex(await ed.signAsync(hostingActBytes(body), LEAF)) };
    expect(await verifyHostingAct(equivocal)).toBe(true);
    const forks = await hostingForks([first.act, second.act, equivocal]);
    expect(forks).toHaveLength(1);
    expect(forks[0]!.prev).toBe(first.cid);
    expect(forks[0]!.actCids).toEqual([second.cid, hostingActCid(equivocal)].sort());
  });

  test("the act rides the carriage board under its own key; the carriage reader never reads it as an act", async () => {
    const { first, second } = await epochs();
    const doc = emptyLarDoc();
    writeHostingAct(doc, first.act);
    writeHostingAct(doc, second.act);
    expect(hostingActsFromBoard(doc, first.act.hearthLeaf).map(hostingActCid).sort()).toEqual([first.cid, second.cid].sort());
    expect(hostingActsFromBoard(doc, "d".repeat(64))).toEqual([]);
    expect(carriageEntriesFromBoard(doc)).toEqual([]);
  });
});

describe("the token — a bearer invite of one class", () => {
  test("a host token verifies at its epoch, never at another, never as a walker invite, never tampered", async () => {
    const { first, second } = await epochs();
    const token = mintHostToken(first);
    expect(token.purpose).toBe("host-invite");
    expect(tokenVerifiesAt(first, token)).toBe(true);
    expect(tokenVerifiesAt(second, token)).toBe(false);
    expect(tokenVerifiesAt(first, { ...token, purpose: "walker-invite" })).toBe(false);
    const flipped = (token.y[0] === "0" ? "1" : "0") + token.y.slice(1);
    expect(tokenVerifiesAt(first, { ...token, y: flipped })).toBe(false);
  });

  test("the two classes evaluate apart: the same nonce yields different outputs under each purpose", async () => {
    const { first } = await epochs();
    const n = "ab".repeat(32);
    expect(evaluateToken(first, n, "host-invite")).not.toBe(evaluateToken(first, n, "walker-invite"));
  });
});

describe("the grant — keyed by the hearth, verified by the hearth alone", () => {
  test("a grant verifies at its own epoch only; renewal is deterministic and counts the epoch survived", async () => {
    const { first, second } = await epochs();
    const grant = issueGrant(first, { leaf: GUEST, lineage: "d".repeat(64), survived: 0, from: "host" });
    expect(grantVerifiesAt(first, grant)).toBe(true);
    expect(grantVerifiesAt(second, grant)).toBe(false);
    expect(grantVerifiesAt(first, { ...grant, survived: 1 })).toBe(false);
    expect(grantVerifiesAt(first, { ...grant, from: "walker" })).toBe(false);
    expect(grantVerifiesAt(first, { ...grant, leaf: "e".repeat(64) })).toBe(false);
    const renewed = renewGrant(second, grant);
    expect(renewed).toEqual(renewGrant(second, grant));
    expect(renewed).toMatchObject({ epoch: second.cid, survived: 1, lineage: grant.lineage, from: "host" });
    expect(grantVerifiesAt(second, renewed)).toBe(true);
  });

  test("RED: LABEL SEPARATION — a token's evaluation never stands as a grant tag, nor a tag as a token", async () => {
    const { first } = await epochs();
    const grant = issueGrant(first, { leaf: GUEST, lineage: "d".repeat(64), survived: 0, from: "walker" });
    expect(grantVerifiesAt(first, grant)).toBe(true);                                       // CONTROL
    // The hearth evaluates the grant's own input bytes under the TOKEN label — the oracle a walker could ask for.
    const asToken: InviteToken = { purpose: "walker-invite", n: "ab".repeat(32), y: grant.tag };
    expect(tokenVerifiesAt(first, asToken)).toBe(false);
    const forgedTag = evaluateToken(first, "ab".repeat(32), "walker-invite");
    expect(grantVerifiesAt(first, { ...grant, tag: forgedTag })).toBe(false);
  });
});

describe("the claim — derived, never stored; the lineage only its holder computes", () => {
  test("a retry re-derives the same claim and lineage; another leaf derives another claim", () => {
    const n = "ab".repeat(32);
    const claim = redeemClaim(LEAF, n);
    expect(redeemClaim(LEAF, n)).toBe(claim);
    expect(redeemClaim(OTHER, n)).not.toBe(claim);
    expect(lineageOf(n, claim)).toBe(lineageOf(n, claim));
    // What the hearth keeps — the claim's digest — does not stand in for the claim.
    expect(lineageOf(n, claimDigest(claim))).not.toBe(lineageOf(n, claim));
  });
});

describe("the carried invite — one string, naming no inviter", () => {
  test("an invite round-trips; it carries where to dial, the Nexus and the token, and nothing else", async () => {
    const { first } = await epochs();
    const invite = { nexusAid: AID, gatePubKey: "e".repeat(64), relay: "ws://hearth:8080/ws", token: mintHostToken(first) };
    const carried = encodeInvite(invite);
    expect(carried.startsWith("lar-invite:")).toBe(true);
    expect(decodeInvite(carried)).toEqual(invite);
    const body = JSON.parse(new TextDecoder().decode(base64UrlDecode(carried.slice("lar-invite:".length)))) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["gatePubKey", "nexusAid", "relay", "token"]);
  });

  test("a torn or foreign string is no invite — never a throw", () => {
    expect(decodeInvite("lar-invite:not-base64!")).toBeNull();
    expect(decodeInvite("https://elsewhere")).toBeNull();
    expect(decodeInvite("lar-invite:" + base64UrlEncode(new TextEncoder().encode(JSON.stringify({ nexusAid: AID, gatePubKey: "short", token: {} }))))).toBeNull();
  });
});

describe("the domain registry names the hosting relations and none of the retired ones", () => {
  test("RED: the hosting, knock and leaf-proof names stand; the invite, countersign and session-proof names are gone", () => {
    const names = ALL_DOMAINS.map((d) => d.slice(DOMAIN_ROOT.length + 1));
    for (const live of ["hosting-act", "hosting-key", "hosting-token", "hosting-grant", "gate-knock", "presented-leaf-proof"]) {
      expect(names, live).toContain(live);
    }
    for (const gone of ["nexus-invite", "host-countersign", "host-session-proof", "presented-admit-leaf-proof"]) {
      expect(names, gone).not.toContain(gone);
    }
    // CONTROL: a standing frozen name is untouched.
    expect(names).toContain("carriage-entry/v1");
  });
});

describe("V — the allowance vests by class, and a walker mints blind", () => {
  test("RED: a host-minted lineage holds its floor at once; a walker-minted one holds nothing until the next roll", () => {
    expect(allowance({ survived: 0, from: "host" }, 3)).toBe(1);
    expect(allowance({ survived: 0, from: "walker" }, 3)).toBe(0);
    expect(allowance({ survived: 1, from: "walker" }, 3)).toBe(1);
    expect(allowance({ survived: 1, from: "host" }, 3)).toBe(2);
    expect(allowance({ survived: 9, from: "host" }, 3)).toBe(3);        // CONTROL: the cap bounds growth
  });

  test("a walker's blind batch finalizes into tokens that redeem; the hearth's transcript names no nonce and no output", async () => {
    const { first } = await epochs();
    const pending = blindWalkerBatch(first.act, 2);
    const blinded = pending.items.map((i) => i.blinded);
    const answer = evaluateWalkerBatch(first, blinded);
    const tokens = finalizeWalkerBatch(first.act, pending, answer);
    for (const t of tokens) expect(tokenVerifiesAt(first, t)).toBe(true);
    // RED (linkage): nothing the hearth saw at issuance matches what it sees at redemption.
    const transcript = JSON.stringify({ blinded, ...answer });
    for (const t of tokens) {
      expect(transcript).not.toContain(t.n);
      expect(transcript).not.toContain(t.y);
    }
    // The same nonce blinded twice yields two unrelated elements: the blind, not the nonce, is what crosses.
    const again = blindWalkerBatch(first.act, 1);
    expect(again.items[0]!.blinded).not.toBe(pending.items[0]!.blinded);
  });

  test("RED: a batch evaluated under another key never finalizes — a hearth cannot tag one walker with its own key", async () => {
    const { first } = await epochs();
    const pending = blindWalkerBatch(first.act, 1);
    const otherEpoch = (await mintHostingAct({ leafSeed: OTHER, nexusAid: AID, prev: null, cap: 3 }));
    const tagged = evaluateWalkerBatch(otherEpoch, pending.items.map((i) => i.blinded));
    expect(() => finalizeWalkerBatch(first.act, pending, tagged)).toThrow();
  });

  test("the class label reveals the class and never the minter: every walker's token evaluates under one info", async () => {
    const { first } = await epochs();
    const p1 = blindWalkerBatch(first.act, 1);
    const p2 = blindWalkerBatch(first.act, 1);
    const t1 = finalizeWalkerBatch(first.act, p1, evaluateWalkerBatch(first, p1.items.map((i) => i.blinded)))[0]!;
    const t2 = finalizeWalkerBatch(first.act, p2, evaluateWalkerBatch(first, p2.items.map((i) => i.blinded)))[0]!;
    // Both are walker-invite tokens that verify under the one public label; nothing in either names its walker.
    expect(t1.purpose).toBe("walker-invite");
    expect(t2.purpose).toBe("walker-invite");
    expect(tokenVerifiesAt(first, t1) && tokenVerifiesAt(first, t2)).toBe(true);
    expect(Object.keys(t1).sort()).toEqual(["n", "purpose", "y"]);
    expect(tokenInfo(AID, first.cid, "walker-invite")).toEqual(tokenInfo(AID, first.cid, "walker-invite"));
    // CONTROL: the host's own class never verifies as a walker's.
    expect(tokenVerifiesAt(first, { ...mintHostToken(first), purpose: "walker-invite" })).toBe(false);
  });

  test("a lineage's mint marker is one per epoch and names no one; a batch digest moves with its batch", async () => {
    const { first, second } = await epochs();
    expect(mintMarker("d".repeat(64), first.cid)).toBe(mintMarker("d".repeat(64), first.cid));
    expect(mintMarker("d".repeat(64), first.cid)).not.toBe(mintMarker("d".repeat(64), second.cid));
    expect(batchDigest(["aa"])).not.toBe(batchDigest(["bb"]));
  });
});
