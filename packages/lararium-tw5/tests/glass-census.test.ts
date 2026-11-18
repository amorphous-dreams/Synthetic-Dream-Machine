/**
 * glass-census — the mirror's plugin gate reads capability, never a name: a theme that evaluates no code passes the closed gate
 * (the stock vanilla and snowwhite themes the boot set carries), a theme that carries a module waits on the seal like any
 * plugin, and a saver or syncadaptor refuses whatever the plugin's type.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { censusPreloads } from "../src/glass-mirror.js";

const PLUGINS = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "plugins");
const stock = (name: string) => JSON.parse(readFileSync(path.join(PLUGINS, name), "utf8")) as Record<string, unknown>;
const packed = (title: string, type: string, shadows: Record<string, Record<string, string>>) =>
  ({ title, "plugin-type": type, type: "application/json", text: JSON.stringify({ tiddlers: shadows }) });

test("the stock themes pass the closed gate; RED: a theme carrying a module waits on the seal; CONTROL: the seal opens it", () => {
  const vanilla = stock("tiddlywiki-vanilla.json"), snowwhite = stock("tiddlywiki-snowwhite.json");
  const scripted = packed("$:/themes/someone/scripted", "theme", { "$:/themes/someone/scripted/run.js": { title: "$:/themes/someone/scripted/run.js", type: "application/javascript", "module-type": "startup", text: "" } });
  const closed = censusPreloads([vanilla, snowwhite, scripted], false);
  expect(closed.accepted.map(p => p.title)).toEqual(["$:/themes/tiddlywiki/vanilla", "$:/themes/tiddlywiki/snowwhite"]);
  expect(closed.refused).toEqual([{ title: "$:/themes/someone/scripted", kind: "plugin-gate" }]);
  expect(censusPreloads([scripted], true).refused).toEqual([]);
});

test("RED: a theme carrying a saver refuses even under the seal; CONTROL: a person's plugin still waits on the closed gate", () => {
  const saver = packed("$:/themes/someone/saving", "theme", { "$:/themes/someone/saving/saver.js": { title: "$:/themes/someone/saving/saver.js", type: "application/javascript", "module-type": "saver", text: "" } });
  expect(censusPreloads([saver], true).refused).toEqual([{ title: "$:/themes/someone/saving", kind: "plugin-syncadaptor" }]);
  const plain = packed("$:/plugins/someone/plain", "plugin", { "$:/plugins/someone/plain/readme": { title: "$:/plugins/someone/plain/readme", text: "hi" } });
  expect(censusPreloads([plain], false).refused).toEqual([{ title: "$:/plugins/someone/plain", kind: "plugin-gate" }]);
});
