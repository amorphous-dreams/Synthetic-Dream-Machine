/**
 * sealed-map-before-bytes — a document named for a sealed bag before its first byte maps as the bag map would map it.
 *
 * A vessel's bag map names a document sealed by the names its bag's document carries (a catalog row, a mounted layer, a slot
 * announcement). A document whose bytes arrive before any of those names it (a sibling's draft, synced ahead of its
 * announcement) read as unmapped, and its bytes rested clear. The caller that knows the bag names the document for it first
 * (`nameDocument`): the bag map answers the row a document of that bag takes by the bag alone (`bagRow`), by the same law its
 * `bagOf` reads, and the store maps the named document by that row.
 *
 *   M1  under a lit face, a bag the face wears takes the face's row; a house canon bag and a bag the face does not wear take
 *       none. At the floor, a face-half catalog row takes `face: null`; a public row takes none.
 *   M2  a document named for a sealed bag at the floor: its save waits in memory and lands no byte at rest; once the face
 *       lights it maps under that face. A document named for a clear bag names nothing and saves clear (control).
 *   M3  the clear-name roster reads the same registry: a document a known bag carries (a public catalog row, a house canon bag)
 *       reads named and saves clear; a document no bag carries reads unknown, and its save waits in memory (`save-unnamed`)
 *       until a bag names it, then lands clear.
 *   M5  the saves held unnamed stay bounded: past the bound a further unnamed save refuses by name (`unnamed-bound`).
 *   M6  an unmapped load reads back an unnamed save alone, never a sealed-class save that waits unmapped.
 *   M7  an unnamed row reads `contentFree` only where its held saves are sync states alone (peers' heads, no change); any
 *       held content save, a peer's push among them, keeps it owed. Each row names its bytes and its age in saves the store
 *       took since its first held save, and the age leaves with its last save.
 *   M4  a catalog row alone names a held document at once: the catalog's own change moves the map (`watchCatalogNames`), so
 *       the held save lands clear with no other event.
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { composeSealedRest, documentIdOfUrl, sealedBagMap, watchCatalogNames } from "../src/sealed-rest.js";
import { SealedDocumentStore, UNNAMED_HELD_MAX_SAVES } from "../src/sealed-doc-store.js";
import { tiddlerText } from "../src/base-doc.js";
import { bagUri } from "../src/lar-uris.js";
import { storedLarRecord } from "../src/stored-record.js";
import { houseCanonBagsSeated } from "../src/kahu-canon-reach.js";
import type { LarDoc } from "../src/base-doc.js";

const SEALED_BAG = bagUri("garden-notes");
const PUBLIC_BAG = bagUri("town-square");
const UNWORN_BAG = bagUri("someone-elses-notes");
const NAMED_DOC = "synced-before-its-name";
const CLEAR_DOC = "a-public-notice";
const SECRET = "the-heron-nests-by-the-third-pond";
const join = (k: StorageKey): string => k.join("\0");
const under = (k: string, prefix: StorageKey): boolean => k.split("\0").slice(0, prefix.length).join("\0") === join(prefix);

function fixture(docs: Record<string, string[]> = {}) {
  const bytes = new Map<string, Uint8Array>();
  const inner: StorageAdapterInterface = {
    async load(k) { return bytes.get(join(k)); },
    async save(k, data) { bytes.set(join(k), Uint8Array.from(data)); },
    async remove(k) { bytes.delete(join(k)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => under(k, prefix)).map(([k, data]) => ({ key: k.split("\0"), data })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (under(k, prefix)) bytes.delete(k); },
  };
  // The catalog as the floor reads it: one face-half row and one public row, neither naming the documents below.
  const catalog: LarDoc = { tiddlers: {
    [SEALED_BAG]: storedLarRecord(SEALED_BAG, { text: "automerge:another-document" }, "test"),
    [PUBLIC_BAG]: storedLarRecord(PUBLIC_BAG, { text: "automerge:another-public-document", "cap-tier": "public" }, "test"),
  } } as unknown as LarDoc;
  let face: string | null = null;
  let bags: string[] = [];
  const map = sealedBagMap({ face: () => face, bags: () => bags, catalog: () => catalog, docsOf: (bagId) => docs[bagId] ?? [] });
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const rest = composeSealedRest({ inner, bagOf: map.bagOf, bagRow: map.bagRow, namesClear: map.names, sessionFace: () => face, door: { seal: refuse, open: refuse }, flushRepo: async () => {} });
  return { map, rest, bytes, light() { face = "face:one"; bags = [SEALED_BAG, ...houseCanonBagsSeated()]; rest.store.mapMoved(); } };
}

describe("a document named for a sealed bag before its first byte maps as the bag map would map it", () => {
  test("M1 — the bag map's row by the bag alone follows its own law, at the floor and under a lit face", () => {
    const f = fixture();
    expect(f.map.bagRow(SEALED_BAG)).toEqual({ bagId: SEALED_BAG, face: null });
    expect(f.map.bagRow(PUBLIC_BAG)).toBeNull();
    expect(f.map.bagRow(UNWORN_BAG)).toBeNull();
    f.light();
    expect(f.map.bagRow(SEALED_BAG)).toEqual({ bagId: SEALED_BAG, face: "face:one" });
    for (const canon of houseCanonBagsSeated()) expect(f.map.bagRow(canon)).toBeNull();
    expect(f.map.bagRow(UNWORN_BAG)).toBeNull();
  });

  test("M2 — a named sealed document's save waits in memory and rests nothing, then maps under the face once it lights; a clear bag's document saves clear", async () => {
    const f = fixture();
    expect(f.rest.store.bagOf(NAMED_DOC)).toBeNull();
    expect(f.rest.store.nameDocument(NAMED_DOC, SEALED_BAG)).toBe(true);
    expect(f.rest.store.bagOf(NAMED_DOC)).toEqual({ bagId: SEALED_BAG, face: null });
    expect(await f.rest.restsSealed(NAMED_DOC)).toBe(true);
    await f.rest.store.save([NAMED_DOC, "incremental", "first"], A.save(A.from({ note: SECRET })));
    expect([...f.bytes.keys()].filter((k) => k.startsWith(NAMED_DOC))).toEqual([]);
    expect(f.rest.store.held()).toEqual([{ documentId: NAMED_DOC, refusal: "save-unmapped", saves: 1, bagId: SEALED_BAG }]);
    f.light();
    expect(f.rest.store.bagOf(NAMED_DOC)).toEqual({ bagId: SEALED_BAG, face: "face:one" });

    // CONTROL: a clear bag names nothing, and its document rests as the engine wrote it once a local caller opens it.
    expect(f.rest.store.nameDocument(CLEAR_DOC, PUBLIC_BAG)).toBe(false);
    f.rest.store.solicited(CLEAR_DOC);
    expect(f.rest.store.bagOf(CLEAR_DOC)).toBeNull();
    await f.rest.store.save([CLEAR_DOC, "incremental", "first"], A.save(A.from({ note: "the-market-opens" })));
    expect(f.bytes.has(join([CLEAR_DOC, "incremental", "first"]))).toBe(true);
  });

  test("M3 — the clear-name roster reads the bag registry: a carried document saves clear, an unknown one waits in memory until a bag names it", async () => {
    const docs: Record<string, string[]> = { [PUBLIC_BAG]: [CLEAR_DOC] };
    const f = fixture(docs);
    const canon = houseCanonBagsSeated()[0]!;
    expect(f.map.names(CLEAR_DOC)).toBe(true);
    expect(f.map.names("an-unsolicited-push")).toBe(false);
    await f.rest.store.save([CLEAR_DOC, "incremental", "first"], A.save(A.from({ note: "the-market-opens" })));
    expect(f.bytes.has(join([CLEAR_DOC, "incremental", "first"]))).toBe(true);

    // UNKNOWN MEANS HOLD: no bag carries it, no caller opened it.
    const pushed = A.save(A.from({ note: SECRET }));
    await f.rest.store.save(["an-unsolicited-push", "incremental", "first"], pushed);
    expect([...f.bytes.keys()].filter((k) => k.startsWith("an-unsolicited-push"))).toEqual([]);
    // A content save of an unnamed document stays owed (`contentFree` false), whoever wrote it.
    expect(f.rest.store.held()).toEqual([{ documentId: "an-unsolicited-push", refusal: "save-unnamed", saves: 1, bagId: null, bytes: pushed.byteLength, contentFree: false, heldAcross: 0 }]);
    expect(await f.rest.store.load(["an-unsolicited-push", "incremental", "first"])).toBeDefined();

    // A HOUSE CANON BAG CARRIES IT under a lit face: it maps no seal, the roster names it, and it lands clear at the next move.
    f.light();
    docs[canon] = ["an-unsolicited-push"];
    expect(f.rest.store.bagOf("an-unsolicited-push")).toBeNull();
    expect(f.map.names("an-unsolicited-push")).toBe(true);
    await f.rest.store.reseal();
    expect(f.bytes.has(join(["an-unsolicited-push", "incremental", "first"]))).toBe(true);
    expect(f.rest.store.held()).toEqual([]);
  });

  test("M4 — a catalog row alone names a held document at once: the catalog's change moves the map, and the held save lands clear", async () => {
    const bytes = new Map<string, Uint8Array>();
    const inner: StorageAdapterInterface = {
      async load(k) { return bytes.get(join(k)); },
      async save(k, data) { bytes.set(join(k), Uint8Array.from(data)); },
      async remove(k) { bytes.delete(join(k)); },
      async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => under(k, prefix)).map(([k, data]) => ({ key: k.split("\0"), data })); },
      async removeRange(prefix) { for (const k of [...bytes.keys()]) if (under(k, prefix)) bytes.delete(k); },
    };
    const repo = new Repo({ network: [] });
    const catalog = repo.create<LarDoc>({ tiddlers: {} } as unknown as LarDoc);
    const map = sealedBagMap({
      face: () => null, bags: () => [], catalog: () => catalog.doc() as LarDoc | undefined,
      docsOf: (bagId) => [documentIdOfUrl(tiddlerText(catalog.doc()?.tiddlers?.[bagId]))],
    });
    const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
    const rest = composeSealedRest({ inner, bagOf: map.bagOf, bagRow: map.bagRow, namesClear: map.names, sessionFace: () => null, door: { seal: refuse, open: refuse }, flushRepo: async () => {} });
    const unwatch = watchCatalogNames(catalog, () => rest.store.mapMoved());
    try {
      const HELD = "named-by-a-row-alone";
      await rest.store.save([HELD, "incremental", "first"], A.save(A.from({ note: "a-row-names-me" })));
      expect(rest.store.held().map((h) => h.refusal)).toEqual(["save-unnamed"]);
      // A PUBLIC ROW NAMES IT: no `mapMoved`, no reseal; the catalog's own change carries the release.
      catalog.change((doc) => { (doc.tiddlers as Record<string, unknown>)[PUBLIC_BAG] = storedLarRecord(PUBLIC_BAG, { text: `automerge:${HELD}`, "cap-tier": "public" }, "test"); });
      const end = Date.now() + 5_000;
      while (!bytes.has(join([HELD, "incremental", "first"])) && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
      expect(bytes.has(join([HELD, "incremental", "first"]))).toBe(true);
      expect(rest.store.held()).toEqual([]);
    } finally { unwatch(); await repo.shutdown(); }
  });

  test("M5 — the saves held unnamed stay bounded: past the bound a further unnamed save refuses by name, and nothing rests", async () => {
    const f = fixture();
    const tiny = Uint8Array.of(1);
    for (let i = 0; i < UNNAMED_HELD_MAX_SAVES; i++) await f.rest.store.save([`push-${i}`, "incremental", "x"], tiny);
    let refusal: string | null = null;
    try { await f.rest.store.save(["one-too-many", "incremental", "x"], tiny); } catch (error) { refusal = (error as { refusal?: string }).refusal ?? null; }
    expect(refusal).toBe("unnamed-bound");
    expect(f.bytes.size).toBe(0);
    expect(f.rest.store.waiting()).toBe(UNNAMED_HELD_MAX_SAVES);
  });

  test("M6 — an unmapped load reads an unnamed save back from memory, never a sealed-class save that waits unmapped", async () => {
    const bytes = new Map<string, Uint8Array>();
    const inner: StorageAdapterInterface = {
      async load(k) { return bytes.get(join(k)); },
      async save(k, data) { bytes.set(join(k), Uint8Array.from(data)); },
      async remove(k) { bytes.delete(join(k)); },
      async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => under(k, prefix)).map(([k, data]) => ({ key: k.split("\0"), data })); },
      async removeRange(prefix) { for (const k of [...bytes.keys()]) if (under(k, prefix)) bytes.delete(k); },
    };
    let mapped = true;
    const store = new SealedDocumentStore({
      inner, namesClear: () => false, waitOverSealed: true,
      bagOf: (id) => (mapped && id === "sealed-then-dropped" ? { bagId: SEALED_BAG, face: null } : null),
      sessionFace: () => null, sessionOf: () => null,
      seal: async () => ({ refusal: "signer-unavailable" }) as never, open: async () => ({ refusal: "value-absent" }) as never,
    });
    // A SEALED-CLASS DOCUMENT whose map drops: its save waits unmapped, and an unmapped load never hands it back as clear.
    await store.save(["sealed-then-dropped", "incremental", "a"], A.save(A.from({ note: SECRET })));
    mapped = false;
    await store.save(["sealed-then-dropped", "incremental", "b"], A.save(A.from({ note: SECRET })));
    expect(store.heldRefusalOf("sealed-then-dropped")).toBe("save-unmapped");
    expect(await store.load(["sealed-then-dropped", "incremental", "b"])).toBeUndefined();
    // receipt-roads-hold-alike row 5: the RANGE read keeps the same law, so a sealed-class save waiting unmapped never rides a
    // loadRange back as if it were clear (it did: the waiting walk pushed every entry under the prefix).
    expect((await store.loadRange(["sealed-then-dropped"])).filter((c) => c.key[2] === "b")).toEqual([]);
    // AN UNNAMED SAVE reads back from memory.
    await store.save(["an-unnamed-push", "incremental", "a"], Uint8Array.of(7));
    expect(await store.load(["an-unnamed-push", "incremental", "a"])).toEqual(Uint8Array.of(7));
    expect((await store.loadRange(["an-unnamed-push"])).map((c) => c.data)).toEqual([Uint8Array.of(7)]);
  });

  test("M7 RED — an unnamed row reads content-free only where its sync states alone wait; any held content save, a peer's push among them, keeps it owed; its age leaves with its last save", async () => {
    const f = fixture();
    // A PEER'S CONTENT PUSH: a replica of another actor wrote it, and it still counts as owed (no island keeps a store).
    const PUSH = "a-peers-content-push";
    const pushed = A.save(A.from({ note: "the-peers-own-words" }, { actor: "aa".repeat(16) as A.ActorId }));
    await f.rest.store.save([PUSH, "snapshot", "a"], pushed);
    expect(f.rest.store.held().find((h) => h.documentId === PUSH)).toEqual({ documentId: PUSH, refusal: "save-unnamed", saves: 1, bagId: null, bytes: pushed.byteLength, contentFree: false, heldAcross: 0 });

    // A SYNC STATE ALONE: peers' heads, no change and no checkpoint, so the row reads content-free.
    const HEADS_ONLY = "a-push-whose-sync-state-alone-waits";
    await f.rest.store.save([HEADS_ONLY, "sync-state", "a-peer-storage-id"], Uint8Array.of(0x43, 0x00));
    await f.rest.store.save([HEADS_ONLY, "sync-state", "another-peer-storage-id"], Uint8Array.of(0x43, 0x00));
    expect(f.rest.store.held().find((h) => h.documentId === HEADS_ONLY)).toEqual({ documentId: HEADS_ONLY, refusal: "save-unnamed", saves: 2, bagId: null, bytes: 4, contentFree: true, heldAcross: 1 });

    // A CONTENT SAVE BESIDE ITS SYNC STATE turns the row owed.
    await f.rest.store.save([HEADS_ONLY, "incremental", "b"], A.save(A.from({ note: "content-arrives" })));
    expect(f.rest.store.held().find((h) => h.documentId === HEADS_ONLY)).toMatchObject({ saves: 3, contentFree: false, heldAcross: 2 });

    // THE AGE LEAVES WITH THE LAST SAVE: once named and landed, a later unnamed save of it ages from zero again.
    f.rest.store.solicited(HEADS_ONLY);
    await f.rest.store.reseal();
    expect(f.rest.store.held().find((h) => h.documentId === HEADS_ONLY)).toBeUndefined();
    const AGED = "an-unnamed-doc-that-leaves-and-returns";
    await f.rest.store.save([AGED, "sync-state", "p"], Uint8Array.of(1));
    await f.rest.store.save(["a-save-between", "sync-state", "p"], Uint8Array.of(1));
    expect(f.rest.store.forget([AGED])).toBe(1);
    await f.rest.store.save([AGED, "sync-state", "p"], Uint8Array.of(1));
    expect(f.rest.store.held().find((h) => h.documentId === AGED)).toMatchObject({ saves: 1, heldAcross: 0 });
  });
});
