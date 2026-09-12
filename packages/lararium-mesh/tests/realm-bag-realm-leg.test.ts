/**
 * realm-bag-realm-leg.test — THE REALM LEG of `mayFederate`, the charter-aware `keptBy`, and the
 * registration `expiry` (the 2026-09-12 ruling: the Nexus plane decides whether a SOCKET stands; the
 * REALM's own registration decides which DOCUMENTS cross it).
 *
 * Proven:
 *   · a peer whose CONTRACT nym stands in a standing registration's `keptBy` reads that bag's doc even
 *     though no members board names it (the write side — the return lane's proof),
 *   · a peer whose contract nym HOLDS the registration's charter reads it (CONTRACT tier),
 *   · CONTROL: a stranger (no contract nym, no charter, no keptBy) draws the same denial as before,
 *   · CONTROL: a members-board peer asking for a NON-realm doc reads exactly what the base gate answers,
 *   · `keptBy` names the charter each hand holds — a two-charter book federates to either charter's holder,
 *     and CONTROL: a single-charter record signs byte-identical bytes to one that never carried the field,
 *   · an EXPIRED registration refuses the write at the realm's pace and still READS (a read-only book),
 *     and CONTROL: a registration with no expiry stands at every pace.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import {
  signRealmBagRegistration, realmBagBytes, realmBagRegistrationCounts, writeRealmBagRegistration,
  mayWriteRealmBag, foldRealmBags, registrationCharters, RealmBagGate,
  type RealmCharterConsult,
} from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const REALM = "epoch-cid-genesis";
const OTHER_CHARTER = "epoch-cid-other";
const A = new Uint8Array(32).fill(1);
const B = new Uint8Array(32).fill(2);
const C = new Uint8Array(32).fill(3);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const BAG   = "lar:///ha.ka.ba/bags/lares";
const DOC_A = deterministicDocUrl("doc-a");
const REALM_URL = deterministicDocUrl("realm-doc");
const OTHER_DOC = deterministicDocUrl("some-other-doc");
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

/** The base gate: the deterministic public shelf — it federates ONE doc and nothing else. */
const baseGate = (open: DocumentId | null): FederationGate => ({
  mayFederate: async (documentId) => open !== null && documentId === open,
});
/** The Nexus answer — a fake members board naming exactly the peers it was handed. */
const membershipOf = (...peers: string[]): NexusMembership => ({
  holdsCarriagePeer: (peerId) => peers.includes(peerId),
});
/** The realm's own consult: peer → proven contract nym, nym → the charters that hand holds. */
const charterConsult = (
  nyms: Record<string, string>, holds: Record<string, readonly string[]>,
): RealmCharterConsult => ({
  contractNymOfPeer: (peerId) => nyms[peerId] ?? null,
  holdsCharter: (nym, charterId) => (holds[nym.toLowerCase()] ?? []).includes(charterId),
});

const docWith = async (...recs: Awaited<ReturnType<typeof signRealmBagRegistration>>[]): Promise<LarDoc> => {
  const doc = { tiddlers: {} } as LarDoc;
  for (const rec of recs) writeRealmBagRegistration(doc, rec);
  return doc;
};

async function stewardA() { return { signer: await pubOf(A), sign: signerOf(A) }; }
async function stewardB() { return { signer: await pubOf(B), sign: signerOf(B) }; }

describe("realm-bag — THE REALM LEG: the registration decides which documents cross", () => {
  test("a peer whose contract nym stands in `keptBy` reads the bag's doc — no members board names it", async () => {
    const [sa, sb] = [await stewardA(), await stewardB()];
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa, sb]);
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: charterConsult({ "peer-B": sb.signer }, {}),
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-B" as PeerId)).toBe(true);
  });

  test("a peer whose contract nym HOLDS the registration's charter reads it — the CONTRACT tier", async () => {
    const sa = await stewardA();
    const reader = await pubOf(C);
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa]);
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: charterConsult({ "peer-C": reader }, { [reader]: [REALM] }),
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-C" as PeerId)).toBe(true);
  });

  test("CONTROL: a stranger — no contract nym, no charter, no keptBy — draws the same denial", async () => {
    const sa = await stewardA();
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa]);
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: charterConsult({}, {}),
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-stranger" as PeerId)).toBe(false);
  });

  test("CONTROL: a members-board peer asking a NON-realm doc reads exactly the base gate's answer", async () => {
    const sa = await stewardA();
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa]);
    const gate = new RealmBagGate(baseGate(null), membershipOf("peer-member"), REALM_URL, {
      charter: charterConsult({}, {}),
    });
    await gate.refold(await docWith(rec), REALM);
    // Off the realm's own shelf the Nexus answer never widens: the base refused, so the gate refuses.
    expect(await gate.mayFederate(idOf(OTHER_DOC), "peer-member" as PeerId)).toBe(false);
    // And the members board still carries the realm's own docs — the Nexus lane stands unchanged.
    expect(await gate.mayFederate(idOf(DOC_A), "peer-member" as PeerId)).toBe(true);
  });
});

describe("realm-bag — the charter's own HEARTH, at the far end of a dial this vessel opened", () => {
  test("the realm's registered books federate back to the hearth peer; every other peer reads as before", async () => {
    const sa = await stewardA();
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa]);
    const hearth = new Set<string>(["peer-hearth"]);
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: { ...charterConsult({}, {}), holdsCharterPeer: (peerId) => hearth.has(peerId) },
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-hearth" as PeerId)).toBe(true);
    expect(await gate.mayFederate(idOf(REALM_URL), "peer-hearth" as PeerId)).toBe(true);
    // CONTROL: the lane reaches the realm's own docs alone, and no other peer.
    expect(await gate.mayFederate(idOf(OTHER_DOC), "peer-hearth" as PeerId)).toBe(false);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-elsewhere" as PeerId)).toBe(false);
  });
});

describe("realm-bag — `keptBy` names the CHARTER each hand holds", () => {
  test("a two-charter book federates to a holder of EITHER charter", async () => {
    const [sa, sb] = [await stewardA(), await stewardB()];
    const reader = await pubOf(C);
    const rec = await signRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract", charters: { [sb.signer]: OTHER_CHARTER } },
      [sa, sb],
    );
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
    expect([...registrationCharters(rec)].sort()).toEqual([OTHER_CHARTER, REALM].sort());
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: charterConsult({ "peer-other": reader }, { [reader]: [OTHER_CHARTER] }),
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-other" as PeerId)).toBe(true);
  });

  test("CONTROL: a single-charter record signs the bytes it signed before the field existed", async () => {
    const sa = await stewardA();
    const parts = { kind: "lar-realm-bag/v1", realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" as const, keptBy: [sa.signer] };
    // The field absent, and the field naming exactly THIS realm's charter for every hand: one byte-image.
    expect(hex(realmBagBytes({ ...parts } as never)))
      .toBe(hex(realmBagBytes({ ...parts, charters: { [sa.signer]: REALM } } as never)));
  });
});

describe("realm-bag — the registration EXPIRY, read at the realm's pace", () => {
  test("past its expiry the record refuses the write and still READS — a read-only book", async () => {
    const sa = await stewardA();
    const rec = await signRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract", expiry: 12 }, [sa]);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
    const standing = await foldRealmBags(await docWith(rec), REALM);
    // At the realm's pace inside the lease the steward writes; past it, the same hand does not.
    expect(mayWriteRealmBag(standing, BAG, sa.signer, 11)).toBe(true);
    expect(mayWriteRealmBag(standing, BAG, sa.signer, 13)).toBe(false);
    // The read never dies with the lease.
    const gate = new RealmBagGate(baseGate(null), membershipOf(), REALM_URL, {
      charter: charterConsult({ "peer-A": sa.signer }, {}),
      pace: () => 13,
    });
    await gate.refold(await docWith(rec), REALM);
    expect(await gate.mayFederate(idOf(DOC_A), "peer-A" as PeerId)).toBe(true);
    expect(gate.mayWrite(BAG, sa.signer)).toBe(false);
  });

  test("CONTROL: a registration carrying no expiry stands at every pace — today's records, unmoved", async () => {
    const sa = await stewardA();
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [sa]);
    const standing = await foldRealmBags(await docWith(rec), REALM);
    expect(mayWriteRealmBag(standing, BAG, sa.signer, 1)).toBe(true);
    expect(mayWriteRealmBag(standing, BAG, sa.signer, 10_000)).toBe(true);
    expect(mayWriteRealmBag(standing, BAG, sa.signer)).toBe(true);
  });
});
