import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "../src/base-doc.js";
import { mountWikiSlot } from "../src/open-vessel-core.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";
import { floorCanonAddress } from "../src/house-canon-doc.js";

describe("working layer residency", () => {
  test("the host mount routes bagless writes into the working Repo document", async () => {
    const repo = new Repo();
    const wikiHandle = repo.create<LarDoc>(emptyLarDoc());
    const draftHandle = repo.create<LarDoc>(emptyLarDoc());
    const workingHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    const keel = {
      repo,
      catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
      waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<T>,
      tempStore: () => new MemoryTiddlerStore(),
    } as never;

    await mountWikiSlot(
      keel,
      composite,
      { wikiSlug: "host", wikiKey: wikiHandle.url, wikiBagId: wikiBagUri("host"), draftBagId: wikiSlotUri("host", "draft") },
      async () => draftHandle.url,
      async () => workingHandle.url,
      wikiHandle,
    );
    const working = wikiSlotUri("host", "working");
    await composite.put({ tiddler: { title: "lar:///host/hand", text: "landed" } }, { kind: "test" });

    expect(composite.defaultWritableBagId()).toBe(working);
    expect(Object.keys(workingHandle.doc().tiddlers)).toContain("lar:///host/hand");
    expect(Object.keys(wikiHandle.doc().tiddlers)).not.toContain("lar:///host/hand");
  });

  /**
   * HOUSE CANON TAKES NO STAND-IN (offering#/the-canon-offer, "One canon document"). A house canon bag's live document rests in
   * the Kahu realm; a vessel the realm names none to reads the bag's floor snapshot through `@oracle`. So a mount of the `lares`
   * wiki with no realm document named mints no document, lays no canon layer and files no catalog row: no registry row can then
   * answer a door for `bags/lares` beside the realm's standing document. Its slot bindings key on the bag's floor address, one
   * name on every boot.
   */
  async function mountOf(slug: string) {
    const repo = new Repo();
    const draftHandle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
    const keel = { repo, catalogHandle, waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<T>, tempStore: () => new MemoryTiddlerStore() } as never;
    const keyedOn: string[] = [];
    const mount = await mountWikiSlot(
      keel, composite,
      { wikiSlug: slug, wikiKey: `wikis/${slug}`, wikiBagId: wikiBagUri(slug), draftBagId: wikiSlotUri(slug, "draft") },
      async (address) => { keyedOn.push(address); return draftHandle.url; },
      async () => null,
    );
    return { mount, composite, catalogHandle, keyedOn };
  }

  test("the lares wiki mounted with no realm document files no catalog row for bags/lares", async () => {
    const lares = wikiBagUri("lares");
    const first = await mountOf("lares");
    expect(Object.keys(first.catalogHandle.doc()!.tiddlers)).not.toContain(lares);
    expect(first.composite.hasBag(lares)).toBe(false);          // no canon layer: the floor answers through @oracle
    expect(first.mount.wikiHandle).toBeNull();
    // The bindings key on the bag's floor address, the same name on a second boot (a per-boot document would fork them).
    expect(first.keyedOn).toEqual([floorCanonAddress(lares)]);
    expect((await mountOf("lares")).keyedOn).toEqual(first.keyedOn);
  });

  test("CONTROL: a user wiki's first stand mints its canon document and files its catalog row", async () => {
    const garden = wikiBagUri("garden");
    const { mount, composite, catalogHandle, keyedOn } = await mountOf("garden");
    expect(mount.wikiHandle).not.toBeNull();
    expect(tiddlerText(catalogHandle.doc()!.tiddlers[garden])).toBe(mount.wikiHandle!.url);
    expect(composite.hasBag(garden)).toBe(true);
    expect(keyedOn).toEqual([mount.wikiHandle!.url]);
  });
});
