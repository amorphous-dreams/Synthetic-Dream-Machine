import { describe, expect, test } from "vitest";
import { memoryControlStore } from "./control-store-fixture.js";
import { CompositeStore, NoWorkingLayerRefusal, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import type { DocHandle, LarDoc, LarTiddlerRecord, Repo } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { fileWardRefusal, makeWhereReactor } from "../src/worker-data-verbs.js";

const SLUG = "mounted-canon";
const TITLE = "working-note";
const CANON = wikiBagUri(SLUG);
const WORKING = wikiSlotUri(SLUG, "working");
const CATALOG_URL = "automerge:catalog";
const CANON_URL = "automerge:canon";
const WORKING_URL = "automerge:working";

const record = (title: string, text: string): LarTiddlerRecord => ({
  tiddler: { title, text },
});

function handle(doc: LarDoc): DocHandle<LarDoc> {
  return { doc: () => doc } as unknown as DocHandle<LarDoc>;
}

function repoFor(docs: Map<string, DocHandle<LarDoc>>): Repo {
  return {
    find: async (url: string) => {
      const found = docs.get(url);
      if (!found) throw new Error(`missing test document: ${url}`);
      return found;
    },
  } as unknown as Repo;
}

describe("where — registered wiki slot membership", () => {
  test("reports a populated working slot when the canon bag is already mounted", async () => {
    const catalog = handle({
      schemaVersion: "0.1",
      tiddlers: {
        [CANON]: record(CANON, CANON_URL),
      },
    });
    const canon = handle({
      schemaVersion: "0.1",
      tiddlers: {
        [TITLE]: record(TITLE, "canon copy"),
      },
    });
    const working = handle({
      schemaVersion: "0.1",
      tiddlers: {
        [TITLE]: record(TITLE, "working copy"),
      },
    });
    const docs = new Map([
      [CATALOG_URL, catalog],
      [CANON_URL, canon],
      [WORKING_URL, working],
    ]);

    const composite = new CompositeStore();
    const canonStore = new MemoryTiddlerStore(CANON);
    canonStore._seed(record(TITLE, "canon copy"));
    composite.addLayer({ bagId: CANON, store: canonStore, writable: false });

    const where = makeWhereReactor(composite, {
      repo: repoFor(docs),
      catalogUrl: CATALOG_URL,
      oracleUrl: null,
      slotDocUrl: async (_slug, kind) => kind === "working" ? WORKING_URL : null,
    });

    const result = await where({ tiddler: TITLE });

    expect(result.bags).toEqual([CANON, WORKING]);
    // `where` reports membership. Its convenience primary is the first holder,
    // and does not claim the recipe's cascade winner.
    expect(result.primaryBag).toBe(CANON);
  });
});

describe("disk ward audit control-home route", () => {
  test("the audit rests in the control document, never in a wiki layer, and refuses by name without one", async () => {
    const composite = new CompositeStore();
    const canon = new MemoryTiddlerStore(CANON);
    const working = new MemoryTiddlerStore(WORKING);
    composite.addLayer({ bagId: CANON, store: canon, writable: true, defaultWritable: false });
    composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const control = memoryControlStore();
    const result = await fileWardRefusal(composite, control, () => {}, { bagId: CANON, uri: "lar:///ward/test", reason: "test" });
    const audit = String(result.audited);
    expect(await control.get(audit)).not.toBeNull();
    expect(await working.get(audit)).toBeNull();
    expect(await canon.get(audit)).toBeNull();
    expect(audit).toContain("/bags/control/ledger/ward/");

    const unmounted = new CompositeStore();
    await expect(fileWardRefusal(composite, unmounted, () => {}, { bagId: CANON, uri: "lar:///ward/test", reason: "test" }))
      .rejects.toBeInstanceOf(NoWorkingLayerRefusal);
  });

  test("audit address is unique without reading wall time", async () => {
    const composite = new CompositeStore();
    const control = memoryControlStore();
    const first = await fileWardRefusal(composite, control, () => {}, { bagId: CANON, uri: "lar:///ward/test", reason: "test" });
    const second = await fileWardRefusal(composite, control, () => {}, { bagId: CANON, uri: "lar:///ward/test", reason: "test" });
    expect(String(first.audited)).toMatch(/\/ledger\/ward\/[0-9a-f-]{36}$/);
    expect(first.audited).not.toBe(second.audited);
  });
});
