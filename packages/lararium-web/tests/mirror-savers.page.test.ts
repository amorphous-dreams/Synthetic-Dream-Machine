import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import sync from "./fixtures/mirror-plugins/syncadaptor.json";
import saver from "./fixtures/mirror-plugins/saver.json";
import library from "./fixtures/mirror-plugins/library.json";
beforeEach(forgetEvidence); afterEach(forgetEvidence);
async function mounted(plugin?: Record<string, unknown>) { const r = await rig(); const inputs = await r.seams.readInputs(); const m = await standMirror(r.options, { ...r.seams, readInputs: async () => ({ ...inputs, preloadedTiddlers: plugin ? [plugin] : [] }) }); if (m.kind !== "mirror") { r.host.remove(); throw new Error(m.why); } await m.settled; return { m, r, close: () => { m.unmount(); r.host.remove(); } }; }
test("mirror-saver-shadows-win", async () => { const x = await mounted(); try { expect(x.m.tw.wiki.getShadowSource("$:/core/modules/savers/put.js")).toBe("lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext"); expect(Object.keys(x.m.tw.modules.types.saver ?? {})).not.toContain("$:/core/modules/savers/put.js"); } finally { x.close(); } });
test("mirror-saver-shadows CONTROL: core owns load-modules", async () => { const x = await mounted(); try { expect(x.m.tw.wiki.getShadowSource("$:/core/modules/startup/load-modules.js")).toBe("$:/core"); } finally { x.close(); } });
async function edits(tw: any) { for (let i = 0; i < 10; i++) tw.wiki.addTiddler(new tw.Tiddler({ title: `Fixture ${i}`, text: "edited" })); await new Promise<void>(resolve => tw.wiki.addEventListener("change", () => resolve())); }
test("mirror-saver-handler-inert", async () => { const x = await mounted(); try { await edits(x.m.tw); expect(document.body.classList.contains("tc-dirty")).toBe(false); expect(x.m.tw.unloadTasks.every((t: any) => !t({}))).toBe(true); } finally { x.close(); } });
// The inert-handler witness reads green under the worker forge today (no saver handler stands) and guards the browser-mode boot, where stock TW5 would mark `tc-dirty` and hold the unload.
test("mirror-saver-handler CONTROL: zero edits stays clean", async () => { document.body.classList.remove("tc-dirty"); const x = await mounted(); try { expect(document.body.classList.contains("tc-dirty")).toBe(false); } finally { x.close(); } });
for (const [name, fixture] of [["syncadaptor", sync], ["saver", saver]] as const) test(`mirror-refuses-${name}-plugin-by-name`, async () => { const x = await mounted(fixture); try { expect(x.m.tw.syncer).toBeUndefined(); expect(x.m.tw.syncadaptor).toBeUndefined(); expect(x.m.tw.wiki.getTiddler(`$:/temp/lares/alert/refused/plugin-syncadaptor/${fixture.title}`)).toBeDefined(); expect(x.r.host.shadowRoot?.childElementCount).toBeGreaterThan(0); } finally { x.close(); } });
test("plugin census CONTROL: library loads without alert", async () => { const x = await mounted(library); try { expect(x.m.tw.modules.titles[library.title + "/module.js"]).toBeDefined(); expect(x.m.tw.wiki.allTitles().some((t: string) => t.startsWith("$:/temp/lares/alert/refused/plugin-syncadaptor/"))).toBe(false); } finally { x.close(); } });
