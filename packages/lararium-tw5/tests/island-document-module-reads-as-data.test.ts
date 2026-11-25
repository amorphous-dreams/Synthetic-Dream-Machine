/**
 * island-document-module-reads-as-data — what the server-side island runs as code, and what it holds as data
 * (lar:///ha.ka.ba/kahua/memory/research/ground-island-boot #/witness).
 *
 * W1: a module, script or plugin record the wiki's document lands reads as data on the island: its text stands, the
 * module table never names it, and nothing it says runs. The island's code comes from the floor-admitted preloads alone
 * (a granted `library` module defines, the CONTROL).
 *
 * W2: a `$:/tags/StartupAction` record the wiki's document lands never runs on the island, whatever the wiki's slug; it
 * runs in the tab alone, as native TW5 runs a store's startup actions. A StartupAction a floor-admitted plugin carries
 * still runs, once, at the engine's own boot pass (the CONTROL).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompositeStore, emptyLarDoc, wikiSlotUri, type DocHandle, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { createHash } from "node:crypto";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, houseSkins, skinPins, skipNote, vendoredCore, wikiSkip } from "./test-wiki.js";

function handleOver(records: readonly LarTiddlerRecord[]): DocHandle<LarDoc> {
  const doc = emptyLarDoc();
  for (const r of records) (doc.tiddlers as Record<string, LarTiddlerRecord>)[r.tiddler.title] = r;
  return {
    url: "automerge:island-document-seed",
    doc: () => doc,
    heads: () => [],
    view: () => ({ doc: () => doc }),
    on: () => {},
    change: (fn: (d: LarDoc) => void) => fn(doc),
  } as unknown as DocHandle<LarDoc>;
}

async function seedInto(engine: TW5Engine, slug: string, records: readonly LarTiddlerRecord[]): Promise<void> {
  buildIslandRecipe({ tw5: engine, composite: new CompositeStore(), recipe: { wikiSlug: slug }, ready: [{ slot: wikiSlotUri(slug, "working"), handle: handleOver(records) }] });
  await seedDrained(engine);
}

const count = (probe: string): string => `<$action-setfield $tiddler="${probe}" text={{{ [{${probe}}else[0]add[1]] }}}/>`;

describe.skipIf(wikiSkip)(`the island holds a document's code as data${skipNote}`, () => {
  let engine: TW5Engine | undefined;
  afterEach(() => { engine?.dispose(); engine = undefined; });

  test("W1: a document module, filter operator and plugin read as data; CONTROL a granted library preload defines", async () => {
    const MOD = "lar:///t/doc/mod", OP = "lar:///t/doc/op", PLUGIN = "lar:///t/doc/plugin", RAN = "$:/temp/doc-mod-ran";
    const modText = `exports.probe = function(){ $tw.wiki.addTiddler({title:'${RAN}', text:'ran'}); };`;
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: MOD, type: "application/javascript", "module-type": "library", text: modText } },
      { tiddler: { title: OP, type: "application/javascript", "module-type": "filteroperator", text: `exports.docprobe = function(){ $tw.wiki.addTiddler({title:'${RAN}', text:'ran'}); return ["probe"]; };` } },
      { tiddler: { title: PLUGIN, "plugin-type": "plugin", type: "application/json", text: JSON.stringify({ tiddlers: { "lar:///t/doc/plugin/shadow": { title: "lar:///t/doc/plugin/shadow", text: "shadow" } } }) } },
    ];
    // CONTROL: the same shape of library, preloaded with a granted digest and the tw5-module component, defines.
    const body = "exports.granted = 42;";
    const granted = { title: "lar:///t/doc/granted", type: CARRIER_TYPE, tags: "lar:///ha.ka.ba/lararium/tw5/tw5-module", "module-type": "library",
      "source-sha256": `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`, text: body };
    engine = new TW5Engine();
    await engine.boot(vendoredCore(), [...houseSkins(), granted],
      undefined, { grantedDigests: new Set([sha256HexBytesSync(canonicalJsonBytes(granted))]), modulePins: skinPins() });
    await seedInto(engine, "doc-code", records);
    const $tw = engine.$tw as unknown as { wiki: TW5Engine["wiki"]; modules: { titles: Record<string, unknown>; execute(t: string): Record<string, unknown> } };
    expect($tw.modules.execute("lar:///t/doc/granted")["granted"], "CONTROL: the granted preload defines").toBe(42);

    expect($tw.wiki.getTiddler(MOD)?.fields["text"], "the module's source stands as data").toBe(modText);
    expect($tw.modules.titles[MOD], "the module table never names it").toBeUndefined();
    expect($tw.modules.titles[OP]).toBeUndefined();
    expect(() => $tw.modules.execute(MOD)).toThrow();
    let answered: string[] = [];
    try { answered = $tw.wiki.filterTiddlers("[docprobe[]]"); } catch { answered = []; }
    expect(answered.includes("probe"), "the document's filter operator never registers").toBe(false);
    expect($tw.wiki.getTiddler(PLUGIN), "the plugin record landed").toBeDefined();
    expect($tw.wiki.isShadowTiddler("lar:///t/doc/plugin/shadow"), "and never unpacked its shadows").toBe(false);
    expect($tw.wiki.getTiddler(RAN), "nothing the document says ran").toBeUndefined();
  }, 120_000);

  for (const slug of ["startup-user", "daemon"]) {
    test(`W2: a document StartupAction never runs on the ${slug} island; CONTROL a floor-admitted plugin's StartupAction runs once`, async () => {
      const DOC = "$:/temp/doc-startup", FLOOR = "$:/temp/floor-startup";
      const plugin = { title: "$:/plugins/lararium/test-floor-startup", "plugin-type": "plugin", type: "application/json",
        text: JSON.stringify({ tiddlers: { "$:/plugins/lararium/test-floor-startup/act": { title: "$:/plugins/lararium/test-floor-startup/act", tags: "$:/tags/StartupAction", text: count(FLOOR) } } }) };
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        engine = await bootTestWiki({ extraPlugins: [plugin] });
        await seedInto(engine, slug, [{ tiddler: { title: "lar:///t/doc/startup", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${DOC}" text="ran"/>` } }]);
      } finally { warn.mockRestore(); }
      const wiki = engine.$tw.wiki;
      expect(wiki.getTiddler(FLOOR)?.fields["text"], "CONTROL: the floor plugin's StartupAction ran once, at boot").toBe("1");
      expect(wiki.getTiddler("lar:///t/doc/startup"), "the document's StartupAction landed as data").toBeDefined();
      expect(wiki.getTiddler(DOC), "and never ran on the island").toBeUndefined();
    }, 120_000);
  }
});
