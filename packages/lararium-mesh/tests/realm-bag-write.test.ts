/**
 * realm-bag-write.test — THE WRITE CAP: the named stewards' set.
 *
 * The read cap (CONTRACT) and the write cap (the stewards) part here. Proven:
 *   · `mayWriteRealmBag` answers off the STANDING fold's `keptBy` — a steward writes, a contracted member
 *     who keeps nothing does not, a stranger does not, an equivocal bag opens to nobody (CONTROLS),
 *   · `RealmBagGate.mayWrite(bag, nym)` carries that same answer at the wire holder,
 *   · NAMING A SECOND STEWARD is n-of-n, so it takes TWO hands: A's proposal names [A, B] and does NOT
 *     count (a named-but-unsigned steward is conscription); B's co-sign on her own next present completes
 *     the SAME bytes and it counts, accreting under B's own key so A's record is never overwritten.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  signRealmBagRegistration, proposeRealmBagRegistration, coSignRealmBagRegistration,
  realmBagRegistrationCounts, writeRealmBagRegistration, realmBagKey, foldRealmBags,
  mayWriteRealmBag, RealmBagGate, realmDocUrl,
} from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import type { LarDoc } from "../src/base-doc.js";
import type { FederationGate, NexusMembership } from "../src/federation-gate.js";

const REALM = "epoch-cid-genesis";
const A = new Uint8Array(32).fill(1);
const B = new Uint8Array(32).fill(2);
const C = new Uint8Array(32).fill(3);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const emptyDoc = (): LarDoc => ({ tiddlers: {} }) as LarDoc;
const BAG = "lar:///ha.ka.ba/bags/lares";
const DOC_A = deterministicDocUrl("doc-a");
const DOC_B = deterministicDocUrl("doc-b");
const stewardOf = async (seed: Uint8Array) => ({ signer: await pubOf(seed), sign: signerOf(seed) });

describe("realm-bag — naming a SECOND steward takes two hands (n-of-n)", () => {
  test("A's proposal names [A, B] and does NOT count — a named-but-unsigned steward is conscription", async () => {
    const prop = await proposeRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" },
      [await stewardOf(A)], [await pubOf(B)],
    );
    expect([...prop.keptBy].sort()).toEqual([await pubOf(A), await pubOf(B)].sort());
    expect(prop.signatures).toHaveLength(1);
    expect(await realmBagRegistrationCounts(prop, REALM)).toBe(false);
  });

  test("B's co-sign completes the SAME bytes — it counts, and it accretes under B's OWN key", async () => {
    const prop = await proposeRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" },
      [await stewardOf(A)], [await pubOf(B)],
    );
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, prop, await pubOf(A));
    expect((await foldRealmBags(doc, REALM)).has(BAG)).toBe(false);   // the proposal stands unregistered

    const done = await coSignRealmBagRegistration(prop, await stewardOf(B));
    expect(await realmBagRegistrationCounts(done, REALM)).toBe(true);
    writeRealmBagRegistration(doc, done, await pubOf(B));
    expect(Object.keys(doc.tiddlers)).toHaveLength(2);               // A's proposal was never overwritten
    expect(doc.tiddlers[realmBagKey(BAG, await pubOf(A))]).toBeDefined();
    expect(doc.tiddlers[realmBagKey(BAG, await pubOf(B))]).toBeDefined();
    expect((await foldRealmBags(doc, REALM)).get(BAG)?.docUrl).toBe(DOC_A);
  });

  test("CONTROL: a co-sign from a hand the record never named changes nothing that counts", async () => {
    const prop = await proposeRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" },
      [await stewardOf(A)], [await pubOf(B)],
    );
    const byC = await coSignRealmBagRegistration(prop, await stewardOf(C));
    expect(await realmBagRegistrationCounts(byC, REALM)).toBe(false);
  });
});

describe("realm-bag — the write cap is the named stewards' set", () => {
  const standingOf = async (doc: LarDoc) => foldRealmBags(doc, REALM);

  test("a STEWARD writes; a contracted member who keeps nothing does not; a stranger does not", async () => {
    const doc = emptyDoc();
    const prop = await proposeRealmBagRegistration(
      { realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" },
      [await stewardOf(A)], [await pubOf(B)],
    );
    writeRealmBagRegistration(doc, await coSignRealmBagRegistration(prop, await stewardOf(B)), await pubOf(B));
    const standing = await standingOf(doc);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(A))).toBe(true);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(B))).toBe(true);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(C))).toBe(false);
    expect(mayWriteRealmBag(standing, "lar:///ha.ka.ba/bags/other", await pubOf(A))).toBe(false);
  });

  test("CONTROL: a bag whose registrations EQUIVOCATE opens to nobody", async () => {
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [await stewardOf(A)]));
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_B, readTier: "contract" }, [await stewardOf(B)]));
    const standing = await standingOf(doc);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(A))).toBe(false);
    expect(mayWriteRealmBag(standing, BAG, await pubOf(B))).toBe(false);
  });

  test("the gate carries the same answer — mayWrite off its own standing fold", async () => {
    const denyAll: FederationGate = { mayFederate: () => false };
    const membership: NexusMembership = { holdsCarriagePeer: () => true };
    const gate = new RealmBagGate(denyAll, membership, realmDocUrl(REALM));
    const doc = emptyDoc();
    writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: BAG, docUrl: DOC_A, readTier: "contract" }, [await stewardOf(A)]));
    await gate.refold(doc, REALM);
    expect(gate.mayWrite(BAG, await pubOf(A))).toBe(true);
    expect(gate.mayWrite(BAG, await pubOf(B))).toBe(false);   // CONTROL: a member peer is not a steward
    expect(gate.mayWrite(BAG, await pubOf(C))).toBe(false);
  });
});
