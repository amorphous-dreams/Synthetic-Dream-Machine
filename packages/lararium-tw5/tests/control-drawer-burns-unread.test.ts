import { expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { VESSEL_STATE_HOME } from "@lararium/mesh/vessel-state";
import { faceAtomPublicKey, signAsFaceAtom } from "@lararium/mesh/face-atom";
import { realmFeedAskImage, signFaceLeafBond } from "@lararium/mesh/face-leaf-bond";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWardAlertReactor, HOME_WIKI_TITLE } from "../src/index.js";
import { makeRealmFeedReactor } from "../src/cabal-realm-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

test("standoffs and realm feeds leave no unread ledger titles", async () => {
  // The realm feed's slots rest in the vessel's fixed-title state; the ward takes no store of its own.
  const store = new MemoryTiddlerStore(VESSEL_STATE_HOME);
  const daemon = new CompositeStore();
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  await daemon.put({ tiddler: { title: HOME_WIKI_TITLE, text: "[[home]]" } }, { kind: "lares-verb", requestId: "home" });
  const alerts: unknown[] = [];
  const ward = makeWardAlertReactor(daemon, (msg) => alerts.push(msg));
  const refusal = { bagId: "mirror", uri: "lar:///probe", reason: "conflict", standoff: "aaaa1111aaaa1111" };
  await ward(refusal);
  await ward(refusal);
  const atomSeed = new Uint8Array(32).fill(5);
  const leafSeed = new Uint8Array(32).fill(6);
  const atom = faceAtomPublicKey(atomSeed);
  const leaf = faceAtomPublicKey(leafSeed);
  const realm = "ab".repeat(32);
  const sign = (seed: Uint8Array) => (bytes: Uint8Array) => signAsFaceAtom(seed, bytes);
  const bond = await signFaceLeafBond({ atom, leaf, nexusAid: "bafy-nexus", realm }, { atom: sign(atomSeed), leaf: sign(leafSeed) });
  const requestId = "feed-1";
  const askSig = await signAsFaceAtom(atomSeed, realmFeedAskImage({ requestId, realm, writer: leaf }));
  await makeRealmFeedReactor({ resolveStore: async () => store })({ realm, writer: leaf, bond, askSig }, { presenter: `0x${atom}`, local: true, invocation: { requestId } } as unknown as VerbContext);
  const titles = await store.listVisible();
  expect(titles.filter((title) => title.includes("/ledger/ward/") || title.includes("/ledger/realm-feed/"))).toEqual([]);
  expect(alerts).toHaveLength(1);
});
