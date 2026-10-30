/**
 * realm-feed binds its writer to the presenter through the face→leaf bond. The writer a feed names is the face's leaf
 * key at the realm's Nexus; the feed lands only where a bond both ends signed ties that leaf to the presenting face's
 * atom for this realm, and only for an ask that arrived local (a session, the vessel's own channel). A synced summons
 * names a presenter it cannot back, so it feeds nothing, bond or no bond.
 */
import { describe, expect, test } from "vitest";
import { DAEMON_BAG_ID, faceAtomPublicKey, realmFeedAskImage, realmFeedSlotUri, signAsFaceAtom, signFaceLeafBond } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeCabalRealmReactors } from "../src/cabal-realm-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const REALM = "ab".repeat(32);
const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (n * 17 + i) & 0xff);
// Every key here is an Ed25519 seed: the atom's helpers sign the leaf half as well.
const keyOf = async (seed: Uint8Array) => faceAtomPublicKey(seed);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => signAsFaceAtom(seed, bytes);

async function face(atomN: number, leafN: number, realm = REALM) {
  const atom = await keyOf(seedOf(atomN));
  const leaf = await keyOf(seedOf(leafN));
  const bond = await signFaceLeafBond({ atom, leaf, nexusAid: "bafy-nexus", realm }, { atom: signer(seedOf(atomN)), leaf: signer(seedOf(leafN)) });
  return { presenter: `0x${atom}`, leaf, bond };
}
const ctx = (presenter: string, local = true) => ({ presenter, local }) as unknown as VerbContext;
function feedOver() {
  const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
  return { store, feed: makeCabalRealmReactors({ resolveStore: async () => store }).feed };
}

describe("realm-feed's writer is bound to the presenter", () => {
  test("CONTROL: a face's own bond feeds as its own leaf, and the slot lands under that leaf", async () => {
    const { store, feed } = feedOver();
    const b = await face(2, 3);
    expect(await feed({ realm: REALM, writer: b.leaf, bond: b.bond }, ctx(b.presenter))).toMatchObject({ verb: "realm-feed", writer: b.leaf, epoch: 1 });
    expect((await store.get(realmFeedSlotUri(REALM, b.leaf)))?.tiddler.text).toBe("1");
  });

  test("RED: a writer the presenter holds no bond for refuses writer-not-presenter, and lands no slot", async () => {
    const { store, feed } = feedOver();
    const a = await face(1, 4);
    const b = await face(2, 3);
    // Face B presents A's bond for A's leaf: the bond names A's atom, never B's.
    await expect(feed({ realm: REALM, writer: a.leaf, bond: a.bond }, ctx(b.presenter))).rejects.toThrow(/writer-not-presenter/);
    // B names A's leaf under its own bond: the bond names B's leaf.
    await expect(feed({ realm: REALM, writer: a.leaf, bond: b.bond }, ctx(b.presenter))).rejects.toThrow(/writer-not-presenter/);
    // No bond at all.
    await expect(feed({ realm: REALM, writer: b.leaf }, ctx(b.presenter))).rejects.toThrow(/writer-not-presenter/);
    // A bond for another realm.
    const elsewhere = await face(2, 3, "cd".repeat(32));
    await expect(feed({ realm: REALM, writer: b.leaf, bond: elsewhere.bond }, ctx(b.presenter))).rejects.toThrow(/writer-not-presenter/);
    expect(await store.get(realmFeedSlotUri(REALM, a.leaf))).toBeFalsy();
    expect(await store.get(realmFeedSlotUri(REALM, b.leaf))).toBeFalsy();
  });

  test("RED: a synced summons feeds nothing, even naming a presenter and its whole bond; CONTROL: no presenter refuses too", async () => {
    const { feed } = feedOver();
    const b = await face(2, 3);
    await expect(feed({ realm: REALM, writer: b.leaf, bond: b.bond }, ctx(b.presenter, false))).rejects.toThrow(/realm-feed-not-local/);
    await expect(feed({ realm: REALM, writer: b.leaf, bond: b.bond }, { local: true } as unknown as VerbContext)).rejects.toThrow(/writer-not-presenter/);
  });
});

/** Sol's read: a bond proves a past signing, never a present hand, so each feed carries the atom's signature over its own ask. */
describe("realm-feed takes a fresh ask from the face, and answers nothing that pairs the face with its leaf", () => {
  const atomSeed = seedOf(7);
  const leafSeed = seedOf(8);
  async function asked(requestId: string, writer?: string) {
    const atom = faceAtomPublicKey(atomSeed);
    const leaf = faceAtomPublicKey(leafSeed);
    const bond = await signFaceLeafBond({ atom, leaf, nexusAid: "bafy-nexus", realm: REALM }, { atom: signer(atomSeed), leaf: signer(leafSeed) });
    const askSig = await signAsFaceAtom(atomSeed, realmFeedAskImage({ requestId, realm: REALM, writer: leaf }));
    const context = { presenter: `0x${atom}`, local: true, invocation: { requestId } } as unknown as VerbContext;
    return { leaf, args: { realm: REALM, writer: writer ?? leaf, bond, askSig }, context };
  }

  test("RED: a whole bond with no ask signed over this request refuses feed-ask-unsigned; CONTROL: the ask signed for it feeds", async () => {
    const { store, feed } = feedOver();
    const a = await asked("req-1");
    const { askSig: _drop, ...replayed } = a.args;
    await expect(feed(replayed, a.context)).rejects.toThrow(/feed-ask-unsigned/);
    // An ask signed for another request, replayed under this one.
    const other = await asked("req-0");
    await expect(feed({ ...a.args, askSig: other.args.askSig }, a.context)).rejects.toThrow(/feed-ask-unsigned/);
    expect(await store.get(realmFeedSlotUri(REALM, a.leaf))).toBeFalsy();
    await feed(a.args, a.context);
    expect((await store.get(realmFeedSlotUri(REALM, a.leaf)))?.tiddler.text).toBe("1");
  });

  test("RED: the answer names neither the writer nor the epoch; a 0x writer lands under the bond's own leaf", async () => {
    const { store, feed } = feedOver();
    const a = await asked("req-2", `0x${faceAtomPublicKey(leafSeed)}`);
    const out = await feed(a.args, a.context);
    expect(out).toEqual({ verb: "realm-feed", realm: REALM, fed: true, federated: false });
    expect((await store.get(realmFeedSlotUri(REALM, a.leaf)))?.tiddler.text).toBe("1");
    expect(await store.get(realmFeedSlotUri(REALM, `0x${a.leaf}`))).toBeFalsy();
  });
});
