/**
 * sealed-rest-vessel — the document store's sealed rest under a vessel's Repo, across the door to a REAL founded
 * vessel's daemon island (sealed-store#/owed, R1 and R2).
 *
 * The real `operatorDaemonOptions` boot runs over a real founding, with real Keyhive identities and the node's own
 * sealed-store shore. The island answers the document store's door (`docStoreDoor`) and asks the vessel's session sign
 * book through the session door, both over real MessageChannels; the vessel books each seal's ask under the session
 * that booked the change, so the island signs through that session and no other.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { islandSessionDoor, operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import {
  answerIslandAsks, composeSealedRest, SessionSignBook, utf8Bytes, vesselDocStoreDoor, type CapabilityRecord, type RecordSigner,
} from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { faceProofSubjectRef, sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-garden-notes";
const SECRET = "the-heron-nests-by-the-third-pond";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

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
const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
const restsClear = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean =>
  [...inner.bytes].some(([key, data]) => key.startsWith(docId) && (holds(data, [...utf8Bytes(SECRET)]) || holds(data, MAGIC)));
const portOf = (p: MessagePort) => {
  teardown.push(() => p.close());
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

/** Stand a real founded island answering the door, and the vessel's book and sealed rest in front of it. */
async function stand() {
  const root = mkdtempSync(join(tmpdir(), "sealed-rest-vessel-"));
  teardown.push(() => rmSync(root, { recursive: true, force: true }));
  const st = await standFoundedIsland(teardown);
  const c = await chain("rest-vessel", "nexus-test-one");
  const own = { scope: c.scope, vesselFaceKey: c.sessionCertificate.vesselFaceKey };
  const subject = faceProofSubjectRef(c.scope);
  const signer: RecordSigner & { dropped: boolean } = {
    dropped: false, certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  // THE VESSEL'S BOOK, answered over the session door's own channel as the vessel answers its island.
  const book = new SessionSignBook();
  const caps: CapabilityRecord = { sessionSign: book.door(() => own, async () => ({ read: true, counted: [], unanswered: [] })) };
  const sign = new MessageChannel();
  answerIslandAsks(portOf(sign.port1), caps);
  const sessionProof = islandSessionDoor(portOf(sign.port2), { patienceMs: 5_000, idPrefix: "rest-vessel" });
  // THE DOCUMENT STORE'S DOOR: the island answers it beside its holder.
  const door = new MessageChannel();
  const vesselSide = portOf(door.port1);
  const daemonAuth = { ...st.daemonAuth, registerBags: [...st.daemonAuth.registerBags, BAG], ...st.veil };
  const opts = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: () => "clear", sealedStore: nodeSealedStoreShore(join(root, "daemon")), persistArchive: () => {}, persistVeilArchive: () => {},
    sessionProof, docStoreDoor: portOf(door.port2),
  } as never);
  const kh = await opts.verifierFactory!(st.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  opts.wireWorkerVerbs!(new VerbTable(), st.ctx);
  type Session = { id: string; subject: string; signer: typeof signer };
  const session: Session = { id: "s-one", subject, signer };
  const inner = memoryAdapter();
  let repo: Repo | null = null;
  const compose = () => composeSealedRest<Session>({
    inner, bagOf: () => ({ bagId: BAG, face: subject }), sessionFace: () => subject,
    door: vesselDocStoreDoor<Session>(() => vesselSide, {
      book: (ask, verb, s) => book.hold(ask, verb, { signer: s.signer, anchor: { kind: "nexus" }, subject: s.subject }),
      patienceMs: 30_000, idPrefix: "rest-vessel-door",
    }),
    flushRepo: async () => { await repo?.flush(); },
  });
  const rest = compose();
  repo = new Repo({ storage: rest.store, network: [] });
  return { rest, repo, inner, session, book, compose };
}

describe("the sealed rest under a vessel's Repo, across the door to a real founded island", () => {
  test("a private bag's change rests as no clear Automerge byte, signed through the booked session; the live document reads clear; a restart hydrates", async () => {
    const { rest, repo, inner, session, book, compose } = await stand();
    const doc = repo.create<{ note?: string }>();
    rest.wrote(doc.documentId, session);
    doc.change((d) => { d.note = SECRET; });
    // A Repo flush can return while a debounced save's seal still crosses the door; the census reads after the store's own
    // flush, which settles every save in turn (the lock's own order: flushRepo, then store.flush).
    await repo.flush();
    await rest.store.flush();
    // THE SETUP TOOK: values reached rest for the document, and no booking outlived its seal.
    expect([...inner.bytes.keys()].some((k) => k.startsWith(doc.documentId))).toBe(true);
    expect(book.size).toBe(0);
    expect(restsClear(inner, doc.documentId)).toBe(false);
    // The live wiki in memory reads clear (control).
    expect(doc.doc().note).toBe(SECRET);
    await repo.shutdown();
    const again = compose();
    const repo2 = new Repo({ storage: again.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc().note).toBe(SECRET);
    await repo2.shutdown();
  }, 120_000);

  test("a save no session booked waits `save-unbooked`, never written; the next session seals it through the island", async () => {
    const { rest, repo, inner, session } = await stand();
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    expect([...inner.bytes.keys()].some((k) => k.startsWith(doc.documentId))).toBe(false);
    expect(rest.store.waiting(doc.documentId)).toBeGreaterThan(0);
    expect(await rest.rebook(session)).toBeGreaterThan(0);
    expect([...inner.bytes.keys()].some((k) => k.startsWith(doc.documentId))).toBe(true);
    expect(restsClear(inner, doc.documentId)).toBe(false);
    await repo.shutdown();
  }, 120_000);
});
