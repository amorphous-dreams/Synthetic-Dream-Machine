/**
 * actor-ids-disjoint-across-faces.test — the change actor scopes to the FACE that writes (the veil at the wire, road `C1`).
 *
 * Automerge stamps every change with an actor id, and a peer that holds a document decodes every change's actor. The
 * engine mints one actor for each document it loads, so two faces lit in one composition that write ONE document write
 * under one actor: a peer that reads a change it can tie to face A and a change it can tie to face B joins the faces by
 * that actor, whatever store id and peer id each leg presents.
 *
 * The vessel side stands as a vessel stands it: ONE Repo over one store (`wireIdentityOf`), and each face's write through
 * the composition's write door (`WireIdentity.writeAs`). The observer stands a Repo of its own, syncs the document and
 * decodes every change it holds.
 *
 *   A1  RED: two faces lit in one composition write one shared document; the observer decodes disjoint actor sets, and
 *       the floor's writes carry a third
 *   A2  CONTROL: one face writes two documents under two actors, so no actor joins a face's documents (the engine mints one
 *       for each document, and a face-wide actor would join a face across its Nexuses)
 *   A3  CONTROL: one face's writes to one document in one composition carry one actor, in sequence
 *   A4  CONTROL: a composition that stands again mints the face another actor, so a restart over a store that lost a write
 *       a peer already holds merges clean (a stable actor reuses the lost sequence, and the engine refuses the merge)
 *   A5  CONTROL: two devices of one face (two stores) write under two actors
 *   A6  RED: an actor reads as sixteen bytes of hex and names no face
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type DocHandle, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { wireIdentityOf } from "../src/wire-identity.js";

type Doc = { marks: Record<string, number> };
type Identity = ReturnType<typeof wireIdentityOf>;
type WriteAs = (handle: DocHandle<Doc>, face: string | null, change: (doc: Doc) => void) => Promise<void>;

class MemoryStore implements StorageAdapterInterface {
  readonly #rows = new Map<string, { key: StorageKey; data: Uint8Array }>();
  async load(key: StorageKey) { return this.#rows.get(key.join("\u0000"))?.data; }
  async save(key: StorageKey, data: Uint8Array) { this.#rows.set(key.join("\u0000"), { key: [...key], data }); }
  async remove(key: StorageKey) { this.#rows.delete(key.join("\u0000")); }
  async loadRange(prefix: StorageKey): Promise<Chunk[]> { return [...this.#rows.values()].filter((r) => prefix.every((p, i) => r.key[i] === p)); }
  async removeRange(prefix: StorageKey) { for (const [name, r] of [...this.#rows]) if (prefix.every((p, i) => r.key[i] === p)) this.#rows.delete(name); }
}

const FACE_A = "persona-group-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FACE_B = "persona-group-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of cleanups.splice(0).reverse()) await down(); });

/** ONE COMPOSITION over `store`, wearing `worn`, and its write door. A composition that holds no door writes as the
 *  engine writes: under the document's one actor. */
function compose(store: StorageAdapterInterface, worn: string | null) {
  const identity: Identity = wireIdentityOf({ store, face: worn });
  const repo = new Repo({ storage: identity.storage, peerId: identity.peerId, network: [] });
  const door = (identity as { writeAs?: WriteAs }).writeAs;
  const writeAs: WriteAs = door ? (handle, face, change) => door(handle, face, change) : async (handle, _face, change) => { handle.change(change); };
  let stood = true;
  const down = async (): Promise<void> => { if (!stood) return; stood = false; await repo.shutdown(); };
  cleanups.push(down);
  return { identity, repo, writeAs, down };
}

/** The actors that wrote each mark, as any holder of the document decodes them. */
function actorsOf(doc: A.Doc<Doc>): Map<string, { actor: string; seq: number }> {
  const by = new Map<string, { actor: string; seq: number }>();
  for (const change of A.getAllChanges(doc).map((c) => A.decodeChange(c))) {
    for (const op of change.ops as Array<{ key?: unknown }>) if (typeof op.key === "string" && op.key !== "marks") by.set(op.key, { actor: change.actor, seq: change.seq });
  }
  return by;
}

/** An observer's Repo, joined to `vessel` over a message channel: it reads `url` once `mark` reached it. */
async function observed(vessel: Repo, url: DocHandle<Doc>["url"], mark: string): Promise<A.Doc<Doc>> {
  const { port1, port2 } = new MessageChannel();
  const observer = new Repo({ network: [new MessageChannelNetworkAdapter(port2)] });
  cleanups.push(async () => { await observer.shutdown(); port1.close(); port2.close(); });
  vessel.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
  const handle = await observer.find<Doc>(url);
  await vi.waitFor(() => { expect(handle.doc()!.marks[mark]).toBe(1); }, { timeout: 10_000 });
  return handle.doc()!;
}

describe("the change actor scopes to the face that writes", () => {
  test("A1 RED: two faces lit in one composition write one document under disjoint actors, and the floor under a third", async () => {
    const c = compose(new MemoryStore(), FACE_A);
    const shared = c.repo.create<Doc>({ marks: {} });
    await c.writeAs(shared, FACE_A, (d) => { d.marks["a1"] = 1; });
    await c.writeAs(shared, FACE_B, (d) => { d.marks["b1"] = 1; });
    await c.writeAs(shared, FACE_A, (d) => { d.marks["a2"] = 1; });
    await c.writeAs(shared, null, (d) => { d.marks["floor"] = 1; });
    const by = actorsOf(await observed(c.repo, shared.url, "floor"));
    const a = new Set([by.get("a1")!.actor, by.get("a2")!.actor]), b = new Set([by.get("b1")!.actor]);
    expect([...a].filter((actor) => b.has(actor)), "a holder of the document joins two faces by one actor").toEqual([]);
    expect(a.size, "one face writes one document under one actor").toBe(1);
    expect(a.has(by.get("floor")!.actor) || b.has(by.get("floor")!.actor), "the floor writes under a face's actor").toBe(false);
  });

  test("A2 CONTROL: one face writes two documents under two actors", async () => {
    const c = compose(new MemoryStore(), FACE_A);
    const one = c.repo.create<Doc>({ marks: {} }), two = c.repo.create<Doc>({ marks: {} });
    await c.writeAs(one, FACE_B, (d) => { d.marks["b1"] = 1; });
    await c.writeAs(two, FACE_B, (d) => { d.marks["b2"] = 1; });
    expect(actorsOf(two.doc()!).get("b2")!.actor, "one actor joins a face's two documents").not.toBe(actorsOf(one.doc()!).get("b1")!.actor);
  });

  test("A3 CONTROL: one face's writes to one document in one composition carry one actor, in sequence", async () => {
    const c = compose(new MemoryStore(), FACE_A);
    const shared = c.repo.create<Doc>({ marks: {} });
    await c.writeAs(shared, FACE_B, (d) => { d.marks["b1"] = 1; });
    await c.writeAs(shared, FACE_B, (d) => { d.marks["b2"] = 1; });
    const by = actorsOf(shared.doc()!);
    expect(by.get("b2")!.actor).toBe(by.get("b1")!.actor);
    expect(by.get("b2")!.seq).toBe(by.get("b1")!.seq + 1);
  });

  test("A4 CONTROL: a composition that stands again mints the face another actor, so a restart over a lost write merges clean", async () => {
    const store = new MemoryStore();
    const first = compose(store, FACE_A);
    const shared = first.repo.create<Doc>({ marks: {} });
    await first.writeAs(shared, FACE_B, (d) => { d.marks["kept"] = 1; });
    await first.repo.flush();
    // The store rests the document here. The next write reaches a peer and never reaches the store.
    const rested = A.save(shared.doc()!);
    await first.writeAs(shared, FACE_B, (d) => { d.marks["lost"] = 1; });
    const atPeer = A.load<Doc>(A.save(shared.doc()!));
    const before = actorsOf(shared.doc()!).get("lost")!.actor;
    await first.down();
    // The composition stands again over a store that names the same face scope (its secret rests in `store`) and the
    // document as it rested.
    const restarted = compose(store, FACE_A);
    const reloaded = restarted.repo.import<Doc>(rested);
    await restarted.writeAs(reloaded, FACE_B, (d) => { d.marks["after"] = 1; });
    const after = actorsOf(reloaded.doc()!).get("after")!.actor;
    expect(after, "a face's actor repeats across a restart, where a lost write hands its sequence out twice").not.toBe(before);
    const merged = A.merge(atPeer, A.load<Doc>(A.save(reloaded.doc()!)));
    expect(Object.keys(merged.marks).sort()).toEqual(["after", "kept", "lost"]);
  });

  test("A5 CONTROL: two devices of one face write under two actors", async () => {
    const deviceOne = compose(new MemoryStore(), FACE_A), deviceTwo = compose(new MemoryStore(), FACE_A);
    const shared = deviceOne.repo.create<Doc>({ marks: {} });
    await deviceOne.writeAs(shared, FACE_A, (d) => { d.marks["one"] = 1; });
    const copy = deviceTwo.repo.import<Doc>(A.save(shared.doc()!));
    await deviceTwo.writeAs(copy, FACE_A, (d) => { d.marks["two"] = 1; });
    expect(actorsOf(copy.doc()!).get("two")!.actor).not.toBe(actorsOf(shared.doc()!).get("one")!.actor);
  });

  test("A6 RED: an actor reads as sixteen bytes of hex and names no face", async () => {
    const c = compose(new MemoryStore(), FACE_A);
    const shared = c.repo.create<Doc>({ marks: {} });
    const actorOf = (c.identity as { actor?: (face: string | null, documentId: string) => Promise<string> }).actor;
    if (typeof actorOf !== "function") throw new Error("the wire identity derives no actor: a face's writes carry the engine's one actor for the document");
    const actor = await actorOf(FACE_B, shared.documentId);
    expect(actor).toMatch(/^[0-9a-f]{32}$/);
    expect(await actorOf(FACE_B, shared.documentId), "one reading answers one actor within a composition").toBe(actor);
    await c.writeAs(shared, FACE_B, (d) => { d.marks["b1"] = 1; });
    expect(actorsOf(shared.doc()!).get("b1")!.actor).toBe(actor);
    expect(FACE_B.includes(actor) || actor.includes("bbbb"), "the actor spells its face").toBe(false);
  });
});
