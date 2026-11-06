/**
 * catalog-before-seal-map — a sealed bag's document never loads clear, before its face lights or after.
 *
 * The sealing scope (stable-founding-road #/rulings, 2026-11-06): every wiki content store rests sealed, and the floor
 * catalog (`F`) names public bags alone ("The catalog splits by face"). The vessel's bag map named a document sealed only
 * once a face lit and wore its bag, so a catalog row on a face's half (`catalogRowHalf`: a user bag, a wiki) read as
 * unmapped before any face lit, and its document passed to the engine and to rest in the clear. The cure: with no face
 * lit, a face-half row's document reads sealed with no face; its load refuses by name (`session-absent`, a hydration
 * wait where the vessel grants one) and its save waits in memory. Only a public row (`cap-tier = public`) loads clear at
 * the floor.
 *
 *   R6a RED: a sealed bag's document the catalog names before any face lights reaches neither the engine nor rest in
 *            clear: its load refuses by name, and its save lands no byte at rest.
 *   R6b CONTROL: a public floor bag's document loads clear at the floor.
 *   R6c CONTROL: once its face lights and the map moves, the same document opens for that face.
 *   R6d RED (static): both vessel shores hand their bag map the catalog they read. The wiring stands on the face cell
 *        reading the proved face (`@lararium/node` tests/e2e/face-cell-lights-proved): a faced vessel with no dial lights
 *        its face at its own place, so its own wiki's rows map under that face, never `face: null`.
 *
 * No patience is granted and no clock waits: every load answers at once, by bytes or by a refusal's name.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b, red 6)
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { composeSealedRest, sealedBagMap, documentIdOfUrl } from "../src/sealed-rest.js";
import { bagUri } from "../src/lar-uris.js";
import { storedLarRecord } from "../src/stored-record.js";
import { ownEntry } from "../src/stored-value.js";
import { tiddlerText, type LarDoc } from "../src/base-doc.js";

const SEALED_BAG = bagUri("garden-notes");
const PUBLIC_BAG = bagUri("town-square");
const SEALED_DOC = "sealed-catalog-document";
const PUBLIC_DOC = "public-catalog-document";
const SECRET = "the-heron-nests-by-the-third-pond";
const NOTICE = "the-market-opens-at-the-second-bell";
const sealedClear = A.save(A.from({ note: SECRET }));
const publicClear = A.save(A.from({ note: NOTICE }));
const join = (k: StorageKey): string => k.join("\0");
const under = (k: string, prefix: StorageKey): boolean => k.split("\0").slice(0, prefix.length).join("\0") === join(prefix);

function fixture() {
  const bytes = new Map<string, Uint8Array>([
    [join([SEALED_DOC, "snapshot", "first"]), sealedClear],
    [join([PUBLIC_DOC, "snapshot", "first"]), publicClear],
  ]);
  const inner: StorageAdapterInterface = {
    async load(k) { return bytes.get(join(k)); },
    async save(k, data) { bytes.set(join(k), Uint8Array.from(data)); },
    async remove(k) { bytes.delete(join(k)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => under(k, prefix)).map(([k, data]) => ({ key: k.split("\0"), data })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (under(k, prefix)) bytes.delete(k); },
  };
  // The catalog as the floor reads it before any face lights: one face-half row, one public row.
  const catalog: LarDoc = { tiddlers: {
    [SEALED_BAG]: storedLarRecord(SEALED_BAG, { text: `automerge:${SEALED_DOC}` }, "test"),
    [PUBLIC_BAG]: storedLarRecord(PUBLIC_BAG, { text: `automerge:${PUBLIC_DOC}`, "cap-tier": "public" }, "test"),
  } } as unknown as LarDoc;
  let face: string | null = null;
  let bags: string[] = [];
  const map = sealedBagMap({
    face: () => face, bags: () => bags, catalog: () => catalog,
    docsOf: (bagId) => [documentIdOfUrl(tiddlerText(ownEntry(catalog.tiddlers, bagId)))],
  } as Parameters<typeof sealedBagMap>[0]);
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const rest = composeSealedRest({ inner, bagOf: map.bagOf, sessionFace: () => face, door: { seal: refuse, open: refuse }, flushRepo: async () => {} });
  return { rest, bytes, light() { face = "face:one"; bags = [SEALED_BAG]; rest.store.mapMoved(); } };
}

/** What a load answers, at once: the bytes it handed the engine, or the refusal it named. */
async function answer<T>(load: Promise<T>): Promise<{ readonly bytes: T } | { readonly refusal: string }> {
  try { return { bytes: await load }; }
  catch (e) { return { refusal: (e as { refusal?: string }).refusal ?? String(e) }; }
}

describe("a sealed bag's catalog row before its face lights", () => {
  test("R6a RED: its document reaches neither the engine nor rest in clear: the load refuses by name, the save lands nothing", async () => {
    const f = fixture();
    const before = new Map(f.bytes);
    const range = await answer(f.rest.store.loadRange([SEALED_DOC]));
    expect(range, "a sealed bag's clear bytes reached the engine before its face lit").not.toHaveProperty("bytes");
    expect(range).toEqual({ refusal: "session-absent" });
    expect(await answer(f.rest.store.load([SEALED_DOC, "snapshot", "first"]))).toEqual({ refusal: "session-absent" });
    await f.rest.store.save([SEALED_DOC, "incremental", "next"], sealedClear);
    expect(f.bytes, "a sealed bag's save landed clear at rest before its face lit").toEqual(before);
    expect(f.rest.store.waiting(SEALED_DOC)).toBe(1);
  });

  test("R6b CONTROL: a public floor bag's document loads clear at the floor", async () => {
    const f = fixture();
    const chunks = await f.rest.store.loadRange([PUBLIC_DOC]);
    expect(A.load<{ note: string }>(chunks[0]!.data!).note).toBe(NOTICE);
  });

  test("R6c CONTROL: once its face lights and the map moves, the document opens for that face", async () => {
    const f = fixture();
    f.light();
    const chunks = await f.rest.store.loadRange([SEALED_DOC]);
    expect(A.load<{ note: string }>(chunks[0]!.data!).note).toBe(SECRET);
  });

  test("R6d RED: both vessel shores hand their bag map the catalog they read", () => {
    for (const rel of ["../../lararium-node/src/open-node-vessel.ts", "../../lararium-browser/src/open-browser-vessel.ts"]) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      const call = src.slice(src.indexOf("sealedBagMap({"), src.indexOf("sealedBagMap({") + 600);
      expect(call, `${rel} composes a bag map`).toMatch(/^sealedBagMap\(\{/);
      expect(call, `${rel} hands its bag map the catalog`).toMatch(/\bcatalog:\s*\(\)\s*=>/);
    }
  });
});
