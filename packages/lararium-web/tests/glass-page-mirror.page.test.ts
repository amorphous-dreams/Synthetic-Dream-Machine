import { afterEach, beforeEach, expect, test } from "vitest";
import { standPageMirror } from "../src/page-mirror.js";
import { forgetEvidence, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);
const attr = (host: HTMLElement) => host.getAttribute("data-lar-mirror");

test("the page root stands its mirror from the vessel's mirrorInputs and tells the host element how wide it stands", async () => {
  const r = await rig(); const asked: string[] = [];
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "did:key:zActor", surface: () => "lares",
      mirrorInputs: async surface => { asked.push(surface); return { coreCid: "0".repeat(64), pluginCids: [] }; } }, r.seams) as any;
    expect(asked).toEqual(["lares"]);
    expect(result.kind).toBe("mirror");
    expect(r.opens()[0]).toMatchObject({ wikiUri: "lares", actor: "did:key:zActor", width: "skinny" });
    await result.settled;
    expect(attr(r.host)).toBe("full");
    result.unmount();
  } finally { r.host.remove(); }
});
test("no surface, or inputs the vessel cannot name, leaves the none projection alone and the host marked", async () => {
  const r = await rig();
  try {
    const noSurface = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => null, mirrorInputs: async () => null }, r.seams);
    expect(noSurface).toEqual({ kind: "floor", width: "none", why: "surface-unknown" });
    expect(attr(r.host)).toBe("none:surface-unknown");
    const noInputs = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares", mirrorInputs: async () => null }, r.seams);
    expect(noInputs).toEqual({ kind: "floor", width: "none", why: "mirror-inputs-absent" });
    expect(r.opens()).toHaveLength(0);
  } finally { r.host.remove(); }
});

test("the page holds its unload while a mirror write waits for its answer, and lets go once it lands", async () => {
  const r = await rig();
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares",
      mirrorInputs: async () => ({ coreCid: "0".repeat(64), pluginCids: [] }) }, r.seams) as any;
    await result.settled;
    const leave = () => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
    expect(leave()).toBe(false);                                       // CONTROL: nothing waits, the page leaves freely
    result.tw.wiki.addTiddler(new result.tw.Tiddler({ title: "Confirmed", text: "a confirmed edit" }));
    await new Promise<void>(resolve => queueMicrotask(resolve)); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const write = r.messages.find(m => m.type === "port:write");
    expect(write, "the edit crossed the port").toBeTruthy();
    expect(leave()).toBe(true);                                        // the act waits: the page holds the leave
    r.port.deliver({ type: "port:written", portId: write!.portId, txId: write!.txId, status: "applied", applied: ["Confirmed"], failed: [] });
    expect(leave()).toBe(false);                                       // answered: the page lets go
    result.unmount();
    expect(leave()).toBe(false);
  } finally { r.host.remove(); }
});
test("the mirror host shows when the mirror stands and the none projection stays beneath as the floor", async () => {
  const r = await rig();
  const projection = document.createElement("div"); projection.id = "projection"; r.host.after(projection);
  r.host.id = "mirror";
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares",
      mirrorInputs: async () => ({ coreCid: "0".repeat(64), pluginCids: [] }) }, r.seams) as any;
    await result.settled;
    expect(r.host.getAttribute("data-lar-shown")).toBe("mirror");
    result.unmount();
    expect(r.host.getAttribute("data-lar-shown")).toBe("floor");
  } finally { projection.remove(); r.host.remove(); }
});

test("a mirror the tab's evidence holds at skinny names why on the host; CONTROL: a mirror at full carries no why", async () => {
  const full = await rig();
  try {
    const result = await standPageMirror({ port: full.port, host: full.host, actor: "a", surface: () => "lares",
      mirrorInputs: async () => ({ coreCid: "0".repeat(64), pluginCids: [] }) }, full.seams) as any;
    await result.settled;
    expect(attr(full.host)).toBe("full");
    expect(full.host.hasAttribute("data-lar-mirror-why")).toBe(false);
    result.unmount();
  } finally { full.host.remove(); }
  sessionStorage.setItem("mirror:began:lares", "an earlier full boot never finished");
  const held = await rig();
  try {
    const result = await standPageMirror({ port: held.port, host: held.host, actor: "a", surface: () => "lares",
      mirrorInputs: async () => ({ coreCid: "0".repeat(64), pluginCids: [] }) }, held.seams) as any;
    await result.settled;
    expect(attr(held.host)).toBe("skinny");
    expect(held.host.getAttribute("data-lar-mirror-why")).toBe("full-promotion-unfinished");
    // The weld's read-only reading: the open story, the wiki's default story, and the palette pointer.
    expect((held.host as any).larMirrorReading).toMatchObject({ story: expect.any(Array), defaults: expect.any(Array), palette: expect.any(String) });
    result.unmount();
    expect(held.host.hasAttribute("data-lar-mirror-why")).toBe(false);
  } finally { held.host.remove(); }
});
