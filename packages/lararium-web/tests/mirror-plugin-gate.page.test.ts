import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import fixture from "./fixtures/mirror-plugins/startup-flag.json";
beforeEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
afterEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
async function mounted(sealedRest = false) { const r = await rig(); const inputs = await r.seams.readInputs(); const m = await standMirror(r.options, { ...r.seams, readInputs: async () => ({ ...inputs, preloadedTiddlers: [...inputs.preloadedTiddlers, fixture], sealedRest }) }); if (m.kind !== "mirror") { r.host.remove(); throw new Error(m.why); } await m.settled; return { m, r, close: () => { m.unmount(); r.host.remove(); } }; }
// `sealedRest` is the vessel's word in the mirror's boot inputs (no vessel speaks it yet: S's row); the rig stands for the vessel here.
test("plugin-gate-refuses-until-sealed-rest", async () => { const x = await mounted(); try { expect((window as any).__larFixtureRan).toBeUndefined(); expect(x.m.tw.wiki.getTiddler(`$:/temp/lares/alert/refused/plugin-gate/${fixture.title}`)).toBeDefined(); } finally { x.close(); } });
test("plugin-gate CONTROL: the house plugin's own module evaluates under the closed gate", async () => { const x = await mounted(); try { expect(x.m.tw.modules.titles["lar:///ha.ka.ba/lararium/tw5/modules/lar-story"]).toBeDefined(); expect(x.m.tw.wiki.getTiddler(`$:/temp/lares/alert/refused/plugin-gate/${fixture.title}`)).toBeDefined(); } finally { x.close(); } });
test("plugin-gate CONTROL: a vessel that speaks sealedRest lets the person's plugin evaluate", async () => { const x = await mounted(true); try { expect((window as any).__larFixtureRan).toBe(true); expect(x.m.tw.wiki.getTiddler(`$:/temp/lares/alert/refused/plugin-gate/${fixture.title}`)).toBeUndefined(); } finally { x.close(); } });
