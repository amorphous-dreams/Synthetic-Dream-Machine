/**
 * sealed-rest-refile — THE LIFT RE-FILES A SEAL, NEVER A DOCUMENT (the-veil-ladder#/the-base-model, in-house Ruling 2).
 * A wiki's canon document a veil floor minted rests sealed under the vessel's held key. When a face lifts it, the same
 * document id re-files under the face's key: its chunks at rest open under the vessel's key one last time and seal again
 * through the face's door, in place. A replay re-files nothing.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { mintHeldRestKey, type HeldRestKey } from "../src/held-rest-key.js";
import { answerDocStoreAsks, composeSealedRest, vesselDocStoreDoor, type SealedBag, type SealedRest } from "../src/sealed-rest.js";
import { vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/veil-notes";
const SECRET = "the-veil-wrote-this-at-its-floor";
const POINTER = [..."lares-sealed-value:"].map((c) => c.charCodeAt(0));

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}

type Session = { readonly id: string; readonly subject: string; readonly signer: RecordSigner };
const ports: MessagePort[] = [];
afterEach(() => { while (ports.length) ports.pop()!.close(); });
const portOf = (p: MessagePort) => {
  ports.push(p);
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

/** One vessel's sealed rest whose map the test moves (`bag`), with the vessel's own key in reach or not (`key`). */
function standRest(a: Vessel, inner: StorageAdapterInterface, cell: { bag: (own: string) => SealedBag | null; key: HeldRestKey | null }) {
  const own = faceProofSubjectRef(a.chain.scope);
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  const asks = new Map<string, Session>();
  const seals: string[] = [];
  answerDocStoreAsks(islandSide, {
    async seal({ bagId, values, ask }) {
      const booked = asks.get(ask.requestId);
      if (!booked) return { refusal: "signer-unavailable" } as never;
      seals.push(bagId);
      return a.holder.sealValues({ bagId, values, signer: booked.signer });
    },
    open: (args) => a.holder.openValue(args),
  });
  let repo: Repo | null = null;
  const rest: SealedRest<Session> = composeSealedRest<Session>({
    inner,
    bagOf: () => cell.bag(own),
    sessionFace: () => own,
    door: vesselDocStoreDoor<Session>(() => vesselSide, { book: (ask, _verb, session) => { asks.set(ask, session); return () => asks.delete(ask); }, idPrefix: "refile" }),
    flushRepo: async () => { await repo?.flush(); },
    vesselKey: () => cell.key,
  });
  return { rest, own, seals, seat: (r: Repo) => { repo = r; } };
}

const starts = (data: Uint8Array, mark: readonly number[]): boolean => mark.every((b, i) => data[i] === b);
const chunksOf = (inner: { bytes: Map<string, Uint8Array> }, docId: string): Uint8Array[] => [...inner.bytes].filter(([key]) => key.startsWith(docId)).map(([, data]) => data);
const within = <T>(p: Promise<T>, ms = 1500): Promise<T | "silent"> => Promise.race([p, new Promise<"silent">((done) => setTimeout(() => done("silent"), ms))]);

describe("RF: a document that rests under the vessel's key re-files under a face's key, in place", () => {
  it("RF1: the same document id opens under the face, its rest names face pointers alone, and a replay re-files nothing", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const key = mintHeldRestKey();
    // THE FLOOR: the document files as the vessel's own and rests sealed under the held key, with no session.
    const cell: { bag: (own: string) => SealedBag | null; key: HeldRestKey | null } = { bag: () => ({ bagId: BAG, face: null, held: key }), key };
    const floor = standRest(a, inner, cell);
    const repo = new Repo({ storage: floor.rest.store, network: [] });
    floor.seat(repo);
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    const atFloor = chunksOf(inner, doc.documentId);
    // THE SETUP TOOK: bytes rest, none names a face pointer, and no seal crossed the face's door.
    expect(atFloor.length).toBeGreaterThan(0);
    expect(atFloor.some((c) => starts(c, POINTER))).toBe(false);
    expect(floor.seals).toEqual([]);
    await repo.shutdown();

    // THE LIFT: the map now names the same document under the face; the vessel's key stays in reach.
    cell.bag = (own) => ({ bagId: BAG, face: own });
    const lifted = standRest(a, inner, cell);
    const session: Session = { id: "s-face", subject: lifted.own, signer: a.signer };
    const repo2 = new Repo({ storage: lifted.rest.store, network: [] });
    lifted.seat(repo2);
    // The document reads at once, before any re-file ran (a crash between the map's move and the re-file strands nothing).
    const found = await within(repo2.find<{ note?: string }>(doc.url));
    expect(found).not.toBe("silent");
    expect((found as { doc(): { note?: string } }).doc().note).toBe(SECRET);
    expect(await lifted.rest.sealMapped(doc.documentId, session)).toBe(true);
    const refiled = chunksOf(inner, doc.documentId);
    expect(refiled.length).toBeGreaterThan(0);
    expect(refiled.every((c) => starts(c, POINTER))).toBe(true);
    expect(lifted.seals.length).toBeGreaterThan(0);
    expect(lifted.seals.every((bag) => bag === BAG)).toBe(true);
    // A REPLAY RE-FILES NOTHING.
    const sealsAfter = lifted.seals.length;
    expect(await lifted.rest.sealMapped(doc.documentId, session)).toBe(false);
    expect(lifted.seals.length).toBe(sealsAfter);
    await repo2.shutdown();

    // THE FACE ALONE NOW OPENS IT: a rest with no vessel key in reach reads the same document id.
    cell.key = null;
    const faced = standRest(a, inner, cell);
    const repo3 = new Repo({ storage: faced.rest.store, network: [] });
    const again = await within(repo3.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl));
    expect(again).not.toBe("silent");
    expect((again as { doc(): { note?: string } }).doc().note).toBe(SECRET);
    await repo3.shutdown();
  });

  it("RF2 (control): with no vessel key in reach, a chunk under the vessel's key never opens for a face", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const key = mintHeldRestKey();
    const cell: { bag: (own: string) => SealedBag | null; key: HeldRestKey | null } = { bag: () => ({ bagId: BAG, face: null, held: key }), key };
    const floor = standRest(a, inner, cell);
    const repo = new Repo({ storage: floor.rest.store, network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await repo.shutdown();
    cell.bag = (own) => ({ bagId: BAG, face: own });
    cell.key = null;
    const faced = standRest(a, inner, cell);
    await expect(faced.rest.store.loadRange([doc.documentId])).rejects.toThrow(/pointer-malformed/);
    expect(await faced.rest.sealMapped(doc.documentId, { id: "s", subject: faced.own, signer: a.signer })).toBe(false);
  });
});
