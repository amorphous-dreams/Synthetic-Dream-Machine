/**
 * realm-feed-receipt.test — a realm feed's slot write leaves a DEVICE-LOCAL receipt tied to it (K20). The slot and the
 * receipt rest in the vessel's control document, which no peer syncs and no mirror names; the receipt lands right after
 * the slot write, keyed by the feed's own request id, so a standing receipt says its slot landed. It names the realm, the
 * epoch the roll reached and a digest of the slot it rolled: never the leaf, never the presenting face, so nothing here
 * pairs a face with its leaf, and the owner who holds the leaf proves the tie by recomputing the digest.
 */
import { describe, expect, test } from "vitest";
import {
  CONTROL_HOME_ID, defaultCryptoProvider, faceAtomPublicKey, realmFeedAskImage, realmFeedSlotUri, sha256Hex, signAsFaceAtom, signFaceLeafBond,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import * as verbs from "../src/cabal-realm-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const REALM = "ab".repeat(32);
const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (n * 31 + i) & 0xff);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => signAsFaceAtom(seed, bytes);
const RECEIPTS = `${CONTROL_HOME_ID}/ledger/realm-feed/`;

async function asked(requestId: string) {
  const atomSeed = seedOf(5);
  const leafSeed = seedOf(6);
  const atom = faceAtomPublicKey(atomSeed);
  const leaf = faceAtomPublicKey(leafSeed);
  const bond = await signFaceLeafBond({ atom, leaf, nexusAid: "bafy-nexus", realm: REALM }, { atom: signer(atomSeed), leaf: signer(leafSeed) });
  const askSig = await signAsFaceAtom(atomSeed, realmFeedAskImage({ requestId, realm: REALM, writer: leaf }));
  const context = { presenter: `0x${atom}`, local: true, invocation: { requestId } } as unknown as VerbContext;
  return { atom, leaf, args: { realm: REALM, writer: leaf, bond, askSig }, context };
}

function feedOver() {
  const store = new MemoryTiddlerStore(CONTROL_HOME_ID);
  return { store, feed: verbs.makeCabalRealmReactors({ resolveStore: async () => store }).feed };
}

describe("a realm feed's slot write leaves a device-local receipt tied to it", () => {
  test("RED: each feed leaves a receipt under its own request id naming the realm, the epoch and the slot's digest", async () => {
    const { store, feed } = feedOver();
    const first = await asked("feed-1");
    await feed(first.args, first.context);
    const second = await asked("feed-2");
    await feed(second.args, second.context);
    const slotDigest = await sha256Hex(new TextEncoder().encode(realmFeedSlotUri(REALM, first.leaf)), defaultCryptoProvider);
    const one = (await store.get(`${RECEIPTS}feed-1`))?.tiddler as Record<string, unknown> | undefined;
    const two = (await store.get(`${RECEIPTS}feed-2`))?.tiddler as Record<string, unknown> | undefined;
    expect(one).toMatchObject({ realm: REALM, epoch: "1", "slot-digest": slotDigest });
    expect(two).toMatchObject({ realm: REALM, epoch: "2", "slot-digest": slotDigest });
    expect((verbs as Record<string, unknown>)["REALM_FEED_RECEIPT_PREFIX"]).toBe(RECEIPTS);
  });

  test("RED: the receipt names neither the leaf nor the presenting face", async () => {
    const { store, feed } = feedOver();
    const a = await asked("feed-3");
    await feed(a.args, a.context);
    const receipt = await store.get(`${RECEIPTS}feed-3`);
    expect(receipt).toBeTruthy();
    const bytes = JSON.stringify(receipt).toLowerCase();
    expect(bytes).not.toContain(a.leaf.toLowerCase());
    expect(bytes).not.toContain(a.atom.toLowerCase());
  });

  test("CONTROL: a feed that refuses lands no slot and leaves no receipt", async () => {
    const { store, feed } = feedOver();
    const a = await asked("feed-4");
    await expect(feed({ ...a.args, askSig: undefined }, a.context)).rejects.toThrow(/feed-ask-unsigned/);
    expect(await store.get(realmFeedSlotUri(REALM, a.leaf))).toBeFalsy();
    expect(await store.get(`${RECEIPTS}feed-4`)).toBeFalsy();
  });
});
