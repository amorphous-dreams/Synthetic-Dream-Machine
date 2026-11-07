/**
 * sealed-doc-store — sealed-store step three: the document store's own storage values rest sealed as `change` and
 * `checkpoint` values, and hydration answers to the session's face.
 *
 * The key shore here models the measured substrate (`content-key-fixture`). The Repo runs whole over an in-memory
 * inner adapter, so a vector reads every byte the document store hands to rest.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (step three) · lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { describe, expect, it } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef, sessionSignatureImage } from "../src/face-proof-subjects.js";
import { SEALED_CHUNK_MARK } from "../src/sealed-chunk.js";
import type { RecordSigner } from "../src/sealed-records.js";
import {
  SEALED_DOCUMENT_REFUSALS, SealedDocumentRefusal, SealedDocumentStore, cutFreshBase, logicalRefOf, readsAsFreshBase,
} from "../src/sealed-doc-store.js";
import { carry, introduce, said, verifies, vessel, world, type Vessel } from "./content-key-fixture.js";
import { chain, signHex } from "./face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
const SECRET = "the-heron-nests-by-the-third-pond";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];   // the Automerge chunk magic

/** A plain in-memory adapter: every byte it holds stays readable to the vector. */
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

/** The document store for one vessel: the bag's face, the session's face, and the signer its seals take. */
function storeFor(v: Vessel, inner: StorageAdapterInterface, over: { sealed?: (documentId: string) => boolean; bagFace?: string; sessionFace?: string | null; signer?: RecordSigner } = {}): SealedDocumentStore {
  const own = faceProofSubjectRef(v.chain.scope);
  return new SealedDocumentStore({
    inner,
    bagOf: (documentId) => (over.sealed ?? (() => true))(documentId) ? { bagId: BAG, face: over.bagFace ?? own } : null,
    sessionFace: () => (over.sessionFace === undefined ? own : over.sessionFace),
    // R2: the vessel's own session booked every change these vectors write.
    sessionOf: () => ({ id: "the-writing-session", subject: own }),
    seal: ({ bagId, values }) => v.holder.sealValues({ bagId, values, signer: over.signer ?? v.signer }),
    open: (args) => v.holder.openValue(args),
  });
}
async function refusalOf(act: () => Promise<unknown>): Promise<string> {
  try { await act(); return "ANSWERED"; } catch (err) { return err instanceof SealedDocumentRefusal ? err.refusal : `THREW:${String(err)}`; }
}

describe("step three: a document change rests sealed", () => {
  it("a change written through the store rests as no clear Automerge byte, and a restart hydrates it", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    let control = "";
    const repo = new Repo({ storage: storeFor(a, inner, { sealed: (id) => id !== control }), network: [] });
    const open = repo.create<{ note?: string }>();
    const clear = repo.create<{ note?: string }>();
    control = clear.documentId;
    open.change((d) => { d.note = SECRET; });
    clear.change((d) => { d.note = `${SECRET}-in-the-clear`; });
    await repo.flush();
    await repo.shutdown();
    // THE SETUP TOOK: the sealed bag's document handed values to rest.
    const sealedKeys = [...inner.bytes.keys()].filter((key) => key.startsWith(open.documentId));
    expect(sealedKeys.length).toBeGreaterThan(0);
    // No clear Automerge byte and no text rests for the sealed bag; each value it rests seals under the format's mark.
    expect(restsClear(inner, open.documentId, SECRET)).toBe(false);
    expect(a.values.size).toBeGreaterThan(0);
    for (const sealed of a.values.values()) expect([...sealed.subarray(0, 4)]).toEqual([...SEALED_CHUNK_MARK]);
    // CONTROL: an unsealed bag's ordinary path rests Automerge's own bytes, text and magic both.
    expect(restsClear(inner, clear.documentId, `${SECRET}-in-the-clear`)).toBe(true);
    // A restart: a fresh holder and a fresh Repo over the same rest read the change back.
    a.restart();
    const again = new Repo({ storage: storeFor(a, inner, { sealed: (id) => id !== control }), network: [] });
    const found = await again.find<{ note?: string }>(open.documentId as unknown as AutomergeUrl);
    expect(found.doc().note).toBe(SECRET);
    await again.shutdown();
  });
});

describe("step three: hydration answers to the session's face", () => {
  it("a session wearing another face reads no byte of the bag, even with the key in hand; a same-face session reads", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const writer = storeFor(a, inner);
    const doc = A.change(A.init<{ note?: string }>(), (d) => { d.note = SECRET; });
    const key = ["doc-one", "incremental", "c1"];
    await writer.save(key, A.save(doc));
    expect(SEALED_DOCUMENT_REFUSALS).toContain("session-face-foreign");
    // The same holder, the same key: a session of another face asks.
    const other = faceProofSubjectRef((await chain("b", "nexus-test-one")).scope);
    const foreign = storeFor(a, inner, { sessionFace: other });
    expect(await refusalOf(() => foreign.load(key))).toBe("session-face-foreign");
    expect(await refusalOf(() => foreign.loadRange(["doc-one"]))).toBe("session-face-foreign");
    expect(await refusalOf(() => storeFor(a, inner, { sessionFace: null }).load(key))).toBe("session-absent");
    // CONTROL: the session of the bag's own face reads the change.
    const loaded = await writer.load(key);
    expect(loaded).toBeInstanceOf(Uint8Array);
    expect(A.load<{ note?: string }>(loaded!).note).toBe(SECRET);
  });

  it("a change another face's session sealed refuses hydration by name for this session's face", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    // b's session signs the batch: the holder seals it (b holds write standing in this model), under a bag of a's face.
    const b = await chain("b", "nexus-test-one");
    const bySigner = storeFor(a, inner, { signer: signerOf(b) });
    await bySigner.save(["doc-two", "incremental", "c1"], A.save(A.change(A.init<{ n?: number }>(), (d) => { d.n = 1; })));
    expect(await refusalOf(() => storeFor(a, inner).load(["doc-two", "incremental", "c1"]))).toBe("writer-face-foreign");
    // CONTROL: a change a's own session sealed reads for a's face.
    await storeFor(a, inner).save(["doc-two", "incremental", "c2"], A.save(A.change(A.init<{ n?: number }>(), (d) => { d.n = 2; })));
    expect(await refusalOf(() => storeFor(a, inner).load(["doc-two", "incremental", "c2"]))).toBe("ANSWERED");
  });
});

// ONE FACE, TWO ANCHORS (session-contract#/the-hands): a vessel that wears its face at its place and later dials a Nexus
// names that face by two proof subjects. A value its place session sealed reads after the map names the face by its
// Nexus subject, and a save its place session booked still seals there (meme-realm-bag ⑮b: a founder that dialed a
// relation's Nexus stood again and found its face's catalog and draft slot `writer-face-foreign`, so unavailable).
describe("one face at two anchors: the store reads the face by every subject the vessel's own chain names", () => {
  const PLACE = "lar:///ha.ka.ba/@test/subjects/place-of-the-worn-face";
  it("W1 — a value the worn face's place session sealed reads at its Nexus subject; another face's writer still refuses", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const key = ["doc-anchor", "incremental", "c1"];
    await storeFor(a, inner).save(key, A.save(A.change(A.init<{ note?: string }>(), (d) => { d.note = SECRET; })));
    const own = faceProofSubjectRef(a.chain.scope);
    // The manifest names the place subject as its writer: the place session sealed it.
    const readAs = (writer: string, wornAt?: (subject: string) => boolean): SealedDocumentStore => new SealedDocumentStore({
      inner,
      bagOf: () => ({ bagId: BAG, face: own }),
      sessionFace: () => own,
      sessionOf: () => ({ id: "the-writing-session", subject: own }),
      seal: ({ bagId, values }) => a.holder.sealValues({ bagId, values, signer: a.signer }),
      open: async (args) => { const opened = await a.holder.openValue(args); return "refusal" in opened ? opened : { ...opened, writer }; },
      ...(wornAt ? { wornAt } : {}),
    });
    const loaded = await readAs(PLACE, (subject) => subject === PLACE).load(key);
    expect(loaded).toBeInstanceOf(Uint8Array);
    expect(A.load<{ note?: string }>(loaded!).note).toBe(SECRET);
    // CONTROL: the worn face's other subject reads only where the vessel names it; another face's writer refuses.
    expect(await refusalOf(() => readAs(PLACE).load(key))).toBe("writer-face-foreign");
    const other = faceProofSubjectRef((await chain("b", "nexus-test-one")).scope);
    expect(await refusalOf(() => readAs(other, (subject) => subject === PLACE).load(key))).toBe("writer-face-foreign");
  });

  it("W2 — a save the place session booked seals after the map names the face by its Nexus subject; another face's session refuses", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const own = faceProofSubjectRef(a.chain.scope);
    const bookedBy = (subject: string, wornAt?: (s: string) => boolean): SealedDocumentStore => new SealedDocumentStore({
      inner,
      bagOf: () => ({ bagId: BAG, face: own }),
      sessionFace: () => own,
      sessionOf: () => ({ id: "the-place-session", subject }),
      seal: ({ bagId, values }) => a.holder.sealValues({ bagId, values, signer: a.signer }),
      open: (args) => a.holder.openValue(args),
      ...(wornAt ? { wornAt } : {}),
    });
    const change = A.save(A.change(A.init<{ note?: string }>(), (d) => { d.note = SECRET; }));
    expect(await refusalOf(() => bookedBy(PLACE, (s) => s === PLACE).save(["doc-place", "incremental", "c1"], change))).toBe("ANSWERED");
    expect(restsClear(inner, "doc-place", SECRET)).toBe(false);
    expect([...inner.bytes.keys()].some((k) => k.startsWith("doc-place"))).toBe(true);
    // CONTROL: unnamed, the same booking refuses by name, and another face's session refuses under the same port.
    expect(await refusalOf(() => bookedBy(PLACE).save(["doc-place", "incremental", "c2"], change))).toBe("session-face-foreign");
    const other = faceProofSubjectRef((await chain("b", "nexus-test-one")).scope);
    expect(await refusalOf(() => bookedBy(other, (s) => s === PLACE).save(["doc-place", "incremental", "c3"], change))).toBe("session-face-foreign");
  });
});

describe("step three: one manifest for each write batch", () => {
  it("a batch rests under one manifest, and each manifest cites the heads of what its writer verified", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const b = await vessel(w, "b");
    introduce(a, b);
    const change = (n: number) => ({ role: "change" as const, ref: logicalRefOf(["doc", "incremental", `c${n}`]), parents: [], plaintext: utf8Bytes(`change ${n}`) });
    const first = await a.holder.sealValues({ bagId: BAG, values: [change(1), change(2), change(3)], signer: a.signer });
    if ("refusal" in first) throw new Error(said(first));
    const manifests = await a.store.records("manifest");
    expect(manifests.length).toBe(1);
    expect(manifests[0]!.body.entries.map((e) => e.role)).toEqual(["change", "change", "change"]);
    expect(manifests[0]!.body.parents).toEqual([]);
    const second = await a.holder.sealValues({ bagId: BAG, values: [{ ...change(4), parents: [first.values[2]!.address] }], signer: a.signer });
    if ("refusal" in second) throw new Error(said(second));
    const secondBody = (await a.store.record("manifest", second.manifest))[0]!.body;
    expect(secondBody.parents).toEqual([first.manifest]);
    expect(secondBody.entries[0]!.parents).toEqual([first.values[2]!.address]);
    // b verifies both of a's manifests on receipt; the second cites the first, so b's batch cites the second alone.
    await carry(a, b, BAG);
    const third = await b.holder.sealValues({ bagId: BAG, values: [change(5)], signer: b.signer });
    if ("refusal" in third) throw new Error(said(third));
    expect((await b.store.record("manifest", third.manifest))[0]!.body.parents).toEqual([second.manifest]);
    // CONTROL: a manifest b never verified (a's later batch) stays uncited by b's next batch.
    const fourth = await a.holder.sealValues({ bagId: BAG, values: [change(6)], signer: a.signer });
    if ("refusal" in fourth) throw new Error(said(fourth));
    const fifth = await b.holder.sealValues({ bagId: BAG, values: [change(7)], signer: b.signer });
    if ("refusal" in fifth) throw new Error(said(fifth));
    expect((await b.store.record("manifest", fifth.manifest))[0]!.body.parents).not.toContain(fourth.manifest);
    expect((await b.store.record("manifest", fifth.manifest))[0]!.body.parents).toContain(third.manifest);
  });
});

describe("step three: a from-now admission opens on a fresh checkpoint", () => {
  const live = (): Uint8Array => {
    let doc = A.change(A.init<{ note?: string }>(), (d) => { d.note = "deleted words"; });
    doc = A.change(doc, (d) => { d.note = "present words"; });
    return A.save(doc);
  };

  it("the document store cuts present values alone, and a reader refuses a base that holds more than its founding change", () => {
    const base = cutFreshBase(live());
    expect(base).not.toBeNull();
    expect(readsAsFreshBase(base!.plaintext)).toBe(true);
    expect(A.load<{ note?: string }>(base!.plaintext).note).toBe("present words");
    expect(A.getAllChanges(A.load(base!.plaintext)).length).toBe(1);
    // CONTROL: the live document itself carries its history, and reads as no fresh base.
    expect(readsAsFreshBase(live())).toBe(false);
    expect(readsAsFreshBase(utf8Bytes("not a document"))).toBe(false);
  });

  it("the fresh checkpoint rests under the new version before any change seals there; with none standing, a change refuses by name", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const before = await a.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c0"]), parents: [], plaintext: live() }], signer: a.signer });
    if ("refusal" in before) throw new Error(said(before));
    // CONTROL: a span its founding opened asks for no fresh checkpoint.
    expect((await a.store.records("checkpoint")).length).toBe(0);
    const base = cutFreshBase(live())!;
    a.cutBase = () => base;
    verifies(w, a, "admit-1");
    const admitted = await a.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a.signer });
    if ("refusal" in admitted) throw new Error(said(admitted));
    const version = admitted[0]!.keyVersion;
    const checkpoints = await a.store.records("checkpoint");
    expect(checkpoints.map((c) => [c.body.keyVersion, c.body.span, c.body.base])).toEqual([[version, version, "fresh"]]);
    const opened = await a.holder.openValue({ bagId: BAG, role: "checkpoint", ref: base.ref });
    if ("refusal" in opened) throw new Error(said(opened));
    expect(readsAsFreshBase(opened.plaintext)).toBe(true);
    // A change after the admission seals under the new version.
    const after = await a.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c1"]), parents: [], plaintext: utf8Bytes("after") }], signer: a.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.keyVersion).toBe(version);

    // A stop after the version rests and before its checkpoint does: no change seals under that span.
    const c = await vessel(w, "c");
    const first = await c.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c0"]), parents: [], plaintext: live() }], signer: c.signer });
    if ("refusal" in first) throw new Error(said(first));
    c.cutBase = () => cutFreshBase(live());
    verifies(w, c, "admit-2");
    c.rest.failOn = (kind) => kind === "checkpoint";
    expect(said(await c.holder.admitFromNow({ bagId: BAG, act: "admit-2", history: "closed", signer: c.signer }))).toMatch(/^store-failed/);
    c.rest.failOn = null;
    c.restart();
    expect(said(await c.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c1"]), parents: [], plaintext: utf8Bytes("late") }], signer: c.signer }))).toBe("fresh-base-unavailable");
  });

  it("the same admission re-entered after a stop between its version and its fresh base cuts the base once, and the span opens", async () => {
    const w = world();
    const c = await vessel(w, "c");
    const first = await c.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c0"]), parents: [], plaintext: live() }], signer: c.signer });
    if ("refusal" in first) throw new Error(said(first));
    c.cutBase = () => cutFreshBase(live());
    verifies(w, c, "admit-2");
    // THE STOP: the version's record rests, and the fresh checkpoint's record does not (a fixture seam, never product code).
    c.rest.failOn = (kind) => kind === "checkpoint";
    expect(said(await c.holder.admitFromNow({ bagId: BAG, act: "admit-2", history: "closed", signer: c.signer }))).toMatch(/^store-failed/);
    c.rest.failOn = null;
    c.restart();
    const versionsBefore = (await c.store.records("key-version")).length;
    // Setup took: the version rests, its fresh base does not, and the span takes no change.
    expect((await c.store.records("checkpoint")).length).toBe(0);
    expect(said(await c.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c1"]), parents: [], plaintext: utf8Bytes("late") }], signer: c.signer }))).toBe("fresh-base-unavailable");

    // THE REPAIR: the same admission, by its causal id, re-entered.
    const again = await c.holder.admitFromNow({ bagId: BAG, act: "admit-2", history: "closed", signer: c.signer });
    if ("refusal" in again) throw new Error(said(again));
    const version = again[0]!.keyVersion;
    // No second version mints for one act: the version the stop left stands, and its base cut once.
    expect((await c.store.records("key-version")).length).toBe(versionsBefore);
    expect((await c.store.records("checkpoint")).map((r) => [r.body.keyVersion, r.body.span, r.body.base])).toEqual([[version, version, "fresh"]]);
    const after = await c.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c1"]), parents: [], plaintext: utf8Bytes("late") }], signer: c.signer });
    if ("refusal" in after) throw new Error(said(after));
    expect(after.keyVersion).toBe(version);
    // A third entry of the same act lands nothing new.
    const third = await c.holder.admitFromNow({ bagId: BAG, act: "admit-2", history: "closed", signer: c.signer });
    if ("refusal" in third) throw new Error(said(third));
    expect(third.map((m) => m.keyVersion)).toEqual([version]);
    expect((await c.store.records("key-version")).length).toBe(versionsBefore);
    expect((await c.store.records("checkpoint")).length).toBe(1);
    // CONTROL: another act still opens its own span.
    verifies(w, c, "admit-3");
    const other = await c.holder.admitFromNow({ bagId: BAG, act: "admit-3", history: "closed", signer: c.signer });
    if ("refusal" in other) throw new Error(said(other));
    expect(other[0]!.keyVersion).not.toBe(version);
    expect((await c.store.records("key-version")).length).toBe(versionsBefore + 1);
  });
});

/** A session signer for a chain the vector names. */
function signerOf(c: Awaited<ReturnType<typeof chain>>): RecordSigner {
  return {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
}

describe("P2-6: a stop inside the fresh base's rest never strands the base", () => {
  const live = (): Uint8Array => A.save(A.change(A.init<{ note?: string }>(), (d) => { d.note = "present words"; }));
  it("a stop between the base's two records: the same admission entered again cuts the base afresh where it does not stand, and it opens", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const before = await a.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c0"]), parents: [], plaintext: live() }], signer: a.signer });
    if ("refusal" in before) throw new Error(said(before));
    const base = cutFreshBase(live())!;
    a.cutBase = () => base;
    verifies(w, a, "admit-1");
    // THE KILL SEAM, in whatever order the holder writes: the rest takes the base's first record (its checkpoint or its
    // manifest) and refuses the second, a stop between the two.
    let records = 0;
    a.rest.failOn = (kind) => (kind === "checkpoint" || kind === "manifest") && ++records === 2;
    const stopped = await a.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a.signer });
    expect("refusal" in stopped).toBe(true);   // the setup took: the admission stopped inside the base's rest
    a.rest.failOn = null;
    a.restart();
    const again = await a.holder.admitFromNow({ bagId: BAG, act: "admit-1", history: "closed", signer: a.signer });
    if ("refusal" in again) throw new Error(said(again));
    const opened = await a.holder.openValue({ bagId: BAG, role: "checkpoint", ref: base.ref });
    expect("plaintext" in opened, JSON.stringify(opened)).toBe(true);
    const after = await a.holder.sealValues({ bagId: BAG, values: [{ role: "change", ref: logicalRefOf(["doc", "incremental", "c1"]), parents: [], plaintext: utf8Bytes("after") }], signer: a.signer });
    expect("refusal" in after ? said(after) : "sealed").toBe("sealed");
  });
});
