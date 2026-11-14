/**
 * face-wire-identity — THE ACCEPTANCE TEST for the veil at the wire: one vessel, two faces, one recording peer.
 *
 * Operator, 2026-11-14: "a human 'publishes' no roster that joins their faces". A Repo names itself to every peer with a
 * peer id and its store's id (the peer metadata), and signs each change with an actor. A vessel keeps ONE store for
 * every face it holds, so each of the three could join face A to face B for a peer that met both.
 *
 * The vessel side here stands exactly as the vessels stand it: a Repo over the vessel's one durable store, its wire
 * identity taken from `wireIdentityOf` for the face the composition wears. A face switch tears the composition down and
 * stands a fresh one over the same store (`main.ts`'s recomposition), which each `present` below does.
 *
 *   W1  face A presents, the vessel switches to face B, presents again: store id, peer id and change actor all differ
 *   W2  the same face across a restart keeps its store id (what a peer keys the vessel's sync state on) and reads back the
 *       sync state it rested for that peer; another face reads none of it
 *   W3  the veil floor keeps an id of its own that no face shares, and keeps it across a restart
 *   W4  CONTROL: the store's documents stay one set under every face (the scope moves the identity, never a document)
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import { Repo, type AutomergeUrl, type Chunk, type DocHandle, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { wireIdentityOf } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";

type Doc = { marks: Record<string, number> };

/** The recording peer's own store: it rests in memory, so the peer names a store id and keeps sync state like any durable peer. */
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

interface Presentation { readonly peerId: string; readonly storageId: string | undefined; readonly actor: string }

let dir: string;
let recorder: Repo;
let shared: DocHandle<Doc>;
let recorderStoreId: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "face-wire-"));
  // The recording peer's store id seats before its Repo stands: a stock Repo's construction and a caller's `storageId()`
  // each mint one on a fresh store, and the peer must present the id this test reads.
  const recorderStore = new MemoryStore();
  recorderStoreId = "recording-peer-store";
  await recorderStore.save(["storage-adapter-id"], new TextEncoder().encode(recorderStoreId));
  recorder = new Repo({ storage: recorderStore });
  shared = recorder.create<Doc>({ marks: {} });
});
afterEach(async () => {
  await recorder.shutdown();
  rmSync(dir, { recursive: true, force: true });
});

/** The vessel's one durable store, opened for one composition. */
const vesselStore = () => new DurableNodeFSStorageAdapter(dir);

/**
 * ONE COMPOSITION: the vessel stands a Repo over its store wearing `face`, meets the recording peer, writes one change to
 * the shared document, rests, and tears down. Answers what the recording peer read of it.
 */
async function present(face: string | null, mark: string): Promise<Presentation> {
  const { port1, port2 } = new MessageChannel();
  const seen: Array<{ peerId: string; storageId: string | undefined }> = [];
  const onPeer = (p: { peerId: string; peerMetadata: { storageId?: string } }): void => { seen.push({ peerId: p.peerId, storageId: p.peerMetadata.storageId }); };
  recorder.networkSubsystem.on("peer", onPeer);
  const leg = new MessageChannelNetworkAdapter(port2);
  recorder.networkSubsystem.addNetworkAdapter(leg);
  const store = vesselStore();
  const identity = wireIdentityOf({ store, face });
  const vessel = new Repo({ ...identity, network: [new MessageChannelNetworkAdapter(port1)] });
  try {
    const handle = await vessel.find<Doc>(shared.url as AutomergeUrl);
    handle.change((d) => { d.marks[mark] = 1; });
    const actor = A.getActorId(handle.doc());
    await vi.waitFor(() => { expect(shared.doc().marks[mark]).toBe(1); }, { timeout: 10_000 });
    // The vessel rests its sync state for the recording peer (the engine debounces that save).
    await vi.waitFor(async () => {
      expect(await identity.storage.load([shared.documentId, "sync-state", recorderStoreId])).toBeDefined();
    }, { timeout: 10_000, interval: 50 });
    await vessel.flush();
    // The engine may announce one arrival twice; the recording peer met ONE vessel peer under one metadata.
    const met = [...new Set(seen.map((p) => `${p.peerId}\u0000${p.storageId ?? ""}`))];
    expect(met.length, "the recording peer met one vessel peer").toBe(1);
    return { ...seen[0]!, actor };
  } finally {
    await vessel.shutdown();
    recorder.networkSubsystem.removeNetworkAdapter(leg);
    recorder.networkSubsystem.off("peer", onPeer);
    port1.close(); port2.close();
    await store.close();
  }
}

/** Every actor that signed a change the recording peer holds of the shared document. */
const actorsSeen = (): string[] => [...new Set(A.getAllChanges(shared.doc()).map((c) => A.decodeChange(c).actor))];

describe("the veil at the wire: one vessel presents no identifier under two faces", () => {
  test("W1: face A, then face B over the same store: store id, peer id and change actor all differ", async () => {
    const a = await present(FACE_A, "a");
    const b = await present(FACE_B, "b");
    expect(a.storageId, "a durable vessel names a store id").toMatch(/\S/);
    expect(b.storageId).toMatch(/\S/);
    expect(b.storageId, "the store id repeats across the face switch").not.toBe(a.storageId);
    expect(b.peerId, "the peer id repeats across the face switch").not.toBe(a.peerId);
    expect(b.actor, "the change actor repeats across the face switch").not.toBe(a.actor);
    // What the recording peer holds agrees with what each composition said of its own actor.
    expect(actorsSeen()).toEqual(expect.arrayContaining([a.actor, b.actor]));
  });

  test("W2: the same face across a restart keeps its store id and its rested sync state; another face reads none of it", async () => {
    const first = await present(FACE_A, "a1");
    const again = await present(FACE_A, "a2");
    expect(again.storageId, "sync resumption keys on the store id: it holds across the restart").toBe(first.storageId);
    const key = [shared.documentId, "sync-state", recorderStoreId];
    const storeA = vesselStore(), storeB = vesselStore(), storeFloor = vesselStore();
    try {
      expect(await wireIdentityOf({ store: storeA, face: FACE_A }).storage.load(key), "face A reads back the sync state it rested").toBeDefined();
      expect(await wireIdentityOf({ store: storeB, face: FACE_B }).storage.load(key), "face B reads no sync state face A rested").toBeUndefined();
      expect(await wireIdentityOf({ store: storeFloor, face: null }).storage.load(key), "the floor reads no sync state face A rested").toBeUndefined();
    } finally { await storeA.close(); await storeB.close(); await storeFloor.close(); }
  });

  test("W3: the veil floor keeps an id of its own, across a restart, that no face shares", async () => {
    const floor = await present(null, "f1");
    const a = await present(FACE_A, "a");
    const floorAgain = await present(null, "f2");
    expect(floor.storageId).toMatch(/\S/);
    expect(floorAgain.storageId, "the floor's own id holds across a restart").toBe(floor.storageId);
    expect(a.storageId, "a face shares the floor's store id").not.toBe(floor.storageId);
    expect(new Set([floor.peerId, a.peerId, floorAgain.peerId]).size, "each composition mints its own peer id").toBe(3);
  });

  test("W4 CONTROL: the store's documents stay one set under every face", async () => {
    await present(FACE_A, "a");
    await present(FACE_B, "b");
    const store = vesselStore();
    const offline = new Repo({ ...wireIdentityOf({ store, face: null }) });
    try {
      const handle = await offline.find<Doc>(shared.url as AutomergeUrl);
      expect(Object.keys(handle.doc().marks).sort()).toEqual(["a", "b"]);
    } finally { await offline.shutdown(); await store.close(); }
  });

  test("W5: a face that settles late holds the store id back and no document: the boot loads and rests documents first", async () => {
    await present(FACE_A, "a");
    const store = vesselStore();
    let settle!: (face: string | null) => void;
    const late = wireIdentityOf({ store, face: new Promise<string | null>((r) => { settle = r; }) });
    const vessel = new Repo({ storage: late.storage, peerId: late.peerId });
    try {
      // The document reads back whole while the face stays unsettled (a browser boot founds and admits in this window).
      const handle = await vessel.find<Doc>(shared.url as AutomergeUrl);
      expect(Object.keys(handle.doc().marks)).toEqual(["a"]);
      handle.change((d) => { d.marks["late"] = 1; });
      await vessel.flush();
      let read: string | null = null;
      void late.storeId().then((id) => { read = id; });
      await new Promise((r) => setTimeout(r, 50));
      expect(read, "the store id waits for the face").toBeNull();
      settle(FACE_A);
      await vi.waitFor(() => { expect(read).not.toBeNull(); });
      const storeA = vesselStore();
      try { expect(read, "the late face reads the id that face rested").toBe(await wireIdentityOf({ store: storeA, face: FACE_A }).storeId()); }
      finally { await storeA.close(); }
    } finally { await vessel.shutdown(); await store.close(); }
  });

  test("W6: two readings of a fresh scope mint ONE id, and the id rests", async () => {
    const store = vesselStore();
    try {
      const wire = wireIdentityOf({ store, face: FACE_B });
      const [one, two] = await Promise.all([wire.storeId(), wire.storeId()]);
      expect(two).toBe(one);
      // The engine's own two readings (a Repo's construction and a caller's `storageId()`) agree with it.
      const repo = new Repo({ storage: wire.storage, peerId: wire.peerId });
      try { expect(await repo.storageId()).toBe(one); } finally { await repo.shutdown(); }
      expect(await wireIdentityOf({ store, face: FACE_B }).storeId(), "a later composition reads the rested id").toBe(one);
    } finally { await store.close(); }
  });

  test("W7: the Repo's shutdown closes the vessel's store through its wire face (CONTROL: a store with no close gains none)", async () => {
    let closes = 0;
    const closing = new MemoryStore() as MemoryStore & { close(): Promise<void> };
    closing.close = async () => { closes += 1; };
    const wire = wireIdentityOf({ store: closing, face: FACE_A });
    const repo = new Repo({ storage: wire.storage, peerId: wire.peerId });
    await repo.shutdown();
    expect(closes, "the store's close ran once at the Repo's shutdown").toBe(1);
    expect("close" in wireIdentityOf({ store: new MemoryStore(), face: FACE_A }).storage).toBe(false);
  });
});
