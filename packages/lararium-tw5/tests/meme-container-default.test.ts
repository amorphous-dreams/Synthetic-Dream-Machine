import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import {
  makeMemeDeleteReactor, makeMemeGetReactor, makeMemeListReactor, makeMemeProjectReactor, makeMemePutReactor,
  type MemeVerbOptions,
} from "../src/meme-verbs.js";
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

/** One call of each meme reactor with the given container args; answers the refusals and the caps asked. */
async function refusalsOf(container: Record<string, unknown>): Promise<{ refusals: Array<{ name: string; reason: unknown; message: string }>; caps: string[]; fields: number }> {
  const r = rig();
  const caps: string[] = [];
  const before = r.fields.size;
  const calls: Array<[ReturnType<typeof makeMemePutReactor>, Record<string, unknown>]> = [
    [makeMemePutReactor(r.opts), { uri: URI, text: BODY }],
    [makeMemeGetReactor(r.opts), { uri: URI }],
    [makeMemeListReactor(r.opts), {}],
    [makeMemeDeleteReactor(r.opts), { uri: URI }],
    [makeMemeProjectReactor(r.opts), { uri: URI, to: "md" }],
  ];
  const refusals: Array<{ name: string; reason: unknown; message: string }> = [];
  for (const [reactor, args] of calls) {
    try { await reactor({ ...args, ...container }, ctx(caps)); refusals.push({ name: "", reason: null, message: "(no refusal)" }); }
    catch (error) { const e = error as Error & { reason?: unknown }; refusals.push({ name: e.name, reason: e.reason, message: e.message }); }
  }
  return { refusals, caps, fields: r.fields.size - before };
}

describe("a content verb names its container at the daemon door", () => {
  test("every meme verb refuses a missing container as no-container, before any cap ask, read or write", async () => {
    const { refusals, caps, fields } = await refusalsOf({});
    expect(refusals.map((r) => r.reason)).toEqual(["no-container", "no-container", "no-container", "no-container", "no-container"]);
    for (const r of refusals) {
      expect(r.name).toBe("VerbRefusal");
      expect(r.message).toMatch(/^no-container: meme-(put|get|list|delete|project)/);
      expect(r.message).toContain("recipe");
      expect(r.message).toContain("bag");
    }
    expect(caps, "no cap gets asked").toEqual([]);
    expect(fields, "the wiki takes no write").toBe(0);
  });

  test("every meme verb refuses both containers together under the same code", async () => {
    const { refusals, caps, fields } = await refusalsOf({ recipe: "default", bag: "lares" });
    expect(refusals.map((r) => r.reason)).toEqual(["no-container", "no-container", "no-container", "no-container", "no-container"]);
    expect(caps).toEqual([]);
    expect(fields).toBe(0);
  });

  test("CONTROL: the daemon's own wiki answers to its explicit name and takes the write in its working layer", async () => {
    const explicit = rig();
    const bags: string[] = [];
    const receipt = await makeMemePutReactor(explicit.opts)({ recipe: "default", uri: URI, text: BODY }, ctx(bags));
    expect(receipt["decision"]).toBe("ingest");
    expect(bags).toEqual([WORKING]);
    expect(explicit.fields.has(URI)).toBe(true);
    expect(await explicit.composite.storeForBag(DAEMON_BAG_ID)!.listVisible()).toEqual([]);
    const read = await makeMemeGetReactor(explicit.opts)({ recipe: "default", uri: URI }, ctx(bags));
    expect((read["meme"] as { text?: string } | null)?.text).toContain("container-default");
  });

  test("CONTROL: an explicit bag goes through unchanged", async () => {
    const r = rig();
    const bags: string[] = [];
    const receipt = await makeMemePutReactor(r.opts)({ bag: WORKING, uri: URI, text: BODY }, ctx(bags));
    expect(receipt["decision"]).toBe("ingest");
    expect(bags).toEqual([WORKING]);
    expect((await r.composite.storeForBag(WORKING)!.get(URI))?.tiddler.title).toBe(URI);
  });
});
