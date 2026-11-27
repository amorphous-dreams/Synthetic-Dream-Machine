import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemeGetReactor, makeMemeListReactor, makeMemeProjectReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeTiddlerDeleteReactor, makeTiddlerPutReactor } from "../src/tiddler-verbs.js";
import { placeMeme, wikiMemeSink } from "../src/place-meme.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/container-default";
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const WORKING = wikiSlotUri("daemon", "working");
const BODY = `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/container-default"\n\`\`\`\n\n` +
  `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>`;
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

/** One call of each content reactor with the given container args; answers the refusals and the caps asked. */
async function refusalsOf(container: Record<string, unknown>): Promise<{ refusals: Array<{ name: string; reason: unknown; message: string }>; caps: string[]; fields: number }> {
  const r = rig();
  const caps: string[] = [];
  const before = r.fields.size;
  const calls: Array<[ReturnType<typeof makeTiddlerPutReactor>, Record<string, unknown>]> = [
    [makeTiddlerPutReactor(r.opts), { title: URI, text: BODY }],
    [makeMemeGetReactor(r.opts), { uri: URI }],
    [makeMemeListReactor(r.opts), {}],
    [makeTiddlerDeleteReactor(r.opts), { title: URI }],
    [makeMemeProjectReactor(r.opts), { uri: URI, to: "md" }],
  ];
  const refusals: Array<{ name: string; reason: unknown; message: string }> = [];
  for (const [reactor, args] of calls) {
    try { await reactor({ ...args, ...container }, ctx(caps)); refusals.push({ name: "", reason: null, message: "(no refusal)" }); }
    catch (error) { const e = error as Error & { reason?: unknown }; refusals.push({ name: e.name, reason: e.reason, message: e.message }); }
  }
  return { refusals, caps, fields: r.fields.size - before };
}

describe("the container law at the daemon door: naming neither reads the daemon wiki", () => {
  test("a content verb naming neither recipe nor bag answers what the explicit recipe default answers: the same caps, the same outcome, never no-container", async () => {
    const neither = await refusalsOf({});
    const explicit = await refusalsOf({ recipe: "default" });
    expect(neither.refusals.map((r) => r.reason)).not.toContain("no-container");
    expect(neither.refusals).toEqual(explicit.refusals);
    expect(neither.caps).toEqual(explicit.caps);
    expect(neither.fields).toBe(explicit.fields);
  });

  test("a realm named alone refuses no-container under every content verb, before any cap ask, read or write", async () => {
    const { refusals, caps, fields } = await refusalsOf({ realm: "a".repeat(64) });
    expect(refusals.map((r) => r.reason)).toEqual(["no-container", "no-container", "no-container", "no-container", "no-container"]);
    for (const r of refusals) {
      expect(r.name).toBe("VerbRefusal");
      expect(r.message).toMatch(/^no-container: (tiddler-(put|delete)|meme-(get|list|project)) realm= names a bag's realm/);
    }
    expect(caps, "no cap gets asked").toEqual([]);
    expect(fields, "the wiki takes no write").toBe(0);
  });

  test("every content verb refuses both containers together under the same code", async () => {
    const { refusals, caps, fields } = await refusalsOf({ recipe: "default", bag: "lares" });
    expect(refusals.map((r) => r.reason)).toEqual(["no-container", "no-container", "no-container", "no-container", "no-container"]);
    expect(caps).toEqual([]);
    expect(fields).toBe(0);
  });

  test("CONTROL: the daemon's own wiki answers to its explicit name", async () => {
    const explicit = rig();
    const bags: string[] = [];
    await placeMeme({ uri: URI, text: BODY }, wikiMemeSink(explicit.opts.tw5.$tw.wiki as never));
    expect(explicit.fields.has(URI)).toBe(true);
    expect(await explicit.composite.storeForBag(DAEMON_BAG_ID)!.listVisible()).toEqual([]);
    const read = await makeMemeGetReactor(explicit.opts)({ recipe: "default", uri: URI }, ctx(bags));
    expect(bags).toEqual([WORKING]);
    expect((read["meme"] as { text?: string } | null)?.text).toContain("container-default");
  });

  test("CONTROL: an explicit bag goes through unchanged", async () => {
    const r = rig();
    const bags: string[] = [];
    const receipt = await makeTiddlerPutReactor(r.opts)({ bag: WORKING, title: URI, text: BODY }, ctx(bags));
    expect(receipt).toMatchObject({ decision: "put", bag: WORKING, layer: "working" });
    expect(bags).toEqual([WORKING]);
    expect((await r.composite.storeForBag(WORKING)!.get(URI))?.tiddler.title).toBe(URI);
  });
});
