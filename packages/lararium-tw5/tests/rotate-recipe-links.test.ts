/**
 * rotate-recipe — a fresh canon, the old one kept as a previous-canon underlay addressed by its own document id and
 * linked to the canon it followed (`rotated-from`). No counter orders the canons: no `canon/vN` address, no
 * `rotation-gen`, no `generation` in the answer.
 */
import { describe, expect, test } from "vitest";
import { emptyLarDoc, recipeUri, storedRecord, wikiBagUri, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { Repo } from "./wiki-shore-rig.js";
import { makeRotateRecipeReactor } from "../src/compaction-handlers.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";

function rig() {
  const repo = new Repo({ network: [] });
  const slug = "garden";
  const wikiKey = wikiBagUri(slug);
  const recipeTitle = recipeUri("catalog", slug);
  const first = repo.create<LarDoc>(emptyLarDoc());
  const catalogDoc = repo.create<LarDoc>(emptyLarDoc());
  catalogDoc.change((d) => {
    d.tiddlers[recipeTitle] = storedRecord({ tiddler: { title: recipeTitle, "bag-stack": `lar:///ha.ka.ba/bags/lararium ${wikiKey}` } });
    d.tiddlers[wikiKey] = storedRecord({ tiddler: { title: wikiKey, text: first.url } });
  });
  const row = (title: string): LarTiddlerRecord | null => {
    const r = catalogDoc.doc()?.tiddlers[title] as LarTiddlerRecord | undefined;
    return r ? JSON.parse(JSON.stringify(r)) as LarTiddlerRecord : null;
  };
  const catalog = {
    handle: async () => catalogDoc,
    urlOf: async (uri: string) => (row(uri)?.tiddler.text as string | undefined) ?? null,
    recordOf: async (title: string) => row(title),
  } as unknown as CatalogAccessor;
  const posted: unknown[] = [];
  const rotate = makeRotateRecipeReactor({ repo, catalog, post: (m: unknown) => { posted.push(m); } } as never);
  return { slug, wikiKey, recipeTitle, first, row, rotate, posted };
}

describe("rotate-recipe names each previous canon by its document id and links the chain", () => {
  test("two rotations: each underlay rides its old doc's id; the second links the first by rotated-from; no counter rides", async () => {
    const r = rig();
    const one = await r.rotate({ slug: r.slug }) as Record<string, unknown>;
    const firstId = r.first.url.replace(/^automerge:/, "");
    expect(one["previousCanonUri"]).toBe(`${r.wikiKey}/canon/${firstId}`);
    expect(one).not.toHaveProperty("generation");
    expect(r.row(r.wikiKey)?.tiddler["rotated-from"]).toBe(one["previousCanonUri"]);
    expect(r.row(one["previousCanonUri"] as string)?.tiddler).not.toHaveProperty("rotated-from");   // the first canon followed none

    const two = await r.rotate({ slug: r.slug }) as Record<string, unknown>;
    const secondId = String(one["newCanonDocUrl"]).replace(/^automerge:/, "");
    expect(two["previousCanonUri"]).toBe(`${r.wikiKey}/canon/${secondId}`);
    // ORDER RIDES THE LINK: the second previous canon names the first as the canon it followed.
    expect(r.row(two["previousCanonUri"] as string)?.tiddler["rotated-from"]).toBe(one["previousCanonUri"]);
    expect(r.row(r.wikiKey)?.tiddler["rotated-from"]).toBe(two["previousCanonUri"]);
    expect(two["stack"]).toEqual(["lar:///ha.ka.ba/bags/lararium", one["previousCanonUri"], two["previousCanonUri"], r.wikiKey]);
    for (const title of [r.wikiKey, r.recipeTitle, one["previousCanonUri"] as string, two["previousCanonUri"] as string]) {
      const fields = r.row(title)?.tiddler ?? {};
      expect(fields).not.toHaveProperty("rotation-gen");
      expect(fields).not.toHaveProperty("rotation");
      expect(JSON.stringify(fields)).not.toMatch(/\/canon\/v\d/);
    }
  });
});
