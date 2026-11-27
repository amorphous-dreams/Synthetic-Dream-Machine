import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import fixture from "./fixtures/mirror-plugins/startup-flag.json";
beforeEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
afterEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
async function mounted() { const r = await rig(); const inputs = await r.seams.readInputs(); const m = await standMirror(r.options, { ...r.seams, readInputs: async () => ({ ...inputs, preloadedTiddlers: [...inputs.preloadedTiddlers, fixture] }) }); if (m.kind !== "mirror") { r.host.remove(); throw new Error(m.why); } await m.settled; return { m, r, close: () => { m.unmount(); r.host.remove(); } }; }
// A person's plugin boots as TiddlyWiki boots any plugin: no seal, no gate.
test("a person's plugin unpacks and its startup module runs at boot, with no seal asked and no refusal raised", async () => { const x = await mounted(); try { expect((window as any).__larFixtureRan).toBe(true); expect(x.m.tw.wiki.allTitles().some((t: string) => t.startsWith("$:/temp/lares/alert/refused/"))).toBe(false); } finally { x.close(); } });
test("CONTROL: the house plugin's own module evaluates beside it", async () => { const x = await mounted(); try { expect(x.m.tw.modules.titles["lar:///ha.ka.ba/lararium/tw5/modules/lar-story"]).toBeDefined(); } finally { x.close(); } });
