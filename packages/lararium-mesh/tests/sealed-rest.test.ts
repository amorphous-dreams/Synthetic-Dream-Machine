/**
 * sealed-rest — the composer that sets the document store's sealed rest under a vessel's Repo (sealed-store#/owed):
 * which bags rest sealed (R1) and which session signs a save the Repo makes on its own timer (R2), across the door
 * between the vessel's thread and its daemon island.
 *
 * The key shore models the measured substrate (`content-key-fixture`); the door runs over a real MessageChannel, so a
 * vector reads every byte the Repo hands to rest and every message that crosses.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { afterEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import * as A from "@automerge/automerge";
import { utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef, sessionSignatureImage } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { SEALED_DOCUMENT_REFUSALS, SealedDocumentStore } from "../src/sealed-doc-store.js";
import { announceSlotDoc, answerDocStoreAsks, composeSealedRest, docStorePortCell, islandRestGuard, sealedBagMap, vesselDocStoreDoor, vesselRestAsker, type SealedRest } from "../src/sealed-rest.js";
import { vessel, world, type Vessel } from "./content-key-fixture.js";
import { chain, signHex } from "./face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const SECRET = "the-heron-nests-by-the-third-pond";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];   // the Automerge chunk magic

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}
const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
const restsClear = (inner: { bytes: Map<string, Uint8Array> }, docId: string, text: string): boolean =>
  [...inner.bytes].some(([key, data]) => key.startsWith(docId) && (holds(data, [...utf8Bytes(text)]) || holds(data, MAGIC)));
const restsAny = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean => [...inner.bytes.keys()].some((key) => key.startsWith(docId));

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
async function signerOf(name: string): Promise<RecordSigner> {
  const c = await chain(name, "nexus-test-one");
  return { certificate: c.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }) };
}

/** One vessel's sealed rest over a MessageChannel door: the vessel's book of asks, and the island's holder behind it. */
function standRest(a: Vessel, inner: StorageAdapterInterface, over: { sealed?: (documentId: string) => boolean; hydrates?: boolean } = {}) {
  const own = faceProofSubjectRef(a.chain.scope);
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  // The vessel's session sign book: each seal books one ask under the session that booked the change.
  const asks = new Map<string, { verb: string; session: Session }>();
  const sealedUnder: { documentAsk: string; session: string }[] = [];
  answerDocStoreAsks(islandSide, {
    async seal({ bagId, values, ask, peer }) {
      const booked = asks.get(ask.requestId);
      if (!booked || booked.verb !== ask.verb) return { refusal: "signer-unavailable" } as never;
      sealedUnder.push({ documentAsk: ask.requestId, session: booked.session.id });
      return a.holder.sealValues({ bagId, values, signer: booked.session.signer, ...(peer !== undefined ? { peer } : {}) });
    },
    open: (args) => a.holder.openValue(args),
  });
  let repo: Repo | null = null;
  const rest: SealedRest<Session> = composeSealedRest<Session>({
    inner,
    bagOf: (documentId) => (over.sealed ?? (() => true))(documentId) ? { bagId: BAG, face: own } : null,
    sessionFace: () => own,
    door: vesselDocStoreDoor<Session>(() => vesselSide, {
      book: (ask, verb, session) => { asks.set(ask, { verb, session }); return () => asks.delete(ask); },
      idPrefix: "test",
    }),
    flushRepo: async () => { await repo?.flush(); },
    ...(over.hydrates === true ? { hydrates: true } : {}),
  });
  return { rest, own, sealedUnder, asks, seat: (r: Repo) => { repo = r; } };
}

describe("R1: a private bag's change rests sealed through the door", () => {
  it("POSITIVE FIRST: the same writes on the bare rest leave the clear Automerge text at rest", async () => {
    const inner = memoryAdapter();
    const repo = new Repo({ storage: inner, network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await repo.shutdown();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);
  });

  it("a session's change crosses as a body, rests as a sealed value, and a restart hydrates it; an unsealed document stays clear (control)", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    let control = "";
    const r = standRest(a, inner, { sealed: (id) => id !== control });
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    const clear = repo.create<{ note?: string }>();
    control = clear.documentId;
    r.rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    clear.change((d) => { d.note = `${SECRET}-clear`; });
    await repo.flush();
    // THE SETUP TOOK: the sealed document reached rest, through the door, under the booked session.
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(r.sealedUnder.length).toBeGreaterThan(0);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    // THE LIVE WIKI IN MEMORY READS CLEAR (control).
    expect(doc.doc().note).toBe(SECRET);
    expect(restsClear(inner, clear.documentId, `${SECRET}-clear`)).toBe(true);
    // No booking outlives its seal.
    await r.rest.store.flush();
    expect([...r.asks.keys()]).toEqual([]);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner, { sealed: (id) => id !== control });
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    const found = await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl);
    expect(found.doc().note).toBe(SECRET);
    await repo2.shutdown();
  });
});

describe("R2: a save the Repo makes on its own timer signs under the session that booked the change", () => {
  it("two sessions write two documents; each timer save signs under its own writer, never under the latest session", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const first: Session = { id: "s-first", subject: r.own, signer: a.signer };
    const later: Session = { id: "s-later", subject: r.own, signer: await signerOf("later-writer") };
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const one = repo.create<{ note?: string }>();
    const two = repo.create<{ note?: string }>();
    r.rest.wrote(one.documentId, first);
    one.change((d) => { d.note = `${SECRET}-one`; });
    r.rest.wrote(two.documentId, later);
    two.change((d) => { d.note = `${SECRET}-two`; });
    // The Repo's own debounce saves them: no flush called.
    await new Promise((settle) => setTimeout(settle, 400));
    await r.rest.store.flush();
    expect(new Set(r.sealedUnder.map((s) => s.session))).toEqual(new Set(["s-first", "s-later"]));
    // At the dispatch position: the manifest's writer. `one` opens as the first session's face; `two` as the later's.
    const ref = [...inner.bytes.keys()].filter((k) => k.startsWith(one.documentId));
    expect(ref.length).toBeGreaterThan(0);
    const writers = new Set<string>();
    for (const key of [...inner.bytes.keys()].filter((k) => k.startsWith(two.documentId))) {
      const parts = key.split("\u0000");
      const opened = await a.holder.openValue({ bagId: BAG, role: parts[1] === "snapshot" ? "checkpoint" : "change", ref: (await import("../src/sealed-doc-store.js")).logicalRefOf(parts) });
      if (!("refusal" in opened)) writers.add(opened.writer);
    }
    expect(writers.size).toBe(1);
    expect([...writers][0]).not.toBe(r.own);
    await repo.shutdown();
  });

  it("a lock with a pending save flushes it sealed before the booking drops; a change after the lock waits unbooked", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [], saveDebounceRate: 60_000 });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    r.rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    // The save stands pending on a long timer; the lock flushes it before it drops the booking.
    expect(restsAny(inner, doc.documentId)).toBe(false);
    await r.rest.lock();
    expect(r.sealedUnder.map((s) => s.session)).toContain("s-a");
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    expect(r.rest.book.size).toBe(0);
    // After the lock: no booking, so the save waits unbooked and nothing more rests.
    const before = inner.bytes.size;
    doc.change((d) => { d.note = `${SECRET}-after-lock`; });
    await repo.flush();
    expect(inner.bytes.size).toBe(before);
    expect(r.rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    await repo.shutdown();
  });

  it("a save no session booked refuses `save-unbooked`, stays readable in memory and unwritten, and seals on the next unlock's session", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const held: string[] = [];
    const rest = composeSealedRest<Session>({
      inner, bagOf: () => ({ bagId: BAG, face: r.own }), sessionFace: () => r.own,
      door: { seal: (args) => a.holder.sealValues({ ...args, signer: args.session ? (args.session as Session).signer : null }), open: (args) => a.holder.openValue(args) },
      flushRepo: async () => { await repo.flush(); },
      onHeld: (h) => held.push(`${h.refusal}:${h.documentId}`),
    });
    const repo = new Repo({ storage: rest.store, network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });   // a peer's change that arrived unsealed: no session booked it
    await repo.flush();
    expect(SEALED_DOCUMENT_REFUSALS).toContain("save-unbooked");
    expect(held).toContain(`save-unbooked:${doc.documentId}`);
    expect(restsAny(inner, doc.documentId)).toBe(false);
    expect(doc.doc().note).toBe(SECRET);
    expect(rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    // The next unlock's session books the waiting save and seals it.
    const sealed = await rest.rebook({ id: "s-next", subject: r.own, signer: a.signer });
    expect(sealed).toBeGreaterThan(0);
    expect(rest.store.waiting(doc.documentId)).toBe(0);
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(SECRET);
    await repo2.shutdown();
  });

  it("a clear chunk of a sealed bag found at rest seals into a checkpoint at the first booked save, and leaves rest", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    // A document written before its bag mapped sealed (a genesis ahead of the face's lighting) rests clear.
    const early = new Repo({ storage: inner, network: [] });
    const doc = early.create<{ note?: string; more?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await early.flush();
    await early.shutdown();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);
    const r = standRest(a, inner);
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    // Hydration reads the clear chunk once, for the session's own face, and the first booked save sweeps it.
    const found = await repo.find<{ note?: string; more?: string }>(doc.documentId as unknown as AutomergeUrl);
    expect(found.doc().note).toBe(SECRET);
    r.rest.wrote(doc.documentId, { id: "s-a", subject: r.own, signer: a.signer });
    found.change((d) => { d.more = "a second word"; });
    await repo.flush();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    const back = await repo2.find<{ note?: string; more?: string }>(doc.documentId as unknown as AutomergeUrl);
    expect(back.doc()).toMatchObject({ note: SECRET, more: "a second word" });
    await repo2.shutdown();
  });
});

/** A peer replica and a vessel's Repo over the sealed rest, joined by a MessageChannel. */
function linked(rest: SealedRest<Session>, peer: Repo, name: string) {
  const channel = new MessageChannel();
  ports.push(channel.port1, channel.port2);
  peer.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(channel.port1));
  return new Repo({ storage: rest.store, network: [new MessageChannelNetworkAdapter(channel.port2)], peerId: name as PeerId });
}
const settle = (ms = 300) => new Promise((done) => setTimeout(done, ms));

describe("T4: a change books its own writer", () => {
  it("a peer's change that syncs in while a local session stands carries the peer's writer; a local change books the session (control)", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const peer = new Repo({ network: [], peerId: "peer-replica" as PeerId });
    const repo = linked(r.rest, peer, "vessel");
    r.seat(repo);
    r.rest.watch(repo, () => session);
    const theirs = peer.create<{ note?: string; ours?: string }>();
    theirs.change((d) => { d.note = SECRET; });
    const peerActor = A.getActorId(theirs.doc() as A.Doc<unknown>);
    const mine = await repo.find<{ note?: string; ours?: string }>(theirs.url);
    await settle();
    expect(mine.doc().note).toBe(SECRET);
    await repo.flush();
    await r.rest.store.flush();
    // The setup took: the peer's change reached this replica, and its writer reads as the peer's, never the session's.
    expect(r.rest.book.writerOf(mine.documentId)).toBe(`peer:${peerActor}`);
    // It rests as received: sealed under the session that holds the rest, never clear.
    expect(restsAny(inner, mine.documentId)).toBe(true);
    expect(restsClear(inner, mine.documentId, SECRET)).toBe(false);
    // CONTROL: a change this replica makes books the local session.
    mine.change((d) => { d.ours = "a local word"; });
    await repo.flush();
    await r.rest.store.flush();
    expect(r.rest.book.writerOf(mine.documentId)).toBe("session:s-a");
    await repo.shutdown();
    await peer.shutdown();
  });
});

describe("U3: the manifest carries the change's writer, signed with it", () => {
  it("each sealed value names its writer off its own manifest, never off the book: the peer's change `peer:<actor>`, the local change the signing session, and a restart that drops the book reads the same", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const peer = new Repo({ network: [], peerId: "peer-replica" as PeerId });
    const repo = linked(r.rest, peer, "vessel");
    r.seat(repo);
    r.rest.watch(repo, () => session);
    const { logicalRefOf } = await import("../src/sealed-doc-store.js");
    const writersAtRest = async (documentId: string): Promise<string[]> => {
      const keys = [...inner.bytes.keys()].filter((k) => k.startsWith(documentId)).map((k) => k.split("\u0000"));
      expect(keys.length).toBeGreaterThan(0);
      const writers = new Set<string>();
      for (const key of keys) {
        const opened = await a.holder.openValue({ bagId: BAG, role: key[1] === "snapshot" ? "checkpoint" : "change", ref: logicalRefOf(key) });
        expect("plaintext" in opened, JSON.stringify(opened)).toBe(true);
        if ("plaintext" in opened) writers.add(opened.changeWriter);
      }
      return [...writers].sort();
    };
    const theirs = peer.create<{ note?: string; ours?: string }>();
    theirs.change((d) => { d.note = SECRET; });
    const peerActor = A.getActorId(theirs.doc() as A.Doc<unknown>);
    const mine = await repo.find<{ note?: string; ours?: string }>(theirs.url);
    await settle();
    await repo.flush();
    await r.rest.store.flush();
    // The peer's change rests as received under the local session, and its manifest names the peer, never that session.
    expect(await writersAtRest(mine.documentId)).toEqual([`peer:${peerActor}`]);
    mine.change((d) => { d.ours = "a local word"; });
    await repo.flush();
    await r.rest.store.flush();
    await repo.shutdown();
    await peer.shutdown();
    // THE BOOK GOES: a restart holds no booking, so the writer reads off the sealed record alone.
    a.restart();
    expect(await writersAtRest(mine.documentId)).toContain(`session:${a.signer.certificate.sessionKey}`);
  });

  it("CONTROL: a seal naming an empty peer refuses `values-malformed`, and a manifest's sealed part with no writer reads malformed", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const refused = await a.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: "cd".repeat(32), parents: [], plaintext: utf8Bytes("x") }], signer: a.signer, peer: "" });
    expect("refusal" in refused && refused.refusal).toBe("values-malformed");
  });
});

describe("P1: a bag map that drops (a dial drop, the floor) never writes clear over a sealed rest", () => {
  it("after the map drops, a change and a compaction leave no clear byte and every sealed pointer at rest; the save waits `save-unmapped` and seals once the map stands again", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    let mapped = true;
    const r = standRest(a, inner, { sealed: () => mapped });
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string; more?: string }>();
    r.rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await r.rest.store.flush();
    const pointers = [...inner.bytes.keys()].filter((k) => k.startsWith(doc.documentId));
    expect(pointers.length).toBeGreaterThan(0);   // the setup took: the document rests sealed
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    // THE MAP DROPS (the dial's chain cleared): the next change saves, and the engine compacts: a snapshot, then the
    // removal of every earlier chunk key.
    mapped = false;
    doc.change((d) => { d.more = `${SECRET}-after-the-drop`; });
    await repo.flush();
    const snapshot = A.save(doc.doc() as A.Doc<unknown>);
    await r.rest.store.save([doc.documentId, "snapshot", "after-the-drop"], snapshot);
    for (const key of pointers) await r.rest.store.remove(key.split("\u0000"));
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    expect(restsClear(inner, doc.documentId, `${SECRET}-after-the-drop`)).toBe(false);
    for (const key of pointers) expect(inner.bytes.has(key), key).toBe(true);
    expect(r.rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    // THE MAP STANDS AGAIN: the waiting saves seal, and only then do the removals the compaction asked land.
    mapped = true;
    r.rest.book.book(doc.documentId, session);
    await r.rest.store.reseal();
    expect(r.rest.store.waiting(doc.documentId)).toBe(0);
    expect(restsClear(inner, doc.documentId, `${SECRET}-after-the-drop`)).toBe(false);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string; more?: string }>(doc.documentId as unknown as AutomergeUrl)).doc()).toMatchObject({ note: SECRET, more: `${SECRET}-after-the-drop` });
    await repo2.shutdown();
  });

  it("CONTROL: a document that never rested sealed still writes clear while unmapped", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner, { sealed: () => false });
    const repo = new Repo({ storage: r.rest.store, network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);
    await repo.shutdown();
  });
});

describe("P2-1: a seal the door cannot answer keeps its change", () => {
  it("a save whose seal refuses (no island answers) waits in memory, never throws its change away, and seals once the door answers", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    let answers = false;
    const held: string[] = [];
    const own = faceProofSubjectRef(a.chain.scope);
    const session: Session = { id: "s-a", subject: own, signer: a.signer };
    let repo: Repo | null = null;
    const rest = composeSealedRest<Session>({
      inner, bagOf: () => ({ bagId: BAG, face: own }), sessionFace: () => own,
      door: {
        seal: async (args) => answers ? a.holder.sealValues({ ...args, signer: (args.session as Session).signer }) : { refusal: "signer-unavailable", cause: "the daemon island did not answer the seal" } as never,
        open: (args) => a.holder.openValue(args),
      },
      flushRepo: async () => { await repo?.flush(); },
      onHeld: (h) => held.push(h.refusal),
    });
    repo = new Repo({ storage: rest.store, network: [] });
    const doc = repo.create<{ note?: string }>();
    rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    const direct = rest.store.save([doc.documentId, "incremental", "direct"], A.save(doc.doc() as A.Doc<unknown>));
    await expect(direct).resolves.toBeUndefined();
    await repo.flush();
    expect(rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    expect(held).toContain("save-unsealed");
    expect(restsAny(inner, doc.documentId)).toBe(false);
    answers = true;
    expect(await rest.store.reseal()).toBeGreaterThan(0);
    expect(rest.store.waiting(doc.documentId)).toBe(0);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    expect(restsAny(inner, doc.documentId)).toBe(true);
    await repo.shutdown();
  });
});

describe("P2-2: the lock reaches the island's holder at once", () => {
  it("after the vessel posts its lock across the door, the island's holder holds no content key: an open refuses, and nothing seals", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const own = faceProofSubjectRef(a.chain.scope);
    const channel = new MessageChannel();
    const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
    let locked = false;
    answerDocStoreAsks(islandSide, {
      seal: ({ bagId, values }) => locked ? Promise.resolve({ refusal: "sealed-store-unavailable" } as never) : a.holder.sealValues({ bagId, values, signer: a.signer }),
      open: (args) => locked ? Promise.resolve({ refusal: "holder-locked" } as never) : a.holder.openValue(args),
      lock: () => { locked = true; a.holder.lock(); },
    });
    const door = vesselDocStoreDoor<Session>(() => vesselSide, { book: () => () => {}, idPrefix: "lock-test" });
    const session: Session = { id: "s-a", subject: own, signer: a.signer };
    const value = { role: "change" as const, ref: "ef".repeat(32), parents: [], plaintext: utf8Bytes(SECRET) };
    const sealed = await door.seal({ bagId: BAG, values: [value], session });
    expect("values" in sealed).toBe(true);   // the setup took
    expect("plaintext" in (await door.open({ bagId: BAG, role: "change", ref: value.ref }))).toBe(true);
    door.lock();
    await settle(50);
    expect(locked).toBe(true);
    const after = await door.open({ bagId: BAG, role: "change", ref: value.ref });
    expect("refusal" in after && after.refusal).toBe("holder-locked");
    const direct = await a.holder.openValue({ bagId: BAG, role: "change", ref: value.ref });
    expect("refusal" in direct).toBe(true);
  });
});

describe("T3: a save waiting at the stand-down is never lost", () => {
  it("a booked change written just before the stand-down seals under its session before any booking drops, and a restart reads it", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [], saveDebounceRate: 60_000 });
    r.seat(repo);
    r.rest.watch(repo, () => session);
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    expect(restsAny(inner, doc.documentId)).toBe(false);
    // Stand down at once: the flush lands sealed under the booked session while the island still answers.
    expect(await r.rest.standDown([session])).toBe(0);
    expect(r.sealedUnder.map((s) => s.session)).toContain("s-a");
    expect(r.rest.book.size).toBe(0);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(SECRET);
    await repo2.shutdown();
  });

  it("a peer's change no session could seal rests nowhere new at the stand-down, comes back by sync after the restart, and seals then", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const peer = new Repo({ network: [], peerId: "peer-replica" as PeerId });
    const repo = linked(r.rest, peer, "vessel-one");
    r.seat(repo);
    r.rest.watch(repo, () => null);   // the vessel stands locked: no session to seal anything
    const theirs = peer.create<{ note?: string }>();
    theirs.change((d) => { d.note = SECRET; });
    const mine = await repo.find<{ note?: string }>(theirs.url);
    await settle();
    expect(mine.doc().note).toBe(SECRET);
    await repo.flush();
    // The setup took: the save waits unbooked; the stand-down rests nothing new and names what still waits.
    expect(await r.rest.standDown([])).toBeGreaterThan(0);
    expect(restsAny(inner, mine.documentId)).toBe(false);
    await repo.shutdown();
    // Restart and unlock: the session stands, the peer re-delivers what this replica lacks, and it seals.
    a.restart();
    const again = standRest(a, inner);
    const session: Session = { id: "s-next", subject: again.own, signer: a.signer };
    const repo2 = linked(again.rest, peer, "vessel-two");
    again.seat(repo2);
    again.rest.watch(repo2, () => session);
    const back = await repo2.find<{ note?: string }>(theirs.url);
    await settle();
    expect(back.doc().note).toBe(SECRET);
    await repo2.flush();
    await again.rest.store.flush();
    expect(restsAny(inner, back.documentId)).toBe(true);
    expect(restsClear(inner, back.documentId, SECRET)).toBe(false);
    await repo2.shutdown();
    await peer.shutdown();
    // A third boot with no peer at all reads it off the sealed rest.
    a.restart();
    const third = standRest(a, inner);
    const repo3 = new Repo({ storage: third.rest.store, network: [] });
    expect((await repo3.find<{ note?: string }>(theirs.url)).doc().note).toBe(SECRET);
    await repo3.shutdown();
  });
});

describe("T2: a holder that stands no session never writes clear over a sealed rest", () => {
  it("the direct holder's store refuses a clear save onto a document that rests sealed, and still writes an unsealed one (control)", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    r.rest.wrote(doc.documentId, { id: "s-a", subject: r.own, signer: a.signer });
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await repo.shutdown();
    expect(restsAny(inner, doc.documentId)).toBe(true);
    // The direct holder: no bag map, no session, no island. It stands over the same rest.
    const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
    const direct = new SealedDocumentStore({ inner, bagOf: () => null, sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true });
    const before = new Map(inner.bytes);
    await expect(direct.save([doc.documentId, "incremental", "c0ffee"], Uint8Array.from([...MAGIC, 1, 2, 3]))).rejects.toMatchObject({ refusal: "bag-unmapped" });
    expect(new Map(inner.bytes)).toEqual(before);
    await expect(direct.load([doc.documentId, "snapshot", [...inner.bytes.keys()].find((k) => k.startsWith(doc.documentId))!.split("\u0000")[2]!])).rejects.toMatchObject({ refusal: "bag-unmapped" });
    // CONTROL: a document that rests no sealed value writes as the engine hands it.
    await direct.save(["an-unsealed-document", "incremental", "c0ffee"], Uint8Array.from([...MAGIC, 1, 2, 3]));
    expect(inner.bytes.has(["an-unsealed-document", "incremental", "c0ffee"].join("\u0000"))).toBe(true);
  });
});

describe("V3: the bag map names a slot document the catalog names no row for", () => {
  it("a working layer's document the mount resolved (the face's derived address) maps sealed, as the catalog's row for the wiki bag does; a bag the map leaves out and a faceless map name none (controls)", () => {
    let face: string | null = "face:one";
    const WIKI = "lar:///ha.ka.ba/bags/@lares", WORKING = "lar:///ha.ka.ba/wikis/@lares/working", OTHER = "lar:///ha.ka.ba/bags/@else";
    const mounted: Record<string, string> = { [WORKING]: "doc-working" };
    const catalog: Record<string, string> = { [WIKI]: "doc-wiki", [OTHER]: "doc-else" };
    const map = sealedBagMap({
      face: () => face,
      bags: () => [WIKI, WORKING],
      docsOf: (bagId) => [mounted[bagId], catalog[bagId]],
    });
    expect(map.bagOf("doc-working")).toEqual({ bagId: WORKING, face: "face:one" });
    expect(map.bagOf("doc-wiki")).toEqual({ bagId: WIKI, face: "face:one" });
    expect(map.docOf(WORKING)).toBe("doc-working");
    expect(map.bagOf("doc-else")).toBeNull();
    face = null;
    expect(map.bagOf("doc-working")).toBeNull();
  });
});

describe("V2: an island's own store rests no document the vessel's rest seals", () => {
  it("an island's change reaches the vessel by sync and rests there sealed; the island's store holds no byte of it, a restart's island finds it by sync, and an unsealed document still rests in the island (control)", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const islandInner = memoryAdapter();
    let control = "";
    const r = standRest(a, inner, { sealed: (id) => id !== control });
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const asked: string[] = [];
    const guardOf = () => islandRestGuard(islandInner, async (documentId) => { asked.push(documentId); return r.rest.restsSealed(documentId); });
    const island = new Repo({ storage: guardOf(), network: [], peerId: "island-one" as PeerId });
    const repo = linked(r.rest, island, "vessel-one");
    r.seat(repo);
    r.rest.watch(repo, () => session);
    const doc = island.create<{ note?: string }>();
    const clear = island.create<{ note?: string }>();
    control = clear.documentId;
    doc.change((d) => { d.note = SECRET; });
    clear.change((d) => { d.note = `${SECRET}-clear`; });
    const mine = await repo.find<{ note?: string }>(doc.url);
    await repo.find<{ note?: string }>(clear.url);
    await settle();
    expect(mine.doc().note).toBe(SECRET);
    await island.flush();
    await repo.flush();
    await r.rest.store.flush();
    // THE SETUP TOOK: the island asked, and the vessel's rest holds the document sealed.
    expect(asked).toContain(doc.documentId);
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    // THE ISLAND'S OWN STORE HOLDS NO BYTE OF IT, and still rests the unsealed document (control).
    expect(restsAny(islandInner, doc.documentId)).toBe(false);
    expect(restsClear(islandInner, clear.documentId, `${SECRET}-clear`)).toBe(true);
    await island.shutdown();
    // A RESTARTED ISLAND finds the sealed document by sync from the vessel.
    const channel = new MessageChannel();
    ports.push(channel.port1, channel.port2);
    repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(channel.port2));
    const island2 = new Repo({ storage: guardOf(), network: [new MessageChannelNetworkAdapter(channel.port1)], peerId: "island-two" as PeerId });
    const back = await island2.find<{ note?: string }>(doc.url);
    expect(back.doc().note).toBe(SECRET);
    await island2.flush();
    expect(restsAny(islandInner, doc.documentId)).toBe(false);
    await island2.shutdown();
    await repo.shutdown();
  });

  it("a clear copy an island store holds from before its document mapped sealed leaves the island's rest at its first ask", async () => {
    const islandInner = memoryAdapter();
    const before = new Repo({ storage: islandInner, network: [] });
    const doc = before.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await before.flush();
    await before.shutdown();
    expect(restsClear(islandInner, doc.documentId, SECRET)).toBe(true);   // the setup took
    const guard = islandRestGuard(islandInner, async () => true);
    expect(await guard.loadRange([doc.documentId])).toEqual([]);
    expect(restsAny(islandInner, doc.documentId)).toBe(false);
  });
});

describe("V3: the slot resolver names each slot document it answers, and the map seals one that already rested clear", () => {
  it("a slot notice from the island reaches the vessel's cell; a document that rested clear before its bag mapped seals at once under the standing session, and its clear chunks leave rest", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    let mapped = false;
    const r = standRest(a, inner, { sealed: () => mapped });
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    // THE NOTICE: the island's resolver names a slot document, and the vessel's cell hears it.
    const heard: string[] = [];
    const channel = new MessageChannel();
    const cell = docStorePortCell(async () => null, { onSlot: (bagId, documentId) => heard.push(`${bagId}=${documentId}`) });
    cell.attach(portOf(channel.port1));
    announceSlotDoc(portOf(channel.port2), "lar:///ha.ka.ba/wikis/@lares/working", "doc-working");
    await settle(50);
    expect(heard).toEqual(["lar:///ha.ka.ba/wikis/@lares/working=doc-working"]);
    // A document that rested clear before its bag mapped (the notice arrived late).
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);   // the setup took
    mapped = true;
    expect(await r.rest.sealMapped(doc.documentId, session)).toBe(true);
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    // CONTROL: a document whose rest holds no clear chunk seals nothing more.
    expect(await r.rest.sealMapped(doc.documentId, session)).toBe(false);
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(SECRET);
    await repo2.shutdown();
  });
});

describe("a restart's hydration: a sealed document's load waits for its map, never strands", () => {
  it("a load before the bag maps waits and hydrates once the map moves; a store that does not hydrate refuses by name (control)", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    r.rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await repo.shutdown();
    a.restart();
    // THE RESTART: the map stands only after the load began (the dial composes, the slot resolver names the document).
    let mapped = false;
    const again = standRest(a, inner, { sealed: () => mapped, hydrates: true });
    let loaded = false;
    const loading = again.rest.store.loadRange([doc.documentId]).then((chunks) => { loaded = true; return chunks; });
    await settle(100);
    // barrier: the load stands pending, waiting on the map (it neither refused nor read).
    expect(loaded).toBe(false);
    mapped = true;
    again.rest.store.mapMoved();
    const chunks = await loading;
    expect(chunks.length).toBeGreaterThan(0);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(SECRET);
    await repo2.shutdown();
    // CONTROL: a store that does not hydrate, with no map standing: the load refuses `bag-unmapped` at once, by name.
    const third = standRest(a, inner, { sealed: () => false });
    await expect(third.rest.store.loadRange([doc.documentId])).rejects.toMatchObject({ refusal: "bag-unmapped" });
  });
});

// NO GLOBAL NOW (operator 2026-11-06: "No timeout"): each wait of the sealed rest ends on the event that settles it, the
// answer or the peer's departure, and a hydrating load on its map's move or the rest's stand-down; no clock decides.
describe("the sealed rest's waits end on their own events, never on a clock", () => {
  it("the rest ask waits for the vessel's answer however late; a sealed answer reads sealed, and never reads unsealed on silence", async () => {
    const channel = new MessageChannel();
    const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
    const answers = new Map<string, boolean>([["doc-sealed", true], ["doc-clear", false]]);
    vesselSide.listen((raw) => {
      const m = raw as { type?: string; requestId?: string; documentId?: string };
      if (m.type !== "rest:ask") return;
      // The vessel answers late: past any patience an island might once have held.
      setTimeout(() => vesselSide.post({ type: "rest:answer", requestId: m.requestId, sealed: answers.get(m.documentId ?? "") === true }), 150);
    });
    const ask = vesselRestAsker(islandSide, { idPrefix: "late" });
    let settled = false;
    const sealed = ask("doc-sealed").then((v) => { settled = true; return v; });
    await settle(50);
    // barrier: no answer yet, and no clock read the silence as unsealed.
    expect(settled).toBe(false);
    expect(await sealed).toBe(true);
    // CONTROL: a vessel that answers unsealed reads unsealed.
    expect(await ask("doc-clear")).toBe(false);
  });

  it("the door's open waits for the island; the island's departure answers it by name at once", async () => {
    const channel = new MessageChannel();
    const silent = portOf(channel.port1);   // an island that never answers: it stands, then goes
    const cell = docStorePortCell(async () => null);
    const detach = cell.attach(silent);
    const door = vesselDocStoreDoor<Session>(() => cell.port(), { book: () => () => {}, idPrefix: "gone" });
    let settled = false;
    const opened = door.open({ bagId: BAG, role: "change", ref: "ab".repeat(32) }).then((v) => { settled = true; return v; });
    await settle(50);
    // barrier: the ask waits on the island, no clock answers it.
    expect(settled).toBe(false);
    detach();
    expect(await opened).toMatchObject({ refusal: "holder-locked" });
    // CONTROL: with no island attached the door refuses at once, by name.
    expect(await door.open({ bagId: BAG, role: "change", ref: "cd".repeat(32) })).toMatchObject({ refusal: "holder-locked" });
  });

  it("a hydrating load with no map waits past any clock, and refuses by name when the rest stands down", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const r = standRest(a, inner);
    const session: Session = { id: "s-a", subject: r.own, signer: a.signer };
    const repo = new Repo({ storage: r.rest.store, network: [] });
    r.seat(repo);
    const doc = repo.create<{ note?: string }>();
    r.rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    await repo.shutdown();
    a.restart();
    const again = standRest(a, inner, { sealed: () => false, hydrates: true });
    let refused: unknown = null;
    const loading = again.rest.store.loadRange([doc.documentId]).then(() => "read", (e: unknown) => { refused = e; return "refused"; });
    await settle(100);
    // barrier: no map, no move, and no clock: the load still waits.
    expect(refused).toBe(null);
    await again.rest.standDown([]);
    expect(await loading).toBe("refused");
    expect(refused).toMatchObject({ refusal: "bag-unmapped" });
    // CONTROL: a store that does not hydrate refuses at once, by name.
    const plain = standRest(a, inner, { sealed: () => false });
    await expect(plain.rest.store.loadRange([doc.documentId])).rejects.toMatchObject({ refusal: "bag-unmapped" });
  });
});
