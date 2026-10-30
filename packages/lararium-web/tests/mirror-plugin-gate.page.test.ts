import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import fixture from "./fixtures/mirror-plugins/startup-flag.json";
beforeEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
afterEach(() => { forgetEvidence(); delete (window as any).__larFixtureRan; });
async function mounted() { const r = await rig(); const inputs = await r.seams.readInputs(); const m = await standMirror(r.options, { ...r.seams, readInputs: async () => ({ ...inputs, preloadedTiddlers: [fixture] }) }); if (m.kind !== "mirror") { r.host.remove(); throw new Error(m.why); } await m.settled; return { m, r, close: () => { m.unmount(); r.host.remove(); } }; }
// The rig's port:open delivers snapshots, not a grant; reading sealedRest belongs to Fix A.
test("plugin-gate-refuses-until-sealed-rest", async () => { const x = await mounted(); try { expect((window as any).__larFixtureRan).toBeUndefined(); expect(x.m.tw.wiki.getTiddler(`$:/temp/lares/alert/refused/plugin-gate/${fixture.title}`)).toBeDefined(); } finally { x.close(); } });
test("plugin-gate CONTROL: core startup module loads", async () => { const x = await mounted(); try { expect(x.m.tw.modules.titles["$:/core/modules/startup/load-modules.js"]).toBeDefined(); } finally { x.close(); } });
test.todo("plugin-gate CONTROL: with sealedRest: true on the grant expect(window.__larFixtureRan).toBe(true)");
