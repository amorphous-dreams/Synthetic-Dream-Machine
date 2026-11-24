/**
 * lit-set-sealed-rest — THE LIT SET: every open face's private documents seal and save under their OWN key, never another
 * face's (operator rulings: no cross-face landing ever; each face hive isolated; a shut face waits by name and never blocks
 * the rest). The sealing core already matched waiting saves by face (`rebook`, `standDown`); these vectors read the three
 * seams the set widens:
 *
 *   (a) the store's face gate (`SealedDocumentStore#face`): a bag of any open face opens under THAT face; a bag of a face
 *       outside the set still refuses `session-face-foreign`
 *   (b) the watch (`composeSealedRest.watch`): the session standing for a document is the one that wears ITS bag's face; a
 *       session of another face never books it, so its save waits (`save-unbooked`), never sealed under another face's key
 *   (c) the lock of one face drops it from the set: its saves wait, the other face keeps sealing
 *
 *   LS1 — lit {a,b}: b's save seals under b's session, never a's (the standing reader hands a's session for every document)
 *   LS2 — lit {a}: b's save waits; it seals once b lights and its session rebooks
 *   LS3 — a load of b's document with only a lit throws session-face-foreign
 *   LS4 — lock b: b's later save waits, a's keeps sealing
 *   LS5 — lock b drops b's waiting saves from memory (`forget`): none reaches disk, and nothing of them seals later
 *   LS6 — each hat its own holder: an open names the face its document's bag wears, so the island opens it through THAT
 *         face's holder (the door routes by face, never by the worn face's seat)
 *
 * Written beside the cure (written, unrun here; CI runs it).
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 */
import { describe, expect, it } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { SealedDocumentRefusal } from "../src/sealed-doc-store.js";
import { composeSealedRest } from "../src/sealed-rest.js";
import { vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG_A = "lar:///ha.ka.ba/wikis/daemon/working#a";
const BAG_B = "lar:///ha.ka.ba/wikis/daemon/working#b";

type Session = { readonly id: string; readonly subject: string; readonly signer: RecordSigner };

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
const restsAny = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean => [...inner.bytes.keys()].some((key) => key.startsWith(docId));

/**
 * One vessel with two faces (a, b), each with its own holder (its own key). The open set reads `open`; the standing reader
 * hands face a's session for EVERY document while a stands (the single-standing shape the set retires), so only the
 * watch's own per-document match keeps b's save off a's key.
 */
async function twoFaces() {
  const w = world();
  const a = await vessel(w, "a"), b = await vessel(w, "b");
  const faceA = faceProofSubjectRef(a.chain.scope), faceB = faceProofSubjectRef(b.chain.scope);
  const sessionA: Session = { id: "s-a", subject: faceA, signer: a.signer };
  const sessionB: Session = { id: "s-b", subject: faceB, signer: b.signer };
  const holderOf = (subject: string): Vessel => (subject === faceA ? a : b);
  const sealedBy: Array<{ bagId: string; subject: string; peer?: string }> = [];
  const held: string[] = [];
  const opened: Array<{ bagId: string; face: string | undefined }> = [];
  const open = new Set<string>([faceA]);
  const docsOfB = new Set<string>();
  const inner = memoryAdapter();
  let repo: Repo | null = null;
  const rest = composeSealedRest<Session>({
    inner,
    bagOf: (documentId) => docsOfB.has(documentId) ? { bagId: BAG_B, face: faceB } : { bagId: BAG_A, face: faceA },
    sessionFace: () => faceA,
    openFaces: () => [...open],
    door: {
      seal: async (args) => {
        const session = args.session as Session;
        const peer = (args as { peer?: string }).peer;
        sealedBy.push({ bagId: args.bagId, subject: session.subject, ...(peer !== undefined ? { peer } : {}) });
        return holderOf(session.subject).holder.sealValues({ ...args, signer: session.signer });
      },
      // EACH HAT ITS OWN HOLDER: the open names its face, and only that face's holder answers it.
      open: async (args) => {
        const face = (args as { face?: string }).face;
        opened.push({ bagId: args.bagId, face });
        const holder = face === faceB ? b : face === faceA ? a : null;
        return holder === null ? { refusal: "face-unnamed" } as never : holder.holder.openValue(args);
      },
    },
    flushRepo: async () => { await repo?.flush(); },
    onHeld: (h) => held.push(`${h.refusal}:${h.documentId}`),
  });
  repo = new Repo({ storage: rest.store, network: [] });
  // One standing session (a's) answers for every document: the watch must refuse it for b's documents.
  rest.watch(repo, () => (open.has(faceA) ? sessionA : null));
  return { rest, repo, inner, faceA, faceB, sessionA, sessionB, sealedBy, held, opened, open, docsOfB, a, b };
}

const docOfB = <T>(r: Awaited<ReturnType<typeof twoFaces>>, init: (d: T) => void) => {
  const handle = r.repo.create<T>();
  r.docsOfB.add(handle.documentId);
  handle.change(init as never);
  return handle;
};

describe("the lit set: each open face seals under its own key", () => {
  it("LS1 — lit {a,b}: b's save keys to b's session, never a's, even where the standing reader hands a's", async () => {
    const r = await twoFaces();
    r.open.add(r.faceB);
    const mine = r.repo.create<{ note?: string }>();
    mine.change((d) => { d.note = "a's own"; });
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "b's own"; });
    await r.repo.flush();
    // The watch refused a's session for b's document: it waits until b's own session books it.
    expect(r.sealedBy.filter((s) => s.bagId === BAG_B && s.subject === r.faceA)).toEqual([]);
    expect(await r.rest.rebook(r.sessionB)).toBeGreaterThan(0);
    expect(r.sealedBy.some((s) => s.bagId === BAG_B && s.subject === r.faceB)).toBe(true);
    expect(r.sealedBy.some((s) => s.bagId === BAG_B && s.subject === r.faceA)).toBe(false);
    expect(r.sealedBy.some((s) => s.bagId === BAG_A && s.subject === r.faceA)).toBe(true);
    expect(restsAny(r.inner, theirs.documentId)).toBe(true);
    expect(restsAny(r.inner, mine.documentId)).toBe(true);
    await r.repo.shutdown();
  });

  it("LS2 — lit {a}: b's save waits in memory, never under a's key; it seals once b lights", async () => {
    const r = await twoFaces();
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "b waits"; });
    await r.repo.flush();
    expect(r.held).toContain(`save-unbooked:${theirs.documentId}`);
    expect(r.rest.store.waiting(theirs.documentId)).toBeGreaterThan(0);
    expect(restsAny(r.inner, theirs.documentId)).toBe(false);
    expect(r.sealedBy.some((s) => s.bagId === BAG_B)).toBe(false);
    // a's session never books it, even asked straight.
    expect(await r.rest.rebook(r.sessionA)).toBe(0);
    expect(restsAny(r.inner, theirs.documentId)).toBe(false);
    // b lights: its own session seals what waited.
    r.open.add(r.faceB);
    expect(await r.rest.rebook(r.sessionB)).toBeGreaterThan(0);
    expect(r.rest.store.waiting(theirs.documentId)).toBe(0);
    expect(r.sealedBy.filter((s) => s.bagId === BAG_B).every((s) => s.subject === r.faceB)).toBe(true);
    await r.repo.shutdown();
  });

  it("LS3 — a load of b's document with only a lit throws session-face-foreign; with b lit it opens under b", async () => {
    const r = await twoFaces();
    r.open.add(r.faceB);
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "b's secret"; });
    await r.repo.flush();
    await r.rest.rebook(r.sessionB);
    const keys = [...r.inner.bytes.keys()].filter((k) => k.startsWith(theirs.documentId)).map((k) => k.split("\u0000"));
    expect(keys.length).toBeGreaterThan(0);
    const loaded = await r.rest.store.load(keys[0]!);
    expect(loaded).toBeInstanceOf(Uint8Array);
    r.open.delete(r.faceB);
    let refusal = "ANSWERED";
    try { await r.rest.store.load(keys[0]!); } catch (e) { refusal = e instanceof SealedDocumentRefusal ? e.refusal : `THREW:${String(e)}`; }
    expect(refusal).toBe("session-face-foreign");
    await r.repo.shutdown();
  });

  it("LS4 — lock b: b's later save waits, and a keeps sealing", async () => {
    const r = await twoFaces();
    r.open.add(r.faceB);
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "before the lock"; });
    const mine = r.repo.create<{ note?: string }>();
    mine.change((d) => { d.note = "a before"; });
    await r.repo.flush();
    await r.rest.rebook(r.sessionB);
    await r.rest.lock(r.sessionB.id);
    r.open.delete(r.faceB);
    const sealedBefore = r.sealedBy.length;
    theirs.change((d) => { d.note = "after the lock"; });
    mine.change((d) => { d.note = "a after"; });
    await r.repo.flush();
    expect(r.rest.store.waiting(theirs.documentId)).toBeGreaterThan(0);
    const after = r.sealedBy.slice(sealedBefore);
    expect(after.some((s) => s.bagId === BAG_A && s.subject === r.faceA)).toBe(true);
    expect(after.some((s) => s.bagId === BAG_B)).toBe(false);
    expect(A.getHeads(theirs.doc() as A.Doc<unknown>).length).toBeGreaterThan(0);
    await r.repo.shutdown();
  });

  it("LS5 — lock b drops its waiting saves from memory: none reaches disk, and b's next light seals nothing of them", async () => {
    const r = await twoFaces();
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "waits for b"; });
    await r.repo.flush();
    expect(r.rest.store.waiting(theirs.documentId)).toBeGreaterThan(0);
    expect(r.rest.forget([theirs.documentId])).toBeGreaterThan(0);
    expect(r.rest.store.waiting(theirs.documentId)).toBe(0);
    expect(restsAny(r.inner, theirs.documentId)).toBe(false);
    r.open.add(r.faceB);
    expect(await r.rest.rebook(r.sessionB)).toBe(0);
    expect(restsAny(r.inner, theirs.documentId)).toBe(false);
    await r.repo.shutdown();
  });

  // A face the island refused goes dark with its host side down and its waiting saves KEPT. Its document leaves the Repo's
  // cache. The save it could not seal waits in the store's memory (`#waiting`) as PLAIN Automerge bytes, gated by the face
  // gate (`#face`): never clear on disk, and never sealed, until its next seat seals it. The keep records the document's own
  // actor first, so the seal still names this vessel's session as its writer once the handle that knew the actor has gone.
  it("LS7 — a refused face's held save outlives its dark: kept, its document leaves the cache, nothing forgets the save, and once the face lights its own session seals it to rest AS ITS OWN WRITER, never as a peer's", async () => {
    const r = await twoFaces();
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "written while b's light refused"; });
    await r.repo.flush();
    const held = r.rest.store.waiting(theirs.documentId);
    expect(held).toBeGreaterThan(0);
    expect(r.rest.keep([theirs.documentId])).toBe(held);
    await r.repo.removeFromCache(theirs.documentId);
    expect(r.rest.store.waiting(theirs.documentId), "the save stays held through the dark").toBe(held);
    expect(restsAny(r.inner, theirs.documentId), "and never reaches disk unsealed").toBe(false);
    // THE RECARD'S LIGHT: b joins the lit set, and its own session books and seals what waited.
    r.open.add(r.faceB);
    expect(await r.rest.rebook(r.sessionB)).toBeGreaterThan(0);
    expect(r.rest.store.waiting(theirs.documentId)).toBe(0);
    expect(restsAny(r.inner, theirs.documentId), "the held save rests sealed").toBe(true);
    const seals = r.sealedBy.filter((s) => s.bagId === BAG_B);
    expect(seals.length).toBeGreaterThan(0);
    expect(seals.every((s) => s.subject === r.faceB)).toBe(true);
    expect(seals.filter((s) => s.peer !== undefined), "this vessel's own change seals as its session's, with no peer writer named").toEqual([]);
    expect(r.rest.book.writerOf(theirs.documentId)).toBe(`session:${r.sessionB.id}`);
    await r.repo.shutdown();
  });

  // The face lights and a reader finds its document again before the session rebooks: the fresh handle carries a NEW actor, and
  // the held save's change still names the one that wrote it. Either reads as this vessel's own.
  it("LS8 — a held save stays this vessel's own though its document came back into the cache under a fresh actor before the rebook", async () => {
    const r = await twoFaces();
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "written while b's light refused"; });
    await r.repo.flush();
    expect(r.rest.keep([theirs.documentId])).toBeGreaterThan(0);
    r.open.add(r.faceB);
    // A handle stands again for the document before the rebook, under an actor the held change never carried.
    const writer = A.getActorId(theirs.doc() as A.Doc<unknown>);
    await r.repo.removeFromCache(theirs.documentId);
    const again = await r.repo.find<{ note?: string }>(theirs.url);
    expect(again.isReady()).toBe(true);
    expect(A.getActorId(again.doc() as A.Doc<unknown>), "the fresh handle writes under another actor").not.toBe(writer);
    expect(await r.rest.rebook(r.sessionB)).toBeGreaterThan(0);
    const seals = r.sealedBy.filter((s) => s.bagId === BAG_B);
    expect(seals.filter((s) => s.peer !== undefined), "no peer writer names this vessel's own change").toEqual([]);
    expect(r.rest.book.writerOf(theirs.documentId)).toBe(`session:${r.sessionB.id}`);
    await r.repo.shutdown();
  });

  it("LS6 — each hat its own holder: b's open names b's face and a's names a's, so each opens under its own holder", async () => {
    const r = await twoFaces();
    r.open.add(r.faceB);
    const mine = r.repo.create<{ note?: string }>();
    mine.change((d) => { d.note = "a's own"; });
    const theirs = docOfB<{ note?: string }>(r, (d) => { d.note = "b's own"; });
    await r.repo.flush();
    await r.rest.rebook(r.sessionB);
    const keyOf = (id: string) => [...r.inner.bytes.keys()].find((k) => k.startsWith(id))!.split("\u0000");
    expect(await r.rest.store.load(keyOf(theirs.documentId))).toBeInstanceOf(Uint8Array);
    expect(await r.rest.store.load(keyOf(mine.documentId))).toBeInstanceOf(Uint8Array);
    expect(r.opened).toEqual([{ bagId: BAG_B, face: r.faceB }, { bagId: BAG_A, face: r.faceA }]);
    await r.repo.shutdown();
  });
});
