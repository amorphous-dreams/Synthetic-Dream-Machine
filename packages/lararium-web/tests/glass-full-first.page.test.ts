import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, lends, rig } from "./glass-rig.js";

const KEY = "mirror:began:wiki";   // keyed by the wiki the mirror serves
const clear = () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); sessionStorage.removeItem("width"); } catch { /* storage may be blocked */ } };
beforeEach(forgetEvidence); afterEach(() => { forgetEvidence(); clear(); });

test("the whole handoff: the page boots from what the island hands over the port, and reads no store of its own", async () => {
  const r = await rig({ records: [{ title: "$:/SiteTitle", fields: { text: "The Handed Wiki" } }] });
  try {
    const result = await standMirror({ ...r.options, inputs: r.names }) as any;      // no seam: the bytes come off the port
    expect(result.kind).toBe("mirror");
    expect(r.opens()).toEqual([expect.objectContaining({ width: "full", boot: true })]);   // one open, at full, asking the boot set
    expect(await result.settled).toEqual({ width: "full" });
    // The house plugin unpacked from the handed blob, and the wiki's own record stood in the store before the engine booted.
    expect(result.tw.wiki.getTiddler("lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext")?.fields["plugin-type"]).toBe("plugin");
    expect(result.tw.wiki.getTiddlerText("$:/SiteTitle")).toBe("The Handed Wiki");
    expect(result.tw.wiki.getTiddlerText("Landed1")).toBe("t");
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);             // a booted record never posts itself
    expect(result.handed).toEqual({ members: 2, records: 2 });                       // the engine and the house plugin, and both records
    result.unmount();
  } finally { r.host.remove(); }
});
test("a boot member the vessel never named floors by name; CONTROL the named set boots", async () => {
  const r = await rig();
  try {
    const result = await standMirror({ ...r.options, inputs: { ...r.names, pluginCids: [] } });
    expect(result).toEqual({ kind: "floor", width: "none", why: `mirror-boot-member-unnamed:${r.names.pluginCids[0]}` });
    expect(r.host.shadowRoot?.childNodes.length ?? 0).toBe(0);
  } finally { r.host.remove(); }
});
test("a name the island never answered floors by name", async () => {
  const r = await rig(); const missing = "f".repeat(64);
  try {
    const result = await standMirror({ ...r.options, inputs: { ...r.names, pluginCids: [...r.names.pluginCids, missing] } });
    expect(result).toEqual({ kind: "floor", width: "none", why: `mirror-boot-member-missing:${missing}` });
  } finally { r.host.remove(); }
});
test("a person's plugin among the wiki's records boots with the engine when it evaluates nothing, and waits on the seal when it carries a module", async () => {
  const packed = (shadows: object) => JSON.stringify({ tiddlers: shadows });
  const r = await rig({ records: [
    { title: "$:/plugins/person/words", fields: { "plugin-type": "plugin", type: "application/json", text: packed({ "$:/person/word": { title: "$:/person/word", text: "unpacked at boot" } }) } },
    { title: "$:/plugins/person/code", fields: { "plugin-type": "plugin", type: "application/json", text: packed({ "$:/person/code.js": { title: "$:/person/code.js", type: "application/javascript", "module-type": "library", text: "globalThis.__personCodeRan = true;" } }) } },
  ] });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.tw.wiki.getTiddlerText("$:/person/word")).toBe("unpacked at boot");       // a shadow of a plugin TW5 registered at boot
    expect(result.tw.wiki.tiddlerExists("$:/plugins/person/code")).toBe(true);              // the held plugin stands as a record
    expect(result.tw.wiki.isShadowTiddler("$:/person/code.js")).toBe(false);                // and unpacked nothing
    expect(result.tw.modules.titles["$:/person/code.js"]).toBeUndefined();
    expect((globalThis as any).__personCodeRan).toBeUndefined();
    expect(result.tw.wiki.tiddlerExists("$:/temp/lares/alert/refused/plugin-gate/$:/plugins/person/code")).toBe(true);
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);
    result.unmount();
  } finally { r.host.remove(); }
});
test("a theme a person installed in the wiki reaches the mirror as the wiki's own record and styles the pane; CONTROL without the theme pointer the rule stays out", async () => {
  const theme = { title: "$:/themes/person/dusk", fields: { "plugin-type": "theme", type: "application/json", name: "Dusk",
    text: JSON.stringify({ tiddlers: { "$:/themes/person/dusk/base": { title: "$:/themes/person/dusk/base", tags: "$:/tags/Stylesheet", text: ".lar-dusk-marker { color: rgb(1, 2, 3); }" } } }) } };
  const sheet = (host: HTMLElement) => host.shadowRoot!.querySelector("style")!.textContent ?? "";
  const worn = await rig({ records: [theme, { title: "$:/theme", fields: { text: "$:/themes/person/dusk" } }] });
  try {
    const result = await standMirror(worn.options, worn.seams) as any;
    expect(result.tw.wiki.isShadowTiddler("$:/themes/person/dusk/base")).toBe(true);     // TW5's own theme manager registered it at boot
    expect(sheet(worn.host)).toContain(".lar-dusk-marker");
    expect(result.tw.wiki.tiddlerExists("$:/temp/lares/alert/refused/plugin-gate/$:/themes/person/dusk")).toBe(false);   // it evaluates nothing: no gate holds it
    result.unmount();
  } finally { worn.host.remove(); }
  forgetEvidence();
  const bare = await rig({ records: [theme] });
  try {
    const result = await standMirror(bare.options, bare.seams) as any;
    expect(sheet(bare.host)).not.toContain(".lar-dusk-marker");
    result.unmount();
  } finally { bare.host.remove(); }
});
test("a canon record that carries a house module's own name leaves the engine's module defined, and the record still shows; CONTROL the module stands without it", async () => {
  const NAME = "lar:///ha.ka.ba/lararium/tw5/modules/deserializer";
  const faults = (tw: any): string[] => tw.wiki.filterTiddlers("[prefix[$:/temp/lares/alert/boot-fault/]]");
  const bare = await rig();
  try {
    const result = await standMirror(bare.options, bare.seams) as any;
    expect(result.tw.modules.titles[NAME]).toBeDefined();                                   // CONTROL
    result.unmount();
  } finally { bare.host.remove(); }
  forgetEvidence();
  const r = await rig({ records: [{ title: NAME, fields: { text: "the carrier canon keeps under the module's own name", type: "text/memetic-wikitext+tiddlywiki" } }] });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.tw.modules.titles[NAME]).toBeDefined();                                   // the record never unseated the module
    expect(faults(result.tw)).toEqual([]);                                                  // and no module that requires it died at boot
    expect(result.tw.wiki.getTiddlerText(NAME)).toBe("the carrier canon keeps under the module's own name");   // the record landed after boot
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);
    result.unmount();
  } finally { r.host.remove(); }
});
test("the mirror opens full on one port; the evidence record stands while full boots and clears once full has painted", async () => {
  const r = await rig(); let during: string | null = null;
  r.onPlace(msg => { if (msg.type === "port:open") during = sessionStorage.getItem(KEY); });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(r.opens().map(m => m.width)).toEqual(["full"]);
    expect(r.messages.some(m => m.type === "port:widen")).toBe(false);
    expect(during).toEqual(expect.any(String));
    // Full has painted but no frame has run over it: the record still stands. It clears once a frame has painted full.
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(sessionStorage.getItem(KEY)).toBeNull();
    result.unmount();
  } finally { r.host.remove(); }
});
test("a record from a full boot that never finished holds the tab at skinny and names why; the record stays", async () => {
  sessionStorage.setItem(KEY, "left-by-a-boot-that-died");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual({ width: "skinny", why: "full-boot-unfinished" });
    expect(r.opens().map(m => m.width)).toEqual(["skinny"]);
    expect(sessionStorage.getItem(KEY)).toBe("left-by-a-boot-that-died");
    result.unmount();
  } finally { r.host.remove(); }
});
test("a remembered width, or the record in another store, selects nothing", async () => {
  sessionStorage.setItem("width", "skinny"); localStorage.setItem(KEY, "elsewhere");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    result.unmount();
  } finally { r.host.remove(); }
});
test("the mirror names the wait for the port's handoff, and a snapshot ends it", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const r = await rig({ gate }); const states: unknown[] = [];
  try {
    const standing = standMirror({ ...r.options, onState: state => states.push(state) }, r.seams);
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    expect(states).toEqual([{ kind: "waiting", for: "handoff" }]);
    release();
    const result = await standing as any;
    expect(states.filter((state: any) => state.for === "handoff")).toEqual([{ kind: "waiting", for: "handoff" }]);   // one handoff wait, named once
    result.unmount();
  } finally { r.host.remove(); }
});
test("a port:gone and snapshot that land before the door returns leave no engine behind", async () => {
  const before = lends(); const r = await rig();
  try {
    // Both arrive inside the open's own send, before the door has returned.
    r.onPlace(msg => { if (msg.type === "port:open") {
      r.port.deliver({ type: "port:snapshot", portId: msg.portId, snapshotId: "early", i: 1, n: 1, records: [] });
      r.port.deliver({ type: "port:gone", portId: msg.portId, reason: "grant-revoked" });
    } });
    const result = await standMirror(r.options, r.seams);
    expect(result).toEqual({ kind: "floor", width: "none", why: "grant-revoked" });
    expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("a record under another wiki's key holds nothing for this wiki", async () => {
  sessionStorage.setItem("mirror:began:other-wiki", "left-by-another-wiki");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(sessionStorage.getItem("mirror:began:other-wiki")).toBe("left-by-another-wiki");
    result.unmount();
  } finally { sessionStorage.removeItem("mirror:began:other-wiki"); r.host.remove(); }
});
test("storage that refuses a write names evidence-unavailable and the tab still boots full", async () => {
  const r = await rig(); const states: any[] = [];
  const denied = { getItem: () => null, setItem: () => { throw new DOMException("denied", "SecurityError"); }, removeItem: () => {} };
  try {
    const result = await standMirror({ ...r.options, evidence: denied, onState: state => states.push(state) }, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(states).toContainEqual({ kind: "evidence-unavailable", why: "SecurityError" });
    result.unmount();
  } finally { r.host.remove(); }
});
test("CONTROL: storage that works names no evidence state", async () => {
  const r = await rig(); const states: any[] = [];
  try {
    const result = await standMirror({ ...r.options, onState: state => states.push(state) }, r.seams) as any;
    await result.settled;
    expect(states.filter(state => state.kind === "evidence-unavailable")).toEqual([]);
    result.unmount();
  } finally { r.host.remove(); }
});

const STANDING = "mirror:full-standing:wiki";
const afterPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
test("the second record stands from full's first paint and clears on pagehide", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled;
    expect(sessionStorage.getItem(STANDING)).toBeNull();                       // full has painted, and no frame has run over it yet
    await afterPaint();
    expect(sessionStorage.getItem(STANDING)).not.toBeNull();                   // a frame painted full: the page stands
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(sessionStorage.getItem(STANDING)).toBeNull();                       // an orderly leave clears it
    result.unmount();
  } finally { r.host.remove(); }
});
test("a page that came back from the back-forward cache stands again, and an unmount clears the record", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled; await afterPaint();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    expect(sessionStorage.getItem(STANDING)).toBeNull();
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    expect(sessionStorage.getItem(STANDING)).not.toBeNull();
    result.unmount();
    expect(sessionStorage.getItem(STANDING)).toBeNull();
  } finally { r.host.remove(); }
});
test("a full page that ended without a pagehide holds the next boot of this wiki at skinny, as evidence and never a flag", async () => {
  sessionStorage.setItem(STANDING, "left-by-a-full-page-that-died");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "skinny", why: "full-ended-without-pagehide" });
    expect(r.opens().map(m => m.width)).toEqual(["skinny"]);
    expect(sessionStorage.getItem(STANDING)).toBe("left-by-a-full-page-that-died");
    result.unmount();
  } finally { r.host.remove(); }
});
test("CONTROL: another wiki's standing record holds nothing for this wiki", async () => {
  sessionStorage.setItem("mirror:full-standing:other-wiki", "elsewhere");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    result.unmount();
  } finally { sessionStorage.removeItem("mirror:full-standing:other-wiki"); r.host.remove(); }
});
