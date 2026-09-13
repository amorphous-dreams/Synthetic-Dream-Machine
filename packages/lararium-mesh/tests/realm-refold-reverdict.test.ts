/**
 * realm-refold-reverdict — THE STALE VERDICT ON THE REGISTERED BOOK.
 *
 * The wire gate's realm leg answers off a STANDING fold: a bag whose counted registration the fold drops
 * stops federating outright (`RealmBagGate.mayFederate` returns false ahead of the members lane). The fold
 * moves on every realm-doc change — including changes another member writes — while the Repo caches its
 * share verdict per (doc, peer) until `shareConfigChanged` asks it to read again.
 *
 * MEASURED on `meme-realm-bag` ⑪/⑬: A registers the book (it counts, it crosses to B once), A then PROPOSES
 * B as a second steward under A's OWN key — the proposal REPLACES A's counted record (`writeRealmBagRegistration`
 * keys by `(bag, signer)`), the fold drops the bag, and A's reverdict denies B that doc. B co-signs; her
 * counted record lands on the realm doc and A's realm plane refolds on the doc's `change` — and NOTHING asks
 * the Repo to re-read the verdict. A's cached "denied" stands, and no change crosses either way after.
 *
 * RED: `makeRealmPlane` gives the caller no way to hear a refold, so the node vessel cannot reverdict on one.
 * CONTROL: a refold that moves nothing still fires (the caller, not the plane, decides what a re-read costs),
 * and the verdict walk below shows the gate's own answer moving with no verb run on the holding vessel.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import {
  signRealmBagRegistration, proposeRealmBagRegistration, coSignRealmBagRegistration,
  writeRealmBagRegistration, RealmBagGate, realmDocUrl, type RealmCharterConsult,
} from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import { emptyLarDoc, mutableLarRecord, type LarDoc } from "../src/base-doc.js";
import { makeRealmPlane } from "../src/realm-plane.js";
import type { NexusDoc } from "../src/nexus-seal-seed.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const REALM = "epoch-cid-genesis";
const BAG   = "lar:///ha.ka.ba/bags/lares";
const DOC_A = deterministicDocUrl("the-registered-book");
const seedA = new Uint8Array(32).fill(1);
const seedB = new Uint8Array(32).fill(2);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

/** The base shelf federates NOTHING — every answer below comes from the realm leg alone. */
const denyAll: FederationGate = { mayFederate: async () => false };
/** The Nexus answer for a peer the members board never names. */
const noMembers: NexusMembership = { holdsCarriagePeer: () => false };

describe("the realm fold moves the wire verdict, and the caller must hear it", () => {
  test("RED — the verdict on the registered book moves with no verb run on the holding vessel", async () => {
    const nymA = await pubOf(seedA);
    const nymB = await pubOf(seedB);
    const consult: RealmCharterConsult = {
      contractNymOfPeer: (peerId) => (peerId === "peer-B" ? nymB : null),
      // B CONTRACTED IN: she holds the realm's charter, so the leg opens a STANDING registration to her at
      // CONTRACT tier — and nothing at all once the fold stops seating one.
      holdsCharter: (nym, charterId) => nym.toLowerCase() === nymB.toLowerCase() && charterId === REALM,
    };
    const parts = { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" as const };
    const gate = new RealmBagGate(denyAll, noMembers, realmDocUrl(REALM), { charter: consult });
    const doc: LarDoc = emptyLarDoc();
    const bagDoc = idOf(DOC_A);
    const peerB = "peer-B" as PeerId;

    // ① A registers alone — the record counts and the book federates to the contracted member.
    const solo = await signRealmBagRegistration(parts, [{ signer: nymA, sign: signerOf(seedA) }]);
    writeRealmBagRegistration(doc, solo, nymA);
    await gate.refold(doc, REALM);
    const afterRegister = await gate.mayFederate(bagDoc, peerB);

    // ② A PROPOSES B as a second steward — same key, so the counted record is REPLACED by one that
    //    does not count. The fold drops the bag; the leg's `#standing.has` early-return denies it.
    const proposal = await proposeRealmBagRegistration(parts, [{ signer: nymA, sign: signerOf(seedA) }], [nymB]);
    writeRealmBagRegistration(doc, proposal, nymA);
    await gate.refold(doc, REALM);
    const whileProposed = await gate.mayFederate(bagDoc, peerB);

    // ③ B co-signs on HER vessel; the completed record reaches A only as a realm-doc change.
    const completed = await coSignRealmBagRegistration(proposal, { signer: nymB, sign: signerOf(seedB) });
    writeRealmBagRegistration(doc, completed, nymB);
    await gate.refold(doc, REALM);
    const afterCoSign = await gate.mayFederate(bagDoc, peerB);

    expect([afterRegister, whileProposed, afterCoSign]).toEqual([true, false, true]);
  });

  test("RED — a realm-doc change refolds the plane and the caller never hears it", async () => {
    const repo = new Repo({});
    const oracleHandle = repo.create<LarDoc>(emptyLarDoc());
    const crossroadsHandle = repo.create<LarDoc>(emptyLarDoc());
    const refolds: number[] = [];
    const plane = makeRealmPlane({
      repo, oracleHandle, crossroadsHandle,
      membership: noMembers,
      base: denyAll,
      onRefold: () => refolds.push(Date.now()),
    });
    await plane.refresh({ sealEpochCid: REALM } as NexusDoc);
    await new Promise((r) => setTimeout(r, 50));
    const standUp = refolds.length;

    // A member's co-signature arrives as a plain change on the shared realm doc — no verb runs here.
    const realmHandle = await repo.find<LarDoc>(plane.realmUrl()!);
    realmHandle.change((d) => { d.tiddlers["probe"] = mutableLarRecord("probe", { text: "co-sign" }, REALM); });
    await new Promise((r) => setTimeout(r, 50));

    expect(standUp, "standing the realm folds once").toBeGreaterThan(0);
    expect(refolds.length, "a realm-doc change must reach the caller that holds the Repo's verdict cache")
      .toBeGreaterThan(standUp);
    plane.dispose();
  });
});
