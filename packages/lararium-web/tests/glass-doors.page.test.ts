import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { makeMirrorDoor, routeFragment } from "../src/glass/doors.js";
import { forgetEvidence, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);

type Ask = { kind: string; args: Record<string, unknown> };
/** A surface door that records each ask and answers `status`. */
const recording = (status = "ok") => { const asks: Ask[] = []; return { asks, door: { ask(kind: string, args: Record<string, unknown>, settle: (s: string) => void) { asks.push({ kind, args }); settle(status); } } }; };
async function stood(options: Parameters<typeof rig>[0] = {}, door?: ReturnType<typeof recording>["door"]) {
  const r = await rig(options);
  const result = await standMirror({ ...r.options, ...(door ? { door: door as never } : {}) }, r.seams) as any;
  expect(result.kind).toBe("mirror");
  await result.settled;
  const shadow = r.host.shadowRoot!;
  const send = (event: Record<string, unknown>) => result.tw.rootWidget.dispatchEvent(event);
  return { r, result, shadow, send, tw: result.tw, done: () => { result.unmount(); r.host.remove(); } };
}
const alertOf = (tw: any, kind: string) => tw.wiki.getTiddler(`$:/temp/lares/alert/refused/${kind}`);

test("the pane's document shape mirrors a stock page: a body stand-in, the page container its first child, the root the engine's own", async () => {
  const m = await stood();
  try {
    const body = m.shadow.querySelector(".lar-mirror.tc-body")!;
    expect(body.firstElementChild?.classList.contains("tc-page-container-wrapper")).toBe(true);
    expect(m.tw.pageContainer).toBe(body.firstElementChild);
    expect(body.firstElementChild!.querySelector(".tc-page-container")).not.toBeNull();   // the page template rendered beneath it
    expect(m.tw.pageScroller.scrollIntoView).toBeTypeOf("function");
  } finally { m.done(); }
});
test("tm-modal paints stock's modal inside the pane, and the page's own body gains nothing; closing it clears the pane", async () => {
  const m = await stood();
  try {
    const before = document.body.childElementCount;
    m.tw.wiki.addTiddler(new m.tw.Tiddler({ title: "Ask", text: "A question in the pane", subtitle: "Hear this" }));
    m.send({ type: "tm-modal", param: "Ask" });
    const wrapper = m.shadow.querySelector(".tc-modal-wrapper");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.textContent).toContain("A question in the pane");
    expect(document.body.childElementCount).toBe(before);
    expect(document.body.querySelector(".tc-modal-wrapper")).toBeNull();
    expect(wrapper!.parentElement).toBe(m.shadow.querySelector(".lar-mirror"));              // beside the page container, as stock appends to the body
  } finally { m.done(); }
});
test("tm-notify paints the notification inside the pane", async () => {
  const m = await stood();
  try {
    m.tw.wiki.addTiddler(new m.tw.Tiddler({ title: "Note", text: "Saved to the island" }));
    m.send({ type: "tm-notify", param: "Note" });
    expect(m.shadow.querySelector(".tc-notification")?.textContent).toContain("Saved to the island");
    expect(document.body.querySelector(".tc-notification")).toBeNull();
  } finally { m.done(); }
});
test("copy, download and full screen ask the surface's door; copy answers with stock's notification", async () => {
  const d = recording(); const m = await stood({}, d.door);
  try {
    m.send({ type: "tm-copy-to-clipboard", param: "words to carry" });
    m.send({ type: "tm-download-file", param: "$:/core/templates/exporters/JsonFile", paramObject: { filename: "wiki.json", type: "application/json", exportFilter: "[[Landed1]]" } });
    m.send({ type: "tm-full-screen", param: "enter" });
    expect(d.asks.map(a => a.kind)).toEqual(["clipboard", "download", "fullscreen"]);
    expect(d.asks[0]!.args).toEqual({ text: "words to carry" });
    expect(d.asks[1]!.args).toMatchObject({ filename: "wiki.json", type: "application/json" });
    expect(String(d.asks[1]!.args["text"])).toContain("Landed1");                               // the export rendered in the engine, as stock saves it
    expect(d.asks[2]!.args).toEqual({ mode: "enter" });
    expect(m.shadow.querySelector(".tc-notification")).not.toBeNull();
  } finally { m.done(); }
});
test("the house's own root doors (permalink, print, refresh) reach the same door through $tw.lares.serviceDoor", async () => {
  const d = recording(); const m = await stood({}, d.door);
  try {
    m.send({ type: "tm-permalink", param: "Landed1" }); m.send({ type: "tm-print" }); m.send({ type: "tm-browser-refresh" });
    expect(d.asks).toEqual([{ kind: "route", args: { action: "permalink", title: "Landed1" } }, { kind: "print", args: {} }, { kind: "route", args: { action: "reload" } }]);
  } finally { m.done(); }
});
test("a door the surface refuses, and a mirror with no door at all, name the refusal on the alert rail; CONTROL an opened door raises none", async () => {
  const refusing = recording("page-action-unavailable"); const a = await stood({}, refusing.door);
  try { a.send({ type: "tm-full-screen" }); expect(alertOf(a.tw, "fullscreen")?.fields.tags).toContain("$:/tags/Alert"); } finally { a.done(); }
  forgetEvidence();
  const b = await stood();
  try { b.send({ type: "tm-copy-to-clipboard", param: "x" }); expect(alertOf(b.tw, "clipboard")).toBeDefined(); } finally { b.done(); }
  forgetEvidence();
  const open = recording(); const c = await stood({}, open.door);
  try { c.send({ type: "tm-full-screen" }); expect(alertOf(c.tw, "fullscreen")).toBeUndefined(); } finally { c.done(); }
});
test("tm-http-request makes no request and refuses by name", async () => {
  const m = await stood(); const seen: string[] = []; const stock = window.fetch;
  window.fetch = ((...args: Parameters<typeof fetch>) => { seen.push(String(args[0])); return stock(...args); }) as typeof fetch;
  try {
    m.send({ type: "tm-http-request", paramObject: { url: "https://example.invalid/x" } });
    expect(seen).toEqual([]);
    expect(alertOf(m.tw, "http-request")?.fields.text).toContain("example.invalid");
  } finally { window.fetch = stock; m.done(); }
});
test("a key reaches the wiki's shortcuts only while it travels through the pane, and never after the camera leaves", async () => {
  const m = await stood();
  const seen: string[] = [];
  // The stock handler under the camera's guard: count what reaches it.
  const manager = m.tw.keyboardManager; const guarded = manager.handleKeydownEvent;
  const inside = new KeyboardEvent("keydown", { key: "a", bubbles: true, composed: true });
  const outside = new KeyboardEvent("keydown", { key: "a", bubbles: true, composed: true });
  const probe = (event: KeyboardEvent) => { seen.push(guarded.call(manager, event) === false && !event.composedPath().includes(m.r.host) ? "kept-out" : "reached"); };
  m.shadow.querySelector(".lar-mirror")!.addEventListener("keydown", e => probe(e as KeyboardEvent));
  const elsewhere = document.createElement("input"); document.body.append(elsewhere);
  elsewhere.addEventListener("keydown", e => probe(e as KeyboardEvent));
  try {
    m.shadow.querySelector(".lar-mirror")!.dispatchEvent(inside); elsewhere.dispatchEvent(outside);
    expect(seen).toEqual(["reached", "kept-out"]);
  } finally { elsewhere.remove(); m.done(); }
  expect(manager.handleKeydownEvent).not.toBe(guarded);                                         // the stock handler stands again once the camera leaves
});
test("tm-scroll moves the pane's own scroll box, never the window", async () => {
  const m = await stood({ records: Array.from({ length: 30 }, (_, i) => ({ title: `Long${i}`, fields: { text: "line\n\n".repeat(40) } })) });
  try {
    m.r.host.style.cssText = "display:block;height:300px;width:900px";
    const body = m.shadow.querySelector<HTMLElement>(".lar-mirror")!;
    m.tw.wiki.addTiddler(new m.tw.Tiddler({ title: "$:/StoryList", list: Array.from({ length: 30 }, (_, i) => `Long${i}`) }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const target = m.shadow.querySelector<HTMLElement>('[data-tiddler-title="Long20"]');
    expect(target).not.toBeNull();
    const windowAt = window.scrollY;
    m.send({ type: "tm-scroll", target, paramObject: { animationDuration: "0" } });
    expect(body.scrollTop).toBeGreaterThan(0);
    expect(window.scrollY).toBe(windowAt);
  } finally { m.done(); }
});
test("a wiki's own StartupAction record never runs a second time on the surface; CONTROL the record itself stands", async () => {
  const m = await stood({ records: [{ title: "$:/person/on-start", fields: { tags: "$:/tags/StartupAction", text: `<$action-setfield $tiddler="Ran On The Page" text="yes"/>` } }] });
  try {
    expect(m.tw.wiki.tiddlerExists("Ran On The Page")).toBe(false);
    expect(m.tw.wiki.tiddlerExists("$:/person/on-start")).toBe(true);
    expect(m.r.messages.filter(msg => msg.type === "port:write")).toEqual([]);
  } finally { m.done(); }
});

test("the mirror's door: reload moves the mirror's life, a permalink reaches the clipboard in stock's form, an unknown kind refuses", async () => {
  const copied: string[] = []; let reloads = 0;
  const door = makeMirrorDoor({ host: document.body, story: () => ["A", "B C"], route: { reload: () => { reloads += 1; } },
    doors: { clipboard: args => { copied.push(String(args["text"])); } } });
  const ask = (kind: string, args: Record<string, string>) => new Promise<string>(resolve => door.ask(kind, args, resolve));
  expect(await ask("route", { action: "reload" })).toBe("ok"); expect(reloads).toBe(1);
  expect(await ask("route", { action: "permalink", title: "B C" })).toBe("ok");
  expect(await ask("route", { action: "permaview", title: "A" })).toBe("ok");
  expect(copied.map(link => link.slice(link.indexOf("#")))).toEqual([routeFragment("B C", null), routeFragment("A", ["A", "B C"])]);
  expect(routeFragment("A", ["A", "B C"])).toBe("#A:A%20%5B%5BB%20C%5D%5D");
  expect(await ask("open-surface", { title: "A" })).toBe("page-action-unavailable");
  expect(await ask("route", { action: "elsewhere" })).toBe("page-action-unavailable");
});
