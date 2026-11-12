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
  test("an ordinary record and a plugin that evaluates nothing boot with the engine; a code plugin waits on the seal and a loose module waits whatever the seal", () => {
    const census = censusRecords([record("Note", { text: "n" }), palette, code, loose], boot, false);
    expect(titles(census.preloaded)).toEqual(["Note", "$:/plugins/person/palette"]);
    expect(titles(census.held)).toEqual(["$:/plugins/person/code", "$:/person/macro.js"]);
    expect(kinds(census)).toEqual({ "$:/plugins/person/code": "plugin-gate" });   // the loose module waits with no alert: the island runs none either
  });
  test("CONTROL: on a vessel whose store rests sealed, the code plugin boots with the engine; a loose module still waits, as it does in the island", () => {
    const census = censusRecords([code, loose], boot, true);
    expect(titles(census.preloaded)).toEqual(["$:/plugins/person/code"]);
    expect(titles(census.held)).toEqual(["$:/person/macro.js"]);
    expect(census.refused).toEqual([]);
  });
  test("a syncadaptor or a saver never boots, sealed or not", () => {
    const census = censusRecords([sync, saver], boot, true);
    expect(census.preloaded).toEqual([]);
    expect(kinds(census)).toEqual({ "$:/plugins/person/sync": "plugin-syncadaptor", "$:/person/saver.js": "module-syncadaptor" });
  });
  test("a record never replaces a tiddler of the verified boot set, sealed or not", () => {
    const census = censusRecords([record("$:/core", { "plugin-type": "plugin", text: packed({}) }), record("$:/themes/tiddlywiki/vanilla", { text: "x" }), record("$:/boot/boot.js", { text: "x" })], boot, true);
    expect(census.preloaded).toEqual([]);
    expect(new Set(Object.values(kinds(census)))).toEqual(new Set(["boot-set-shadow"]));
  });
  test("a plugin whose body the port left out, or whose packed text will not parse, waits: nothing can read what it would evaluate", () => {
    const census = censusRecords([record("$:/plugins/skinny", { "plugin-type": "plugin" }, ["text"]), record("$:/plugins/bent", { "plugin-type": "plugin", text: "{" })], boot, true);
    expect(census.preloaded).toEqual([]);
    expect(titles(census.held)).toEqual(["$:/plugins/skinny", "$:/plugins/bent"]);
  });
  test("the glass's own titles and a tombstone enter neither list", () => {
    const census = censusRecords([record("$:/StoryList", { list: "A" }), record("$:/state/x", { text: "1" }), { title: "Gone", fields: {}, deleted: true as const }], boot, false);
    expect(census.preloaded).toEqual([]); expect(census.held).toEqual([]);
  });
  test("a record's StartupAction waits out the boot with no alert; CONTROL a record that only mentions the tag in its text boots", () => {
    const census = censusRecords([record("$:/on-start", { tags: "$:/tags/StartupAction", text: "x" }), record("$:/on-browser", { tags: "Other [[$:/tags/StartupAction/Browser]]", text: "x" }),
      record("$:/note", { tags: "Notes", text: "$:/tags/StartupAction" }), record("$:/near", { tags: "$:/tags/StartupActionX", text: "x" })], boot, true);
    expect(titles(census.held)).toEqual(["$:/on-start", "$:/on-browser"]);
    expect(titles(census.preloaded)).toEqual(["$:/note", "$:/near"]);
    expect(census.refused).toEqual([]);
  });
  test("a record sharing its title with a module the boot set packs waits out the boot with no alert, so the engine's module stays defined; CONTROL a record over a plain shadow boots", () => {
    const house = { title: "house", "plugin-type": "plugin", text: packed({ "lar:///modules/deserializer": { "module-type": "library", type: "application/javascript", text: "" }, "$:/config/x": { text: "shadow" } }) };
    const modules = bootSetModuleTitles([house, { title: "$:/loose.js", "module-type": "utils", text: "" }]);
    expect([...modules].sort()).toEqual(["$:/loose.js", "lar:///modules/deserializer"]);
    const census = censusRecords([record("lar:///modules/deserializer", { text: "the carrier canon keeps under the module's own name" }), record("$:/config/x", { text: "a person's override" }),
      record("$:/core/modules/widgets/list.js", { text: "x" })], bootSetTitles([house]), true, [], modules);
    expect(titles(census.held)).toEqual(["lar:///modules/deserializer", "$:/core/modules/widgets/list.js"]);
    expect(titles(census.preloaded)).toEqual(["$:/config/x"]);
    expect(census.refused).toEqual([]);
  });
});
