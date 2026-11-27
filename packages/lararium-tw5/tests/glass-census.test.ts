/**
 * glass-census — the mirror boots its boot set as TiddlyWiki boots any store: every plugin unpacks and every module it packs
 * defines, a theme's or a person's, scripted or not. One kind refuses: a plugin carrying a saver or a syncadaptor, whatever its
 * type, since the mirror takes its truth from the port alone.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { censusPreloads } from "../src/glass-mirror.js";

const PLUGINS = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "plugins");
const stock = (name: string) => JSON.parse(readFileSync(path.join(PLUGINS, name), "utf8")) as Record<string, unknown>;
const packed = (title: string, type: string, shadows: Record<string, Record<string, string>>) =>
  ({ title, "plugin-type": type, type: "application/json", text: JSON.stringify({ tiddlers: shadows }) });

test("the stock themes, a theme carrying a module, both house skins and a person's code plugin all boot", () => {
  const vanilla = stock("tiddlywiki-vanilla.json"), snowwhite = stock("tiddlywiki-snowwhite.json");
  const grammar = stock("lares-memetic-wikitext.json"), house = stock("lares-lararium.json");
  const scripted = packed("$:/themes/someone/scripted", "theme", { "$:/themes/someone/scripted/run.js": { title: "$:/themes/someone/scripted/run.js", type: "application/javascript", "module-type": "startup", text: "" } });
  const person = packed("$:/plugins/someone/code", "plugin", { "$:/plugins/someone/code/run.js": { title: "$:/plugins/someone/code/run.js", type: "application/javascript", "module-type": "startup", text: "" } });
  const census = censusPreloads([vanilla, snowwhite, grammar, house, scripted, person]);
  expect(census.accepted).toEqual([vanilla, snowwhite, grammar, house, scripted, person]);
  expect(census.refused).toEqual([]);
});

test("RED: a theme carrying a saver refuses; CONTROL: a plain plugin beside it boots", () => {
  const saver = packed("$:/themes/someone/saving", "theme", { "$:/themes/someone/saving/saver.js": { title: "$:/themes/someone/saving/saver.js", type: "application/javascript", "module-type": "saver", text: "" } });
  const plain = packed("$:/plugins/someone/plain", "plugin", { "$:/plugins/someone/plain/readme": { title: "$:/plugins/someone/plain/readme", text: "hi" } });
  const census = censusPreloads([saver, plain]);
  expect(census.refused).toEqual([{ title: "$:/themes/someone/saving", kind: "plugin-syncadaptor" }]);
  expect(census.accepted).toEqual([plain]);
});
