/**
 * shadow-gates — a standing edge shadow at the share verdicts and at the realm's own gates.
 *
 * One rule serves every gate (kapae#/reach): a gate that reads a standing shadow answers as though the
 * relation never stood, and the peer draws the same `false` any other denial draws. Each vector carries a
 * control: with no shadow the lane answers exactly as it answered before.
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  federationShareDecision, identityShareDecision, carryContractShareDecision, carrierShareDecision,
  capTierShareDecision, siblingShareDecision, presenterStandsAside,
  type FederationGate, type NexusMembership, type PlaneSeal, type ShadowConsult, type SiblingShare,
} from "../src/federation-gate.js";
import { RealmBagGate, RealmBoardGate, signRealmBagRegistration, writeRealmBagRegistration, type RealmCharterConsult } from "../src/realm-bag.js";
import { deterministicDocUrl, realmEdgeBoardDocUrl, realmVouchBoardDocUrl } from "../src/deterministic-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import { pubOf, signerOf } from "./fixtures/carriage.js";

const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;
const DOC = idOf(deterministicDocUrl("a-private-plane"));
const SHELF = idOf(deterministicDocUrl("a-public-board"));
const AWAY = "device-set-aside", HOME = "device-at-home";
const shadow: ShadowConsult = { aside: (peerId) => peerId === AWAY };
const allow: FederationGate = { mayFederate: () => true };
const shelf: FederationGate = { mayFederate: (d) => d === SHELF };
const members: NexusMembership = { holdsCarriagePeer: () => true };
const sealed: PlaneSeal = { isSealedPlane: () => true };
const NONE: ReadonlySet<string> = new Set<string>();

describe("the share verdicts read the edge shadow first", () => {
  test("★ a device set aside draws false on the same-operator lane, the gated lane and the sealed lane ★", async () => {
    for (const peer of [AWAY, HOME]) {
      const want = peer === HOME;   // CONTROL: the device at home reads exactly what it read with no consult
      expect(await federationShareDecision(new Set([peer]), null, peer, DOC, null, shadow), "same-operator relay").toBe(want);
      expect(await federationShareDecision(NONE, null, peer, DOC, null, shadow), "in-process").toBe(want);
      expect(await federationShareDecision(new Set([peer]), shelf, peer, SHELF, null, shadow), "the public shelf").toBe(want);
      expect(await identityShareDecision(new Set([peer]), null, null, peer, DOC, null, shadow)).toBe(want);
      expect(await carryContractShareDecision(NONE, null, null, null, peer, DOC, shadow)).toBe(want);
      expect(await carrierShareDecision(new Set([peer]), shelf, null, null, members, sealed, peer, DOC, shadow), "the sealed carriage lane").toBe(want);
      expect(await capTierShareDecision(new Set([peer]), shelf, null, null, members, sealed, null, peer, DOC, shadow)).toBe(want);
      expect(await siblingShareDecision(allow, peer, DOC, shadow), "the sibling lane").toBe(want);
    }
    expect(presenterStandsAside(null, AWAY)).toBe(false);
    expect(await carrierShareDecision(new Set([AWAY]), shelf, null, null, members, sealed, AWAY, DOC)).toBe(true);   // CONTROL: no consult, no shadow
  });

  test("★ a sibling whose own dyad stands shadowed reaches nothing through the sibling gate ★", async () => {
    const siblings = (aside?: (p: string) => boolean): SiblingShare => ({ isSibling: () => true, gate: () => allow, ...(aside ? { aside } : {}) });
    expect(await federationShareDecision(NONE, null, AWAY, DOC, siblings((p) => p === AWAY))).toBe(false);
    expect(await federationShareDecision(NONE, null, HOME, DOC, siblings((p) => p === AWAY))).toBe(true);   // CONTROL
    expect(await federationShareDecision(NONE, null, AWAY, DOC, siblings())).toBe(true);                      // CONTROL: no consult
  });
});

describe("the realm's own gate reads the member shadow ahead of every lane", () => {
  const REALM = "epoch-cid-genesis";
  const REALM_URL = deterministicDocUrl("realm-doc");
  const BAG = "lar:///ha.ka.ba/bags/ford";
  const BAG_DOC = deterministicDocUrl("bag-doc");
  const deny: FederationGate = { mayFederate: () => false };
  const A = new Uint8Array(32).fill(1);

  async function gateWith(memberAside: ((peerId: string) => boolean) | undefined, consult: Partial<RealmCharterConsult> = {}) {
    const nym = await pubOf(A);
    const charter: RealmCharterConsult = {
      contractNymOfPeer: () => nym,
      holdsCharter: () => true,
      holdsCharterPeer: () => true,
      carrierPeer: () => true,
      ...consult,
    };
    const gate = new RealmBagGate(deny, members, REALM_URL, { charter, ...(memberAside ? { memberAside } : {}) });
    const doc = { tiddlers: {} } as LarDoc;
    writeRealmBagRegistration(doc, await signRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: BAG_DOC, readTier: "public" }, [{ signer: nym, sign: signerOf(A) }]));
    await gate.refold(doc, REALM);
    return gate;
  }

  test("★ a member set aside reads neither the realm doc nor a registered bag, by any lane ★", async () => {
    const aside = (peerId: string) => peerId === AWAY;
    // Every lane the gate holds would open for this peer: the charter's hearth, the write side, CONTRACT, the
    // carrier leg and the Nexus lane.
    const gate = await gateWith(aside);
    for (const doc of [idOf(REALM_URL), idOf(BAG_DOC)]) {
      expect(await gate.mayFederate(doc, AWAY as PeerId)).toBe(false);
      expect(await gate.mayFederate(doc, HOME as PeerId)).toBe(true);    // CONTROL: another member reads
    }
    // Each lane ALONE, so no single one slips past the shadow.
    const closed = { holdsCharterPeer: () => false, holdsCharter: () => false, carrierPeer: () => false, contractNymOfPeer: () => null };
    for (const lane of [{ holdsCharterPeer: () => true }, { contractNymOfPeer: () => "00".repeat(32), holdsCharter: () => true }, { carrierPeer: () => true }, {}]) {
      const one = await gateWith(aside, { ...closed, ...lane });
      expect(await one.mayFederate(idOf(BAG_DOC), AWAY as PeerId)).toBe(false);
      expect(await one.mayFederate(idOf(BAG_DOC), HOME as PeerId)).toBe(true);
    }
    // CONTROL: with no member consult the gate answers as it answered before.
    expect(await (await gateWith(undefined)).mayFederate(idOf(REALM_URL), AWAY as PeerId)).toBe(true);
    // The shadow scopes to the realm's own documents: a doc off the realm's shelf reads the base gate alone.
    expect(await gate.mayFederate(DOC, HOME as PeerId)).toBe(false);
    // ★ A base gate that would itself open the realm's documents opens none of them for a member set aside.
    const nym = await pubOf(A);
    const wide = new RealmBagGate(allow, members, REALM_URL, { charter: { contractNymOfPeer: () => nym, holdsCharter: () => true }, memberAside: aside });
    const doc = { tiddlers: {} } as LarDoc;
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: BAG_DOC, readTier: "contract" }, [{ signer: nym, sign: signerOf(A) }]));
    await wide.refold(doc, REALM);
    for (const realmDoc of [idOf(REALM_URL), idOf(BAG_DOC)]) {
      expect(await wide.mayFederate(realmDoc, AWAY as PeerId)).toBe(false);
      expect(await wide.mayFederate(realmDoc, HOME as PeerId)).toBe(true);
      expect(wide.holdsDoc(realmDoc)).toBe(true);
    }
    expect(await wide.mayFederate(DOC, AWAY as PeerId)).toBe(true);   // CONTROL: off the realm's plane the base gate answers
    expect(wide.holdsDoc(DOC)).toBe(false);
  });
});

describe("a realm's own boards cross to a peer that holds standing there, and to nobody else", () => {
  const REALM = "ab".repeat(32), OTHER = "cd".repeat(32);
  const boards = new Map<DocumentId, string>([
    [idOf(realmVouchBoardDocUrl(REALM)), REALM], [idOf(realmEdgeBoardDocUrl(REALM)), REALM],
    [idOf(realmEdgeBoardDocUrl(OTHER)), OTHER],
  ]);
  const stands = (peerId: string, realm: string) => peerId === HOME && realm === REALM;
  const gate = new RealmBoardGate(shelf, () => boards, stands);

  test("★ the vouch board and the edge board open for a standing member alone ★", async () => {
    for (const board of [realmVouchBoardDocUrl(REALM), realmEdgeBoardDocUrl(REALM)]) {
      expect(await gate.mayFederate(idOf(board), HOME as PeerId)).toBe(true);
      expect(await gate.mayFederate(idOf(board), AWAY as PeerId)).toBe(false);   // a member set aside, or a stranger
      expect(await gate.mayFederate(idOf(board))).toBe(false);                    // no peer named → deny
    }
    // Standing in one realm opens no other realm's board.
    expect(await gate.mayFederate(idOf(realmEdgeBoardDocUrl(OTHER)), HOME as PeerId)).toBe(false);
    // The two addresses differ per realm and per board, and neither rides the public shelf.
    expect(new Set(boards.keys()).size).toBe(3);
    expect(await shelf.mayFederate(idOf(realmEdgeBoardDocUrl(REALM)))).toBe(false);
    // CONTROL: the base gate's own surface still crosses, and a doc the gate names nowhere stays closed.
    expect(await gate.mayFederate(SHELF, AWAY as PeerId)).toBe(true);
    expect(await gate.mayFederate(DOC, HOME as PeerId)).toBe(false);
    // ★ A base gate that would open everything opens no realm board: standing alone answers for one.
    const wide = new RealmBoardGate(allow, () => boards, stands);
    expect(await wide.mayFederate(idOf(realmEdgeBoardDocUrl(REALM)), AWAY as PeerId)).toBe(false);
    expect(await wide.mayFederate(idOf(realmEdgeBoardDocUrl(REALM)))).toBe(false);
    expect(await wide.mayFederate(idOf(realmEdgeBoardDocUrl(REALM)), HOME as PeerId)).toBe(true);
    expect(await wide.mayFederate(DOC, AWAY as PeerId)).toBe(true);
  });
});
