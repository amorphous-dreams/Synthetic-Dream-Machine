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
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef, sessionSignatureImage } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { SEALED_DOCUMENT_REFUSALS } from "../src/sealed-doc-store.js";
import { answerDocStoreAsks, composeSealedRest, vesselDocStoreDoor, type SealedRest } from "../src/sealed-rest.js";
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
function standRest(a: Vessel, inner: StorageAdapterInterface, over: { sealed?: (documentId: string) => boolean } = {}) {
  const own = faceProofSubjectRef(a.chain.scope);
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  // The vessel's session sign book: each seal books one ask under the session that booked the change.
  const asks = new Map<string, { verb: string; session: Session }>();
  const sealedUnder: { documentAsk: string; session: string }[] = [];
  answerDocStoreAsks(islandSide, {
    async seal({ bagId, values, ask }) {
      const booked = asks.get(ask.requestId);
      if (!booked || booked.verb !== ask.verb) return { refusal: "signer-unavailable" } as never;
      sealedUnder.push({ documentAsk: ask.requestId, session: booked.session.id });
      return a.holder.sealValues({ bagId, values, signer: booked.session.signer });
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
      patienceMs: 5_000, idPrefix: "test",
    }),
    flushRepo: async () => { await repo?.flush(); },
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
