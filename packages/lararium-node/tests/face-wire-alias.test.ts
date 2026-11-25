/**
 * face-wire-alias — THE ACCEPTANCE TEST for the veil's second cut: ONE composition, several faces lit, several Nexuses.
 *
 * Operator, 2026-11-19: "a crypto-registry or any other DreamNet published document SHALL NOT link a human's faces", by their crypto identities (+ public Handles); pet names carry no restriction. The first cut (`face-wire-identity`)
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
 *   V6  a gate's leg (the engine's server adapter, its seat read for each peer) says nothing to a peer its seat does
 *       not name; CONTROL: a seated session reads the alias a dial seated for the same (face, Nexus) presents
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { Repo, type AutomergeUrl, type Chunk, type DocHandle, type NetworkAdapterInterface, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeWSServerAdapter, WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { wireIdentityOf } from "@lararium/mesh/wire-identity-door";
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
async function meet(c: { readonly identity: Identity; readonly vessel: Repo }, seat: Seat): Promise<Meeting> {
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
  const leg: NetworkAdapterInterface = c.identity.leg(new MessageChannelNetworkAdapter(port1), seat);
  c.vessel.networkSubsystem.addNetworkAdapter(leg);
  recorder.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port2));
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
    // The engine keeps ONE pending sync-state save for each peer store, and this vessel syncs two documents with each
    // peer here (each peer's own, relayed to the other), so one document's word may displace another's pending save. A
    // fresh change to this document, then quiet past the engine's save delay, rests its state.
    const handle = await c.vessel.find<Doc>(a.shared.url as AutomergeUrl);
    let turn = 0;
    await vi.waitFor(async () => {
      handle.change((d) => { d.marks[`a${turn += 1}`] = 1; });
      await new Promise((r) => setTimeout(r, 400));
      expect(await c.identity.storage.load([a.shared.documentId, "sync-state", a.remoteStoreAtVessel!])).toBeDefined();
    }, { timeout: 20_000, interval: 50 });
    expect(await c.identity.storage.load([a.shared.documentId, "sync-state", REMOTE_STORE]), "no sync state rests under the remote's bare id").toBeUndefined();
    // The Repo of this test shares every document with every peer, so the peer under face B may hold a state of its own
    // for this document; it rests under face B's scope, a key of its own (the two scopes differ, above).
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

  test("V6: a gate's leg, which seats each peer, says nothing to a peer its seat does not name", async () => {
    const c = compose(FACE_A);
    // A GATE'S LEG as the vessel stands it: the engine's own server adapter, many sessions on one adapter, the seat read
    // for each remote peer. Its composer settles a pair's alias before that session's first word (`alias`).
    const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await once(wss, "listening");
    cleanups.push(() => new Promise<void>((done) => { for (const s of wss.clients) s.terminate(); wss.close(() => done()); }));
    const url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;
    const seats = new Map<string, Seat>([["seated-peer", { face: FACE_B, nexus: NEXUS_2 }]]);
    const refusals: string[] = [];
    await c.identity.alias({ face: FACE_B, nexus: NEXUS_2 });
    const gate = c.identity.leg(new NodeWSServerAdapter(wss as never, 60_000), (remote) => seats.get(remote) ?? null, (refusal, peer) => refusals.push(`${refusal}:${peer}`));
    // The Repo connects an adapter once its own peer metadata resolves (its store id read), and the server adapter hears
    // sockets only from that connect on: a session that dials sooner finds no listener, its join drops, and its client
    // redials only after its retry interval. So no peer dials before the gate stands: the test waits on that connect.
    const gateStands = new Promise<void>((stood) => { const connect = gate.connect.bind(gate); gate.connect = (...args) => { const out = connect(...args); stood(); return out; }; });
    c.vessel.networkSubsystem.addNetworkAdapter(gate);
    await gateStands;
    const dial = (peerId: string) => {
      const recorder = new Repo({ peerId: peerId as PeerId, network: [new WebSocketClientAdapter(url, 60_000)] });
      const seen: Array<{ peerId: string; storageId: string | undefined }> = [];
      recorder.networkSubsystem.on("peer", (p) => { seen.push({ peerId: p.peerId, storageId: p.peerMetadata.storageId }); });
      cleanups.push(() => recorder.shutdown());
      return { recorder, seen };
    };
    const stranger = dial("unseated-peer");
    const seated = dial("seated-peer");
    await vi.waitFor(() => { expect(seated.seen.length).toBeGreaterThan(0); }, { timeout: 10_000 });
    await vi.waitFor(() => { expect(refusals).toContain("unseated:unseated-peer"); }, { timeout: 10_000 });
    await new Promise((r) => setTimeout(r, 200));
    expect(stranger.seen, "an unseated peer read an identifier of this vessel").toEqual([]);
    expect(c.vessel.peers, "the Repo met a peer its gate's seat does not name").toEqual(["seated-peer"]);
    // CONTROL: the seated session reads the alias a dial seated for the same (face, Nexus) presents, and sync crosses it.
    const fixed = await meet(c, { face: FACE_B, nexus: NEXUS_2 });
    expect(seated.seen[0]!.peerId).toBe(fixed.peerId);
    expect(seated.seen[0]!.storageId).toBe(fixed.storageId);
    expect(seated.seen[0]!.peerId).not.toBe(c.identity.peerId);
    const shared = seated.recorder.create<Doc>({ marks: {} });
    const handle = await c.vessel.find<Doc>(shared.url as AutomergeUrl);
    handle.change((d) => { d.marks["gate"] = 1; });
    await vi.waitFor(() => { expect(shared.doc()!.marks["gate"]).toBe(1); }, { timeout: 10_000 });
  });
});
