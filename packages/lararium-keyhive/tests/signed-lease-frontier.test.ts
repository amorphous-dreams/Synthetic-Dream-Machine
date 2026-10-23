import { describe, test, expect } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, leaseEpochSlotUri, currentSignerOf, makeHandLineage,
  signLeaseAdvance, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { readLeaseFrontier } from "../src/lease-frontier.js";

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
});
