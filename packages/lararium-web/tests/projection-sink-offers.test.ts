/**
 * projection-sink-offers.test — FILES, DROPS, ORDER, KEYS AND NAVIGATE ON THE PAGE (dreamdom#/what-a-sink-keeps).
 *
 * The page reads files and drags, holds an order list's live order, decides which keys cross, and composes the
 * address from the story order; the island lands what crosses. Each vector stands beside a control that MUST read
 * the other way, over the real sink in real Chromium.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SHORTCUTS, LAR_KEY_STORY_ORDER, LAR_KEY_SURFACE, LAR_WHOLE_BYTES_MAX,
  mkLarControlResult, type LarFrameKey, type LarMsg_ControlEvent, type LarStoryOrder,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";
import { parseChords } from "../src/controls/lar-chords.js";

function mount(opts: { addressBar?: boolean } = {}) {
  const host = document.createElement("div");
  host.style.cssText = "height: 200px; overflow: auto";
  document.body.appendChild(host);
  const sink = createProjectionSink(host, opts);
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { sent.push(ev); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;
  const q = <T extends Element = HTMLElement>(sel: string): T => { const n = pane().querySelector<T>(sel); if (!n) throw new Error(`no ${sel}`); return n; };
  const words = (id: string): HTMLOutputElement | undefined => [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].find((o) => o.dataset["larFor"] === id);
  return { host, sink, sent, pane, q, words, done: () => host.remove() };
}
let rev = 0;
function frame(html: string, extra: LarFrameKey[] = [], epoch = 1): LarSurfaceFrame {
  return { type: LAR_FRAME, wikiUri: "lar:///wiki/offers", cameraId: LAR_CAMERA_STORY, mountEpoch: epoch, surface: "offers", sensedRevision: {},
    keys: [{ key: LAR_KEY_SURFACE, rev: ++rev, html }, ...extra] };
}
const story = (s: LarStoryOrder): LarFrameKey => ({ key: LAR_KEY_STORY_ORDER, rev: ++rev, story: s });
const until = async (check: () => boolean, what: string): Promise<void> => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error(`timed out waiting for ${what}`);
};
const pick = (input: HTMLInputElement, files: File[]): void => {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
const drop = (node: Element, dt: DataTransfer, init: DragEventInit = {}): DragEvent => {
  const e = new DragEvent("drop", { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, ...init });
  node.dispatchEvent(e);
  return e;
};
const keydown = (node: EventTarget, init: KeyboardEventInit & { keyCode: number }): KeyboardEvent => {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, composed: true, ...init });
  Object.defineProperty(e, "keyCode", { value: init.keyCode });
  node.dispatchEvent(e);
  return e;
};
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

describe("★ files and drops cross whole, within the bound ★", () => {
  test("RED: a picked tiddler-JSON file crosses as its text, any other file as bounded bytes beside its name and type — CONTROL: a file past data-max-bytes never crosses and says so beside the picker", async () => {
    const m = mount();
    m.sink.apply(frame(`<lar-file-picker data-max-bytes="64" data-accept=".json,.tid"><label>Import <input type="file" data-lar-rid="p1"></label></lar-file-picker>`));
    const input = m.q<HTMLInputElement>("input");
    expect(input.accept, "the picker hands its accept list to the native input").toBe(".json,.tid");
    const json = `[{"title":"T1","text":"one"}]`;
    pick(input, [new File([json], "one.json", { type: "application/json" })]);
    await until(() => m.sent.length === 1, "the JSON offer");
    expect(m.sent[0]).toMatchObject({ kind: "lar:act", action: "lar:import-offer", renderId: "p1", controlType: "lar-file-picker", wholeValue: json });
    expect(m.sent[0]!.file, "parsed JSON carries no file").toBeUndefined();
    const picker = m.q("lar-file-picker");
    expect(picker.getAttribute("data-lar-status")).toBe("offered");
    m.sink.applyResult(mkLarControlResult({ eventId: m.sent[0]!.eventId, cameraId: LAR_CAMERA_STORY, mountEpoch: 1, renderId: "p1", status: "applied" }));
    expect(picker.getAttribute("data-lar-status")).toBe("applied");

    pick(input, [new File(["title: B\n\nbody"], "b.tid", { type: "" })]);
    await until(() => m.sent.length === 2, "the bytes offer");
    expect(m.sent[1]!.wholeValue).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(m.sent[1]!.wholeValue as Uint8Array)).toBe("title: B\n\nbody");
    expect(m.sent[1]!.file).toEqual({ name: "b.tid", type: "" });

    pick(input, [new File(["x".repeat(65)], "big.tid")]);
    await until(() => m.words("p1") !== undefined, "the refusal");
    await settle();
    expect(m.sent, "CONTROL: the oversize file never crossed").toHaveLength(2);
    expect(m.words("p1")?.dataset["larReason"]).toBe("input-too-long");
    expect(m.words("p1")?.textContent).toBe("This file exceeds 64 bytes. Choose a smaller file; nothing has been imported.");
    expect(picker.getAttribute("data-lar-status")).toBe("refused");
    m.done();
  });

  test("RED: a drop on a node that declares drop relays one lar:drop with the whole title list and the modifiers, and the page cancels it — CONTROL: a drop on an undeclared node relays nothing and keeps its default", async () => {
    const m = mount();
    m.sink.apply(frame(`<div class="dz" data-lar-rid="d1" data-lar-on="drop" data-lar-cancel="dragenter dragover drop">zone</div><div class="plain" data-lar-rid="d2">plain</div>`));
    const dt = new DataTransfer();
    dt.setData("text/x-lar-titles", JSON.stringify(["A", "B C"]));
    const over = new DragEvent("dragover", { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
    m.q(".dz").dispatchEvent(over);
    expect(over.defaultPrevented, "the declared zone accepts the drag").toBe(true);
    const e = drop(m.q(".dz"), dt, { shiftKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toMatchObject({ action: "lar:drop", renderId: "d1", wholeValue: ["A", "B C"], modifiers: { ctrl: false, meta: false, alt: false, shift: true } });
    const other = drop(m.q(".plain"), dt);
    expect(other.defaultPrevented, "CONTROL: the undeclared node keeps its default").toBe(false);
    expect(m.sent).toHaveLength(1);
    m.done();
  });

  test("RED: a dropped file past LAR_WHOLE_BYTES_MAX never crosses and reads input-too-long beside the zone — CONTROL: dropped tiddler JSON crosses as its text", async () => {
    const m = mount();
    m.sink.apply(frame(`<div class="zone" data-lar-rid="z1" data-lar-on="drop">zone</div>`));
    const json = `[{"title":"J","text":"j"}]`;
    const small = new DataTransfer();
    small.setData("text/vnd.tiddler", json);
    drop(m.q(".zone"), small);
    expect(m.sent.map((e) => e.wholeValue)).toEqual([json]);
    const big = new DataTransfer();
    big.items.add(new File([new Uint8Array(LAR_WHOLE_BYTES_MAX + 1)], "big.bin"));
    drop(m.q(".zone"), big);
    await until(() => m.words("z1") !== undefined, "the refusal");
    await settle();
    expect(m.sent, "the oversize bytes never crossed").toHaveLength(1);
    expect(m.words("z1")?.dataset["larReason"]).toBe("input-too-long");
    m.done();
  });
});

describe("★ an order list offers its whole order ★", () => {
  test("RED: dragging an item onto another shows the order at once and relays the whole new order once — CONTROL: a move past the list's edge relays nothing", async () => {
    const m = mount();
    m.sink.apply(frame(`<lar-order-list data-control-id="order" data-tiddler="T" data-field="list"><ol><li data-item-id="a" draggable="true">a <button type="button" data-move="up">up</button></li><li data-item-id="b" draggable="true">b</li><li data-item-id="c" draggable="true">c</li></ol></lar-order-list>`));
    const dt = new DataTransfer();
    m.q('li[data-item-id="c"]').dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    drop(m.q('li[data-item-id="a"]'), dt);
    expect([...m.pane().querySelectorAll("li")].map((li) => li.dataset["itemId"])).toEqual(["c", "a", "b"]);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toMatchObject({ action: "lar:order", controlId: "order", controlType: "lar-order-list", wholeValue: ["c", "a", "b"] });
    m.q<HTMLButtonElement>('li[data-item-id="a"] button').click();
    expect(m.sent.at(-1)!.wholeValue, "a moves above c").toEqual(["a", "c", "b"]);
    m.q<HTMLButtonElement>('li[data-item-id="a"] button').click();
    expect(m.sent, "CONTROL: a already leads; nothing moved, nothing crossed").toHaveLength(2);
    m.done();
  });
});

describe("★ only declared keys leave the page ★", () => {
  test("RED: a chord the crossing set declares crosses to its target and the page cancels it — CONTROL: an undeclared key never leaves the page and keeps its default", () => {
    const m = mount();
    m.sink.apply(frame(`<span class="kb" data-lar-rid="k1" data-lar-on="keydown" data-lar-cancel="keydown:declared" data-lar-keys="enter alt-shift-N" data-lar-bubble="yes"><input class="search" data-lar-rid="k2" data-lar-on="keydown input" data-lar-bubble="yes"></span>`));
    const enter = keydown(m.q("input"), { key: "Enter", code: "Enter", keyCode: 13 });
    expect(enter.defaultPrevented).toBe(true);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toMatchObject({ action: "lar:key", renderId: "k2", key: { key: "Enter", code: "Enter", keyCode: 13, repeat: false } });
    keydown(m.q("input"), { key: "N", code: "KeyN", keyCode: 78, altKey: true, shiftKey: true });
    expect(m.sent).toHaveLength(2);
    const a = keydown(m.q("input"), { key: "a", code: "KeyA", keyCode: 65 });
    expect(a.defaultPrevented, "CONTROL: the typed key keeps its default").toBe(false);
    expect(m.sent, "CONTROL: the undeclared key never crossed").toHaveLength(2);
    const composing = keydown(m.q("input"), { key: "Enter", code: "Enter", keyCode: 229, isComposing: true });
    expect(composing.defaultPrevented).toBe(false);
    expect(m.sent, "a composing key never crosses").toHaveLength(2);
    m.done();
  });

  test("RED: a shortcut chord the lar:shortcuts key names crosses on the document leg, from inside the pane or outside it — CONTROL: a chord it never named relays nothing", () => {
    const m = mount();
    m.sink.apply(frame(`<p data-lar-rid="p">page</p>`, [{ key: LAR_KEY_SHORTCUTS, rev: ++rev, chords: parseChords("alt-shift-G") }]));
    const outside = keydown(document.body, { key: "G", code: "KeyG", keyCode: 71, altKey: true, shiftKey: true });
    expect(outside.defaultPrevented).toBe(true);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toMatchObject({ action: "lar:key", controlId: "lar:document", modifiers: { alt: true, shift: true, ctrl: false, meta: false } });
    expect(m.sent[0]!.renderId).toBeUndefined();
    keydown(m.q("p"), { key: "G", code: "KeyG", keyCode: 71, altKey: true, shiftKey: true });
    expect(m.sent, "inside the pane, one relay, never two").toHaveLength(2);
    const plain = keydown(document.body, { key: "G", code: "KeyG", keyCode: 71, altKey: true });
    expect(plain.defaultPrevented).toBe(false);
    expect(m.sent, "CONTROL: alt-G names no shortcut").toHaveLength(2);
    m.done();
  });
});

describe("★ the story order composes the address and Back routes ★", () => {
  test("RED: a navigation within the mount scrolls the navigated tiddler into view and pushes the address; Back posts lar:route — CONTROL: the mount's first story key scrolls nothing and pushes nothing", async () => {
    const m = mount({ addressBar: true });
    const river = (titles: string[]) => titles.map((t) => `<div class="tc-tiddler-frame" data-tiddler-title="${t}" style="height: 400px">${t}</div>`).join("");
    const startLength = history.length;
    m.sink.apply(frame(river(["A", "B C"]), [story({ order: ["A", "B C"], tail: "A", depth: 1 })]));
    expect(m.sink.route()).toBe(`#A:${encodeURIComponent("A [[B C]]")}`);
    expect(location.hash).toBe(m.sink.route());
    expect(m.host.scrollTop, "CONTROL: the first key scrolls nothing").toBe(0);
    expect(history.length, "CONTROL: the first key pushes nothing").toBe(startLength);

    m.sink.apply(frame(river(["A", "B C"]), [story({ order: ["A", "B C"], tail: "B C", depth: 2 })]));
    await until(() => m.host.scrollTop > 300, "the navigated tiddler to scroll into view");
    expect(history.length).toBe(startLength + 1);
    expect(location.hash.startsWith(`#${encodeURIComponent("B C")}:`)).toBe(true);

    history.back();
    await until(() => m.sent.length === 1, "the route act");
    expect(m.sent[0]).toMatchObject({ action: "lar:route", controlId: "lar:document", wholeValue: "A" });
    // The island's answer to the route lands as a deeper history ending on A: the page replaces, never pushes.
    m.sink.apply(frame(river(["A", "B C"]), [story({ order: ["A", "B C"], tail: "A", depth: 3 })]));
    expect(history.length).toBe(startLength + 1);
    m.done();
  });
});

describe("★ a named page action relays as itself ★", () => {
  test("RED: an allowlisted data-action relays as that action on its control id — CONTROL: a name outside the allowlist relays as an ordinary click", () => {
    const m = mount();
    m.sink.apply(frame(`<lar-action data-control-id="$:/Import" data-action="lar:perform-import"><button type="button">Import</button></lar-action><lar-action data-control-id="other" data-action="lar:delete-everything"><button type="button" data-lar-rid="x">x</button></lar-action>`));
    m.q<HTMLButtonElement>('lar-action[data-control-id="$:/Import"] button').click();
    expect(m.sent[0]).toMatchObject({ action: "lar:perform-import", controlId: "$:/Import" });
    m.q<HTMLButtonElement>('lar-action[data-control-id="other"] button').click();
    expect(m.sent[1]?.action, "CONTROL: no named action outside the allowlist").toBe("lar:click");
    m.done();
  });
});
