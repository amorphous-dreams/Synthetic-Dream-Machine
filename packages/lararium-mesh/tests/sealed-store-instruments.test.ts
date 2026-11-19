/**
 * sealed-store-instruments — A SAVE OR A LOAD THE SEALED REST HOLDS BACK NAMES WHY.
 *
 * Three instruments, each read both ways:
 *   · a save the holder refused (`save-unsealed`) tells `onHeld` the holder's own refusal and its cause, never a bare word;
 *   · a hydrating load that waits tells `onHydrationWait`, once per document, which refusal it waits on and which bag holds it;
 *   · a vessel-held home whose key has not opened (`locked`) refuses `holder-locked` by name: at once where the store does
 *     not hydrate, and named while it waits where it does, opening once the key stands (the restart this wait exists for).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge";
import { faceProofSubjectRef } from "../src/face-proof-subjects.js";
import { composeSealedRest } from "../src/sealed-rest.js";
import { mintHeldRestKey } from "../src/held-rest-key.js";
import { vesselHeldHomes } from "../src/secret-home.js";
import { CONTROL_HOME_ID } from "../src/lar-uris.js";
import { vessel, world } from "./content-key-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";

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
const unsettled = Symbol("unsettled");
const settledWithin = <T>(p: Promise<T>, ms = 300): Promise<T | typeof unsettled> =>
  Promise.race([p, new Promise<typeof unsettled>((done) => setTimeout(() => done(unsettled), ms))]);

describe("a save the holder refused names the holder's refusal and its cause", () => {
  it("`save-unsealed` reaches onHeld with the refusal and the cause the door gave", async () => {
    const w = world();
    const a = await vessel(w, "a");
    const own = faceProofSubjectRef(a.chain.scope);
    const held: { refusal: string; error?: string; cause?: string }[] = [];
    const rest = composeSealedRest<{ id: string; subject: string }>({
      inner: memoryAdapter(), bagOf: () => ({ bagId: BAG, face: own }), sessionFace: () => own,
      door: { seal: async () => ({ refusal: "writer-not-capable", cause: "the face registers no such bag" }) as never, open: (args) => a.holder.openValue(args) },
      flushRepo: async () => {},
      onHeld: (h) => held.push(h as never),
    });
    const doc = A.change(A.init<{ note?: string }>(), (d) => { d.note = "x"; });
    rest.book.book("2MZ5fCHpbqBkTqmhQ8Gm4hTJ5cDS", { id: "s", subject: own });
    await rest.store.save(["2MZ5fCHpbqBkTqmhQ8Gm4hTJ5cDS", "incremental", "k"], A.save(doc));
    expect(held).toEqual([{ refusal: "save-unsealed", documentId: "2MZ5fCHpbqBkTqmhQ8Gm4hTJ5cDS", error: "writer-not-capable", cause: "the face registers no such bag" }]);
  });

  it("CONTROL: a save no session booked names `save-unbooked` alone, with no holder refusal", async () => {
    const own = "face-subject";
    const held: unknown[] = [];
    const rest = composeSealedRest<{ id: string; subject: string }>({
      inner: memoryAdapter(), bagOf: () => ({ bagId: BAG, face: own }), sessionFace: () => own,
      door: { seal: async () => { throw new Error("never asked"); }, open: async () => { throw new Error("never asked"); } },
      flushRepo: async () => {}, onHeld: (h) => held.push(h),
    });
    await rest.store.save(["2MZ5fCHpbqBkTqmhQ8Gm4hTJ5cDS", "incremental", "k"], A.save(A.change(A.init<{ n?: number }>(), (d) => { d.n = 1; })));
    expect(held).toEqual([{ refusal: "save-unbooked", documentId: "2MZ5fCHpbqBkTqmhQ8Gm4hTJ5cDS" }]);
  });
});

describe("a vessel-held home whose key has not opened refuses `holder-locked`, and a hydrating wait names it once", () => {
  /** A held home resting sealed under its vessel's key, then a rest over the same store whose key has not opened. */
  const standHome = async () => {
    const inner = memoryAdapter();
    const key = mintHeldRestKey();
    const open = vesselHeldHomes();
    const writing = composeSealedRest({ inner, bagOf: (id) => open.bagOf(id) as never, sessionFace: () => null, door: { seal: async () => { throw new Error("no"); }, open: async () => { throw new Error("no"); } }, flushRepo: async () => {} });
    const repo = new Repo({ storage: writing.store, network: [] });
    const doc = repo.create<{ note?: string }>({ note: "control rows" });
    const openRest = open.rest(async () => false);
    openRest.enroll("secret-home-of-the-test", key);
    openRest.enrollBeside?.(doc.documentId, CONTROL_HOME_ID);
    doc.change((d) => { d.note = "control rows, sealed"; });
    await repo.flush();
    await repo.shutdown();
    return { inner, key, documentId: doc.documentId, url: doc.url };
  };

  it("a store that does not hydrate refuses a locked home's load at once, by name", async () => {
    const { inner, documentId } = await standHome();
    const homes = vesselHeldHomes();
    homes.rest(async () => true).enrollBeside?.(documentId, CONTROL_HOME_ID);
    const rest = composeSealedRest({ inner, bagOf: (id) => homes.bagOf(id) as never, sessionFace: () => null, door: { seal: async () => { throw new Error("no"); }, open: async () => { throw new Error("no"); } }, flushRepo: async () => {} });
    const chunks = await inner.loadRange([documentId]);
    expect(chunks.length).toBeGreaterThan(0);
    await expect(rest.store.load(chunks[0]!.key)).rejects.toMatchObject({ refusal: "holder-locked" });
  });

  it("a hydrating store waits on the locked home, names the refusal and the bag once, and opens once the key stands", async () => {
    const { inner, key, documentId } = await standHome();
    const homes = vesselHeldHomes();
    const homeRest = homes.rest(async () => true);
    let moved: () => void = () => {};
    const waits: { documentId: string; refusal: string; bagId: string | null }[] = [];
    const rest = composeSealedRest({
      inner, bagOf: (id) => homes.bagOf(id) as never, sessionFace: () => null,
      door: { seal: async () => { throw new Error("no"); }, open: async () => { throw new Error("no"); } },
      flushRepo: async () => {}, hydrates: true,
      onHydrationWait: (w: { documentId: string; refusal: string; bagId: string | null }) => waits.push(w),
    } as never);
    moved = () => rest.store.mapMoved();
    homeRest.enrollBeside?.(documentId, CONTROL_HOME_ID);
    const chunks = await inner.loadRange([documentId]);
    const first = rest.store.load(chunks[0]!.key);
    const second = rest.store.load(chunks[0]!.key);
    expect(await settledWithin(first), "the load waits while the key stays shut").toBe(unsettled);
    moved();
    expect(await settledWithin(second)).toBe(unsettled);
    expect(waits, "named once for the document, with its refusal and its bag").toEqual([{ documentId, refusal: "holder-locked", bagId: CONTROL_HOME_ID }]);
    // THE KEY OPENS (custody unlocked): the secret home's enroll stands the vessel's key, and the map moves.
    homeRest.enroll("secret-home-of-the-test", key);
    moved();
    await expect(first).resolves.toBeInstanceOf(Uint8Array);
    await expect(second).resolves.toBeInstanceOf(Uint8Array);
  });
});

void ({} as AutomergeUrl);
