import { describe, test, expect } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, leaseEpochSlotUri, currentSignerOf, makeHandLineage,
  signLeaseAdvance, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { readLeaseFrontier, readLeaseUnderFace } from "../src/lease-frontier.js";
import { readFace, mintFaceAnchor, raiseFaceFrontier } from "@lararium/mesh";
import { realKel } from "../../lararium-mesh/tests/kel-fixture.js";

const group = "ab".repeat(16);
const other = "cd".repeat(16);
const rootSeed = new Uint8Array(32).fill(4);
const strangerSeed = new Uint8Array(32).fill(5);

describe("signed PersonaGroup lease frontier", () => {
  test("unsigned, stranger-signed, and foreign-group slots raise nothing; root-signed control raises", async () => {
    const root = { key: await ed25519VerifyingKeyFromSeed(rootSeed), sign: ed25519SignerFromSeed(rootSeed) };
    const stranger = { key: await ed25519VerifyingKeyFromSeed(strangerSeed), sign: ed25519SignerFromSeed(strangerSeed) };
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
    const put = async (resource: string, writer: string, value: string) => {
      const title = leaseEpochSlotUri(resource, writer);
      await store.put({ tiddler: { title, text: value }, meta: { authority: "test" } } as never, { kind: "test" } as never);
    };
    await put(group, root.key, "999");
    await put(group, stranger.key, await signLeaseAdvance({ resource: group, epoch: 88 }, stranger));
    await put(other, root.key, await signLeaseAdvance({ resource: other, epoch: 77 }, root));
    const authorize = (writer: string) => writer === root.key;
    expect(await readLeaseFrontier(composite, group, authorize)).toEqual({ kind: "epoch", n: 0 });
    await put(group, root.key, await signLeaseAdvance({ resource: group, epoch: 3 }, root));
    expect(await readLeaseFrontier(composite, group, authorize)).toEqual({ kind: "epoch", n: 3 });
  });

  test("RED: the daemon gate's lease read takes only the current roster; a key the KEL rotated past raises nothing", async () => {
    const oldK = { key: await ed25519VerifyingKeyFromSeed(rootSeed), sign: ed25519SignerFromSeed(rootSeed) };
    const newK = { key: await ed25519VerifyingKeyFromSeed(strangerSeed), sign: ed25519SignerFromSeed(strangerSeed) };
    const lineage = makeHandLineage([{ epoch: 0, signers: [oldK.key], threshold: 1 }, { epoch: 1, signers: [newK.key], threshold: 1 }])!;
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
    const put = async (writer: string, value: string) => {
      await store.put({ tiddler: { title: leaseEpochSlotUri(group, writer), text: value }, meta: { authority: "test" } } as never, { kind: "test" } as never);
    };
    await put(oldK.key, await signLeaseAdvance({ resource: group, epoch: 900 }, oldK));
    expect(await readLeaseFrontier(composite, group, currentSignerOf(lineage))).toEqual({ kind: "epoch", n: 0 });
    await put(newK.key, await signLeaseAdvance({ resource: group, epoch: 4 }, newK));
    expect(await readLeaseFrontier(composite, group, currentSignerOf(lineage))).toEqual({ kind: "epoch", n: 4 });
  });

  test("RED: the live join and grant lease read floors under the sealed anchor, so a missing or replayed older slot never lowers it; CONTROL: a higher signed advance still rises", async () => {
    const root = { key: await ed25519VerifyingKeyFromSeed(rootSeed), sign: ed25519SignerFromSeed(rootSeed) };
    const chain = (await realKel([root.key])).chain;
    const anchor = raiseFaceFrontier(mintFaceAnchor({ personaGroup: group, personaKelPrefix: chain[0]!.prefix, personaRootDid: `0x${root.key}`, edge: {}, leaseEpoch: 0 }), { leaseEpoch: 7 });
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true });
    const put = async (value: string) => { await store.put({ tiddler: { title: leaseEpochSlotUri(group, root.key), text: value }, meta: { authority: "test" } } as never, { kind: "test" } as never); };
    await put(await signLeaseAdvance({ resource: group, epoch: 2 }, root));      // a replayed OLDER slot
    const face = readFace(chain, anchor);
    expect(await readLeaseUnderFace(composite, group, face), "the anchor's 7 stands over the slot's 2").toEqual({ kind: "epoch", n: 7 });
    expect(await readLeaseFrontier(composite, group, face!.currentSigner), "the unfloored read is the bug").toEqual({ kind: "epoch", n: 2 });
    await put(await signLeaseAdvance({ resource: group, epoch: 9 }, root));
    expect(await readLeaseUnderFace(composite, group, face)).toEqual({ kind: "epoch", n: 9 });
    expect(await readLeaseUnderFace(composite, group, null), "no verified face reads no signer").toEqual({ kind: "epoch", n: 0 });
  });
});
