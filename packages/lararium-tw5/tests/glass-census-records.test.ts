import { describe, expect, test } from "vitest";
import { bootSetTitles, censusRecords } from "../src/glass-mirror.js";

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
  test("an ordinary record and a plugin that evaluates nothing boot with the engine; a code plugin and a loose module wait on the seal", () => {
    const census = censusRecords([record("Note", { text: "n" }), palette, code, loose], boot, false);
    expect(titles(census.preloaded)).toEqual(["Note", "$:/plugins/person/palette"]);
    expect(titles(census.held)).toEqual(["$:/plugins/person/code", "$:/person/macro.js"]);
    expect(kinds(census)).toEqual({ "$:/plugins/person/code": "plugin-gate", "$:/person/macro.js": "module-gate" });
  });
  test("CONTROL: on a vessel whose store rests sealed, the code plugin and the loose module boot with the engine", () => {
    const census = censusRecords([code, loose], boot, true);
    expect(titles(census.preloaded)).toEqual(["$:/plugins/person/code", "$:/person/macro.js"]);
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
});
