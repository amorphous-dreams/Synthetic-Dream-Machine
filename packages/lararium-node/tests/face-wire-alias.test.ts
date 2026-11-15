/**
 * face-wire-alias — THE ACCEPTANCE TEST for the veil's second cut: ONE composition, several faces lit, several Nexuses.
 *
 * Operator, 2026-11-14: "a human 'publishes' no roster that joins their faces". The first cut (`face-wire-identity`)
 * closed the MOUNT switch: a fresh composition presents a fresh peer id and its own scope's store id. Inside one
 * composition every leg still presented that composition's one peer id and one store id, so a face lit beside the worn
 * one (`vault unlock --all` lights three) and a face that stands at two Nexuses each showed one identifier twice.
 *
 * The vessel side here stands as the vessels stand it: ONE Repo over the vessel's one durable store, wearing face A, and
 * each leg seated for the (face, Nexus) it serves (`WireIdentity.leg`). Each recording peer stands its own Repo, as a
 * remote hearth does.
 *
 *   V1  a peer seated under face A and a peer seated under a lit face B read unrelated peer ids and store ids, and
 *       neither reads the composition's own
 *   V2  one face at two Nexuses shows two peer ids and two store ids
 *   V3  CONTROL: one face's two connections at one Nexus read one peer id and one store id
 *   V4  an inbound store id rests under the local (face, Nexus): two faces that meet one remote store keep two sync
 *       states, and the remote's own id never rests bare
 *   V5  RESUMPTION: across a restart a (face, Nexus) keeps its store id, mints a fresh peer id, and reads back the sync
 *       state it rested for that peer
 *   V6  a leg whose seat names no (face, Nexus) for a peer says nothing to it: no identifier leaves, the composition's
 *       own included
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl, type Chunk, type DocHandle, type NetworkAdapterInterface, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { wireIdentityOf } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";

type Doc = { marks: Record<string, number> };
type Identity = ReturnType<typeof wireIdentityOf>;
type Seat = { readonly face: string | null; readonly nexus: string | null };

class MemoryStore implements StorageAdapterInterface {
  readonly #rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.#rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.#rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.#rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.#rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.#rows]) if (prefix.every((p, i) => r.key[i] === p)) this.#rows.delete(name); }
}

const FACE_A = "persona-group-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FACE_B = "persona-group-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NEXUS_1 = "nexus-aid-1111111111111111111111111111111111111111111111111111111111111111";
const NEXUS_2 = "nexus-aid-2222222222222222222222222222222222222222222222222222222222222222";
/** Every recording peer names this one store: two faces that meet it meet ONE remote store. */
const REMOTE_STORE = "recording-peer-store";

/** What one recording peer read of the vessel, and what the vessel read of it. */
interface Meeting {
  readonly peerId: string;
  readonly storageId: string | undefined;
  /** The remote store id as the vessel's Repo holds it for this peer. */
  readonly remoteStoreAtVessel: string | undefined;
  readonly recorder: Repo;
  readonly shared: DocHandle<Doc>;
}

let dir: string;
const cleanups: Array<() => Promise<void> | void> = [];

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "face-wire-alias-")); });
afterEach(async () => {
  for (const down of cleanups.splice(0).reverse()) await down();
  rmSync(dir, { recursive: true, force: true });
});

/** ONE COMPOSITION over the vessel's one durable store, wearing `face`. */
function compose(face: string | null): { readonly identity: Identity; readonly vessel: Repo; down(): Promise<void> } {
  const store = new DurableNodeFSStorageAdapter(dir);
  const identity = wireIdentityOf({ store, face });
  const vessel = new Repo({ storage: identity.storage, peerId: identity.peerId, network: [] });
  let stood = true;
  const down = async (): Promise<void> => { if (!stood) return; stood = false; await vessel.shutdown(); await store.close(); };
  cleanups.push(down);
  return { identity, vessel, down };
}

/** Seat one leg of `vessel` for `seat` and meet a fresh recording peer over it. */
async function meet(c: { readonly identity: Identity; readonly vessel: Repo }, seat: Seat | ((remote: string) => Seat | null), opts: { readonly expectMet?: boolean } = {}): Promise<Meeting> {
  const { port1, port2 } = new MessageChannel();
  const recorderStore = new MemoryStore();
  await recorderStore.save(["storage-adapter-id"], new TextEncoder().encode(REMOTE_STORE));
  const recorder = new Repo({ storage: recorderStore, network: [] });
  const shared = recorder.create<Doc>({ marks: {} });
  const seen: Array<{ peerId: string; storageId: string | undefined }> = [];
  recorder.networkSubsystem.on("peer", (p) => { seen.push({ peerId: p.peerId, storageId: p.peerMetadata.storageId }); });
  const atVessel: Array<string | undefined> = [];
  const onVesselPeer = (p: { peerId: string; peerMetadata: { storageId?: string } }): void => { if (p.peerId === recorder.peerId) atVessel.push(p.peerMetadata.storageId); };
  c.vessel.networkSubsystem.on("peer", onVesselPeer);
  cleanups.push(async () => { c.vessel.networkSubsystem.off("peer", onVesselPeer); await recorder.shutdown(); port1.close(); port2.close(); });
  // THE TREE BEFORE THE SECOND CUT hands no `leg`: the adapter then joins bare, as every leg joined, and the reds below
  // measure what a peer read of it.
  const bare = new MessageChannelNetworkAdapter(port1);
  const seatLeg = (c.identity as { leg?: (adapter: NetworkAdapterInterface, at: typeof seat) => NetworkAdapterInterface }).leg;
  const leg: NetworkAdapterInterface = typeof seatLeg === "function" ? seatLeg(bare, seat) : bare;
  c.vessel.networkSubsystem.addNetworkAdapter(leg);
  recorder.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port2));
  if (opts.expectMet === false) {
    await new Promise((r) => setTimeout(r, 300));
    return { peerId: seen[0]?.peerId ?? "", storageId: seen[0]?.storageId, remoteStoreAtVessel: atVessel[0], recorder, shared };
  }
  await vi.waitFor(() => { expect(seen.length).toBeGreaterThan(0); expect(atVessel.length).toBeGreaterThan(0); }, { timeout: 10_000 });
  const met = [...new Set(seen.map((p) => `${p.peerId}\u0000${p.storageId ?? ""}`))];
  expect(met.length, "the recording peer met one vessel peer").toBe(1);
  return { ...seen[0]!, remoteStoreAtVessel: atVessel[0], recorder, shared };
}

/** The vessel writes one mark into the peer's shared document and the peer reads it: sync crosses the leg both ways. */
async function cross(c: { readonly vessel: Repo }, m: Meeting, mark: string): Promise<void> {
  const handle = await c.vessel.find<Doc>(m.shared.url as AutomergeUrl);
  handle.change((d) => { d.marks[mark] = 1; });
  await vi.waitFor(() => { expect(m.shared.doc()!.marks[mark]).toBe(1); }, { timeout: 10_000 });
}

describe("the veil's second cut: one composition presents each (face, Nexus) its own identifiers", () => {
  test("V1: a peer seated under face A and a peer seated under a lit face B read unrelated ids, and neither reads the composition's own", async () => {
    const c = compose(FACE_A);
    const own = { peerId: c.identity.peerId as string, storeId: await c.identity.storeId() };
    const a = await meet(c, { face: FACE_A, nexus: NEXUS_1 });
    const b = await meet(c, { face: FACE_B, nexus: NEXUS_1 });
    expect(a.storageId).toMatch(/\S/);
    expect(b.storageId).toMatch(/\S/);
    expect(b.peerId, "a lit face shows the worn face's peer id").not.toBe(a.peerId);
    expect(b.storageId, "a lit face shows the worn face's store id").not.toBe(a.storageId);
    for (const m of [a, b]) {
      expect(m.peerId, "a wire peer reads the composition's own peer id").not.toBe(own.peerId);
      expect(m.storageId, "a wire peer reads the composition's own store id").not.toBe(own.storeId);
    }
    // The aliases carry sync: each peer reads the vessel's change to its own document.
    await cross(c, a, "a");
    await cross(c, b, "b");
  });

  test("V2: one face at two Nexuses shows two peer ids and two store ids", async () => {
    const c = compose(FACE_A);
    const one = await meet(c, { face: FACE_A, nexus: NEXUS_1 });
    const two = await meet(c, { face: FACE_A, nexus: NEXUS_2 });
    expect(two.peerId, "one face shows one peer id at two Nexuses").not.toBe(one.peerId);
    expect(two.storageId, "one face shows one store id at two Nexuses").not.toBe(one.storageId);
  });

  test("V3 CONTROL: one face's two connections at one Nexus read one peer id and one store id", async () => {
    const c = compose(FACE_A);
    const first = await meet(c, { face: FACE_B, nexus: NEXUS_1 });
    const second = await meet(c, { face: FACE_B, nexus: NEXUS_1 });
    expect(second.peerId).toBe(first.peerId);
    expect(second.storageId).toBe(first.storageId);
  });

  test("V4: an inbound store id rests under the local (face, Nexus), never bare", async () => {
    const c = compose(FACE_A);
    const a = await meet(c, { face: FACE_A, nexus: NEXUS_1 });
    const b = await meet(c, { face: FACE_B, nexus: NEXUS_1 });
    expect(a.remoteStoreAtVessel, "the vessel holds the remote store id bare").not.toBe(REMOTE_STORE);
    expect(a.remoteStoreAtVessel).toContain(REMOTE_STORE);
    expect(b.remoteStoreAtVessel, "two local faces key one remote store's sync state alike").not.toBe(a.remoteStoreAtVessel);
    await cross(c, a, "a");
    await vi.waitFor(async () => {
      expect(await c.identity.storage.load([a.shared.documentId, "sync-state", a.remoteStoreAtVessel!])).toBeDefined();
    }, { timeout: 10_000, interval: 50 });
    expect(await c.identity.storage.load([a.shared.documentId, "sync-state", REMOTE_STORE]), "no sync state rests under the remote's bare id").toBeUndefined();
    expect(await c.identity.storage.load([a.shared.documentId, "sync-state", b.remoteStoreAtVessel!]), "face B's scope reads the sync state face A rested").toBeUndefined();
  });

  test("V5 RESUMPTION: across a restart a (face, Nexus) keeps its store id, mints a fresh peer id and reads back its sync state", async () => {
    const first = compose(FACE_A);
    const before = await meet(first, { face: FACE_B, nexus: NEXUS_1 });
    await cross(first, before, "b1");
    const key = [before.shared.documentId, "sync-state", before.remoteStoreAtVessel!];
    await vi.waitFor(async () => { expect(await first.identity.storage.load(key)).toBeDefined(); }, { timeout: 10_000, interval: 50 });
    await first.vessel.flush();
    await first.down();
    const again = compose(FACE_A);
    const after = await meet(again, { face: FACE_B, nexus: NEXUS_1 });
    expect(after.storageId, "sync resumption keys on the store id: it holds across the restart").toBe(before.storageId);
    expect(after.peerId, "each composition mints its own peer id for a (face, Nexus)").not.toBe(before.peerId);
    expect(after.remoteStoreAtVessel, "the local scope of a (face, Nexus) holds across the restart").toBe(before.remoteStoreAtVessel);
    expect(await again.identity.storage.load(key), "the (face, Nexus) reads back the sync state it rested").toBeDefined();
  });

  test("V6: a leg whose seat names no (face, Nexus) for a peer says nothing to it", async () => {
    const c = compose(FACE_A);
    const unseated = await meet(c, () => null, { expectMet: false });
    expect(unseated.peerId, "an unseated peer read an identifier of this vessel").toBe("");
    expect(unseated.storageId).toBeUndefined();
    // CONTROL: the same seat form, naming a (face, Nexus) for the peer, meets it under that scope's alias.
    const seated = await meet(c, () => ({ face: FACE_B, nexus: NEXUS_2 }));
    const fixed = await meet(c, { face: FACE_B, nexus: NEXUS_2 });
    expect(seated.peerId).toBe(fixed.peerId);
    expect(seated.storageId).toBe(fixed.storageId);
  });
});
