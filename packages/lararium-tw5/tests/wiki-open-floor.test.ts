import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, wikiBagUri, type LarDoc, type LarTiddlerRecord, type DocHandle } from "@lararium/mesh";
import { makeOpenWikiReactor } from "../src/wiki-mint-handlers.js";
import { ACTIVE_WIKI_URI } from "../src/active-wiki.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const record = (title: string, fields: Record<string, string>): LarTiddlerRecord => ({ tiddler: { title, ...fields } });
function rig(withCanon = true) {
  const key = wikiBagUri("probe-book");
  const tiddlers: Record<string, LarTiddlerRecord> = withCanon ? { [key]: record(key, { text: "automerge:canon" }) } : {};
  const handle = { url: "automerge:catalog", doc: () => ({ tiddlers }), change: (fn: (doc: { tiddlers: typeof tiddlers }) => void) => fn({ tiddlers }), whenReady: async () => {} } as unknown as DocHandle<LarDoc>;
  const catalog: CatalogAccessor = { handle: async () => handle, urlOf: async (uri) => typeof tiddlers[uri]?.tiddler.text === "string" ? tiddlers[uri]!.tiddler.text as string : null, recordOf: async () => null, find: async () => null, storeOf: async () => null };
  // The active-wiki marker rests in the daemon bag, the layer an island's composite carries for it.
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true, defaultWritable: false });
  const posted: unknown[] = [];
  return { catalog, composite, posted, key };
}

describe("open wiki on its floor", () => {
  test("a catalog canon without a recipe opens and sets the active wiki", async () => {
    const r = rig();
    const out = await makeOpenWikiReactor({ catalog: r.catalog, composite: r.composite, post: (message) => { r.posted.push(message); } })({ slug: "probe-book" }, {} as VerbContext);
    expect(out).toMatchObject({ slug: "probe-book", status: "selected-for-next-boot" });
    expect(await r.composite.get(ACTIVE_WIKI_URI)).toMatchObject({ tiddler: { text: "probe-book" } });
  });

  test("an absent catalog canon refuses no-such-bag", async () => {
    const r = rig(false);
    await expect(makeOpenWikiReactor({ catalog: r.catalog, composite: r.composite, post: () => {} })({ slug: "probe-book" }, {} as VerbContext)).rejects.toThrow(/no-such-bag/);
  });

  test("CONTROL: a bag with its standing record opens", async () => {
    const r = rig();
    const key = "lar:///ha.ka.ba/wikis/probe-book/recipe";
    const withRecord: CatalogAccessor = { ...r.catalog, recordOf: async (title) => title === key ? record(key, { "bag-stack": `${r.key} lar:///ha.ka.ba/bags/oracle` }) : null };
    await expect(makeOpenWikiReactor({ catalog: withRecord, composite: r.composite, post: () => {} })({ slug: "probe-book" }, {} as VerbContext)).resolves.toMatchObject({ slug: "probe-book" });
  });
});
