/**
 * realm-bag-carrier-leg.test — THE CARRIER LEG of `mayFederate`: a faceless PLACE that contracted as a
 * CARRIER reads a realm's PUBLIC-declared books by hash, and nothing else.
 *
 * The design (`bags/lares/ha.ka.ba/lares/docs/pono/heraldry.mem` #/the-herm-card): a Herm's grant is exactly
 * PUBLIC-by-hash — not CONTRACT, not a read cap. The shore already skips a CONTRACT book
 * (`bulb-read-face.ts:99`); this is the leg one step upstream, which decides whether the book's doc ever
 * reaches the Herm's replica at all.
 *
 * Proven:
 *   · a peer the consult names a CARRIER federates a bag whose standing registration declares PUBLIC,
 *   · ★ CONTROL: that SAME peer draws false for a CONTRACT-tier bag — the withholding that keeps carry ⊥ read,
 *   · ★ CONTROL: that same peer draws false for the REALM DOC itself (the registrations are not its business),
 *   · CONTROL: a carrier peer with NO registration naming the doc draws the same false a stranger draws,
 *   · CONTROL: every prior leg still answers — a `keptBy` hand, a charter holder, a members-board peer,
 *     and a stranger each read exactly as they read before the carrier leg existed.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import {
  signRealmBagRegistration, writeRealmBagRegistration, RealmBagGate, type RealmCharterConsult,
} from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const REALM = "epoch-cid-genesis";
const A = new Uint8Array(32).fill(1);
const C = new Uint8Array(32).fill(3);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

const PUBLIC_BAG   = "lar:///ha.ka.ba/bags/lares";
const CONTRACT_BAG = "lar:///ha.ka.ba/bags/ledger";
const PUBLIC_DOC   = deterministicDocUrl("public-book");
const CONTRACT_DOC = deterministicDocUrl("contract-book");
const REALM_URL    = deterministicDocUrl("realm-doc");
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

const denyAll: FederationGate = { mayFederate: async () => false };
const membershipOf = (...peers: string[]): NexusMembership => ({
  holdsCarriagePeer: (peerId) => peers.includes(peerId),
});

/** The realm's consult with the CARRIER question answered — the fold a vessel keeps off its own board. */
const consultWith = (carriers: string[], nyms: Record<string, string> = {}, holds: Record<string, readonly string[]> = {}): RealmCharterConsult => ({
  contractNymOfPeer: (peerId) => nyms[peerId] ?? null,
  holdsCharter: (nym, charterId) => (holds[nym.toLowerCase()] ?? []).includes(charterId),
  carrierPeer: (peerId) => carriers.includes(peerId),
});

async function bothBooks(): Promise<LarDoc> {
  const sa = { signer: await pubOf(A), sign: signerOf(A) };
  const doc = { tiddlers: {} } as LarDoc;
  writeRealmBagRegistration(doc, await signRealmBagRegistration(
    { realmId: REALM, bagUri: PUBLIC_BAG, docUrl: PUBLIC_DOC, readTier: "public" }, [sa]));
  writeRealmBagRegistration(doc, await signRealmBagRegistration(
    { realmId: REALM, bagUri: CONTRACT_BAG, docUrl: CONTRACT_DOC, readTier: "contract" }, [sa]));
  return doc;
}

describe("realm-bag — THE CARRIER LEG: a place carries the PUBLIC tier by hash and nothing else", () => {
  test("a CARRIER peer federates a book the registration declares PUBLIC", async () => {
    const gate = new RealmBagGate(denyAll, membershipOf(), REALM_URL, { charter: consultWith(["peer-herm"]) });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(PUBLIC_DOC), "peer-herm" as PeerId)).toBe(true);
  });

  test("★ CONTROL: the SAME carrier peer draws false for a CONTRACT-tier book ★", async () => {
    const gate = new RealmBagGate(denyAll, membershipOf(), REALM_URL, { charter: consultWith(["peer-herm"]) });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(CONTRACT_DOC), "peer-herm" as PeerId)).toBe(false);
  });

  test("★ CONTROL: the same carrier peer draws false for the REALM DOC itself ★", async () => {
    const gate = new RealmBagGate(denyAll, membershipOf(), REALM_URL, { charter: consultWith(["peer-herm"]) });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(REALM_URL), "peer-herm" as PeerId)).toBe(false);
  });

  test("CONTROL: a carrier peer asking a doc NO registration names draws the stranger's false", async () => {
    const gate = new RealmBagGate(denyAll, membershipOf(), REALM_URL, { charter: consultWith(["peer-herm"]) });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(deterministicDocUrl("nobody's-doc")), "peer-herm" as PeerId)).toBe(false);
  });

  test("CONTROL: every prior leg answers exactly as it did before the carrier leg existed", async () => {
    const keeper = await pubOf(A);
    const reader = await pubOf(C);
    const gate = new RealmBagGate(denyAll, membershipOf("peer-member"), REALM_URL, {
      charter: consultWith([], { "peer-keeper": keeper, "peer-reader": reader }, { [reader]: [REALM] }),
    });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(CONTRACT_DOC), "peer-keeper" as PeerId)).toBe(true);    // the write side
    expect(await gate.mayFederate(idOf(CONTRACT_DOC), "peer-reader" as PeerId)).toBe(true);    // CONTRACT tier
    expect(await gate.mayFederate(idOf(CONTRACT_DOC), "peer-member" as PeerId)).toBe(true);    // the Nexus lane
    expect(await gate.mayFederate(idOf(CONTRACT_DOC), "peer-stranger" as PeerId)).toBe(false); // a stranger
  });

  test("CONTROL: a consult that answers NO carrier question behaves exactly as before", async () => {
    const gate = new RealmBagGate(denyAll, membershipOf(), REALM_URL, {
      charter: { contractNymOfPeer: () => null, holdsCharter: () => false },
    });
    await gate.refold(await bothBooks(), REALM);
    expect(await gate.mayFederate(idOf(PUBLIC_DOC), "peer-herm" as PeerId)).toBe(false);
  });
});
