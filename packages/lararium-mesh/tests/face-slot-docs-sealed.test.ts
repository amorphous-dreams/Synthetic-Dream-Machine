/**
 * face-slot-docs-sealed — EVERY SLOT DOCUMENT THE WORN FACE'S RESOLVER NAMES RESTS SEALED UNDER THAT FACE.
 *
 * The daemon island's resolver names each wiki's `personal` margin and `draft` binding to the vessel's map before its first
 * byte (`announceSlotDoc`), as `wikis/<slug>/<kind>`. The vessel composes its map from the bags the worn face seals
 * (`wornFaceWikiBags`) and the documents each bag carries (the announced ones among them). A named document whose bag the
 * map does not seal passes clear to the inner rest, and every island's guard reads it unsealed, so its copy rests clear
 * there too. These vectors compose the map the way the vessel does, with the face lit and the announcement standing.
 *
 * The key shore models the measured substrate (`content-key-fixture`); the door runs over a real MessageChannel.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/lararium/api/personal-slot
 */
import { afterEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge";
import { utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import type { RecordSigner } from "../src/sealed-records.js";
import { answerDocStoreAsks, composeSealedRest, islandRestGuard, sealedBagMap, vesselDocStoreDoor, type SealedRest } from "../src/sealed-rest.js";
import { wornFaceWikiBags, type WikiSlotBags } from "../src/register-bags.js";
import { wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";
import { vessel, world, type Vessel } from "./content-key-fixture.js";

const SECRET = "the-margin-holds-the-heron-count";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];   // the Automerge chunk magic
const SLOT: WikiSlotBags = { wikiBagId: wikiBagUri("lares"), workingBagId: wikiSlotUri("lares", "working"), draftBagId: wikiSlotUri("lares", "draft") };

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

/**
 * The vessel's sealed rest, its map composed as the node vessel composes it: the worn face lit, the bags it seals
 * (`wornFaceWikiBags`, every slot bag the resolver named passed as `announced`), and each bag's documents by the names
 * the resolver gave (`slotDocsNamed`).
 */
function standVessel(a: Vessel, inner: StorageAdapterInterface, slotDocsNamed: Map<string, Set<string>>) {
  const own = faceProofSubjectRef(a.chain.scope);
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  const asks = new Map<string, { verb: string; session: Session }>();
  answerDocStoreAsks(islandSide, {
    async seal({ bagId, values, ask, peer }) {
      const booked = asks.get(ask.requestId);
      if (!booked || booked.verb !== ask.verb) return { refusal: "signer-unavailable" } as never;
      return a.holder.sealValues({ bagId, values, signer: booked.session.signer, ...(peer !== undefined ? { peer } : {}) });
    },
    open: (args) => a.holder.openValue(args),
  });
  const map = sealedBagMap({
    face: () => own,
    bags: () => wornFaceWikiBags({ slot: SLOT, lit: true, announced: slotDocsNamed.keys() }).sealed,
    docsOf: (bagId) => [...(slotDocsNamed.get(bagId) ?? [])],
  });
  let repo: Repo | null = null;
  const rest: SealedRest<Session> = composeSealedRest<Session>({
    inner,
    bagOf: (documentId) => map.bagOf(documentId),
    sessionFace: () => own,
    door: vesselDocStoreDoor<Session>(() => vesselSide, {
      book: (ask, verb, session) => { asks.set(ask, { verb, session }); return () => asks.delete(ask); },
      idPrefix: "test",
    }),
    flushRepo: async () => { await repo?.flush(); },
  });
  return { rest, own, map, session: { id: "s-a", subject: own, signer: a.signer } as Session, seat: (r: Repo) => { repo = r; } };
}

/** Name `documentId` as `bagId`'s document, as the vessel's `onSlotNamed` files a resolver's announcement. */
const announce = (named: Map<string, Set<string>>, bagId: string, documentId: string): void => {
  const set = named.get(bagId) ?? new Set<string>();
  set.add(documentId);
  named.set(bagId, set);
};

async function restsSealedUnder(bagId: string) {
  const w = world();
  const a = await vessel(w, "a");
  const inner = memoryAdapter();
  const named = new Map<string, Set<string>>();
  const v = standVessel(a, inner, named);
  const repo = new Repo({ storage: v.rest.store, network: [] });
  v.seat(repo);
  const doc = repo.create<{ note?: string }>();
  // THE NAMING LEADS THE FIRST BYTE: the resolver names the binding before its caller writes.
  announce(named, bagId, doc.documentId);
  v.rest.wrote(doc.documentId, v.session);
  doc.change((d) => { d.note = SECRET; });
  await repo.flush();
  await v.rest.store.flush();
  return { a, inner, named, v, repo, doc };
}

describe("the worn face's resolver names a slot document: it rests sealed under that face", () => {
  it("the mounted wiki's personal margin (wikis/lares/personal): the rest answers sealed, and a save rests a sealed pointer, never clear", async () => {
    const bagId = wikiSlotUri("lares", "personal");
    const { a, inner, named, v, repo, doc } = await restsSealedUnder(bagId);
    expect(v.map.bagOf(doc.documentId), "the map names the personal margin under the worn face").toEqual({ bagId, face: v.own });
    expect(await v.rest.restsSealed(doc.documentId)).toBe(true);
    expect(restsAny(inner, doc.documentId), "the save rested").toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET), "no clear chunk of the margin rests").toBe(false);
    await repo.shutdown();
    // A restart opens it under the same face.
    a.restart();
    const again = standVessel(a, inner, named);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc()).toMatchObject({ note: SECRET });
    await repo2.shutdown();
  });

  it("another wiki's draft binding (wikis/notes/draft), beside the mount slot: it rests sealed too", async () => {
    const bagId = wikiSlotUri("notes", "draft");
    const { inner, v, repo, doc } = await restsSealedUnder(bagId);
    expect(v.map.bagOf(doc.documentId)).toEqual({ bagId, face: v.own });
    expect(await v.rest.restsSealed(doc.documentId)).toBe(true);
    expect(restsAny(inner, doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    await repo.shutdown();
  });

  it("another wiki's personal margin (wikis/notes/personal): sealed as the mount slot's is", async () => {
    const bagId = wikiSlotUri("notes", "personal");
    const { inner, v, repo, doc } = await restsSealedUnder(bagId);
    expect(await v.rest.restsSealed(doc.documentId)).toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(false);
    await repo.shutdown();
  });

  it("CONTROL: another wiki's working layer (its realm workbench, shared across the realm's faces) stays outside this face's seal", async () => {
    const bagId = wikiSlotUri("notes", "working");
    const { inner, v, repo, doc } = await restsSealedUnder(bagId);
    expect(v.map.bagOf(doc.documentId)).toBeNull();
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);
    await repo.shutdown();
  });

  it("CONTROL: a document no resolver named stays unmapped and rests clear, as before", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const v = standVessel(a, inner, new Map());
    const repo = new Repo({ storage: v.rest.store, network: [] });
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    expect(await v.rest.restsSealed(doc.documentId)).toBe(false);
    expect(restsClear(inner, doc.documentId, SECRET)).toBe(true);
    await repo.shutdown();
  });
});

describe("a slot document that already rests clear seals and leaves once the map names it", () => {
  it("the vessel's clear chunks seal and leave rest at the naming (`sealMapped`); an island's clear copy leaves at its guard's first sealed answer", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const inner = memoryAdapter();
    const named = new Map<string, Set<string>>();
    const v = standVessel(a, inner, named);
    const repo = new Repo({ storage: v.rest.store, network: [] });
    v.seat(repo);
    // AN EARLIER BUILD: the margin rested clear on the vessel, and an island synced it and rested its own clear copy.
    const doc = repo.create<{ note?: string }>();
    doc.change((d) => { d.note = SECRET; });
    await repo.flush();
    expect(restsClear(inner, doc.documentId, SECRET), "the setup took: the margin rests clear").toBe(true);
    const islandInner = memoryAdapter();
    const clearCopy = A.save(doc.doc() as A.Doc<unknown>);
    await islandInner.save([doc.documentId, "snapshot", "an-earlier-build"], clearCopy);
    const guard = islandRestGuard(islandInner, (documentId) => v.rest.restsSealed(documentId));
    // THIS BUILD'S BOOT: the resolver names the margin again, and the vessel seals what rested clear.
    announce(named, wikiSlotUri("lares", "personal"), doc.documentId);
    expect(await v.rest.sealMapped(doc.documentId, v.session), "the clear chunks sealed").toBe(true);
    await v.rest.store.flush();
    expect(restsAny(inner, doc.documentId), "the margin still rests, sealed").toBe(true);
    expect(restsClear(inner, doc.documentId, SECRET), "no clear chunk of the margin remains on the vessel").toBe(false);
    // The island's guard asks at its next act on the document, and its clear copy leaves.
    expect(await guard.load([doc.documentId, "snapshot", "an-earlier-build"])).toBeUndefined();
    expect(restsAny(islandInner, doc.documentId), "the island's clear copy left its rest").toBe(false);
    await repo.shutdown();
    a.restart();
    const again = standVessel(a, inner, named);
    const repo2 = new Repo({ storage: again.rest.store, network: [] });
    expect((await repo2.find<{ note?: string }>(doc.documentId as unknown as AutomergeUrl)).doc()).toMatchObject({ note: SECRET });
    await repo2.shutdown();
  });
});
