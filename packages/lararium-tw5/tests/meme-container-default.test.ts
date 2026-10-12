import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/container-default";
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const WORKING = wikiSlotUri("daemon", "working");
const BODY = `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/container-default"\n\`\`\`\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>`;
const ctx = (bags: string[]): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "container-default" } as VerbContext["invocation"],
  cap: async (_access, bag) => { bags.push(bag); return { ok: true }; },
});

function rig() {
  const fields = new Map<string, Record<string, unknown>>();
  const wiki = {
    allTitles: () => [...fields.keys()],
    getTiddler: (title: string) => fields.has(title) ? { fields: fields.get(title) } : undefined,
    getTiddlerText: (title: string, fallback = "") => String(fields.get(title)?.["text"] ?? fallback),
    addTiddler: (record: Record<string, unknown>) => fields.set(String(record["title"]), record),
    deleteTiddler: (title: string) => { fields.delete(title); },
  };
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  composite.addLayer({ bagId: WORKING, store: new MemoryTiddlerStore(WORKING), writable: true });
  fields.set(CURRENT_WIKI_BAG, { title: CURRENT_WIKI_BAG, text: WORKING });
  const opts: MemeVerbOptions = { composite, tw5: { $tw: { wiki } } as unknown as MemeVerbOptions["tw5"] };
  return { opts, fields, composite };
}

describe("explicit default meme container", () => {
  test("recipe default and an omitted node-side target select the daemon wiki sink", async () => {
    const omitted = rig();
    const explicit = rig();
    const omittedBags: string[] = [];
    const explicitBags: string[] = [];

    const omittedReceipt = await makeMemePutReactor(omitted.opts)({ uri: URI, text: BODY }, ctx(omittedBags));
    const explicitReceipt = await makeMemePutReactor(explicit.opts)({ recipe: "default", uri: URI, text: BODY }, ctx(explicitBags));

    expect(omittedReceipt["decision"]).toBe("ingest");
    expect(explicitReceipt["decision"]).toBe("ingest");
    expect([...explicit.fields].sort()).toEqual([...omitted.fields].sort());
    expect(explicitBags).toEqual(omittedBags);
    expect(omittedBags).toEqual([WORKING]);
    expect(await omitted.composite.storeForBag(DAEMON_BAG_ID)!.listVisible()).toEqual([]);
    expect(await explicit.composite.storeForBag(DAEMON_BAG_ID)!.listVisible()).toEqual([]);
  });
});
