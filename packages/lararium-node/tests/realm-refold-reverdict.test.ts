/**
 * realm-refold-reverdict — THE STALE VERDICT ON THE REGISTERED BOOK.
 *
 * The wire gate's realm leg answers off a STANDING fold: a bag whose counted registration the fold drops
 * stops federating outright (`RealmBagGate.mayFederate` returns false ahead of the members lane). The fold
 * moves on every realm-doc change — including changes another member writes — while the Repo caches its
 * share verdict per (doc, peer) until `shareConfigChanged` asks it to read again.
 *
 * TWO LAWS HOLD THE BOOK OPEN. A record still short of a seal rests under its own key, so a proposal never
 * unseats the registration that stands (`realmBagProposalKey`). And every fold fires the caller's `onRefold`,
 * so a change another member wrote reaches the Repo's verdict cache with no verb run on the holding vessel.
 *
 * VECTOR 1: a proposal lands and the registered book keeps federating; a counted record that names ANOTHER
 * doc lands from another member and the book stops (the fold moved on a foreign write).
 * VECTOR 2: a realm-doc change refolds the plane and the caller hears it. CONTROL: standing the realm folds once.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  hex,
  signRealmBagRegistration, proposeRealmBagRegistration, coSignRealmBagRegistration,
  writeRealmBagRegistration, RealmBagGate, realmDocUrl, type RealmCharterConsult,
  deterministicDocUrl,
  emptyLarDoc, mutableLarRecord, type LarDoc,
  type FederationGate, type NexusMembership,
} from "@lararium/mesh";
import { makeRealmPlane } from "../src/realm-plane.js";
import { namedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { arrival, type Arrival } from "../../lararium-mesh/tests/handshake.js";

const REALM = `nexus-${"e1".repeat(32)}`;
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
  test("a proposal never drops the registered book; a foreign counted record that names another doc does", async () => {
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

    // ② B ASKS to keep the book: her proposal names [A, B] and rests under its own key, so A's counted record
    //    keeps standing and the book keeps federating while the ask waits.
    const proposal = await proposeRealmBagRegistration(parts, [{ signer: nymB, sign: signerOf(seedB) }], [nymA]);
    writeRealmBagRegistration(doc, proposal, nymB);
    await gate.refold(doc, REALM);
    const whileProposed = await gate.mayFederate(bagDoc, peerB);

    // ③ A consents on HIS vessel; the completed record lands and the widest consented set stands.
    const completed = await coSignRealmBagRegistration(proposal, { signer: nymA, sign: signerOf(seedA) });
    writeRealmBagRegistration(doc, completed, nymA);
    await gate.refold(doc, REALM);
    const afterCoSign = await gate.mayFederate(bagDoc, peerB);
    expect(gate.registrations().get(BAG)?.keptBy).toHaveLength(2);

    // ④ ANOTHER member writes a counted record that names a DIFFERENT doc for the bag: the fold equivocates
    //    and the book stops federating, with no verb run on this vessel.
    const rival = await signRealmBagRegistration({ ...parts, docUrl: deterministicDocUrl("a-rival-book") }, [{ signer: nymB, sign: signerOf(seedB) }]);
    writeRealmBagRegistration(doc, rival, nymB);
    await gate.refold(doc, REALM);
    const afterRival = await gate.mayFederate(bagDoc, peerB);

    expect([afterRegister, whileProposed, afterCoSign, afterRival]).toEqual([true, true, true, false]);
  });

  test("a realm-doc change refolds the plane and the caller hears it", async () => {
    const repo = new Repo({});
    const oracleHandle = repo.create<LarDoc>(emptyLarDoc());
    const crossroadsHandle = repo.create<LarDoc>(emptyLarDoc());
    let refolds = 0;
    let heard: Arrival<void> | null = null;
    const plane = makeRealmPlane({
      repo, oracleHandle, crossroadsHandle,
      membership: noMembers,
      base: denyAll,
      onRefold: () => { refolds += 1; heard?.arrive(); },
    });
    // The charter doc names REALM and carries no law for the plane to verify. Standing the plane awaits its own
    // first fold, so the count reads the moment `refresh` answers.
    await plane.refresh(namedCharter(REALM));
    const standUp = refolds;
    // The same charter again: the plane folds one at a time, so this call returns only after every fold asked so
    // far has run. From here on a fold has one cause left: a change to the realm doc.
    await plane.refresh(namedCharter(REALM));
    const quiet = refolds;

    // A member's co-signature arrives as a plain change on the shared realm doc — no verb runs here. The vector
    // waits on the caller's own word (`onRefold`), never on the clock.
    const realmHandle = await repo.find<LarDoc>(plane.realmUrl()!);
    // The vector's own listener counts every change the realm doc ever emits from here on, so a fold heard below
    // has exactly one change to answer for.
    let realmChanges = 0;
    realmHandle.on("change", () => { realmChanges += 1; });
    heard = arrival<void>("the fold a realm-doc change owes its caller (`onRefold` after the change)");
    realmHandle.change((d) => { d.tiddlers["probe"] = mutableLarRecord("probe", { text: "co-sign" }, REALM); });
    await heard.arrived;

    expect(standUp, "standing the realm folds once").toBeGreaterThan(0);
    expect(quiet, "CONTROL: the second refresh folded, so the count moves only by a fold").toBeGreaterThan(standUp);
    expect(refolds, "a realm-doc change must reach the caller that holds the Repo's verdict cache")
      .toBeGreaterThan(quiet);
    expect(realmChanges, "the probe stands as the one change the realm doc took, so the fold answers it").toBe(1);
    plane.dispose();
  });
});
