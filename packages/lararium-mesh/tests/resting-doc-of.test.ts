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
 *   R5  BOUND: a silent store and a late store each read absent at the bound; the late answer populates nothing
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { afterEach, describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type PeerId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { heldDocOf, personaActRecordsOfGroup, personaLineageFromKel, readRestingDoc, signFoundingLog, writePersonaAct } from "../src/persona-act-board.js";
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
    expect(textOf(await readRestingDoc(storage, url), "lar:///founding")).toBe("the founding act");
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
    expect(await readRestingDoc(storage, theirs.url, 2_000)).toBeUndefined();
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
    expect(textOf(await readRestingDoc(rest.store, plane.url, 2_000), "lar:///founding")).toBe("b's founding");
    open.delete(faceB);
    expect(await readRestingDoc(rest.store, plane.url, 1_000)).toBeUndefined();
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
    const records = personaActRecordsOfGroup(await readRestingDoc(storage, url), "g1");
    expect(records.length).toBeGreaterThan(0);
    const lineage = personaLineageFromKel((await realKel([root.key])).chain)!;
    expect(projectPersonaLog(records, { group: "g1", lineage, authorize: () => true }).founded).toBe(false);
    expect(holdsHandle(live, url)).toBe(false);
  });

  test("R5 BOUND: a silent store and a late store each read absent at the bound, and the late answer populates nothing", async () => {
    const real = memoryAdapter();
    const url = await restPlane(real, { "lar:///founding": { text: "rests" } });
    const silent = { loadRange: () => new Promise<Chunk[]>(() => {}) };
    let t0 = Date.now();
    expect(await readRestingDoc(silent, url, 300)).toBeUndefined();
    expect(Date.now() - t0).toBeLessThan(2_000);
    let landed = false;
    const late = { loadRange: (prefix: StorageKey) => new Promise<Chunk[]>((done) => setTimeout(() => { landed = true; void real.loadRange(prefix).then(done); }, 600)) };
    const live = repoOf({ storage: real, network: [], sharePolicy: async () => false });
    t0 = Date.now();
    expect(await readRestingDoc(late, url, 200)).toBeUndefined();
    expect(Date.now() - t0).toBeLessThan(500);
    await new Promise((done) => setTimeout(done, 700));
    expect(landed).toBe(true);
    expect(holdsHandle(live, url)).toBe(false);
  });
});
