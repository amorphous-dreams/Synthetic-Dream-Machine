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
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { composeSealedRest, sealedBagMap } from "../src/sealed-rest.js";
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

function fixture() {
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
  const map = sealedBagMap({ face: () => face, bags: () => bags, catalog: () => catalog, docsOf: () => [] });
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const rest = composeSealedRest({ inner, bagOf: map.bagOf, bagRow: map.bagRow, sessionFace: () => face, door: { seal: refuse, open: refuse }, flushRepo: async () => {} });
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

    // CONTROL: a clear bag names nothing, and its document rests as the engine wrote it.
    expect(f.rest.store.nameDocument(CLEAR_DOC, PUBLIC_BAG)).toBe(false);
    expect(f.rest.store.bagOf(CLEAR_DOC)).toBeNull();
    await f.rest.store.save([CLEAR_DOC, "incremental", "first"], A.save(A.from({ note: "the-market-opens" })));
    expect(f.bytes.has(join([CLEAR_DOC, "incremental", "first"]))).toBe(true);
  });
});
