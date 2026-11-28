/** Feed slots persist in place without per-request receipts. */
import { describe, expect, test } from "vitest";
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { faceAtomPublicKey, signAsFaceAtom } from "@lararium/mesh/face-atom";
import { realmFeedAskImage, signFaceLeafBond } from "@lararium/mesh/face-leaf-bond";
import { realmFeedSlotUri } from "@lararium/mesh/cabal-realm";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import * as verbs from "../src/cabal-realm-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const REALM = "ab".repeat(32);
const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (n * 31 + i) & 0xff);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => signAsFaceAtom(seed, bytes);

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
  const store = new MemoryTiddlerStore(VESSEL_STATE_ID);
  return { store, feed: verbs.makeCabalRealmReactors({ resolveStore: async () => store }).feed };
}

describe("a realm feed keeps its slot without per-request receipts", () => {
  test("two feeds rewrite one slot and retain the public answer", async () => {
    const { store, feed } = feedOver();
    const first = await asked("feed-1");
    const second = await asked("feed-2");
    await feed(first.args, first.context);
    expect(await feed(second.args, second.context)).toEqual({ verb: "realm-feed", realm: REALM, fed: true, federated: false });
    expect(await store.listVisible()).toEqual([realmFeedSlotUri(REALM, first.leaf)]);
    expect((await store.get(realmFeedSlotUri(REALM, first.leaf)))?.tiddler.text).toContain("2");
    expect((verbs as Record<string, unknown>)["REALM_FEED_RECEIPT_PREFIX"]).toBeUndefined();
  });
  test("a refused feed leaves no slot or receipt", async () => {
    const { store, feed } = feedOver();
    const a = await asked("feed-4");
    await expect(feed({ ...a.args, askSig: undefined }, a.context)).rejects.toThrow(/feed-ask-unsigned/);
    expect(await store.listVisible()).toEqual([]);
  });
});
