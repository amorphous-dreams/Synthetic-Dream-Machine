/**
 * resting-doc-of — a lit sibling's persona plane rests in this replica's own store, unmounted: its proof reads the plane's
 * bytes from the storage adapter into a scratch document (`readRestingDoc`), never a Repo handle, never a peer.
 *
 *   R1  RED: a plane resting unmounted reads absent to the memory-only read (`heldDocOf`, the two-face walk's `no-founding`)
 *       and whole to the store read, and the read leaves the live Repo holding no handle for it
 *   R2  CUSTODY: a plane a CONNECTED peer holds and this store does not reads absent, and nothing asks the peer (the same Repo
 *       then fetches it over that real network, so the peer could have answered)
 *   R3  CUSTODY: a sibling's plane sealed under its own face reads while that face stands open, and absent once it locks
 *   R4  CUSTODY: a decryptable plane whose log the root never signed reads, fails its fold, and never reached the live Repo
 *   R5  BOUND: a silent store and a late store each read bound-spent at the timer; the late answer populates nothing
 *   R6  ORDER: the callback-order contract: the timer callback alone closes the window (fake timers, no clock)
 *   R7  ONE READ PER KEY: a call while its key's read waits answers read-outstanding; an expired read's bytes reach no one
 *   R8  PARTIAL: a chunk that did not read, an empty chunk, too many chunks or bytes refuse by name
 *   R9  ABSENCE BY NAME: a malformed url, a throwing adapter, nothing at rest and torn bytes, never a throw
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { RESTING_DOC_MAX_BYTES, RESTING_DOC_MAX_CHUNKS, type RestingRead, heldDocOf, personaActRecordsOfGroup, personaLineageFromKel, readRestingDoc, signFoundingLog, writePersonaAct } from "../src/persona-act-board.js";
import { projectPersonaLog } from "../src/persona-act.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { composeSealedRest } from "../src/sealed-rest.js";
import type { LarDoc } from "../src/base-doc.js";
import { realKel } from "./kel-fixture.js";
import { testVesselTag } from "./vessel-tag-fixture.js";
import { vessel, world } from "./content-key-fixture.js";

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}

const textOf = (doc: LarDoc | undefined, title: string): string | undefined =>
  (doc?.tiddlers as Record<string, { text?: string }> | undefined)?.[title]?.text;
const docOf = (r: RestingRead): LarDoc | undefined => ("doc" in r ? r.doc : undefined);
const holdsHandle = (repo: Repo, url: string): boolean =>
  Object.keys(repo.handles).includes(url.replace(/^automerge:/, ""));
const ports: MessagePort[] = [];
const repos: Repo[] = [];
afterEach(async () => {
  for (const p of ports.splice(0)) p.close();
  for (const r of repos.splice(0)) await r.shutdown().catch(() => {});
});
const repoOf = (opts: ConstructorParameters<typeof Repo>[0]): Repo => { const r = new Repo(opts); repos.push(r); return r; };

/** A plane resting in `storage`, written by a Repo that then shuts, as a founding leaves it on disk. */
async function restPlane(storage: StorageAdapterInterface, tiddlers: Record<string, unknown>): Promise<string> {
  const founding = new Repo({ storage, network: [], sharePolicy: async () => false });
  const plane = founding.create<LarDoc>({ tiddlers } as unknown as LarDoc);
  await founding.flush();
  await founding.shutdown();
  return plane.url;
}

describe("readRestingDoc: a sibling's plane reads from this replica's own store alone", () => {
  test("R1 RED: a plane resting unmounted reads absent to heldDocOf and whole to the store read, leaving the Repo untouched", async () => {
    const storage = memoryAdapter();
    const url = await restPlane(storage, { "lar:///founding": { text: "the founding act" } });
    const live = repoOf({ storage, network: [], sharePolicy: async () => false });
    expect(heldDocOf(live, url)).toBeUndefined();
    expect(textOf(docOf(await readRestingDoc(storage, url)), "lar:///founding")).toBe("the founding act");
    expect(holdsHandle(live, url)).toBe(false);
  });

  test("R2 CUSTODY: a plane only a connected peer holds reads absent, and nothing asks that peer", async () => {
    // The peer announces nothing (it answers a request alone), so nothing lands in this store unless this replica asks.
    const peer = repoOf({ network: [], peerId: "peer-replica" as PeerId, sharePolicy: async () => false });
    const theirs = peer.create<LarDoc>({ tiddlers: { "lar:///founding": { text: "a peer's act" } } } as unknown as LarDoc);
    const channel = new MessageChannel();
    ports.push(channel.port1, channel.port2);
    peer.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(channel.port1 as never));
    const storage = memoryAdapter();
    const live = repoOf({ storage, network: [new MessageChannelNetworkAdapter(channel.port2 as never)], peerId: "vessel" as PeerId, sharePolicy: async () => true });
    await new Promise((done) => setTimeout(done, 200));
    expect(await readRestingDoc(storage, theirs.url, { boundMs: 2_000 })).toEqual({ absent: "nothing-rests" });
    expect(holdsHandle(live, theirs.url)).toBe(false);
    // The network stands real: the same Repo, asked through the network, receives the peer's plane.
    const fetched = await live.find<LarDoc>(theirs.url as AutomergeUrl);
    expect(textOf(fetched.doc(), "lar:///founding")).toBe("a peer's act");
  });

  test("R3 CUSTODY: a sibling's sealed plane reads while its face stands open and absent once that face locks", async () => {
    type Session = { readonly id: string; readonly subject: string; readonly signer: RecordSigner };
    const w = world();
    const a = await vessel(w, "a"), b = await vessel(w, "b");
    const faceA = faceProofSubjectRef(a.chain.scope), faceB = faceProofSubjectRef(b.chain.scope);
    const sessionB: Session = { id: "s-b", subject: faceB, signer: b.signer };
    const open = new Set<string>([faceA, faceB]);
    const planeOfB = new Set<string>();
    const inner = memoryAdapter();
    let writer: Repo | null = null;
    const rest = composeSealedRest<Session>({
      inner,
      bagOf: (id) => planeOfB.has(id) ? { bagId: "lar:///ha.ka.ba/wikis/daemon/working#b", face: faceB } : { bagId: "lar:///ha.ka.ba/wikis/daemon/working#a", face: faceA },
      sessionFace: () => faceA,
      openFaces: () => [...open],
      door: {
        seal: async (args) => { const s = args.session as Session; return (s.subject === faceB ? b : a).holder.sealValues({ ...args, signer: s.signer }); },
        open: async (args) => { const face = (args as { face?: string }).face; const h = face === faceB ? b : face === faceA ? a : null; return h === null ? { refusal: "face-unnamed" } as never : h.holder.openValue(args); },
      },
      flushRepo: async () => { await writer?.flush(); },
    });
    writer = repoOf({ storage: rest.store, network: [] });
    const plane = writer.create<LarDoc>();
    planeOfB.add(plane.documentId);
    plane.change((d) => { (d as unknown as { tiddlers: Record<string, unknown> }).tiddlers = { "lar:///founding": { text: "b's founding" } }; });
    await writer.flush();
    expect(await rest.rebook(sessionB)).toBeGreaterThan(0);
    expect(textOf(docOf(await readRestingDoc(rest.store, plane.url, { boundMs: 2_000 })), "lar:///founding")).toBe("b's founding");
    open.delete(faceB);
    expect(docOf(await readRestingDoc(rest.store, plane.url, { boundMs: 1_000 }))).toBeUndefined();
  });

  test("R4 CUSTODY: a decryptable plane whose founding the root never signed fails its fold and never reached the live Repo", async () => {
    const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
    const root = { key: await ed25519VerifyingKeyFromSeed(seed(1)) };
    const attacker = { key: await ed25519VerifyingKeyFromSeed(seed(9)), sign: ed25519SignerFromSeed(seed(9)) };
    const forged = await signFoundingLog({ group: "g1", personaKelPrefix: "kel1", rootCommitment: "rc", epoch: 0, planes: {}, deviceKey: "dev1", edgeDigest: "ed1", vesselTag: await testVesselTag(1, "g1", "dev1") }, attacker);
    const draft = { tiddlers: {} } as unknown as LarDoc;
    for (const act of forged) writePersonaAct(draft, act);
    const storage = memoryAdapter();
    const url = await restPlane(storage, (draft as unknown as { tiddlers: Record<string, unknown> }).tiddlers);
    const live = repoOf({ storage, network: [], sharePolicy: async () => false });
    const records = personaActRecordsOfGroup(docOf(await readRestingDoc(storage, url)), "g1");
    expect(records.length).toBeGreaterThan(0);
    const lineage = personaLineageFromKel((await realKel([root.key])).chain)!;
    expect(projectPersonaLog(records, { group: "g1", lineage, authorize: () => true }).founded).toBe(false);
    expect(holdsHandle(live, url)).toBe(false);
  });

  test("R5 BOUND: a silent store reads bound-spent at the timer, and a late store's answer reads bound-spent and populates nothing", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    const live = repoOf({ storage: real, network: [], sharePolicy: async () => false });
    vi.useFakeTimers();
    try {
      const quiet = readRestingDoc({ loadRange: () => new Promise<Chunk[]>(() => {}) }, url, { boundMs: 300 });
      await vi.advanceTimersByTimeAsync(300);
      expect(await quiet).toEqual({ absent: "bound-spent" });
      let answer!: (chunks: Chunk[]) => void;
      const reading = readRestingDoc({ loadRange: () => new Promise<Chunk[]>((done) => { answer = done; }) }, url, { boundMs: 200 });
      await vi.advanceTimersByTimeAsync(200);
      answer(await real.loadRange([url.replace(/^automerge:/, "")]));
      expect(await reading).toEqual({ absent: "bound-spent" });
      expect(holdsHandle(live, url)).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  test("R6 ORDER (the callback-order contract): an answer that reaches acceptance before the timer callback reads whole; one that reaches it after reads bound-spent", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    const chunks = await real.loadRange([url.replace(/^automerge:/, "")]);
    vi.useFakeTimers();
    try {
      let early!: (c: Chunk[]) => void;
      const inside = readRestingDoc({ loadRange: () => new Promise<Chunk[]>((done) => { early = done; }) }, url, { boundMs: 100 });
      await vi.advanceTimersByTimeAsync(99);
      early(chunks);
      expect(textOf(docOf(await inside), "lar:///founding")).toBe("rests");
      // The I/O completes, then the timer callback runs before acceptance's continuation: the callback closed the window.
      let racing!: (c: Chunk[]) => void;
      const raced = readRestingDoc({ loadRange: () => new Promise<Chunk[]>((done) => { racing = done; }) }, url, { boundMs: 100 });
      await vi.advanceTimersByTimeAsync(99);
      racing(chunks);
      vi.advanceTimersByTime(1);
      expect(await raced).toEqual({ absent: "bound-spent" });
    } finally { vi.useRealTimers(); }
  });

  test("R7 ONE READ PER KEY, NEVER SHARED: a call while its key's read waits answers read-outstanding at once; another opening reads its own; the key frees when the read settles", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    const chunks = await real.loadRange([url.replace(/^automerge:/, "")]);
    let asked = 0;
    const answers: Array<(c: Chunk[]) => void> = [];
    const slow = { loadRange: () => { asked++; return new Promise<Chunk[]>((done) => { answers.push(done); }); } };
    vi.useFakeTimers();
    try {
      const first = readRestingDoc(slow, url, { boundMs: 50, scope: "fcid#1" });
      expect(await readRestingDoc(slow, url, { boundMs: 50, scope: "fcid#1" })).toEqual({ absent: "read-outstanding" });
      await vi.advanceTimersByTimeAsync(50);
      expect(await first).toEqual({ absent: "bound-spent" });
      // The expired read still waits on the adapter: its key stays taken, so no caller takes its bytes.
      expect(await readRestingDoc(slow, url, { boundMs: 50, scope: "fcid#1" })).toEqual({ absent: "read-outstanding" });
      // A new opening reads with its own adapter call.
      const reopened = readRestingDoc(slow, url, { boundMs: 50, scope: "fcid#2" });
      answers[1]!(chunks);
      expect(textOf(docOf(await reopened), "lar:///founding")).toBe("rests");
      // The expired read settles; its bytes reach no caller, and its key frees.
      answers[0]!(chunks);
      await vi.advanceTimersByTimeAsync(0);
      const again = readRestingDoc(slow, url, { boundMs: 50, scope: "fcid#1" });
      answers[2]!(chunks);
      expect(textOf(docOf(await again), "lar:///founding")).toBe("rests");
      expect(asked).toBe(3);
    } finally { vi.useRealTimers(); }
  });

  test("R8 PARTIAL: a chunk that did not read, an empty chunk, too many chunks and too many bytes each refuse by name, never stale-present", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    // The plane's resting chunks, then one incremental beside them, as the engine writes a later change.
    const id = url.replace(/^automerge:/, "");
    const rested = await real.loadRange([id]);
    const base = A.loadIncremental(A.init<LarDoc>(), rested[0]!.data!);
    const heads = A.getHeads(base);
    const next = A.change(base, (d) => { (d.tiddlers as Record<string, unknown>)["lar:///second"] = { text: "an incremental" }; });
    const chunks: Chunk[] = [...rested, { key: [id, "incremental", "later"], data: A.saveSince(next, heads) }];
    expect(textOf(docOf(await readRestingDoc({ loadRange: async () => chunks }, url)), "lar:///second")).toBe("an incremental");
    const unread: Chunk[] = chunks.map((c) => (c.key[1] === "incremental" ? { key: c.key, data: undefined } : c));
    expect(await readRestingDoc({ loadRange: async () => unread }, url)).toEqual({ absent: "chunk-unread" });
    const empty: Chunk[] = chunks.map((c) => (c.key[1] === "incremental" ? { key: c.key, data: new Uint8Array(0) } : c));
    expect(await readRestingDoc({ loadRange: async () => empty }, url)).toEqual({ absent: "chunk-empty" });
    const many = Array.from({ length: RESTING_DOC_MAX_CHUNKS + 1 }, (_, i) => ({ key: [id, "incremental", `h${i}`], data: new Uint8Array(1) }));
    expect(await readRestingDoc({ loadRange: async () => many }, url)).toEqual({ absent: "over-cap" });
    const heavy = [{ key: [id, "snapshot", "big"], data: new Uint8Array(RESTING_DOC_MAX_BYTES + 1) }];
    expect(await readRestingDoc({ loadRange: async () => heavy }, url)).toEqual({ absent: "over-cap" });
  });

  test("R9 ABSENCE BY NAME: a malformed url, an adapter that throws on the call, nothing at rest and torn bytes, never a throw", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    expect(await readRestingDoc(real, "not-a-url")).toEqual({ absent: "url-malformed" });
    expect(await readRestingDoc({ loadRange: () => { throw new Error("adapter fault"); } }, url)).toEqual({ absent: "refused" });
    expect(await readRestingDoc(memoryAdapter(), url)).toEqual({ absent: "nothing-rests" });
    expect(await readRestingDoc({ loadRange: async () => [{ key: [url, "snapshot", "x"], data: new Uint8Array([1, 2, 3, 4]) }] }, url)).toEqual({ absent: "torn" });
  });
});
