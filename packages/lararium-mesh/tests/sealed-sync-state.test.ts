/**
 * sealed-sync-state — a peer's sync state never waits on a face's session.
 *
 * The engine stores one sync state per (document, peer storage id) beside the document's chunks. A sealed bag's store drops
 * that save (it names no sealed role), so its load holds nothing to open and answers nothing at once, whether or not the
 * bag's face stands a session. Measured in a real two-browser smoke: a joined leaf with no road stands no session for its
 * face, so every sync-state load of a face document waited `session-absent` for ever, the engine's bounded pool of
 * sync-state loads filled with those waits, and every later (document, peer) pair stalled behind them: the Lift's floor
 * documents never reached the daemon island, which held them in the same vessel.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { SealedDocumentStore } from "../src/sealed-doc-store.js";

const FACE = "face-subject-with-no-session";
const BAG = "lar:///ha.ka.ba/@test/bags/face-notes";

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}

const refuse = async () => ({ refusal: "signer-unavailable" as const });
/** A vessel's hydrating store where each document `faceDocs` names belongs to a face that stands no session; the rest rest clear. */
function faceStoreWithNoSession(faceDocs: ReadonlySet<string>): SealedDocumentStore {
  return new SealedDocumentStore({
    inner: memoryAdapter(),
    bagOf: (documentId) => (faceDocs.has(documentId) ? { bagId: BAG, face: FACE } : null),
    sessionFace: () => null,
    sessionOf: () => null,
    seal: refuse as never, open: refuse as never,
    waitOverSealed: true,
    hydrates: true,
  });
}
const settle = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe("a peer's sync state never waits on a face's session", () => {
  it("a sealed bag's sync-state load answers nothing at once with no session; a chunk load still waits for one (control)", async () => {
    const store = faceStoreWithNoSession(new Set(["doc-one"]));
    expect(await store.load(["doc-one", "sync-state", "peer-storage-id"])).toBeUndefined();
    // CONTROL: a sealed chunk of the same bag still waits on the session (the hydration), never reads clear.
    let read = false;
    void store.load(["doc-one", "snapshot", "heads"]).then(() => { read = true; }, () => { read = true; });
    await settle(50);
    expect(read).toBe(false);
    store.endHydration();
  });

  it("a peer with a storage id still reaches a clear document while many face documents stand with no session", async () => {
    const faceDocs = new Set<string>();
    const vesselStore = faceStoreWithNoSession(faceDocs);
    const channel = new MessageChannel();
    const vessel = new Repo({ storage: vesselStore, network: [new MessageChannelNetworkAdapter(channel.port1)], peerId: "vessel" as PeerId });
    // More face documents than the engine's bounded pool of sync-state loads (20): each one the peer meets loads its sync state.
    for (let i = 0; i < 24; i++) { const h = vessel.create<{ n?: number }>(); faceDocs.add(h.documentId); h.change((d) => { d.n = i; }); }
    const clear = vessel.create<{ note?: string }>();
    clear.change((d) => { d.note = "the floor's own words"; });
    // The island keeps a store of its own, so it carries a storage id and the vessel loads its sync state per document.
    const island = new Repo({ storage: memoryAdapter(), network: [new MessageChannelNetworkAdapter(channel.port2)], peerId: "island" as PeerId });
    // barrier: both ends hear each other before the island asks (a find with no peer reads unavailable at once).
    for (let i = 0; i < 100 && !(island.peers.includes("vessel" as PeerId) && vessel.peers.includes("island" as PeerId)); i++) await settle(20);
    const arrived = island.find<{ note?: string }>(clear.url as AutomergeUrl).then((h) => h.doc().note ?? null);
    const out = await Promise.race([arrived, settle(3000).then(() => "never arrived")]);
    expect(out).toBe("the floor's own words");
    vesselStore.endHydration();
    await Promise.allSettled([island.shutdown(), vessel.shutdown()]);
    channel.port1.close(); channel.port2.close();
  }, 15000);
});
