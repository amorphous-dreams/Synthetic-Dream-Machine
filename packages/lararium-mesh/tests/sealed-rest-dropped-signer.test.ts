/**
 * sealed-rest-dropped-signer — A DROPPED SIGNER SIGNS NOTHING, AND NO SAVE WAITS ON ONE (sealed-store#/owed, R2).
 *
 * The live house (2026-11-25, `run/vessel-last.log` and the running vessel's own log) refused face 1's saves of the daemon
 * working document and the lares working document `save-unsealed (record-refused: signer-refused)`, burst after burst,
 * outside every keep window, while the put door answered ok. The save book kept each document booked to the session
 * that last wrote it, and nothing unbooked it when that session's signer dropped by any road other than the lock (the
 * place session's re-mint drops its signer bare, an anchor move drops a socket's signer bare): every later save of the
 * document signed under the dead signer and refused, and its reseal refused the same way, until the next down took it.
 *
 *   DS1 — a document booked to a session whose signer then drops, with no live session for its face: the next save never
 *         asks the dead signer; it waits `save-unbooked` (the honest state the next session seals), never `signer-refused`
 *   DS2 — the same, with a live session standing for the face: the save seals under the live one at once
 *   DS3 — a save that waited under a dead booking seals at the next live rebook, and a rebook under a dead session books nothing
 *   DS4 — the sign book's standing reading never names a dropped signer, and `standingFor` names the live session that
 *         wears the face, past a call of another face that stands first
 *   DS5 — the rest-owed watch reads only the documents this call moved (a noop owes nothing, another call's debt stays its own)
 *   DS6 — a save refused outright, and a flush that failed, read owed
 *   DS7 — a storm of notices drops no hold (counted per document, never a sampled tail)
 *   DS8 — the store tells every refusal it throws (session-face-foreign), so none passes silent
 *   DS10 — call touches tag at the change: concurrent calls own their own documents; a long-held one never blames another call
 *   DS9 — two faces: a dead booking never falls to the other face's live session
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import { describe, expect, it } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { composeSealedRest, restOwedWatch } from "../src/sealed-rest.js";
import { SessionSignBook, type BookedSession } from "../src/session-sign-book.js";
import { inCallScope, seatCallScope, takeCallTouches, watchCallTouches } from "../src/call-touches.js";
import { vessel, world } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/wikis/daemon/working";

type DroppableSigner = RecordSigner & { dropped: boolean };
type Session = { readonly id: string; readonly subject: string; readonly signer: DroppableSigner };

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

/** One face, two sessions of it (a CLI one-shot that will drop, the vessel's own live one); `standing` names which stands. */
async function oneFace() {
  const w = world();
  const a = await vessel(w, "a");
  const face = faceProofSubjectRef(a.chain.scope);
  const oneShot: Session = { id: "s-one-shot", subject: face, signer: { ...a.signer, dropped: false } };
  const live: Session = { id: "s-live", subject: face, signer: { ...a.signer, dropped: false } };
  const asked: string[] = [];
  const held: string[] = [];
  const watch = { standing: null as Session | null };
  const inner = memoryAdapter();
  let repo: Repo | null = null;
  const rest = composeSealedRest<Session>({
    inner,
    bagOf: () => ({ bagId: BAG, face }),
    sessionFace: () => face,
    door: {
      // THE ISLAND'S DOOR, as `SessionSignBook.door` answers it: a dropped signer refuses `signer-refused`.
      seal: async (args) => {
        const session = args.session as Session;
        asked.push(session.id);
        if (session.signer.dropped) return { refusal: "record-refused", cause: "signer-refused:signer-refused" } as never;
        return a.holder.sealValues({ ...args, signer: session.signer });
      },
      open: async (args) => a.holder.openValue(args),
    },
    flushRepo: async () => { await repo?.flush(); },
    onHeld: (h) => held.push(`${h.refusal}:${h.documentId}${h.error !== undefined ? `:${h.error}` : ""}`),
  });
  repo = new Repo({ storage: rest.store, network: [] });
  rest.watch(repo, () => watch.standing);
  return { rest, repo, inner, face, oneShot, live, asked, held, watch };
}

const restsAny = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean => [...inner.bytes.keys()].some((key) => key.startsWith(docId));

describe("a dropped signer signs nothing, and no save waits on one", () => {
  it("DS1 — booked to a session whose signer dropped, with none live: the save waits save-unbooked, never asks the dead signer", async () => {
    const r = await oneFace();
    // The one-shot's call stands: its change books it and seals.
    r.watch.standing = r.oneShot;
    const doc = r.repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "the put"; });
    await r.repo.flush();
    expect(restsAny(r.inner, doc.documentId)).toBe(true);
    // Its signer drops bare (the place session's re-mint, an anchor move): no lock unbooks it, and no session stands now.
    r.oneShot.signer.dropped = true;
    r.watch.standing = null;
    r.asked.length = 0;
    doc.change((d) => { d.note = "after the drop"; });
    await r.repo.flush();
    expect(r.asked).not.toContain("s-one-shot");
    expect(r.held.some((h) => h.includes("signer-refused"))).toBe(false);
    expect(r.held).toContain(`save-unbooked:${doc.documentId}`);
    await r.repo.shutdown();
  });

  it("DS2 — booked to a dropped signer with a live session standing: the save seals under the live one", async () => {
    const r = await oneFace();
    r.watch.standing = r.oneShot;
    const doc = r.repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "the put"; });
    await r.repo.flush();
    r.oneShot.signer.dropped = true;
    r.watch.standing = r.live;
    r.asked.length = 0;
    doc.change((d) => { d.note = "after the drop"; });
    await r.repo.flush();
    expect(r.asked).not.toContain("s-one-shot");
    expect(r.asked).toContain("s-live");
    expect(r.rest.store.waiting(doc.documentId)).toBe(0);
    await r.repo.shutdown();
  });

  it("DS3 — a save that waited on a dead booking seals at the next live rebook; a dead session's rebook books nothing", async () => {
    const r = await oneFace();
    r.watch.standing = r.oneShot;
    const doc = r.repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "the put"; });
    await r.repo.flush();
    r.oneShot.signer.dropped = true;
    r.watch.standing = null;
    doc.change((d) => { d.note = "waits"; });
    await r.repo.flush();
    expect(r.rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    r.asked.length = 0;
    expect(await r.rest.rebook(r.oneShot)).toBe(0);
    expect(r.asked).not.toContain("s-one-shot");
    expect(await r.rest.rebook(r.live)).toBeGreaterThan(0);
    expect(r.rest.store.waiting(doc.documentId)).toBe(0);
    await r.repo.shutdown();
  });

  it("DS4 — the sign book's standing never names a dropped signer; standingFor names the live session wearing the face", () => {
    const book = new SessionSignBook();
    const signer = (dropped = false) => ({ dropped, certificate: null, sign: async () => ({ signature: "s" }) });
    const dead: BookedSession = { signer: signer(), anchor: { kind: "place" }, subject: "face-a" };
    const foreign: BookedSession = { signer: signer(), anchor: { kind: "place" }, subject: "face-b" };
    const seated: BookedSession = { signer: signer(), anchor: { kind: "place" }, subject: "face-a" };
    book.hold("r-dead", "docstore-seal", dead);
    book.hold("r-foreign", "tiddler-put", foreign);
    book.seat(seated);
    (dead.signer as { dropped: boolean }).dropped = true;
    expect(book.standing()).not.toContain(dead);
    expect(book.standing()).toContain(foreign);
    expect(book.standingFor((s) => s.subject === "face-a")).toBe(seated);
    (seated.signer as { dropped: boolean }).dropped = true;
    expect(book.standingFor((s) => s.subject === "face-a")).toBeNull();
  });

  it("DS5 — the rest-owed watch names only the documents this call changed that still wait; a call that changed nothing owes nothing", () => {
    const waiting = new Map<string, number>([["other-call", 3]]);
    const watch = restOwedWatch({ waiting: (id) => waiting.get(id) ?? 0 });
    watch.notice({ refusal: "save-unsealed", documentId: "other-call", error: "signer-refused" });
    const mark = watch.mark();
    expect(watch.owed(mark, [])).toBeNull();
    watch.notice({ refusal: "save-unsealed", documentId: "doc-1", error: "record-refused", cause: "signer-refused" });
    waiting.set("doc-1", 2);
    // `sealed` changed and sealed: it owes nothing; `other-call` waits, and this call never changed it.
    expect(watch.owed(mark, ["doc-1", "sealed"])).toEqual({ band: "owed", documents: [{ documentId: "doc-1", refusal: "save-unsealed", error: "record-refused", cause: "signer-refused" }] });
  });

  it("DS6 — a save refused outright reads owed; a failed flush and a change that never synced read owed by name", () => {
    const watch = restOwedWatch({ waiting: () => 0 });
    const mark = watch.mark();
    watch.notice({ refusal: "save-refused", documentId: "doc-1", error: "session-face-foreign" });
    expect(watch.owed(mark, ["doc-1"])).toEqual({ band: "owed", documents: [{ documentId: "doc-1", refusal: "save-refused", error: "session-face-foreign" }] });
    expect(watch.owed(mark, ["doc-1", "doc-2"], { flushError: "flush threw" })?.documents.map((d) => [d.documentId, d.refusal])).toEqual([["doc-1", "save-refused"], ["doc-2", "flush-refused"]]);
    expect(watch.owed(mark, ["doc-3"], { unsynced: ["doc-3"] })?.documents.map((d) => d.refusal)).toEqual(["save-unsynced"]);
  });

  it("DS7 — a storm of notices drops no hold: the watch counts each document's latest reading, never a sampled tail", () => {
    const waiting = new Map<string, number>();
    const watch = restOwedWatch({ waiting: (id) => waiting.get(id) ?? 0 });
    const mark = watch.mark();
    watch.notice({ refusal: "save-unbooked", documentId: "mine" });
    waiting.set("mine", 1);
    for (let i = 0; i < 5000; i++) watch.notice({ refusal: "save-unnamed", documentId: `storm-${i}` });
    expect(watch.owed(mark, ["mine"])?.documents).toEqual([{ documentId: "mine", refusal: "save-unbooked" }]);
  });

  it("DS10 — call touches tag at the change: two concurrent calls each own their own documents, and a peer's change tags neither", async () => {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    const store = new AsyncLocalStorage<string>();
    seatCallScope({ run: (id, fn) => store.run(id, fn), current: () => store.getStore() });
    try {
      const repo = new Repo({ network: [] });
      watchCallTouches(repo as never);
      const held = repo.create<{ n?: number }>();   // a document that waits long, from an earlier call
      const mine = repo.create<{ n?: number }>();
      const tick = () => new Promise<void>((r) => setTimeout(r, 1));
      await Promise.all([
        inCallScope("call-a", async () => { await tick(); held.change((d) => { d.n = 1; }); await tick(); held.change((d) => { d.n = 2; }); }),
        inCallScope("call-b", async () => { await tick(); mine.change((d) => { d.n = 1; }); }),
      ]);
      held.change((d) => { d.n = 3; });            // outside every call: a peer's sync, a timer
      expect(Object.keys(takeCallTouches("call-b") ?? {})).toEqual([mine.documentId]);
      expect(Object.keys(takeCallTouches("call-a") ?? {})).toEqual([held.documentId]);
      expect(takeCallTouches("call-c")).toBeNull();
      // The held document waits, and call b's band never names it.
      const watch = restOwedWatch({ waiting: (id) => (id === held.documentId ? 4 : 0) });
      expect(watch.owed(watch.mark(), [mine.documentId])).toBeNull();
      await repo.shutdown();
    } finally { seatCallScope(null); }
  });

  it("DS8 — the store tells a refusal it throws (session-face-foreign), so no outright refusal passes silent", async () => {
    const w = world();
    const a = await vessel(w, "a"), b = await vessel(w, "b");
    const faceA = faceProofSubjectRef(a.chain.scope), faceB = faceProofSubjectRef(b.chain.scope);
    const refused: string[] = [];
    const rest = composeSealedRest<Session>({
      inner: memoryAdapter(),
      bagOf: () => ({ bagId: BAG, face: faceB }),
      sessionFace: () => faceA,
      openFaces: () => [faceA, faceB],
      door: { seal: async (args) => b.holder.sealValues({ ...args, signer: (args.session as Session).signer }), open: async (args) => b.holder.openValue(args) },
      flushRepo: async () => {},
      onRefused: (r) => refused.push(`${r.refusal}:${r.documentId}`),
    });
    const sessionA: Session = { id: "s-a", subject: faceA, signer: { ...a.signer, dropped: false } };
    rest.wrote("doc-b", sessionA);
    let threw = "";
    try { await rest.store.save(["doc-b", "incremental", "x"], new Uint8Array([1, 2, 3])); } catch (e) { threw = String((e as { refusal?: string }).refusal); }
    expect(threw).toBe("session-face-foreign");
    expect(refused).toEqual(["session-face-foreign:doc-b"]);
  });

  it("DS9 — two faces: a booking whose signer dropped never falls to the other face's live session; b's save waits for b", async () => {
    const w = world();
    const a = await vessel(w, "a"), b = await vessel(w, "b");
    const faceA = faceProofSubjectRef(a.chain.scope), faceB = faceProofSubjectRef(b.chain.scope);
    const liveA: Session = { id: "s-a", subject: faceA, signer: { ...a.signer, dropped: false } };
    const oneShotB: Session = { id: "s-b-once", subject: faceB, signer: { ...b.signer, dropped: false } };
    const liveB: Session = { id: "s-b", subject: faceB, signer: { ...b.signer, dropped: false } };
    const sealedBy: string[] = [];
    const held: string[] = [];
    const standing = { b: oneShotB as Session | null };
    let repo: Repo | null = null;
    const rest = composeSealedRest<Session>({
      inner: memoryAdapter(),
      bagOf: () => ({ bagId: BAG, face: faceB }),
      sessionFace: () => faceA,
      openFaces: () => [faceA, faceB],
      door: {
        seal: async (args) => {
          const session = args.session as Session;
          sealedBy.push(session.id);
          if (session.signer.dropped) return { refusal: "record-refused", cause: "signer-refused" } as never;
          return (session.subject === faceA ? a : b).holder.sealValues({ ...args, signer: session.signer });
        },
        open: async (args) => b.holder.openValue(args),
      },
      flushRepo: async () => { await repo?.flush(); },
      onHeld: (h) => held.push(`${h.refusal}:${h.documentId}`),
    });
    repo = new Repo({ storage: rest.store, network: [] });
    // The standing reader hands b's session while it stands, else a's: the per-document match must refuse a's for b's bag.
    rest.watch(repo, () => standing.b ?? liveA);
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "b writes"; });
    await repo.flush();
    oneShotB.signer.dropped = true;
    standing.b = null;
    sealedBy.length = 0;
    doc.change((d) => { d.note = "after b's signer dropped"; });
    await repo.flush();
    expect(sealedBy).not.toContain("s-a");
    expect(sealedBy).not.toContain("s-b-once");
    expect(held).toContain(`save-unbooked:${doc.documentId}`);
    expect(await rest.rebook(liveA)).toBe(0);
    expect(await rest.rebook(liveB)).toBeGreaterThan(0);
    expect(sealedBy.filter((id) => id !== "s-b")).toEqual([]);
    await repo.shutdown();
  });
});
