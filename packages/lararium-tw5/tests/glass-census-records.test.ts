import { describe, expect, test } from "vitest";
import { bootSetModuleTitles, bootSetTitles, censusRecords } from "../src/glass-mirror.js";

const packed = (shadows: Record<string, Record<string, string>>) => JSON.stringify({ tiddlers: shadows });
const record = (title: string, fields: Record<string, string>, omitted?: string[]) => ({ title, fields, ...(omitted ? { omitted } : {}) });
const boot = bootSetTitles([{ title: "$:/themes/tiddlywiki/vanilla", "plugin-type": "theme", text: packed({}) }]);
const palette = record("$:/plugins/person/palette", { "plugin-type": "plugin", text: packed({ "$:/p": { text: "x" } }) });
const code = record("$:/plugins/person/code", { "plugin-type": "plugin", text: packed({ "$:/m.js": { type: "application/javascript", "module-type": "widget", text: "" } }) });
const sync = record("$:/plugins/person/sync", { "plugin-type": "plugin", text: packed({ "$:/s.js": { "module-type": "syncadaptor", text: "" } }) });
const loose = record("$:/person/macro.js", { type: "application/javascript", "module-type": "macro", text: "" });
const saver = record("$:/person/saver.js", { type: "application/javascript", "module-type": "saver", text: "" });
const kinds = (census: ReturnType<typeof censusRecords>) => Object.fromEntries(census.refused.map(r => [r.title, r.kind]));
const titles = (records: readonly { title: string }[]) => records.map(r => r.title);

describe("the record census ~ which of the wiki's own records the mirror's engine boots with", () => {
  test("an ordinary record, a plugin that evaluates nothing, a person's code plugin and a loose module all boot with the engine", () => {
    const census = censusRecords([record("Note", { text: "n" }), palette, code, loose], boot);
    expect(titles(census.preloaded)).toEqual(["Note", "$:/plugins/person/palette", "$:/plugins/person/code", "$:/person/macro.js"]);
    expect(census.held).toEqual([]);
    expect(census.refused).toEqual([]);
  });
  test("a syncadaptor or a saver never boots", () => {
    const census = censusRecords([sync, saver], boot);
    expect(census.preloaded).toEqual([]);
    expect(kinds(census)).toEqual({ "$:/plugins/person/sync": "plugin-syncadaptor", "$:/person/saver.js": "module-syncadaptor" });
  });
  test("a record never replaces a tiddler of the verified boot set", () => {
    const census = censusRecords([record("$:/core", { "plugin-type": "plugin", text: packed({}) }), record("$:/themes/tiddlywiki/vanilla", { text: "x" }), record("$:/boot/boot.js", { text: "x" })], boot);
    expect(census.preloaded).toEqual([]);
    expect(new Set(Object.values(kinds(census)))).toEqual(new Set(["boot-set-shadow"]));
  });
  test("a plugin whose body the port left out, or whose packed text will not parse, waits: no engine boots bytes it never received", () => {
    const census = censusRecords([record("$:/plugins/skinny", { "plugin-type": "plugin" }, ["text"]), record("$:/plugins/bent", { "plugin-type": "plugin", text: "{" })], boot);
    expect(census.preloaded).toEqual([]);
    expect(titles(census.held)).toEqual(["$:/plugins/skinny", "$:/plugins/bent"]);
  });
  test("the glass's own titles and a tombstone enter neither list", () => {
    const census = censusRecords([record("$:/StoryList", { list: "A" }), record("$:/state/x", { text: "1" }), { title: "Gone", fields: {}, deleted: true as const }], boot);
    expect(census.preloaded).toEqual([]); expect(census.held).toEqual([]);
  });
  test("a startup record boots with the engine and runs at TW5's startup pass, whatever tag beneath StartupAction it wears", () => {
    const census = censusRecords([record("$:/on-start", { tags: "$:/tags/StartupAction", text: "x" }), record("$:/on-browser", { tags: "Other [[$:/tags/StartupAction/Browser]]", text: "x" }),
      record("$:/note", { tags: "Notes", text: "$:/tags/StartupAction" })], boot);
    expect(titles(census.preloaded)).toEqual(["$:/on-start", "$:/on-browser", "$:/note"]);
    expect(census.held).toEqual([]);
    expect(census.refused).toEqual([]);
  });
  test("a record sharing its title with a module the boot set packs waits out the boot with no alert, so the engine's module stays defined; CONTROL a record over a plain shadow boots", () => {
    const house = { title: "house", "plugin-type": "plugin", text: packed({ "lar:///modules/deserializer": { "module-type": "library", type: "application/javascript", text: "" }, "$:/config/x": { text: "shadow" } }) };
    const modules = bootSetModuleTitles([house, { title: "$:/loose.js", "module-type": "utils", text: "" }]);
    expect([...modules].sort()).toEqual(["$:/loose.js", "lar:///modules/deserializer"]);
    const census = censusRecords([record("lar:///modules/deserializer", { text: "the carrier canon keeps under the module's own name" }), record("$:/config/x", { text: "a person's override" }),
      record("$:/core/modules/widgets/list.js", { text: "x" })], bootSetTitles([house]), [], modules);
    expect(titles(census.held)).toEqual(["lar:///modules/deserializer", "$:/core/modules/widgets/list.js"]);
    expect(titles(census.preloaded)).toEqual(["$:/config/x"]);
    expect(census.refused).toEqual([]);
  });
});
