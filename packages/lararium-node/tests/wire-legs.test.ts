/**
 * wire-legs — the node vessel's own wire legs seat for the (face, Nexus) each serves (the veil's second cut, road `C1`).
 *
 * `face-wire-alias` proves the construction on a bare Repo. This suite proves the node's composition of it: the sync
 * gate's leg (the engine's server adapter over gated sessions, `gate-sync-server`) reads each session's pair off what
 * the gate proved, and the client dial seats for the face it presents at the Nexus it dials.
 *
 *   G1  three sessions on ONE gate leg (a device of face A, a device of a lit face B, a contracted peer at another
 *       Nexus) each read a peer id and a store id of their own, and none reads the Repo's own
 *   G2  CONTROL: two sessions of one face at one Nexus read one peer id and one store id
 *   G3  a contracted session faces the worn face at the session's Nexus; a same-operator session faces the face it proved
 *   G4  a session whose alias cannot settle never reaches the adapter: its channel closes and no word leaves
 *   G5  the vessel's composition seats both legs (read as source: the composition stands only inside a whole boot)
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { cbor } from "@automerge/automerge-repo/slim";
import { wireIdentityOf } from "@lararium/mesh/wire-identity-door";
import { type GateSession } from "@lararium/mesh/face-gate-door";
import { type GateSessionChannel } from "@lararium/mesh/gate-session-channel";
import { type SealedMessage } from "@lararium/mesh/sealed-carriage";
import { ListeningWSServerAdapter } from "../src/open-node-vessel.js";
import { gateSyncServer } from "../src/gate-sync-server.js";

class MemoryStore implements StorageAdapterInterface {
  readonly #rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  failing = false;
  async load(key: StorageKey) { if (this.failing && String(key[0]).endsWith(".veil")) throw new Error("the store refuses"); return this.#rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.#rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.#rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.#rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.#rows]) if (prefix.every((p, i) => r.key[i] === p)) this.#rows.delete(name); }
}

const FACE_A = "0x" + "aa".repeat(32);
const FACE_B = "0x" + "bb".repeat(32);
const NEXUS_1 = "nexus-aid-1";
const NEXUS_2 = "nexus-aid-2";

const sameOperator = (personaGroup: string, nexus: string): GateSession =>
  ({ tier: "sovereign", class: "same-operator", scope: { faceKey: "f".repeat(64), nexus }, face: { personaGroup, faceKey: "f".repeat(64), nexus, revision: "r" } }) as unknown as GateSession;
const contracted = (nexus: string): GateSession =>
  ({ tier: "sovereign", class: "contracted", scope: { faceKey: "c".repeat(64), nexus }, face: null }) as unknown as GateSession;

function fakeChannel() {
  const inbox: Array<SealedMessage | null> = [];
  const waiters: Array<(m: SealedMessage | null) => void> = [];
  const sent: Array<{ kind: string; bytes: Uint8Array }> = [];
  let state: "open" | "closed" = "open";
  const channel = {
    get state() { return state; },
    closedBy: null,
    send(kind: string, bytes: Uint8Array) { if (state !== "open") throw new Error("closed"); sent.push({ kind, bytes }); },
    recv() { const next = inbox.shift(); if (next !== undefined) return Promise.resolve(next); return new Promise<SealedMessage | null>((r) => waiters.push(r)); },
    close() { if (state === "closed") return; state = "closed"; for (const w of waiters.splice(0)) w(null); },
  } as unknown as GateSessionChannel;
  const deliver = (m: SealedMessage | null) => { const w = waiters.shift(); if (w) w(m); else inbox.push(m); };
  return { channel, sent, deliver, state: () => state };
}
const settle = async (): Promise<void> => { for (let i = 0; i < 20; i += 1) await new Promise<void>((r) => setImmediate(r)); };

type Legs = typeof import("../src/wire-legs.js");
let legs: Legs | null = null;
beforeAll(async () => { legs = await import("../src/wire-legs.js").catch(() => null); });

const downs: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of downs.splice(0).reverse()) await down(); });

/** The node's gate leg as its composition stands it: one server adapter over gated sessions, seated by `seatGateLeg`. */
async function standGate(worn: string | null, store = new MemoryStore()) {
  expect(legs, "the node composes no seat for its wire legs (src/wire-legs)").not.toBeNull();
  const wire = wireIdentityOf({ store, face: worn });
  let connected!: () => void;
  const adapterReady = new Promise<void>((r) => { connected = r; });
  const gateSync = gateSyncServer({ adapterConnected: adapterReady, settle: legs!.gateSessionSettles(wire, worn) });
  const network = legs!.seatGateLeg(wire, new ListeningWSServerAdapter(gateSync.wss as never), gateSync, worn);
  void network.connected.then(connected);
  const repo = new Repo({ storage: wire.storage, peerId: wire.peerId, network: [network] });
  downs.push(async () => { gateSync.close(); await repo.shutdown(); });
  await network.connected;
  /** One session joins as `peerId` and answers what the gate leg told it. */
  const join = async (session: GateSession, peerId: string) => {
    const c = fakeChannel();
    gateSync.onOpen(c.channel, session);
    c.deliver({ kind: "sync", bytes: cbor.encode({ type: "join", senderId: peerId, peerMetadata: {}, supportedProtocolVersions: ["1"] }) } as unknown as SealedMessage);
    await settle();
    const words = c.sent.filter((m) => m.kind === "sync").map((m) => cbor.decode(m.bytes) as { type: string; senderId: string; peerMetadata?: { storageId?: string } });
    return { words, peer: words.find((w) => w.type === "peer") ?? null, channel: c };
  };
  return { wire, repo, join, store };
}

describe("the node's wire legs seat for the (face, Nexus) each serves", () => {
  test("G1: three sessions on one gate leg each read ids of their own, and none reads the Repo's own", async () => {
    const g = await standGate(FACE_A);
    const a = await g.join(sameOperator(FACE_A, NEXUS_1), "device-of-a");
    const b = await g.join(sameOperator(FACE_B, NEXUS_1), "device-of-b");
    const far = await g.join(contracted(NEXUS_2), "contracted-peer");
    const read = [a, b, far].map((s) => { expect(s.peer, "the gate leg answered the join").not.toBeNull(); return s.peer!; });
    expect(new Set(read.map((p) => p.senderId)).size, "two sessions read one peer id").toBe(3);
    expect(new Set(read.map((p) => p.peerMetadata?.storageId)).size, "two sessions read one store id").toBe(3);
    const ownStore = await g.wire.storeId();
    for (const p of read) {
      expect(p.peerMetadata?.storageId).toMatch(/\S/);
      expect(p.senderId, "a session read the Repo's own peer id").not.toBe(g.wire.peerId);
      expect(p.peerMetadata?.storageId, "a session read the composition's own store id").not.toBe(ownStore);
    }
    expect([...g.repo.peers].sort()).toEqual(["contracted-peer", "device-of-a", "device-of-b"]);
  });

  test("G2 CONTROL: two sessions of one face at one Nexus read one peer id and one store id", async () => {
    const g = await standGate(FACE_A);
    const one = await g.join(sameOperator(FACE_B, NEXUS_1), "device-one");
    const two = await g.join(sameOperator(FACE_B, NEXUS_1), "device-two");
    expect(two.peer!.senderId).toBe(one.peer!.senderId);
    expect(two.peer!.peerMetadata?.storageId).toBe(one.peer!.peerMetadata?.storageId);
  });

  test("G3: a contracted session faces the worn face at its Nexus; a same-operator session faces the face it proved", () => {
    expect(legs, "the node composes no seat for its wire legs (src/wire-legs)").not.toBeNull();
    expect(legs!.gateLegAt(contracted(NEXUS_2), FACE_A)).toEqual({ face: FACE_A, nexus: NEXUS_2 });
    expect(legs!.gateLegAt(contracted(NEXUS_2), null)).toEqual({ face: null, nexus: NEXUS_2 });
    expect(legs!.gateLegAt(sameOperator(FACE_B, NEXUS_1), FACE_A)).toEqual({ face: FACE_B, nexus: NEXUS_1 });
    const place = { tier: "floor", class: "contracted", scope: null, face: null, standing: { nym: "n", aid: NEXUS_1 } } as unknown as GateSession;
    expect(legs!.gateLegAt(place, FACE_A)).toEqual({ face: FACE_A, nexus: NEXUS_1 });
  });

  test("G4: a session whose alias cannot settle never reaches the adapter", async () => {
    const store = new MemoryStore();
    const g = await standGate(FACE_A, store);
    store.failing = true;
    const refused = await g.join(sameOperator(FACE_B, NEXUS_1), "device-of-b");
    expect(refused.words, "a word left for a session whose alias never settled").toEqual([]);
    expect(refused.channel.state()).toBe("closed");
    expect(g.repo.peers).toEqual([]);
    // CONTROL: the store answers again, and the same face's next session seats.
    store.failing = false;
    const seated = await g.join(sameOperator(FACE_B, NEXUS_1), "device-of-b");
    expect(seated.peer).not.toBeNull();
  });

  test("G5: the vessel's composition seats its gate leg and its dial leg", () => {
    const read = (name: string): string => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), "utf8");
    const vessel = read("open-node-vessel.ts");
    expect(vessel, "the sync gate's adapter joins the Repo unseated").toMatch(/const network\s*=\s*seatGateLeg\(wire, new ListeningWSServerAdapter\(/);
    expect(vessel, "the gate sync server settles no alias before a session opens").toMatch(/settle: gateSessionSettles\(wire, custodyGroup\)/);
    expect(vessel, "the client dial joins the Repo unseated").toMatch(/leg: \(adapter\) => seatDialLeg\(wire, adapter, \{ face: custodyGroup, nexus: dialNexus \}/);
    // The browser's relay seats through the same door (`seatDialLeg`), so the two vessels' dials hold one derivation.
    const page = readFileSync(fileURLToPath(new URL("../../lararium-browser/src/open-browser-vessel.ts", import.meta.url)), "utf8");
    expect(page, "the browser's relay joins the Repo unseated").toMatch(/const adapter = seatDialLeg\(wire, new LarWSClientAdapter\(/);
    expect(read("nexus-client-dial.ts"), "the dial joins its adapter before the seat").toMatch(/addNetworkAdapter\(shoreInbound\(cfg\.leg \? cfg\.leg\(adapter\) : adapter\)\)/);
  });
});
