import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import { RealmBagGate, signRealmBagRegistration, writeRealmBagRegistration, type RealmCharterConsult } from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const realm = "a".repeat(64), bag = "lar:///x", seed = new Uint8Array(32).fill(7);
const peer = (s: string) => s as PeerId;
const id = (s: string): DocumentId => interpretAsDocumentId(s as never) as DocumentId;
const realmUrl = deterministicDocUrl("cabal-realm"), contractDoc = deterministicDocUrl("contract-book"), publicDoc = deterministicDocUrl("public-book");
const membership = (...members: string[]): NexusMembership => ({ holdsCarriagePeer: (p) => members.includes(p) });
const base: FederationGate = { mayFederate: async () => false };

describe("RealmBagGate cabal lane", () => {
  test("standing opens realm and registered docs; membership, hearth and contract lanes stay shut", async () => {
    const signer = hex(await ed.getPublicKeyAsync(seed));
    const rec = await signRealmBagRegistration({ realmId: realm, bagUri: bag, docUrl: contractDoc, readTier: "contract" }, [{ signer, sign: (bytes) => ed.signAsync(bytes, seed).then(hex) }]);
    const doc = { tiddlers: {} } as LarDoc; writeRealmBagRegistration(doc, rec);
    const consult: RealmCharterConsult = { contractNymOfPeer: () => null, holdsCharter: () => false, holdsCharterPeer: (p) => p === "hearth" };
    const gated = new RealmBagGate(base, membership("nexus"), realmUrl, { charter: consult, stands: (p) => p === "stands" || p === "aside", memberAside: (p) => p === "aside", nexusLane: false });
    await gated.refold(doc, realm);
    for (const p of ["stands"]) {
      expect(await gated.mayFederate(id(realmUrl), peer(p))).toBe(true);
      expect(await gated.mayFederate(id(contractDoc), peer(p))).toBe(true);
    }
    for (const p of ["nexus", "hearth", "aside"]) {
      expect(await gated.mayFederate(id(realmUrl), peer(p))).toBe(false);
      expect(await gated.mayFederate(id(contractDoc), peer(p))).toBe(false);
    }
  });

  test("carrier reads PUBLIC book only; default options preserve Nexus and hearth controls", async () => {
    const signer = hex(await ed.getPublicKeyAsync(seed));
    const recs = await Promise.all([
      signRealmBagRegistration({ realmId: realm, bagUri: "lar:///public", docUrl: publicDoc, readTier: "public" }, [{ signer, sign: (bytes) => ed.signAsync(bytes, seed).then(hex) }]),
      signRealmBagRegistration({ realmId: realm, bagUri: "lar:///contract", docUrl: contractDoc, readTier: "contract" }, [{ signer, sign: (bytes) => ed.signAsync(bytes, seed).then(hex) }]),
    ]);
    const doc = { tiddlers: {} } as LarDoc; recs.forEach((r) => writeRealmBagRegistration(doc, r));
    const charter: RealmCharterConsult = { contractNymOfPeer: () => null, holdsCharter: () => false, holdsCharterPeer: (p) => p === "hearth", carrierPeer: (p) => p === "carrier" };
    const cabal = new RealmBagGate(base, membership("nexus"), realmUrl, { charter, nexusLane: false }); await cabal.refold(doc, realm);
    expect(await cabal.mayFederate(id(publicDoc), peer("carrier"))).toBe(true);
    expect(await cabal.mayFederate(id(contractDoc), peer("carrier"))).toBe(false);
    expect(await cabal.mayFederate(id(realmUrl), peer("carrier"))).toBe(false);
    const control = new RealmBagGate(base, membership("nexus"), realmUrl, { charter }); await control.refold(doc, realm);
    expect(await control.mayFederate(id(publicDoc), peer("nexus"))).toBe(true);
    expect(await control.mayFederate(id(realmUrl), peer("hearth"))).toBe(true);
  });

  test("a standing consult that throws answers NO and rejects nothing; control: the same peer opens once the consult reads", async () => {
    const signer = hex(await ed.getPublicKeyAsync(seed));
    const rec = await signRealmBagRegistration({ realmId: realm, bagUri: bag, docUrl: contractDoc, readTier: "contract" }, [{ signer, sign: (bytes) => ed.signAsync(bytes, seed).then(hex) }]);
    const doc = { tiddlers: {} } as LarDoc; writeRealmBagRegistration(doc, rec);
    let torn = true;
    const gated = new RealmBagGate(base, membership(), realmUrl, { nexusLane: false, stands: (p) => { if (torn) throw new Error("ring torn"); return p === "stands"; } });
    await gated.refold(doc, realm);
    await expect(gated.mayFederate(id(contractDoc), peer("stands"))).resolves.toBe(false);
    torn = false;
    await expect(gated.mayFederate(id(contractDoc), peer("stands"))).resolves.toBe(true);
  });
  test("a carrier never reads the cabal realm doc, even where a PUBLIC record names it as a book; control: the carrier reads the PUBLIC book beside it", async () => {
    const signer = hex(await ed.getPublicKeyAsync(seed)), sign = (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
    const recs = await Promise.all([
      signRealmBagRegistration({ realmId: realm, bagUri: "lar:///trap", docUrl: realmUrl, readTier: "public" }, [{ signer, sign }]),
      signRealmBagRegistration({ realmId: realm, bagUri: "lar:///public", docUrl: publicDoc, readTier: "public" }, [{ signer, sign }]),
    ]);
    const doc = { tiddlers: {} } as LarDoc; recs.forEach((r) => writeRealmBagRegistration(doc, r));
    const charter: RealmCharterConsult = { contractNymOfPeer: () => null, holdsCharter: () => false, holdsCharterPeer: () => false, carrierPeer: (p) => p === "carrier" };
    const cabal = new RealmBagGate(base, membership(), realmUrl, { charter, nexusLane: false }); await cabal.refold(doc, realm);
    expect(await cabal.mayFederate(id(realmUrl), peer("carrier"))).toBe(false);
    expect(await cabal.mayFederate(id(publicDoc), peer("carrier"))).toBe(true);
  });
});
