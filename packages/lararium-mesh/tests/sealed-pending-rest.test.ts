/**
 * sealed-pending-rest — NEVER CLEAR AND NEVER LOST: a save no session sealed survives its process, one document holds a
 * counted ceiling of them, a signer that stands and signs nothing takes one ask, and the teardown testifies.
 *
 * The live house (boot `8b0515ad`, `research/restand-log-read` L1 and L3) printed `save-unsealed (signer-refused) 4Z7n…
 * waits in memory, never clear, until a session seals it` 142 times in one boot. The document stood as a lit sibling face's
 * daemon working slot (`daemon-slot/working/<group>`); its seated session's signer never read dropped and refused every
 * signature, so each save booked it again, each refused save sat in the store's process memory with no bound, and a crash
 * or a kill past the stop grace dropped them all with no line.
 *
 *   SP1 — a save under a refusing signer rests sealed-pending; the process dies with no stand-down; the save stands after
 *         the restart, and the next live session of the face seals it in place
 *   SP2 — control: with the vessel's key out of reach the same save waits in memory alone, says so, and the kill drops it
 *   SP3 — past one document's counted ceiling a further save refuses `held-bound`: memory stays bounded, the refusal
 *         reaches the writer's owed band, the census row reads at its bound, and another document still holds
 *   SP4 — a signer that stands and refuses takes ONE ask, never one per save; it leaves the standing reading until it acts
 *         again (a rebook) or a count of unbooked saves passes; a live session of the face takes the saves meanwhile
 *   SP5 — the stand-down seals what a live session signs, carries what rests sealed-pending, drops what memory alone held,
 *         and says each
 *   SP6 — four fates, four sentences, each naming its cure, none with a copula
 *   SP7 — the sign book tells the signer's own word for a refused signature, while the island hears `signer-refused` alone
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/kahua/memory/research/restand-log-read
 */
import { describe, expect, it } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import { mintHeldRestKey, type HeldRestKey } from "../src/held-rest-key.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { HELD_MAX_SAVES_PER_DOCUMENT, type HeldNotice } from "../src/sealed-doc-store.js";
import {
  REFUSING_SIGNER_REASK_SAVES, composeSealedRest, heldFateLine, refusedFateLine, restOwedWatch, standDownLine, type StandDownRow,
} from "../src/sealed-rest.js";
import { SessionSignBook, type BookedSession } from "../src/session-sign-book.js";
import { vessel, world, type Vessel } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
const POINTER = [..."lares-sealed-value:"].map((c) => c.charCodeAt(0));
const AUTOMERGE = [0x85, 0x6f, 0x4a, 0x83];
const starts = (data: Uint8Array, mark: readonly number[]): boolean => mark.every((b, i) => data[i] === b);

type Adapter = StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> };
function memoryAdapter(from?: Adapter): Adapter {
  const bytes = new Map<string, Uint8Array>([...(from?.bytes ?? [])].map(([key, data]): [string, Uint8Array] => [key, Uint8Array.from(data)]));
  const name = (key: StorageKey): string => key.join("\u0000");
  const under = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => under(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (under(key, prefix)) bytes.delete(key); },
  };
}
const chunksOf = (inner: Adapter, docId: string): Uint8Array[] => [...inner.bytes].filter(([key]) => key.startsWith(docId)).map(([, data]) => data);

/** A signer the test can make refuse every signature while it never reads dropped (a session its owner's table holds
 *  not-live without dropping it, a place signer whose anchor read fails). */
type Signer = RecordSigner & { dropped: boolean; refuses: boolean };
type Session = { readonly id: string; readonly subject: string; readonly signer: Signer };

/** One face's sealed rest over `inner`, with the vessel's key in reach or not; `watch.standing` names the standing session. */
function standRest(a: Vessel, inner: Adapter, key: HeldRestKey | null) {
  const face = faceProofSubjectRef(a.chain.scope);
  const asked: string[] = [];
  const held: HeldNotice[] = [];
  const refused: Array<{ readonly documentId: string; readonly refusal: string; readonly cause?: string }> = [];
  const watch = { standing: null as Session | null };
  let repo: Repo | null = null;
  const rest = composeSealedRest<Session>({
    inner,
    bagOf: () => ({ bagId: BAG, face }),
    sessionFace: () => face,
    vesselKey: () => key,
    door: {
      // THE ISLAND'S DOOR as the sign book answers it: a signer that refuses its signature reads `signer-refused`.
      seal: async (args) => {
        const session = args.session as Session;
        asked.push(session.id);
        if (session.signer.dropped || session.signer.refuses) return { refusal: "record-refused", cause: "signer-refused:signer-refused" } as never;
        return a.holder.sealValues({ ...args, signer: session.signer });
      },
      open: async (args) => a.holder.openValue(args),
    },
    flushRepo: async () => { await repo?.flush(); },
    onHeld: (h) => held.push(h),
    onRefused: (r) => refused.push(r),
  });
  const session = (id: string): Session => ({ id, subject: face, signer: { ...a.signer, dropped: false, refuses: false } });
  return {
    rest, face, asked, held, refused, watch, session,
    seat(r: Repo): Repo { repo = r; rest.watch(r, () => watch.standing); return r; },
    /** The standing reading alone, with no Repo: each save books whichever session `watch.standing` names, as a vessel's does. */
    standingAlone(): void { rest.watch({ handles: {} } as never, () => watch.standing); },
  };
}

const change = (n: number): Uint8Array => A.save(A.from({ n }));

describe("a save no session sealed rests sealed-pending: never clear, never lost", () => {
  it("SP1 — a save under a refusing signer survives a kill and seals at the next live session of its face", async () => {
    const a = await vessel(world(), "a");
    const key = mintHeldRestKey();
    const inner = memoryAdapter();
    const first = standRest(a, inner, key);
    const repo = first.seat(new Repo({ storage: first.rest.store, network: [] }));
    const seated = first.session("s-seated");
    first.watch.standing = seated;
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "the put"; });
    await repo.flush();
    expect(first.rest.store.waiting(doc.documentId)).toBe(0);

    // THE SIGNER REFUSES AND NEVER READS DROPPED: the save waits, and rests sealed under the vessel's key.
    seated.signer.refuses = true;
    doc.change((d) => { d.note = "after the refusal"; });
    await repo.flush();
    expect(first.rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    const waiting = first.held.filter((h) => h.documentId === doc.documentId);
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.every((h) => h.rests === "sealed-pending" && h.bagId === BAG && h.face === first.face)).toBe(true);
    expect(first.rest.store.held().find((h) => h.documentId === doc.documentId)?.pending).toBeGreaterThan(0);
    // NEVER CLEAR: every chunk at rest names a face pointer or a sealed value; none reads as the engine wrote it.
    const atRest = chunksOf(inner, doc.documentId);
    expect(atRest.some((c) => !starts(c, POINTER))).toBe(true);
    expect(atRest.some((c) => starts(c, AUTOMERGE))).toBe(false);

    // THE KILL: no stand-down, no flush. The next process stands over the bytes exactly as they rested.
    const afterKill = memoryAdapter(inner);
    await repo.shutdown();
    const second = standRest(a, afterKill, key);
    const repo2 = second.seat(new Repo({ storage: second.rest.store, network: [] }));
    const found = await repo2.find<{ note?: string }>(doc.url);
    // NEVER LOST: the change the dead process never sealed reads back, and joins this process's wait by name.
    expect(found.doc().note).toBe("after the refusal");
    expect(second.rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    expect(second.held.some((h) => h.documentId === doc.documentId && h.carried === true && h.rests === "sealed-pending")).toBe(true);

    // THE NEXT LIVE SESSION OF THE FACE SEALS IT, IN PLACE: the pending value gives way to a face pointer.
    expect(await second.rest.rebook(second.session("s-live"))).toBeGreaterThan(0);
    expect(second.rest.store.waiting(doc.documentId)).toBe(0);
    expect(chunksOf(afterKill, doc.documentId).every((c) => starts(c, POINTER))).toBe(true);
    await repo2.shutdown();

    // AND IT READS FROM THE FACE'S SEAL ALONE: a third process with no vessel key in reach opens the same content.
    const third = standRest(a, afterKill, null);
    const repo3 = third.seat(new Repo({ storage: third.rest.store, network: [] }));
    expect((await repo3.find<{ note?: string }>(doc.url)).doc().note).toBe("after the refusal");
    await repo3.shutdown();
  });

  it("SP2 — control: with the vessel's key out of reach the save waits in memory alone, says so, and a kill drops it", async () => {
    const a = await vessel(world(), "a");
    const inner = memoryAdapter();
    const first = standRest(a, inner, null);
    const repo = first.seat(new Repo({ storage: first.rest.store, network: [] }));
    const seated = first.session("s-seated");
    first.watch.standing = seated;
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = "the put"; });
    await repo.flush();
    seated.signer.refuses = true;
    doc.change((d) => { d.note = "after the refusal"; });
    await repo.flush();
    const waiting = first.held.filter((h) => h.documentId === doc.documentId);
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.every((h) => h.rests === "memory")).toBe(true);
    expect(first.rest.store.held().find((h) => h.documentId === doc.documentId)?.pending).toBeUndefined();
    expect(chunksOf(inner, doc.documentId).every((c) => starts(c, POINTER))).toBe(true);

    const afterKill = memoryAdapter(inner);
    await repo.shutdown();
    const second = standRest(a, afterKill, null);
    const repo2 = second.seat(new Repo({ storage: second.rest.store, network: [] }));
    expect((await repo2.find<{ note?: string }>(doc.url)).doc().note).toBe("the put");
    expect(second.rest.store.waiting(doc.documentId)).toBe(0);
    await repo2.shutdown();
  });
});

describe("one document holds a counted ceiling of unsealed saves", () => {
  it("SP3 — past the ceiling a save refuses held-bound: memory stays bounded and the refusal reaches the writer", async () => {
    const a = await vessel(world(), "a");
    const r = standRest(a, memoryAdapter(), mintHeldRestKey());
    const owed = restOwedWatch({ waiting: (documentId) => r.rest.store.waiting(documentId) });
    const mark = owed.mark();
    // No session stands: each save waits `save-unbooked`, up to the ceiling.
    for (let i = 0; i < HELD_MAX_SAVES_PER_DOCUMENT; i++) await r.rest.store.save(["doc-busy", "incremental", `k${i}`], change(i));
    expect(r.rest.store.waiting("doc-busy")).toBe(HELD_MAX_SAVES_PER_DOCUMENT);
    expect(r.refused).toEqual([]);
    // THE NEXT ONE REFUSES BY NAME, and nothing more waits.
    await expect(r.rest.store.save(["doc-busy", "incremental", "one-more"], change(-1))).rejects.toThrow(/held-bound/);
    await expect(r.rest.store.save(["doc-busy", "incremental", "and-another"], change(-2))).rejects.toThrow(/held-bound/);
    expect(r.rest.store.waiting("doc-busy")).toBe(HELD_MAX_SAVES_PER_DOCUMENT);
    expect(r.refused.map((x) => `${x.documentId}:${x.refusal}`)).toEqual(["doc-busy:held-bound", "doc-busy:held-bound"]);
    // THE WRITER READS IT OWED, the census row reads at its bound, and the refusal's sentence names the ceiling and a cure.
    for (const x of r.refused) owed.notice({ documentId: x.documentId, refusal: "save-refused", error: x.refusal, ...(x.cause !== undefined ? { cause: x.cause } : {}) });
    expect(owed.owed(mark, ["doc-busy"])?.documents[0]).toMatchObject({ documentId: "doc-busy", refusal: "save-refused", error: "held-bound" });
    expect(r.rest.store.held().find((h) => h.documentId === "doc-busy")).toMatchObject({ saves: HELD_MAX_SAVES_PER_DOCUMENT, atBound: true });
    expect(refusedFateLine(r.refused[0]!)).toMatch(new RegExp(`ceiling of ${HELD_MAX_SAVES_PER_DOCUMENT}`));
    expect(refusedFateLine(r.refused[0]!)).toMatch(/Cure: /);
    // THE CEILING COUNTS PER DOCUMENT: another document still holds, and reads under its bound.
    await r.rest.store.save(["doc-quiet", "incremental", "k"], change(7));
    expect(r.rest.store.waiting("doc-quiet")).toBe(1);
    expect(r.rest.store.held().find((h) => h.documentId === "doc-quiet")?.atBound).toBeUndefined();
    // A SAVE ALREADY WAITING UNDER ITS KEY SAVES AGAIN: the ceiling counts keys, never repeats.
    await r.rest.store.save(["doc-busy", "incremental", "k0"], change(0));
    expect(r.rest.store.waiting("doc-busy")).toBe(HELD_MAX_SAVES_PER_DOCUMENT);
    // THE LIVE SESSION SEALS WHAT WAITS, and the document holds again.
    expect(await r.rest.rebook(r.session("s-live"))).toBe(HELD_MAX_SAVES_PER_DOCUMENT + 1);
    expect(r.rest.store.waiting()).toBe(0);
  });
});

describe("a signer that stands and signs nothing stands for no save", () => {
  it("SP4 — it takes one ask, leaves the standing reading, and returns at its own next act or a count of unbooked saves", async () => {
    const a = await vessel(world(), "a");
    const r = standRest(a, memoryAdapter(), mintHeldRestKey());
    r.standingAlone();
    // Opaque bytes carry no actor, so each save books the session the standing reading names (never a peer's writer).
    const bytes = (n: number): Uint8Array => new Uint8Array([7, 7, 7, n]);
    const refuser = r.session("s-refuser");
    refuser.signer.refuses = true;
    r.watch.standing = refuser;
    expect(r.rest.signs(refuser)).toBe(true);
    await r.rest.store.save(["doc", "incremental", "k0"], bytes(0));
    expect(r.asked).toEqual(["s-refuser"]);
    expect(r.rest.signs(refuser)).toBe(false);
    expect(r.held.map((h) => `${h.refusal}:${h.error ?? ""}`)).toEqual(["save-unsealed:record-refused"]);
    // THE SAVES THAT FOLLOW NEVER ASK IT: each waits `save-unbooked`, the honest state, until a count of them passes.
    for (let i = 1; i <= REFUSING_SIGNER_REASK_SAVES; i++) await r.rest.store.save(["doc", "incremental", `k${i}`], bytes(i));
    expect(r.asked).toEqual(["s-refuser"]);
    expect(r.held.length).toBe(1 + REFUSING_SIGNER_REASK_SAVES);
    expect(r.held.slice(1).every((h) => h.refusal === "save-unbooked" && h.rests === "sealed-pending")).toBe(true);
    // THE COUNT PASSED: the next save asks it once more, and it leaves again.
    await r.rest.store.save(["doc", "incremental", "after-the-count"], bytes(99));
    expect(r.asked).toEqual(["s-refuser", "s-refuser"]);
    expect(r.rest.signs(refuser)).toBe(false);
    // ITS OWN NEXT ACT (a rebook) asks it once, whatever waits: a reseal's pass over the waiting saves counts nothing.
    r.asked.length = 0;
    expect(await r.rest.rebook(refuser)).toBe(0);
    expect(r.asked).toEqual(["s-refuser"]);
    expect(r.rest.signs(refuser)).toBe(false);
    // A LIVE SESSION OF THE SAME FACE TAKES THE NEXT SAVE AT ONCE, and its rebook seals every save that waited.
    const live = r.session("s-live");
    r.watch.standing = live;
    r.asked.length = 0;
    await r.rest.store.save(["doc", "incremental", "under-the-live-one"], bytes(100));
    expect(r.asked).toEqual(["s-live"]);
    expect(await r.rest.rebook(live)).toBe(2 + REFUSING_SIGNER_REASK_SAVES);
    expect(r.rest.store.waiting("doc")).toBe(0);
    expect(r.asked).not.toContain("s-refuser");
    // THE REFUSER ACTS AGAIN AND SIGNS: its rebook lifts the mark, and it stands for saves once more.
    refuser.signer.refuses = false;
    expect(await r.rest.rebook(refuser)).toBe(0);
    expect(r.rest.signs(refuser)).toBe(true);
  });
});

describe("the teardown testifies", () => {
  const stand = async (key: HeldRestKey | null) => {
    const a = await vessel(world(), "a");
    const r = standRest(a, memoryAdapter(), key);
    const rows: StandDownRow[] = [];
    return { r, rows, testify: (row: StandDownRow) => { rows.push(row); } };
  };

  it("SP5a — a save a live session signs seals at the stand-down, and the row says sealed", async () => {
    const { r, rows, testify } = await stand(mintHeldRestKey());
    await r.rest.store.save(["doc", "incremental", "k0"], change(0));
    await r.rest.store.save(["doc", "incremental", "k1"], change(1));
    expect(await r.rest.standDown([r.session("s-live")], testify)).toBe(0);
    expect(rows).toEqual([{ documentId: "doc", refusal: "save-unbooked", bagId: BAG, sealed: 2, carried: 0, dropped: 0 }]);
    expect(standDownLine(rows[0]!)).toMatch(/2 save\(s\) sealed/);
  });

  it("SP5b — a save no signer signs leaves carried where it rests sealed-pending, and the row says carried", async () => {
    const { r, rows, testify } = await stand(mintHeldRestKey());
    const refuser = r.session("s-refuser");
    refuser.signer.refuses = true;
    await r.rest.store.save(["doc", "incremental", "k0"], change(0));
    await r.rest.store.save(["doc", "incremental", "k1"], change(1));
    expect(await r.rest.standDown([refuser], testify)).toBe(2);
    expect(rows).toEqual([{ documentId: "doc", refusal: "save-unbooked", bagId: BAG, sealed: 0, carried: 2, dropped: 0 }]);
    expect(standDownLine(rows[0]!)).toMatch(/2 carried at rest sealed-pending/);
    // THE STOP ASKED THE SEATED SIGNER ONCE, never once per save.
    expect(r.asked).toEqual(["s-refuser"]);
  });

  it("SP5c — control: with no vessel key in reach the same save leaves in memory alone, and the row says dropped", async () => {
    const { r, rows, testify } = await stand(null);
    await r.rest.store.save(["doc", "incremental", "k0"], change(0));
    expect(await r.rest.standDown([], testify)).toBe(1);
    expect(rows).toEqual([{ documentId: "doc", refusal: "save-unbooked", bagId: BAG, sealed: 0, carried: 0, dropped: 1 }]);
    expect(standDownLine(rows[0]!)).toMatch(/1 leave in this process's memory alone and drop with it/);
  });

  it("SP5d — a stand-down with nothing waiting testifies no row and answers zero", async () => {
    const { r, rows, testify } = await stand(mintHeldRestKey());
    expect(await r.rest.standDown([r.session("s-live")], testify)).toBe(0);
    expect(rows).toEqual([]);
  });
});

describe("each held save names its own fate", () => {
  const COPULA = /\b(is|are|was|were|be|been|being|am)\b/i;
  const base = { documentId: "4Z7nNfywXcoGg7zH8y3fUGqCgqBK" };

  it("SP6 — four fates, four sentences, each naming its cure, none with a copula", () => {
    const unnamedContent = heldFateLine({ ...base, refusal: "save-unnamed", bagId: null, face: null, rests: "memory", syncState: false });
    const unnamedSync = heldFateLine({ ...base, refusal: "save-unnamed", bagId: null, face: null, rests: "memory", syncState: true });
    const pending = heldFateLine({ ...base, refusal: "save-unsealed", error: "signer-refused", bagId: BAG, face: "face-subject-of-a-lit-sibling", rests: "sealed-pending" });
    const memory = heldFateLine({ ...base, refusal: "save-unbooked", bagId: BAG, face: null, rests: "memory" });
    const refused = refusedFateLine({ ...base, refusal: "held-bound", cause: "64 save(s) of this document already wait unsealed" });
    // EACH FATE READS ITS OWN WAY ON.
    expect(unnamedContent).toMatch(/the roster's naming lands it clear, a sealed bag's naming seals it, and a stop drops it/);
    expect(unnamedSync).toMatch(/drops once a sealed bag names it; a stop loses no content here/);
    expect(pending).toMatch(/rests sealed-pending under the vessel's own key, never clear: a stop or a crash keeps it/);
    expect(memory).toMatch(/waits in this process's memory alone, never clear .* a stop drops it unless a live session of its face seals it first/);
    expect(refused).toMatch(/neither waits nor rests/);
    expect(new Set([unnamedContent, unnamedSync, pending, memory, refused]).size).toBe(5);
    // AN UNNAMED SAVE NEVER PROMISES A SESSION'S SEAL, and a pending one never claims memory alone.
    expect(unnamedContent).not.toMatch(/until a session seals it/);
    expect(unnamedSync).not.toMatch(/until a session seals it/);
    expect(pending).not.toMatch(/memory alone/);
    // THE ROW BEHIND THE DOCUMENT: the sealed-class sentences name the bag, and the face where one stands lit.
    expect(pending).toContain(`bag ${BAG}, face face-subject-of-`);
    expect(memory).toContain(`bag ${BAG}, no lit face`);
    for (const line of [unnamedContent, unnamedSync, pending, memory, refused]) {
      expect(line).toMatch(/Cure: /);
      expect(line).not.toMatch(COPULA);
    }
    // A CARRIED SAVE SAYS WHERE IT CAME FROM.
    const carried = heldFateLine({ ...base, refusal: "save-unbooked", bagId: BAG, face: "f", rests: "sealed-pending", carried: true });
    expect(carried).toMatch(/stood at rest sealed-pending from an earlier boot/);
    expect(carried).not.toMatch(COPULA);
  });
});

describe("the sign book tells the signer's own word", () => {
  it("SP7 — a refused signature answers the island signer-refused and tells the vessel the signer's own refusal, with its session", async () => {
    const heard: string[] = [];
    const book = new SessionSignBook({ onRefused: (session, verb, why) => heard.push(`${verb}:${session.subject}:${why}`) });
    const frozen: BookedSession = {
      signer: { dropped: false, certificate: {}, sign: async () => ({ refusal: "session-not-live" }) },
      anchor: { kind: "place" }, subject: "face-of-a-lit-sibling",
    };
    const release = book.hold("ask-1", "docstore-seal", frozen);
    const door = book.door(() => ({ place: {} }) as never);
    expect(await door({ op: "sign", ask: "ask-1", verb: "docstore-seal", payload: new Uint8Array([1]) } as never)).toEqual({ refusal: "signer-refused" });
    expect(heard).toEqual(["docstore-seal:face-of-a-lit-sibling:session-not-live"]);
    // THE SIGNER NEVER READ DROPPED, so the book's own standing reading still names it: only the sealed rest's `signs` passes over it.
    expect(book.standing()).toEqual([frozen]);
    release();
  });
});
