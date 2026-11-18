/**
 * stale-base-write-keeps-the-face-actor — a write that names its worn face lands under that face's actor, a stale base
 * included, or refuses by name; it never lands under the engine's actor (Wave 4b lane C; decisions: the stale-base rule
 * under writeAs).
 *
 * The store is the one write path for every bag. A write's origin names the face a session wore (`ChangeOrigin.face`:
 * a PersonaGroup, or null at the veil floor); the store seated with the composition's actor door (`WireIdentity`) writes
 * that change under the actor the face derives for the document. A based write whose base went stale writes at its base
 * (`changeAt` semantics, so a concurrent value stays a conflict) under that same actor. A store that holds no door
 * refuses a write naming a face, by name, and lands nothing.
 *
 * The engine writes a change at a past base under an ISOLATION actor of the writer's own (automerge's `isolate`: a short
 * prefix and a counter ahead of the writer's actor id), so a stale-base change names its writer's actor as that actor's
 * isolation form: `underActor` reads the actor a change's id carries, and `ownsActor` answers the isolation form too.
 *
 *   S1  RED: tool-door-stale-base-write-keeps-the-face-actor-or-refuses: a stale-base write under a worn face lands
 *       under the face's actor, and the concurrent value it never saw stays a conflict
 *   S2  RED: a plain write under a worn face lands under the face's actor, and the document stands again under the
 *       engine's actor
 *   S3  CONTROL: a stale-base write that names no face rides the engine's actor and keeps the conflict
 *   S4  RED: a tombstone under a worn face rides the face's actor
 *   S5  RED: a store with no actor door refuses a write naming a face, plain or stale-base, and lands nothing
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, expect, test, afterEach } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { wireIdentityOf } from "../src/wire-identity.js";
import type { ChangeOrigin, LarTiddlerRecord } from "../src/tiddler-store.js";

class MemoryStore implements StorageAdapterInterface {
  readonly #rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.#rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.#rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.#rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.#rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.#rows]) if (prefix.every((p, i) => r.key[i] === p)) this.#rows.delete(name); }
}

const FACE_A = "persona-group-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BAG = "lar:///ha.ka.ba/wikis/probe/working";
const T = "lar:///ha.ka.ba/probe/worn-write";
const engine: ChangeOrigin = { kind: "lares-verb", requestId: "engine" };
const worn = (face: string | null): ChangeOrigin => ({ kind: "lares-verb", requestId: "worn", face });
const rec = (text: string): LarTiddlerRecord => ({ tiddler: { title: T, text }, meta: {} });

const downs: Array<() => Promise<void>> = [];
afterEach(async () => { for (const down of downs.splice(0).reverse()) await down(); });

/** One composition: a Repo over the wire identity's store, a document, and a store seated with the actor door (or not). */
function stand(door: boolean) {
  const wire = wireIdentityOf({ store: new MemoryStore(), face: FACE_A });
  const repo = new Repo({ storage: wire.storage, peerId: wire.peerId, network: [] });
  downs.push(() => repo.shutdown());
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const store = door ? new AutomergeDocStore(handle, BAG, { wear: wire }) : new AutomergeDocStore(handle, BAG);
  return { wire, handle, store };
}

/** The actors of the changes a write added, read off the document as any holder decodes them. */
function actorsAdded(before: readonly string[], doc: A.Doc<LarDoc>): string[] {
  const held = new Set(before);
  return A.getAllChanges(doc).map((c) => A.decodeChange(c)).filter((c) => !held.has(c.hash)).map((c) => c.actor);
}
/** Whether a change's actor reads as `actor` itself or as its isolation form (the engine's changeAt at a past base). */
const underActor = (written: string | undefined, actor: string): boolean =>
  written === actor || (written !== undefined && written.length > actor.length && written.endsWith(actor));
const hashes = (doc: A.Doc<LarDoc>) => A.getAllChanges(doc).map((c) => A.decodeChange(c).hash!);

describe("a write under a worn face lands under the face's actor, or refuses by name", () => {
  test("S1 RED: tool-door-stale-base-write-keeps-the-face-actor-or-refuses", async () => {
    const { wire, handle, store } = stand(true);
    await store.put(rec("v0"), engine);
    const base = store.headsNow()!;
    await store.put(rec("v1"), engine);
    const engineActor = A.getActorId(handle.doc()!);
    const before = hashes(handle.doc()!);
    await store.put(rec("v2"), worn(FACE_A), { base });
    const added = actorsAdded(before, handle.doc()!);
    const faceActor = await wire.actor(FACE_A, handle.documentId);
    expect(added, "one change lands").toHaveLength(1);
    expect(underActor(added[0], faceActor), `the stale-base write lands under the worn face's actor (wrote ${added[0]}, face ${faceActor})`).toBe(true);
    expect(wire.ownsActor(added[0]!), "the composition derived the actor").toBe(true);
    expect(underActor(added[0], engineActor), `the stale-base write rides the engine's actor (wrote ${added[0]}, engine ${engineActor})`).toBe(false);
    expect(store.parallelDrafts(T).length, "the concurrent value the write never saw stays a conflict").toBeGreaterThan(0);
    expect(A.getActorId(handle.doc()!), "the document stands again under the engine's actor").toBe(engineActor);
  });

  test("S2 RED: a plain write under a worn face lands under the face's actor", async () => {
    const { wire, handle, store } = stand(true);
    await store.put(rec("v0"), engine);
    const engineActor = A.getActorId(handle.doc()!);
    const before = hashes(handle.doc()!);
    await store.put(rec("v1"), worn(FACE_A));
    expect(actorsAdded(before, handle.doc()!)).toEqual([await wire.actor(FACE_A, handle.documentId)]);
    expect(A.getActorId(handle.doc()!)).toBe(engineActor);
    // The veil floor derives an actor of its own, apart from every face and from the engine.
    const floorBefore = hashes(handle.doc()!);
    await store.put(rec("v2"), worn(null));
    const floor = actorsAdded(floorBefore, handle.doc()!);
    expect(floor).toEqual([await wire.actor(null, handle.documentId)]);
    expect(floor[0]).not.toBe(engineActor);
  });

  test("S3 CONTROL: a stale-base write that names no face rides the engine's actor and keeps the conflict", async () => {
    const { handle, store } = stand(true);
    await store.put(rec("v0"), engine);
    const base = store.headsNow()!;
    await store.put(rec("v1"), engine);
    const engineActor = A.getActorId(handle.doc()!);
    const before = hashes(handle.doc()!);
    await store.put(rec("v2"), engine, { base });
    const added = actorsAdded(before, handle.doc()!);
    expect(added).toHaveLength(1);
    expect(underActor(added[0], engineActor), `the based write rides the engine's actor (wrote ${added[0]}, engine ${engineActor})`).toBe(true);
    expect(store.parallelDrafts(T).length).toBeGreaterThan(0);
  });

  test("S4 RED: a tombstone under a worn face rides the face's actor", async () => {
    const { wire, handle, store } = stand(true);
    await store.put(rec("v0"), engine);
    const before = hashes(handle.doc()!);
    await store.tombstone(T, worn(FACE_A));
    expect(actorsAdded(before, handle.doc()!)).toEqual([await wire.actor(FACE_A, handle.documentId)]);
    expect((await store.get(T))?.meta?.deleted).toBe(true);
  });

  test("S5 RED: a store with no actor door refuses a write naming a face, plain or stale-base, and lands nothing", async () => {
    const { handle, store } = stand(false);
    await store.put(rec("v0"), engine);
    const base = store.headsNow()!;
    await store.put(rec("v1"), engine);
    const before = hashes(handle.doc()!);
    await expect(store.put(rec("v2"), worn(FACE_A)), "a plain write naming a face").rejects.toMatchObject({ reason: "worn-face-unwritable" });
    await expect(store.put(rec("v2"), worn(FACE_A), { base }), "a stale-base write naming a face").rejects.toMatchObject({ reason: "stale-base-under-worn-face" });
    expect(hashes(handle.doc()!), "nothing lands under the engine's actor").toEqual(before);
  });
});
