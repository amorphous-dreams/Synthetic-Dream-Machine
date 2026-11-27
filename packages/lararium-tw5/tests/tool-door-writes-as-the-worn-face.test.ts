/**
 * tool-door-writes-as-the-worn-face — a tool-door write a session made lands under the actor its worn face derives for the
 * document, and a write no session made rides the engine's actor (Wave 4b lane C, the door; the store seam stands at
 * `lararium-mesh/tests/stale-base-write-keeps-the-face-actor.test.ts`).
 *
 * The session's face reaches the verb as `VerbContext.worn` (its ordinal, its presenter, and the PersonaGroup the vessel's
 * worn face maps the ordinal to). The tiddler door, over a wiki's engine and over a bag's store, names that group on the write's origin
 * (`ChangeOrigin.face`); the tiddler door's record crosses TiddlyWiki's `wiki.addTiddler` hop into the island adaptor,
 * which carries the face onto the save it flushes for that title. The stores carry the composition's actor door
 * (`{ wear }`), so the write lands under the face's actor rather than refusing `worn-face-unwritable`.
 *
 *   T1  RED: tool-door-put-lands-under-the-worn-faces-actor (tiddler-put, through the hop)
 *   T2  RED: tool-door-bag-put-lands-under-the-worn-faces-actor (a family put into a bag the composition holds)
 *   T3  RED: tool-door-two-faces-write-disjoint-actors
 *   T4  CONTROL: tool-door-write-with-no-worn-face-rides-the-engine-actor
 *
 * A real engine boots here (`bootTestWiki`), with the real recipe, the real adaptor and the real bridge.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { wikiBagUri, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { wireIdentityOf } from "@lararium/mesh/wire-identity-door";
import { type DocHandle, type Repo as RepoType, type StorageAdapterInterface } from "@lararium/mesh/automerge";
import { seedDrained } from "../src/island-recipe.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { makeTiddlerPutReactor } from "../src/tiddler-verbs.js";
import type { VerbContext, SessionWorn } from "../src/verb-dispatcher.js";
import { standIslandOverSeed, skipNote, wikiSkip } from "./test-wiki.js";

// THE ENGINE THE MESH LOADS: this package holds no automerge dependency of its own, so the suite reads the mesh's copy.
const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { storage?: StorageAdapterInterface; peerId?: string; network: unknown[] }) => RepoType;
const A = meshRequire("@automerge/automerge") as {
  getAllChanges(doc: LarDoc): Uint8Array[];
  decodeChange(change: Uint8Array): { hash?: string; actor: string };
  getActorId(doc: LarDoc): string;
};
type StorageKey = string[];
type Chunk = { key: StorageKey; data: Uint8Array | undefined };

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
const SLUG = "daemon";
const WORKING = wikiSlotUri(SLUG, "working");
const POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const MEME = "lar:///t/worn-meme";
const memeText = `<<^ code=\`&#x0001;\` from=\`?\` to=\`${MEME}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/worn-meme"\n\`\`\`\n\n` +
  `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const downs: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of downs.splice(0).reverse()) await down(); });

const turns = async (n = 16): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const worn = (group: string): SessionWorn => ({ ordinal: group === FACE_A ? 0 : 1, presenter: `presenter-${group.slice(-4)}`, group });
const ctx = (w?: SessionWorn): VerbContext => ({
  daemon: {} as CompositeStore, invocation: { requestId: `r-${Math.random()}` } as VerbContext["invocation"],
  cap: async () => ({ ok: true }), ...(w ? { worn: w } : {}),
});
const hashes = (h: DocHandle<LarDoc>): Set<string> => new Set(A.getAllChanges(h.doc()!).map((c) => A.decodeChange(c).hash!));
const added = (h: DocHandle<LarDoc>, before: Set<string>): string[] =>
  A.getAllChanges(h.doc()!).map((c) => A.decodeChange(c)).filter((c) => !before.has(c.hash!)).map((c) => c.actor);
const holds = (h: DocHandle<LarDoc>, title: string): boolean => Object.prototype.hasOwnProperty.call(h.doc()!.tiddlers, title);

/** A daemon island over one Repo: the canon slot and the working slot stand as AutomergeDocStores seated with the door. */
async function rig() {
  const wire = wireIdentityOf({ store: new MemoryStore(), face: FACE_A });
  const repo = new Repo({ storage: wire.storage, peerId: wire.peerId, network: [] });
  downs.push(() => repo.shutdown());
  const canon = repo.create<LarDoc>(emptyLarDoc());
  const working = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  const { tw5: engine, adaptor } = await standIslandOverSeed({ composite, recipe: { wikiSlug: SLUG }, ready: [{ slot: wikiBagUri(SLUG), handle: canon }], wear: wire });
  const stop = bridgeWikiToAdaptor(engine, adaptor);
  downs.push(async () => { await adaptor.stop(); stop(); });
  await seedDrained(engine);
  composite.addLayer({ bagId: WORKING, store: new AutomergeDocStore(working, WORKING, { wear: wire }), writable: true, defaultWritable: true }, composite.layerIndexOf(wikiBagUri(SLUG)) + 1);
  await composite.put({ tiddler: { title: POINTER, text: WORKING } }, { kind: "canon-hydrate", receipt: "test-attach" }, { bag: wikiSlotUri(SLUG, "temp") });
  await turns(32);
  await adaptor.boundary().catch(() => {});
  await turns(32);
  const opts = { composite, tw5: engine };
  /** Put one tiddler through the door and wait until the working document holds it. */
  const put = async (title: string, w?: SessionWorn): Promise<string[]> => {
    const before = hashes(working);
    await makeTiddlerPutReactor(opts)({ recipe: "default", title, text: `by ${w?.group ?? "no face"}` }, ctx(w));
    const deadline = Date.now() + 5_000;
    while (!holds(working, title) && Date.now() < deadline) { await adaptor.boundary().catch(() => {}); await turns(8); }
    expect(holds(working, title), `the working document holds ${title}`).toBe(true);
    return added(working, before);
  };
  return { engine, wire, working, composite, opts, put, engineActor: () => A.getActorId(working.doc()!) };
}

describe.skipIf(wikiSkip)(`a tool-door write lands under the worn face's actor${skipNote}`, () => {
  test("T1 RED: tool-door-put-lands-under-the-worn-faces-actor", async () => {
    const r = await rig();
    const actors = await r.put("Worn note", worn(FACE_A));
    expect(actors.length, "the put lands a change").toBeGreaterThan(0);
    expect(new Set(actors), `the put lands under the worn face's actor (engine ${r.engineActor()})`).toEqual(new Set([await r.wire.actor(FACE_A, r.working.documentId)]));
    expect(r.wire.ownsActor(actors[0]!)).toBe(true);
  }, 60_000);

  test("T2 RED: tool-door-bag-put-lands-under-the-worn-faces-actor", async () => {
    const r = await rig();
    const before = hashes(r.working);
    const receipt = await makeTiddlerPutReactor(r.opts)({ bag: WORKING, title: MEME, text: memeText }, ctx(worn(FACE_A)));
    expect(receipt["decision"]).toBe("put");
    const actors = added(r.working, before);
    expect(actors.length).toBeGreaterThan(0);
    expect(new Set(actors), `the bag put lands under the worn face's actor (engine ${r.engineActor()})`).toEqual(new Set([await r.wire.actor(FACE_A, r.working.documentId)]));
  }, 60_000);

  test("T3 RED: tool-door-two-faces-write-disjoint-actors", async () => {
    const r = await rig();
    const a = new Set(await r.put("Note of A", worn(FACE_A)));
    const b = new Set(await r.put("Note of B", worn(FACE_B)));
    expect([...a].filter((actor) => b.has(actor)), "two faces join by one actor").toEqual([]);
    expect(a.has(r.engineActor()) || b.has(r.engineActor()), "a face's write rides the engine's actor").toBe(false);
    expect(b).toEqual(new Set([await r.wire.actor(FACE_B, r.working.documentId)]));
  }, 60_000);

  test("T4 CONTROL: tool-door-write-with-no-worn-face-rides-the-engine-actor", async () => {
    const r = await rig();
    const actors = await r.put("Unworn note");
    expect(new Set(actors)).toEqual(new Set([r.engineActor()]));
    const before = hashes(r.working);
    await makeTiddlerPutReactor(r.opts)({ bag: WORKING, title: MEME, text: memeText }, ctx());
    expect(new Set(added(r.working, before))).toEqual(new Set([r.engineActor()]));
  }, 60_000);
});
