import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { mountWikiSlot } from "../src/open-vessel-core.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";

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
});
