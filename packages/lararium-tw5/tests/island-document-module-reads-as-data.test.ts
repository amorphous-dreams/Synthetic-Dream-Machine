/** A document's records join native TW5 boot through wave zero. Modules and plugins define at boot,
 * and document and floor StartupActions each run once. */
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { seedDrained } from "../src/island-recipe.js";
import { TW5Engine } from "../src/tw5-vm.js";
import { skipNote, wikiSkip } from "./test-wiki.js";
import { standIslandOverSeed } from "./island-over-seed.js";

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

const count = (probe: string): string => `<$action-setfield $tiddler="${probe}" text={{{ [{${probe}}else[0]add[1]] }}}/>`;

describe.skipIf(wikiSkip)(`the island boots a document's code from the seed${skipNote}`, () => {
  let engine: TW5Engine | undefined;
  afterEach(() => { engine?.dispose(); engine = undefined; });

  test("W1: a document module, filter operator and plugin boot from the seed", async () => {
    const MOD = "lar:///t/doc/mod", OP = "lar:///t/doc/op", PLUGIN = "lar:///t/doc/plugin", RAN = "$:/temp/doc-mod-ran";
    const modText = `exports.probe = function(){ $tw.wiki.addTiddler({title:'${RAN}', text:'ran'}); };`;
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: MOD, type: "application/javascript", "module-type": "library", text: modText } },
      { tiddler: { title: OP, type: "application/javascript", "module-type": "filteroperator", text: `exports.docprobe = function(){ $tw.wiki.addTiddler({title:'${RAN}', text:'ran'}); return ["probe"]; };` } },
      { tiddler: { title: PLUGIN, "plugin-type": "plugin", type: "application/json", text: JSON.stringify({ tiddlers: { "lar:///t/doc/plugin/shadow": { title: "lar:///t/doc/plugin/shadow", text: "shadow" } } }) } },
    ];
    const stood = await standIslandOverSeed({ composite: new CompositeStore(), recipe: { wikiSlug: "doc-code" }, ready: [{ slot: wikiSlotUri("doc-code", "working"), handle: handleOver(records) }] });
    engine = stood.tw5;
    await seedDrained(engine);
    const $tw = engine.$tw as unknown as { wiki: TW5Engine["wiki"]; modules: { titles: Record<string, unknown>; execute(t: string): Record<string, unknown> } };


    expect($tw.wiki.getTiddler(MOD)?.fields["text"], "the module's source stands as data").toBe(modText);
    expect($tw.modules.titles[MOD], "the seeded module defines at boot").toBeDefined();
    expect($tw.modules.titles[OP]).toBeDefined();
    expect($tw.modules.execute(MOD)["probe"]).toBeTypeOf("function");
    let answered: string[] = [];
    try { answered = $tw.wiki.filterTiddlers("[docprobe[]]"); } catch { answered = []; }
    expect(answered.includes("probe"), "the seeded filter operator registers").toBe(true);
    expect($tw.wiki.getTiddler(PLUGIN), "the plugin record landed").toBeDefined();
    expect($tw.wiki.isShadowTiddler("lar:///t/doc/plugin/shadow"), "the seeded plugin unpacked its shadows").toBe(true);
    expect($tw.wiki.getTiddler(RAN), "the invoked filter ran").toBeDefined();
  }, 120_000);

  for (const slug of ["startup-user", "daemon"]) {
    test(`W2: a document StartupAction runs once on the ${slug} island; CONTROL a floor-admitted plugin's StartupAction runs once`, async () => {
      const DOC = "$:/temp/doc-startup", FLOOR = "$:/temp/floor-startup";
      const plugin = { title: "$:/plugins/lararium/test-floor-startup", "plugin-type": "plugin", type: "application/json",
        text: JSON.stringify({ tiddlers: { "$:/plugins/lararium/test-floor-startup/act": { title: "$:/plugins/lararium/test-floor-startup/act", tags: "$:/tags/StartupAction", text: count(FLOOR) } } }) };
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        ({ tw5: engine } = await standIslandOverSeed({ composite: new CompositeStore(), recipe: { wikiSlug: slug }, ready: [{ slot: wikiSlotUri(slug, "working"), handle: handleOver([{ tiddler: { title: "lar:///t/doc/startup", tags: ["$:/tags/StartupAction"], text: count(DOC) } }]) }], boot: { extraPlugins: [plugin] } }));
        await seedDrained(engine);
      } finally { warn.mockRestore(); }
      const wiki = engine.$tw.wiki;
      expect(wiki.getTiddler(FLOOR)?.fields["text"], "CONTROL: the floor plugin's StartupAction ran once, at boot").toBe("1");
      expect(wiki.getTiddler("lar:///t/doc/startup"), "the document's StartupAction landed").toBeDefined();
      expect(wiki.getTiddler(DOC)?.fields["text"], "and ran on the island, once").toBe("1");
    }, 120_000);
  }
});
