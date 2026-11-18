/**
 * tree-boot-set — the boot set the NEXT bake carries, read off the tree, boots the island engine on both host paths with the stock
 * theme, the house palette and the wiki's own default story. The isomorphic witness on the node side: the mirror's page suite
 * (`lararium-web/tests/glass-theme.page.test.ts`) reads the same blobs through the glass inputs.
 *
 * ── WHY THE TREE AND NOT THE GENESIS CAS ─────────────────────────────────────────────────────────
 * The stock themes and the trued palette pointer ride packed plugin files the controller bakes (genesis/unbaked.json declares
 * the gap). A suite over the committed CAS reads the last bake; this suite reads every top-level `.json` of
 * `packages/lararium-tw5/plugins/` (the bake's own packed set, `genesisPackedPluginFiles`) through the same `preloadsFromCasBlob`
 * the kernel calls, beside the engine blob the genesis CAS already carries (the core did not move).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { genesisCoreBlob, genesisNote, genesisSkip, type EnginePath } from "./genesis-boot.harness.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { preloadsFromCasBlob } from "../src/cas-preloads.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { openDefaultStory } from "../src/default-story.js";
import { TW5_PAGE_STYLESHEET } from "../src/tw5-camera.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PLUGINS = path.resolve(HERE, "..", "plugins");
const BAGS = path.resolve(HERE, "..", "..", "..", "bags");
const STOCK = new Set(["tiddlywiki-vanilla.json", "tiddlywiki-snowwhite.json"]);

/** The bake's packed set: every top-level `.json` of the plugins directory, sorted by name; `dropStock` withholds the stock themes. */
function treePreloads(dropStock = false): Record<string, unknown>[] {
  return readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !(dropStock && STOCK.has(entry.name)))
    .map((entry) => entry.name).sort()
    .flatMap((name) => preloadsFromCasBlob(new Uint8Array(readFileSync(path.join(PLUGINS, name)))));
}

/** A canon carrier's records, read through the grammar's own deserializer, as a bag lands them. */
function canonRecords(relative: string, uri: string): Array<Record<string, string | string[]>> {
  return memeticWikitextDeserializer(readFileSync(path.join(BAGS, relative), "utf8"), { title: uri })
    .map((record) => Object.fromEntries(Object.entries(record).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : String(v)])));
}

async function boot(enginePath: EnginePath, dropStock = false): Promise<TW5Engine> {
  const g = globalThis as Record<string, unknown>;
  const lend = enginePath === "browser-worker" && g["WorkerGlobalScope"] === undefined;
  if (lend) g["WorkerGlobalScope"] = {};
  try {
    const engine = new TW5Engine();
    await engine.boot(genesisCoreBlob(), treePreloads(dropStock));
    return engine;
  } finally { if (lend) delete g["WorkerGlobalScope"]; }
}

interface Wiki {
  isShadowTiddler(title: string): boolean; tiddlerExists(title: string): boolean;
  renderTiddler(type: string, title: string): string; getTiddlerList(title: string): string[];
}
const wikiOf = (engine: TW5Engine): Wiki => engine.$tw.wiki as unknown as Wiki;
const PALETTE = "lar:///ha.ka.ba/lararium/tw5/palette/gruvbox-dark";
const WELCOME = "lar:///ha.ka.ba/lares/docs/welcome";

describe.skipIf(genesisSkip)(`the tree's boot set${genesisNote}`, () => {
  const engines: TW5Engine[] = [];
  afterEach(() => { for (const e of engines.splice(0)) e.dispose(); });

  for (const enginePath of ["node", "browser-worker"] as const) {
    test(`${enginePath}: the stock vanilla theme resolves as a shadow and its sheet styles the sidebar; CONTROL: withheld, neither stands`, async () => {
      const engine = await boot(enginePath); engines.push(engine);
      const wiki = wikiOf(engine);
      expect(wiki.isShadowTiddler("$:/themes/tiddlywiki/vanilla/base")).toBe(true);
      expect(wiki.isShadowTiddler("$:/themes/tiddlywiki/snowwhite/base")).toBe(true);
      expect(wiki.renderTiddler("text/plain", TW5_PAGE_STYLESHEET)).toMatch(/\.tc-sidebar-scrollable\s*\{/);
      const bare = await boot(enginePath, true); engines.push(bare);
      expect(wikiOf(bare).isShadowTiddler("$:/themes/tiddlywiki/vanilla/base")).toBe(false);
      expect(wikiOf(bare).renderTiddler("text/plain", TW5_PAGE_STYLESHEET)).not.toMatch(/\.tc-sidebar-scrollable\s*\{/);
    }, 120_000);
  }

  test("the palette pointer names the carrier's dictionary slot, and the sheet reads #282828 once the carrier lands; CONTROL: before it lands, no gruvbox colour", async () => {
    const engine = await boot("node"); engines.push(engine);
    const wiki = wikiOf(engine);
    expect(engine.$tw.wiki.getTiddlerText("$:/palette")).toBe(`${PALETTE}#/palette`);
    expect(wiki.renderTiddler("text/plain", TW5_PAGE_STYLESHEET)).not.toContain("#282828");
    for (const record of canonRecords("lararium/ha.ka.ba/lararium/tw5/palette/gruvbox-dark.mem", PALETTE)) engine.setTiddler(record);
    expect(engine.$tw.wiki.getTiddler(`${PALETTE}#/palette`)?.fields["type"]).toBe("application/x-tiddler-dictionary");
    expect(wiki.renderTiddler("text/plain", TW5_PAGE_STYLESHEET)).toContain("#282828");
  }, 120_000);

  test("the island boots with no story; the story opens on the wiki's own landing at its first snapshot; CONTROL: with no landing, the stock fallback", async () => {
    const engine = await boot("node"); engines.push(engine);
    const wiki = wikiOf(engine);
    // RED before the cure: TW5's own story startup opened GettingStarted inside boot.
    expect(wiki.tiddlerExists("$:/StoryList")).toBe(false);
    for (const record of canonRecords("lares/ha.ka.ba/lares/docs/welcome.mem", WELCOME)) engine.setTiddler(record);
    expect(openDefaultStory(engine.$tw as never)).toEqual([WELCOME]);
    expect(wiki.getTiddlerList("$:/StoryList")).toEqual([WELCOME]);
    // A story that landed (a personal StoryList) stays.
    engine.setTiddler({ title: "$:/StoryList", list: "Kept" });
    expect(openDefaultStory(engine.$tw as never, { keepLanded: true })).toBeNull();
    expect(wiki.getTiddlerList("$:/StoryList")).toEqual(["Kept"]);
    const bare = await boot("node"); engines.push(bare);
    expect(openDefaultStory(bare.$tw as never)).toEqual(["GettingStarted"]);
  }, 120_000);
});
