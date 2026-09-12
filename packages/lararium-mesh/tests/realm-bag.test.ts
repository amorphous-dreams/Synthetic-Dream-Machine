/**
 * realm-bag.test — the realm's shared bag registration: the name, the record, the fold, the announce, the gate.
 *
 * Proven:
 *   · the realm id reads the charter's GENESIS epoch (fixed across rotation); an unseated charter names none,
 *   · a steward-signed registration counts; a record naming an unsigned steward (conscription), a foreign
 *     realm, a tampered doc url, or a PUBLIC tier never counts (CONTROLS),
 *   · registrations accrete under distinct keys; two hands naming DIFFERENT docs for one bag equivocate and
 *     the bag stands unregistered; two hands naming the SAME doc fold to one,
 *   · the @crossroads announce carries `{ bagUri, keptBy }` and never the doc url (CONTROL),
 *   · the gate federates the realm doc + a standing bag's doc to a MEMBER peer and refuses a stranger,
 *     never widens the base, and a registration that fails to count opens no doc.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import {
  realmIdOfCharter, realmDocUrl, signRealmBagRegistration, realmBagRegistrationCounts,
  writeRealmBagRegistration, realmBagRegistrationsFromDoc, foldRealmBags,
  crossroadsAnnounceOf, writeRealmBagAnnounce, realmBagAnnounceKey, RealmBagGate, REALM_BAG_DOMAIN,
} from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import { NEXUS_DOC_DOMAIN, type NexusDoc } from "../src/nexus-seal-seed.js";
import type { LarDoc } from "../src/base-doc.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const REALM = "epoch-cid-genesis";
const A = new Uint8Array(32).fill(1);
const B = new Uint8Array(32).fill(2);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const emptyDoc = (): LarDoc => ({ tiddlers: {} }) as LarDoc;
const BAG = "lar:///ha.ka.ba/bags/lares";
const DOC_A = deterministicDocUrl("doc-a");
const DOC_B = deterministicDocUrl("doc-b");

async function stewardA() { return { signer: await pubOf(A), sign: signerOf(A) }; }
async function stewardB() { return { signer: await pubOf(B), sign: signerOf(B) }; }
async function registrationByA(docUrl: string = DOC_A) {
  return signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl, readTier: "contract" }, [await stewardA()]);
}

describe("realm-bag — the realm's name", () => {
  test("the realm id reads the charter's GENESIS epoch, fixed across a rotation", () => {
    const doc: NexusDoc = {
      kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: "epoch-1", kahu: [],
      sealLineage: [
        { epoch: 0, epochCid: REALM, keySetHash: "k0", nextKeyCommit: "n0", prevEpochCid: null },
        { epoch: 1, epochCid: "epoch-1", keySetHash: "n0", nextKeyCommit: "n1", prevEpochCid: REALM },
      ],
    };
    expect(realmIdOfCharter(doc)).toBe(REALM);
    expect(realmDocUrl(REALM)).toBe(realmDocUrl(REALM));
    expect(realmDocUrl(REALM)).not.toBe(realmDocUrl("epoch-1"));
  });
  test("CONTROL: an unseated charter names no realm", () => {
    expect(realmIdOfCharter(null)).toBeNull();
    expect(realmIdOfCharter({ kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: null, kahu: [] })).toBeNull();
  });
});

describe("realm-bag — the registration record", () => {
  test("a steward-signed registration counts", async () => {
    const rec = await registrationByA();
    expect(rec.kind).toBe(REALM_BAG_DOMAIN);
    expect(rec.keptBy).toEqual([await pubOf(A)]);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
  });
  test("CONTROL: a record naming a steward who never signed (conscription) never counts", async () => {
    const rec = await registrationByA();
    const conscripted = { ...rec, keptBy: [...rec.keptBy, await pubOf(B)] };
    expect(await realmBagRegistrationCounts(conscripted, REALM)).toBe(false);
  });
  test("CONTROL: a tampered doc url, a foreign realm, a PUBLIC tier — none counts", async () => {
    const rec = await registrationByA();
    expect(await realmBagRegistrationCounts({ ...rec, docUrl: DOC_B }, REALM)).toBe(false);
    expect(await realmBagRegistrationCounts(rec, "another-realm")).toBe(false);
    const pub = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "public" }, [await stewardA()]);
    expect(await realmBagRegistrationCounts(pub, REALM)).toBe(false);
  });
  test("two stewards sign one record — both named, both verified", async () => {
    const rec = await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [await stewardA(), await stewardB()]);
    expect(rec.keptBy).toHaveLength(2);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
    expect(await realmBagRegistrationCounts({ ...rec, signatures: rec.signatures.slice(0, 1) }, REALM)).toBe(false);
  });
});

describe("realm-bag — the doc face and the fold", () => {
  test("a registration roundtrips through write → read → fold", async () => {
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await registrationByA());
    expect(realmBagRegistrationsFromDoc(doc)).toHaveLength(1);
    const folded = await foldRealmBags(doc, REALM);
    expect(folded.get(BAG)?.docUrl).toBe(DOC_A);
  });
  test("two hands naming DIFFERENT docs for one bag equivocate — the bag stands unregistered", async () => {
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await registrationByA(DOC_A));
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_B, readTier: "contract" }, [await stewardB()]));
    expect(realmBagRegistrationsFromDoc(doc)).toHaveLength(2);   // both accrete — nothing overwrote
    expect((await foldRealmBags(doc, REALM)).has(BAG)).toBe(false);
  });
  test("two hands naming the SAME doc fold to one", async () => {
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await registrationByA(DOC_A));
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [await stewardB()]));
    expect((await foldRealmBags(doc, REALM)).get(BAG)?.docUrl).toBe(DOC_A);
  });
  test("CONTROL: an uncounted record (foreign realm) folds to nothing; an absent doc folds empty", async () => {
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await registrationByA());
    expect((await foldRealmBags(doc, "another-realm")).size).toBe(0);
    expect((await foldRealmBags(undefined, REALM)).size).toBe(0);
  });
});

describe("realm-bag — what @crossroads carries", () => {
  test("the announce names the bag and its keepers, never the doc", async () => {
    const rec = await registrationByA();
    const ann = crossroadsAnnounceOf(rec);
    expect(ann).toEqual({ kind: "lar-realm-bag-announce/v1", bagUri: BAG, keptBy: [await pubOf(A)] });
    const cross = emptyDoc();
    writeRealmBagAnnounce(cross, rec);
    const text = (cross.tiddlers[realmBagAnnounceKey(BAG)]!.tiddler as { text: string }).text;
    expect(text).not.toContain(DOC_A);           // CONTROL: the doc url never rides the public plane
    expect(text).not.toContain("automerge:");
    expect(Object.keys(cross.tiddlers)).toHaveLength(1);
  });
});

describe("realm-bag — the wire gate", () => {
  const realmUrl = realmDocUrl(REALM);
  const realmDocId = interpretAsDocumentId(realmUrl) as DocumentId;
  const bagDocId   = interpretAsDocumentId(DOC_A as AutomergeUrl) as DocumentId;
  const otherDocId = interpretAsDocumentId(DOC_B as AutomergeUrl) as DocumentId;
  const member = "peer-member" as PeerId, stranger = "peer-stranger" as PeerId;
  const membership: NexusMembership = { holdsCarriagePeer: (p) => p === member };
  const denyAll: FederationGate = { mayFederate: () => false };
  const publicShelf: FederationGate = { mayFederate: (d) => d === otherDocId };

  test("the realm doc federates to a MEMBER and refuses a STRANGER; before any fold, a bag doc opens for nobody", async () => {
    const gate = new RealmBagGate(denyAll, membership, realmUrl);
    expect(await gate.mayFederate(realmDocId, member)).toBe(true);
    expect(await gate.mayFederate(realmDocId, stranger)).toBe(false);
    expect(await gate.mayFederate(bagDocId, member)).toBe(false);
    expect(await gate.mayFederate(realmDocId)).toBe(false);   // no peer → no member → nothing
  });
  test("a standing registration opens its doc to a MEMBER alone; a stranger draws the same denial as before", async () => {
    const gate = new RealmBagGate(denyAll, membership, realmUrl);
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await registrationByA());
    await gate.refold(doc, REALM);
    expect(await gate.mayFederate(bagDocId, member)).toBe(true);
    expect(await gate.mayFederate(bagDocId, stranger)).toBe(false);
    expect(await gate.mayFederate(otherDocId, member)).toBe(false);   // an unregistered doc stays closed
    expect(gate.standingDocIds().has(bagDocId)).toBe(true);
  });
  test("CONTROL: a registration that fails to count (conscripted steward) opens no doc", async () => {
    const gate = new RealmBagGate(denyAll, membership, realmUrl);
    const rec = await registrationByA();
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, { ...rec, keptBy: [...rec.keptBy, await pubOf(B)] });
    await gate.refold(doc, REALM);
    expect(await gate.mayFederate(bagDocId, member)).toBe(false);
  });
  test("the gate never narrows the base — a public-shelf doc still crosses to a stranger", async () => {
    const gate = new RealmBagGate(publicShelf, membership, realmUrl);
    expect(await gate.mayFederate(otherDocId, stranger)).toBe(true);
  });
});
