/**
 * hosting-delegation.test.ts — the operator's seat delegates to ONE hosting key, and that key signs the hosting act
 * with its three dials. Pure; no socket, no store.
 *
 * Proven:
 *   · one vector set pins the seat's delegation, the hosting key's public identity, the act image, its three dials
 *     and its CID (the epoch), so a byte that moves reads red here first;
 *   · the act reader checks the delegation under the seat AND the act under the hosting key; changing the seat, the
 *     delegation, the hosting key, the Nexus, the epoch parent or any one dial refuses by name;
 *   · CONTROL: the untouched act reads, a roll re-derives its epoch from the hosting key alone, and a seat inside the
 *     seated set reads where one outside it refuses;
 *   · the hosting key seeds each epoch: the POPRF key and the grant key both re-derive from it and move on a roll.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import {
  delegatedHostingActBytes, delegatedHostingActCid, delegatedHostingEpochOf, hostingDelegationBytes,
  mintDelegatedHostingAct, readDelegatedHostingAct, signHostingDelegation, verifyDelegatedHostingAct,
  type DelegatedHostingAct, type HostingDials,
} from "../src/hosting-delegation.js";
import { HOSTING_DELEGATED_ACT_DOMAIN, HOSTING_DELEGATION_DOMAIN } from "../src/domains.js";
import { hex } from "../src/crypto.js";

const AID      = "nexus-" + "a".repeat(64);
const SEAT     = new Uint8Array(32).fill(51);
const HOSTING  = new Uint8Array(32).fill(52);
const OTHER    = new Uint8Array(32).fill(53);
const DIALS: HostingDials = { openIntroductions: 1, preAnswered: 3, strangersHeld: 0 };

async function founded(): Promise<{ seat: string; hostingKey: string; first: Awaited<ReturnType<typeof mintDelegatedHostingAct>> }> {
  const seat = hex(await ed.getPublicKeyAsync(SEAT));
  const hostingKey = hex(await ed.getPublicKeyAsync(HOSTING));
  const delegation = await signHostingDelegation({ seatSeed: SEAT, nexusAid: AID, hostingKey });
  const first = await mintDelegatedHostingAct({ hostingSeed: HOSTING, delegation, prev: null, dials: DIALS });
  return { seat, hostingKey, first };
}

describe("the vector set — seat, delegation, hosting key, act image, three dials", () => {
  test("the bytes stand pinned", async () => {
    const { seat, hostingKey, first } = await founded();
    expect(seat).toBe(VECTOR.seat);
    expect(hostingKey).toBe(VECTOR.hostingKey);
    expect(new TextDecoder().decode(hostingDelegationBytes({ nexusAid: AID, seat, hostingKey }))).toBe(VECTOR.delegationImage);
    expect(first.act.delegation).toBe(VECTOR.delegation);
    const { sig: _sig, ...body } = first.act;
    expect(new TextDecoder().decode(delegatedHostingActBytes(body))).toBe(VECTOR.actImage);
    expect(first.act.oprfPub).toBe(VECTOR.oprfPub);
    expect(first.act.sig).toBe(VECTOR.actSig);
    expect(first.cid).toBe(VECTOR.cid);
    expect(first.grantKey).toBe(VECTOR.grantKey);
  });

  test("each image leads with its own name, and the act carries exactly the three dials", async () => {
    const { first } = await founded();
    expect(first.act.kind).toBe(HOSTING_DELEGATED_ACT_DOMAIN);
    expect(new TextDecoder().decode(hostingDelegationBytes(first.act))).toContain(HOSTING_DELEGATION_DOMAIN);
    expect(Object.keys(first.act.dials).sort()).toEqual(["openIntroductions", "preAnswered", "strangersHeld"]);
    expect(first.cid).toBe(delegatedHostingActCid(first.act));
  });
});

describe("the act reader — the seat's delegation and the hosting key's signature", () => {
  test("CONTROL: the untouched act reads, a roll from it reads, and a seated seat reads", async () => {
    const { seat, first } = await founded();
    expect(readDelegatedHostingAct(first.act)).toEqual({ ok: true, act: first.act });
    expect(readDelegatedHostingAct(first.act, { seatedKeys: [seat] }).ok).toBe(true);
    const second = await mintDelegatedHostingAct({ hostingSeed: HOSTING, delegation: delegationOf(first.act), prev: first.cid, dials: DIALS });
    expect(verifyDelegatedHostingAct(second.act)).toBe(true);
    expect(second.act.prev).toBe(first.cid);
    expect(second.act.oprfPub).not.toBe(first.act.oprfPub);       // the hosting key seeds each epoch, no counter
    expect(second.grantKey).not.toBe(first.grantKey);
    expect((await delegatedHostingEpochOf(first.act, HOSTING))?.cid).toBe(first.cid);
    expect((await delegatedHostingEpochOf(first.act, HOSTING))?.grantKey).toBe(first.grantKey);
    expect(await delegatedHostingEpochOf(first.act, OTHER)).toBeNull();
  });

  test("RED: another seat, delegation, hosting key, Nexus or epoch parent refuses by name", async () => {
    const { first } = await founded();
    const otherKey = hex(await ed.getPublicKeyAsync(OTHER));
    const cases: Array<[Partial<DelegatedHostingAct>, string]> = [
      [{ seat: otherKey }, "delegation-refused"],
      [{ delegation: "0".repeat(128) }, "delegation-refused"],
      [{ hostingKey: otherKey }, "delegation-refused"],
      [{ nexusAid: "nexus-" + "b".repeat(64) }, "delegation-refused"],
      [{ prev: "f".repeat(64) }, "act-signature-refused"],
      [{ oprfPub: "e".repeat(64) }, "act-signature-refused"],
    ];
    for (const [mutation, refusal] of cases) {
      expect(readDelegatedHostingAct({ ...first.act, ...mutation })).toEqual({ ok: false, refusal });
    }
  });

  test("RED: each dial moved alone refuses", async () => {
    const { first } = await founded();
    for (const dial of ["openIntroductions", "preAnswered", "strangersHeld"] as const) {
      const moved = { ...first.act, dials: { ...first.act.dials, [dial]: first.act.dials[dial] + 1 } };
      expect(readDelegatedHostingAct(moved)).toEqual({ ok: false, refusal: "act-signature-refused" });
    }
  });

  test("RED: a re-signed delegation from another seat under the same hosting key refuses where that seat sits unseated", async () => {
    const { seat, hostingKey, first } = await founded();
    const stranger = await signHostingDelegation({ seatSeed: OTHER, nexusAid: AID, hostingKey });
    const forged = await mintDelegatedHostingAct({ hostingSeed: HOSTING, delegation: stranger, prev: null, dials: DIALS });
    expect(verifyDelegatedHostingAct(forged.act)).toBe(true);                                    // a sound signature alone
    expect(readDelegatedHostingAct(forged.act, { seatedKeys: [seat] })).toEqual({ ok: false, refusal: "seat-unseated" });
    expect(readDelegatedHostingAct(first.act, { seatedKeys: [seat] }).ok).toBe(true);
  });

  test("RED: a seat that delegates to itself, a malformed dial and an extra field refuse", async () => {
    const { seat, first } = await founded();
    const self = await signHostingDelegation({ seatSeed: SEAT, nexusAid: AID, hostingKey: seat });
    await expect(mintDelegatedHostingAct({ hostingSeed: SEAT, delegation: self, prev: null, dials: DIALS })).rejects.toThrow(/delegation-to-self/);
    expect(readDelegatedHostingAct({ ...first.act, dials: { ...first.act.dials, strangersHeld: -1 } })).toEqual({ ok: false, refusal: "act-malformed" });
    expect(readDelegatedHostingAct({ ...first.act, dials: { ...first.act.dials, clock: 1 } })).toEqual({ ok: false, refusal: "act-malformed" });
    expect(readDelegatedHostingAct({ ...first.act, session: "face" })).toEqual({ ok: false, refusal: "act-malformed" });
    expect(readDelegatedHostingAct(null)).toEqual({ ok: false, refusal: "act-malformed" });
  });

  test("RED: a hosting seed other than the delegated key mints nothing", async () => {
    const { first } = await founded();
    await expect(mintDelegatedHostingAct({ hostingSeed: OTHER, delegation: delegationOf(first.act), prev: null, dials: DIALS }))
      .rejects.toThrow(/hosting-key-mismatch/);
  });
});

function delegationOf(act: DelegatedHostingAct) {
  return { kind: HOSTING_DELEGATION_DOMAIN, nexusAid: act.nexusAid, seat: act.seat, hostingKey: act.hostingKey, sig: act.delegation } as const;
}

// The one vector set. The domain names ride the registry's exports, which `tools/domain-registry-witness.sh` guards.
// Seeds: seat 0x33×32, hosting key 0x34×32; Nexus `nexus-a…a`; dials 1 · 3 · 0; no parent.
const VECTOR = {
  seat: "17cb79fb2b4120f2b1ec65e4198d6e08b28e813feb01e4a400839b85e18080ce",
  hostingKey: "eb2cf13bf7ae3a5f614168a1fb09272d39771ec4b8523727815e466caf8ee163",
  delegationImage: `{"hostingKey":"eb2cf13bf7ae3a5f614168a1fb09272d39771ec4b8523727815e466caf8ee163","kind":"${HOSTING_DELEGATION_DOMAIN}","nexusAid":"nexus-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","seat":"17cb79fb2b4120f2b1ec65e4198d6e08b28e813feb01e4a400839b85e18080ce"}`,
  delegation: "4242e2b9dc58f22c6345b11f6b6eaffad422054b640e3c164ef81e78d4b0c356a625fe209898eec2a70ff224f262ec4b696da6bfe7628fcc65c9641cfd0c0600",
  actImage: `{"delegation":"4242e2b9dc58f22c6345b11f6b6eaffad422054b640e3c164ef81e78d4b0c356a625fe209898eec2a70ff224f262ec4b696da6bfe7628fcc65c9641cfd0c0600","dials":{"openIntroductions":1,"preAnswered":3,"strangersHeld":0},"hostingKey":"eb2cf13bf7ae3a5f614168a1fb09272d39771ec4b8523727815e466caf8ee163","kind":"${HOSTING_DELEGATED_ACT_DOMAIN}","nexusAid":"nexus-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","oprfPub":"6a15f3d4b0719e7db1a0b27b1b98e17da55d798af3f3318f8bd84d811c5a8c0f","prev":null,"seat":"17cb79fb2b4120f2b1ec65e4198d6e08b28e813feb01e4a400839b85e18080ce"}`,
  oprfPub: "6a15f3d4b0719e7db1a0b27b1b98e17da55d798af3f3318f8bd84d811c5a8c0f",
  actSig: "d82a6a5dddf0aaeb1b30cb2af05d62fa4cf07aa4a8d8f9389ab8f4806c40e6d77b27370229b171c12854f7774e5e7e9e74720b5d03f9a7f71e36d40a5106eb0c",
  cid: "c28e18a0eba703ec8424d24eafc87f5ddd600507ac8fb8918fcccc04823a8f83",
  grantKey: "465376c1782c4064fa6eb7d7575c61770f32478c15c4c473e2116dc79597ee38",
};
