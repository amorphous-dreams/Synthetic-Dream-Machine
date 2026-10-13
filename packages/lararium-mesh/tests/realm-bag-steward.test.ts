/**
 * realm-bag-steward.test — WHO stands on a counted registration: the kept names, each once, and no other key.
 *
 * A steward's name reads a face key or a Handle prefix (`steward-seal`). The fold counts a record only when it
 * carries exactly its stewards' seals. Each vector names its control:
 *
 *   F1 a record that counts, given one EXTRA seal under a key it does not keep, stops counting (so no key
 *      rides a counted record beside its stewards) / the same record without the extra seal counts.
 *   F2 a name the record spells twice, and a name stored in upper case, each refuse / the canonical record counts.
 *   F3 a HANDLE keeps a bag: the record counts under the Handle's prefix and the write cap answers that prefix
 *      alone / a reader that holds the Handle's rotated chain folds the bag away, and the face key behind the
 *      Handle writes nothing.
 *   F4 a face proposes a Handle as second steward and the Handle completes the SAME bytes / before its hand the
 *      record counts nothing.
 *   F5 a seal moved under another kept name never counts for it / each seal under its own name counts.
 *   F6 a stored record past the size bound reads as no record / the same record under the bound folds.
 *   F7 A NAME ENTERS BY ITS OWN HAND FIRST: `stewardSealedHere` answers for a name whose own seal verifies on a
 *      record of this realm / a name another hand merely listed, a seal over another realm's record, and a
 *      seal by another key under that name each read unproven.
 *   F8 a proposal rests under its own key and never unseats the writer's counted record / the old shape of
 *      the hazard: the same proposal written over the counted key drops the bag.
 *   F9 `realmBagSealedBy` names the kept stewards whose seals verify / a seal outside `keptBy`, and a seal
 *      that fails, add nobody.
 *   F10 the wire gate's own refold reads a Handle seal against the vessel's chain / with no chain it stands.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  signRealmBagRegistration, proposeRealmBagRegistration, coSignRealmBagRegistration, realmBagRegistrationCounts,
  realmBagRegistrationsFromDoc, writeRealmBagRegistration, realmBagKey, realmBagProposalKey, realmBagBytes, foldRealmBags,
  mayWriteRealmBag, stewardSealedHere, realmBagSealedBy, RealmBagGate, realmDocUrl,
  REALM_BAG_RECORD_MAX, type RealmBagRegistration, type StewardSigner,
} from "../src/realm-bag.js";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";
import { handleKeyDigestOf, mintHandleInception, mintHandleRotation, type HandleKelEvent } from "../src/handle-kel.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import type { LarDoc } from "../src/base-doc.js";

const REALM = "epoch-cid-genesis";
const BAG   = "lar:///ha.ka.ba/bags/commons";
const DOC   = deterministicDocUrl("the-commons-book");
const seed = (n: number) => new Uint8Array(32).fill(n);
const signerOf = (s: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, s).then(hex);
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const face = async (s: Uint8Array): Promise<StewardSigner> => ({ signer: await pubOf(s), sign: signerOf(s) });
const emptyDoc = (): LarDoc => ({ tiddlers: {} }) as LarDoc;
const parts = { realmId: REALM, bagUri: BAG, docUrl: DOC, readTier: "contract" as const };

const A = seed(1), B = seed(2), ROOT = seed(9), HANDLE_KEY = seed(51), HANDLE_NEXT = seed(52), OWNER = seed(61);

/** A founded 1-of-1 Handle, and the signer its head key seals with. */
async function handle() {
  const key = `0x${await pubOf(HANDLE_KEY)}`, next = `0x${await pubOf(HANDLE_NEXT)}`, owner = `0x${await pubOf(OWNER)}`;
  const ownerPrefix = `persona-${"ab".repeat(32)}`;
  const inception = mintHandleInception(key, ownerPrefix, `recovery-${"cd".repeat(32)}`, handleKeyDigestOf(next));
  const chain: HandleKelEvent[] = [inception];
  const signer: StewardSigner = { signer: inception.prefix, sign: signerOf(HANDLE_KEY), chain };
  return { prefix: inception.prefix, inception, chain, signer, next, owner, ownerPrefix };
}

describe("realm-bag — a counted record carries its stewards' seals and no other key", () => {
  test("F1 an extra seal under a key the record does not keep stops the count", async () => {
    const rec = await signRealmBagRegistration(parts, [await face(A)]);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
    const root = await pubOf(ROOT);
    const smuggled: RealmBagRegistration = { ...rec, signatures: [...rec.signatures, { signer: root, sig: await signerOf(ROOT)(new Uint8Array([1])) }] };
    expect(await realmBagRegistrationCounts(smuggled, REALM)).toBe(false);
    // The same holds for a WELL-FORMED seal over the record's own bytes by a key outside `keptBy`.
    const cosigned = await coSignRealmBagRegistration(rec, await face(ROOT));
    expect(cosigned.signatures.map((s) => s.signer)).toContain(root);
    expect(await realmBagRegistrationCounts(cosigned, REALM)).toBe(false);
  });

  test("F2 a name spelled twice, and a name in upper case, each refuse", async () => {
    const rec = await signRealmBagRegistration(parts, [await face(A)]);
    const a = await pubOf(A);
    // The record spells A twice and A seals THOSE bytes twice: every seal verifies, and the count still refuses.
    const { signatures: _, ...unsigned } = { ...rec, keptBy: [a, a] };
    const sig = await signerOf(A)(realmBagBytes(unsigned));
    const twice: RealmBagRegistration = { ...unsigned, signatures: [{ signer: a, sig }, { signer: a, sig }] };
    expect(await realmBagRegistrationCounts(twice, REALM)).toBe(false);
    const shouted: RealmBagRegistration = { ...rec, keptBy: [a.toUpperCase()], signatures: [{ ...rec.signatures[0]!, signer: a.toUpperCase() }] };
    expect(await realmBagRegistrationCounts(shouted, REALM)).toBe(false);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);                       // CONTROL
  });

  test("F3 a Handle keeps a bag; a reader that holds its rotated chain folds the bag away", async () => {
    const h = await handle();
    const rec = await signRealmBagRegistration(parts, [h.signer]);
    expect(rec.keptBy).toEqual([h.prefix]);
    expect(rec.signatures[0]!.chain).toHaveLength(1);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, rec, h.prefix);
    // The stored record reads back whole, chain and all, and the fold seats it.
    expect(realmBagRegistrationsFromDoc(doc)[0]!.signatures[0]!.chain).toHaveLength(1);
    const standing = await foldRealmBags(doc, REALM);
    expect(mayWriteRealmBag(standing, BAG, h.prefix)).toBe(true);
    // The write cap answers the NAME the record keeps: the face key behind the Handle holds no cap by it.
    expect(mayWriteRealmBag(standing, BAG, await pubOf(HANDLE_KEY))).toBe(false);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(OWNER))).toBe(false);
    // A reader whose own handle book holds the ROTATED chain reads the seal stale: the bag stands unregistered.
    const rotation = await mintHandleRotation({
      head: h.inception, freshHandleKeyDid: h.next, nextHandleKeyDigest: `hkeynext-${"ef".repeat(32)}`,
      ownerAuthMemberPrefix: h.ownerPrefix, ownerHeadOpKeyDid: h.owner, sign: signerOf(OWNER),
    });
    expect(rotation.ok).toBe(true);
    if (!rotation.ok) return;
    const rotated = [h.inception, rotation.event];
    expect((await foldRealmBags(doc, REALM, { heldChain: (prefix) => (prefix === h.prefix ? rotated : null) })).has(BAG)).toBe(false);
    expect((await foldRealmBags(doc, REALM, { heldChain: () => null })).has(BAG)).toBe(true);     // CONTROL
    // A handle book answers through a promise, and a book that will not open reads the seal as no seal.
    expect((await foldRealmBags(doc, REALM, { heldChain: async () => rotated })).has(BAG)).toBe(false);
    expect((await foldRealmBags(doc, REALM, { heldChain: async () => null })).has(BAG)).toBe(true);
    expect((await foldRealmBags(doc, REALM, { heldChain: async () => { throw new Error("custody rests at the floor"); } })).has(BAG)).toBe(false);
  });

  test("F4 a face proposes a Handle as second steward, and the Handle completes the same bytes", async () => {
    const h = await handle();
    const proposal = await proposeRealmBagRegistration(parts, [await face(A)], [h.prefix]);
    expect([...proposal.keptBy].sort()).toEqual([await pubOf(A), h.prefix].sort());
    expect(await realmBagRegistrationCounts(proposal, REALM)).toBe(false);                 // CONTROL: one hand of two
    const done = await coSignRealmBagRegistration(proposal, h.signer);
    expect(await realmBagRegistrationCounts(done, REALM)).toBe(true);
    // The face's key completing the Handle's place never counts: the seal stands under the wrong name.
    const wrong = await coSignRealmBagRegistration(proposal, await face(HANDLE_KEY));
    expect(await realmBagRegistrationCounts(wrong, REALM)).toBe(false);
  });

  test("F5 a seal moved under another kept name never counts for it", async () => {
    const rec = await signRealmBagRegistration(parts, [await face(A), await face(B)]);
    expect(await realmBagRegistrationCounts(rec, REALM)).toBe(true);                       // CONTROL
    const [first, second] = rec.signatures as [RealmBagRegistration["signatures"][number], RealmBagRegistration["signatures"][number]];
    const swapped: RealmBagRegistration = { ...rec, signatures: [{ ...first, signer: second.signer }, { ...second, signer: first.signer }] };
    expect(await realmBagRegistrationCounts(swapped, REALM)).toBe(false);
  });

  test("F6 a stored record past the size bound reads as no record", async () => {
    const rec = await signRealmBagRegistration(parts, [await face(A)]);
    const doc = emptyDoc();
    const key = realmBagKey(BAG, rec.keptBy[0]!);
    const padded = JSON.stringify({ ...rec, pad: "x".repeat(REALM_BAG_RECORD_MAX) });
    doc.tiddlers[key] = storedLarRecord(key, { text: padded }, REALM);
    expect(realmBagRegistrationsFromDoc(doc)).toHaveLength(0);
    expect((await foldRealmBags(doc, REALM)).has(BAG)).toBe(false);
    writeRealmBagRegistration(doc, rec, rec.keptBy[0]!);                                    // CONTROL: under the bound
    expect((await foldRealmBags(doc, REALM)).has(BAG)).toBe(true);
  });

  test("F7 a name stands proven here only by its own verifying seal on a record of this realm", async () => {
    const a = await pubOf(A), b = await pubOf(B);
    const doc = emptyDoc();
    // A seals a record that merely LISTS B: A stands proven, and B, whom another hand named, does not.
    const proposal = await proposeRealmBagRegistration(parts, [await face(A)], [b]);
    writeRealmBagRegistration(doc, proposal, a);
    expect(await stewardSealedHere(doc, REALM, a)).toBe(true);
    expect(await stewardSealedHere(doc, REALM, b)).toBe(false);
    // A seal under B's name by ANOTHER key proves nothing.
    const forged: RealmBagRegistration = { ...proposal, signatures: [...proposal.signatures, { signer: b, sig: await signerOf(ROOT)(realmBagBytes(proposal)) }] };
    const forgedDoc = emptyDoc();
    writeRealmBagRegistration(forgedDoc, forged, a);
    expect(await stewardSealedHere(forgedDoc, REALM, b)).toBe(false);
    // B's own seal over ANOTHER realm's record proves nothing here.
    const elsewhere = await signRealmBagRegistration({ ...parts, realmId: "another-realm" }, [await face(B)]);
    writeRealmBagRegistration(doc, elsewhere, b);
    expect(await stewardSealedHere(doc, REALM, b)).toBe(false);
    expect(await stewardSealedHere(doc, "another-realm", b)).toBe(true);
    // CONTROL: once B's own hand seals a record of THIS realm, any record at all, B stands proven here.
    const own = await signRealmBagRegistration({ ...parts, bagUri: "lar:///ha.ka.ba/bags/other" }, [await face(B)]);
    writeRealmBagRegistration(doc, own, b);
    expect(await stewardSealedHere(doc, REALM, b)).toBe(true);
  });

  test("F8 a proposal rests under its own key and never unseats the writer's counted record", async () => {
    const a = await pubOf(A), b = await pubOf(B);
    const doc = emptyDoc();
    const solo = await signRealmBagRegistration(parts, [await face(A)]);
    writeRealmBagRegistration(doc, solo, a);
    const proposal = await proposeRealmBagRegistration(parts, [await face(A)], [b]);
    writeRealmBagRegistration(doc, proposal, a);
    expect(Object.keys(doc.tiddlers).sort()).toEqual([realmBagKey(BAG, a), realmBagProposalKey(BAG, a)].sort());
    expect((await foldRealmBags(doc, REALM)).get(BAG)?.keptBy).toEqual([a]);
    // The hazard this key closes: the same proposal written OVER the counted key drops the bag.
    doc.tiddlers[realmBagKey(BAG, a)] = storedLarRecord(realmBagKey(BAG, a), { text: JSON.stringify(proposal) }, REALM);
    expect((await foldRealmBags(doc, REALM)).has(BAG)).toBe(false);
    // A writer that VERIFIED its record says so: a record with one seal per name that still counts nothing
    // (a junk seal) rests under the proposal key when the writer names it short.
    const junk: RealmBagRegistration = { ...proposal, signatures: [...proposal.signatures, { signer: b, sig: "00".repeat(64) }] };
    const told = emptyDoc(), guessed = emptyDoc();
    writeRealmBagRegistration(told, junk, a, false);
    writeRealmBagRegistration(guessed, junk, a);
    expect(Object.keys(told.tiddlers)).toEqual([realmBagProposalKey(BAG, a)]);
    expect(Object.keys(guessed.tiddlers)).toEqual([realmBagKey(BAG, a)]);            // the shape alone reads it whole
  });

  test("F9 the sealed names read kept stewards with verifying seals alone", async () => {
    const a = await pubOf(A), b = await pubOf(B);
    const proposal = await proposeRealmBagRegistration(parts, [await face(A)], [b]);
    expect(await realmBagSealedBy(proposal)).toEqual([a]);
    const done = await coSignRealmBagRegistration(proposal, await face(B));
    expect([...(await realmBagSealedBy(done))].sort()).toEqual([a, b].sort());
    const stray = await coSignRealmBagRegistration(proposal, await face(ROOT));          // outside `keptBy`
    expect(await realmBagSealedBy(stray)).toEqual([a]);
    const broken: RealmBagRegistration = { ...done, signatures: done.signatures.map((s) => (s.signer === b ? { ...s, sig: "00".repeat(64) } : s)) };
    expect(await realmBagSealedBy(broken)).toEqual([a]);
  });

  test("F10 the wire gate's refold reads a Handle seal against the vessel's own chain", async () => {
    const h = await handle();
    const rec = await signRealmBagRegistration(parts, [h.signer]);
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, rec, h.prefix);
    const rotation = await mintHandleRotation({
      head: h.inception, freshHandleKeyDid: h.next, nextHandleKeyDigest: `hkeynext-${"ef".repeat(32)}`,
      ownerAuthMemberPrefix: h.ownerPrefix, ownerHeadOpKeyDid: h.owner, sign: signerOf(OWNER),
    });
    expect(rotation.ok).toBe(true);
    if (!rotation.ok) return;
    const rotated = [h.inception, rotation.event];
    const denyAll: FederationGate = { mayFederate: async () => false };
    const everyone: NexusMembership = { holdsCarriagePeer: () => true };
    const bagDoc = interpretAsDocumentId(DOC as never) as DocumentId, peer = "peer-m" as PeerId;
    const blind = new RealmBagGate(denyAll, everyone, realmDocUrl(REALM));
    await blind.refold(doc, REALM);
    expect(await blind.mayFederate(bagDoc, peer)).toBe(true);                              // CONTROL: no chain held
    const knowing = new RealmBagGate(denyAll, everyone, realmDocUrl(REALM), { sealReading: { heldChain: (p) => (p === h.prefix ? rotated : null) } });
    await knowing.refold(doc, REALM);
    expect(knowing.registrations().has(BAG)).toBe(false);
    expect(await knowing.mayFederate(bagDoc, peer)).toBe(false);
  });
});
