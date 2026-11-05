/**
 * glass-census-promoted — the glass mirror's census runs over EVERY preload, a promoted bundle and a promoted loose module among them.
 *
 * The mirror is fed by the port alone: nothing carrying a `syncadaptor` or `saver` module reaches it, whether it rides as a plugin
 * bundle or as a tiddler whose own module-type names one. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lararium/tw5/glass-mirror
 */
import { describe, expect, test } from "vitest";
import { censusPreloads } from "../src/glass-mirror.js";

const bundle = (title: string, shadows: Record<string, unknown>) => ({ title, "plugin-type": "plugin", text: JSON.stringify({ tiddlers: shadows }) });

describe("the mirror census over promoted preloads", () => {
  test("RED: a promoted plugin bundle carrying a saver or syncadaptor module is refused `plugin-syncadaptor`; CONTROL: a bundle of plain modules passes on a sealed-rest vessel", () => {
    const saver = bundle("$:/plugins/rites/saver", { "$:/rites/save": { "module-type": "saver", text: "x" } });
    const sync = bundle("$:/plugins/rites/sync", { "$:/rites/sync": { "module-type": "syncadaptor", text: "x" } });
    const fine = bundle("$:/plugins/rites/widget", { "$:/rites/w": { "module-type": "widget", text: "x" } });
    const { accepted, refused } = censusPreloads([saver, sync, fine], true);
    expect(refused).toEqual([{ title: "$:/plugins/rites/saver", kind: "plugin-syncadaptor" }, { title: "$:/plugins/rites/sync", kind: "plugin-syncadaptor" }]);
    expect(accepted).toEqual([fine]);
  });

  test("RED: a promoted loose tiddler whose own module-type is saver or syncadaptor is refused `module-syncadaptor`; CONTROL: a loose startup module and a plain macro pass", () => {
    const looseSaver = { title: "rites/saver", "module-type": "saver", type: "application/javascript", text: "x" };
    const looseSync = { title: "rites/sync", "module-type": "syncadaptor", type: "application/javascript", text: "x" };
    const startup = { title: "rites/startup", "module-type": "startup", type: "application/javascript", text: "x" };
    const macro = { title: "rites/macro", tags: "$:/tags/Macro", text: "\\define m() x" };
    const { accepted, refused } = censusPreloads([looseSaver, looseSync, startup, macro], false);
    expect(refused).toEqual([{ title: "rites/saver", kind: "module-syncadaptor" }, { title: "rites/sync", kind: "module-syncadaptor" }]);
    expect(accepted).toEqual([startup, macro]);
  });
});
