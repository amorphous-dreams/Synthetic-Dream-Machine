/**
 * projection-sink-toggles.test — THE TOGGLE FAMILY ON THE PAGE: checkbox, radio, select (dreamdom#/what-a-sink-keeps).
 *
 * A toggle crosses as one `lar:toggle` act carrying `checked`; a select crosses its whole key set as `lar:sense` on
 * `input` and `lar:choice` on `change`. The browser's own default stays (a checkbox click toggles the box), and the
 * person's state holds against any frame rendered before the island took it in: a toggle or select whose
 * `localRev` runs ahead of the frame's `sensedRevision` keeps `checked` and its selected options. Each vector
 * stands beside a control that MUST read the other way. Real Chromium, the shipped idiomorph.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, type LarMsg_ControlEvent,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host);
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { sent.push(ev); } });
  const pane = (): HTMLElement => host.shadowRoot!.querySelector<HTMLElement>(".lar-projection")!;
  const q = <T extends Element>(sel: string): T => pane().querySelector<T>(sel)!;
  return { sink, sent, pane, q, done: () => host.remove() };
}
const frame = (rev: number, html: string, sensed: Record<string, number> = {}): LarSurfaceFrame => ({
  type: LAR_FRAME, wikiUri: "lar:///wiki/toggles", cameraId: LAR_CAMERA_STORY, mountEpoch: 1, surface: "toggles",
  keys: [{ key: LAR_KEY_SURFACE, rev, html }], sensedRevision: sensed,
});
const box = (checked: boolean, extra = ""): string =>
  `<label class="tc-checkbox cb"><input type="checkbox" data-lar-rid="cb"${checked ? ' checked="checked"' : ""}${extra}><span></span></label>`;
const sel = (chosen: string, multiple = false): string =>
  `<select data-lar-rid="sel"${multiple ? ' multiple="multiple"' : ""}>${["s", "m", "l"].map((k) => `<option value="${k}"${chosen.split(" ").includes(k) ? ' selected="selected"' : ""}>${k}</option>`).join("")}</select>`;
const change = (el: Element, type = "change"): void => { el.dispatchEvent(new Event(type, { bubbles: true, composed: true })); };

describe("★ a toggle crosses as one act, and the browser's default stands ★", () => {
  test("a checkbox click relays ONE lar:toggle carrying checked and a localRev, and the box stays checked; CONTROL: a button click still relays lar:click", () => {
    const m = mount();
    m.sink.apply(frame(1, box(false) + `<button data-lar-rid="b">b</button>`));
    const input = m.q<HTMLInputElement>("input");
    input.click();
    expect(input.checked, "the browser's toggle stood: no blanket preventDefault reached it").toBe(true);
    expect(m.sent.map((e) => [e.kind, e.action, e.checked, e.localRev, e.renderId])).toEqual([["lar:act", "lar:toggle", true, 1, "cb"]]);
    m.q<HTMLLabelElement>("label").click();             // the label works the box: one act again, unchecking
    expect(input.checked).toBe(false);
    expect(m.sent.slice(1).map((e) => [e.action, e.checked, e.localRev])).toEqual([["lar:toggle", false, 2]]);
    m.q<HTMLButtonElement>("button").click();
    expect(m.sent.at(-1)?.action).toBe("lar:click");
    m.done();
  });

  test("a select relays its whole key set: lar:sense on input, lar:choice on change under the same revision; CONTROL: a second choice bumps it", () => {
    const m = mount();
    m.sink.apply(frame(1, sel("m s", true)));
    const select = m.q<HTMLSelectElement>("select");
    for (const o of select.options) o.selected = o.value !== "m";
    change(select, "input");
    change(select);
    expect(m.sent.map((e) => [e.kind, e.action, e.wholeValue, e.localRev])).toEqual([
      ["lar:sense", "lar:sense", ["s", "l"], 1],
      ["lar:act", "lar:choice", ["s", "l"], 1],
    ]);
    select.options[0]!.selected = false;
    change(select, "input");
    change(select);
    expect(m.sent.slice(2).map((e) => [e.action, e.wholeValue, e.localRev])).toEqual([["lar:sense", ["l"], 2], ["lar:choice", ["l"], 2]]);
    m.done();
  });
});

describe("★ the person's unsensed toggle or choice outranks an older render ★", () => {
  test("a frame rendered before the island took the toggle in keeps the box checked; CONTROL: the frame that names its revision unchecks it", () => {
    const m = mount();
    m.sink.apply(frame(1, box(false)));
    const input = m.q<HTMLInputElement>("input");
    input.click();                                            // localRev 1, unsensed
    m.sink.apply(frame(2, box(false), {}));
    expect(input.checked, "the older render never reverts the person's toggle").toBe(true);
    expect(m.q("input"), "the node stays").toBe(input);
    m.sink.apply(frame(3, box(false), { cb: 1 }));           // the island took it in and the store says unchecked
    expect(input.checked).toBe(false);
    m.done();
  });

  test("a single select's unsensed choice survives a frame painting another option selected; CONTROL: the sensed frame re-syncs option.selected", () => {
    const m = mount();
    m.sink.apply(frame(1, sel("m")));
    const select = m.q<HTMLSelectElement>("select");
    select.value = "l";
    change(select, "input");                                  // localRev 1, unsensed
    m.sink.apply(frame(2, sel("s")));
    expect(select.value, "option.selected never re-syncs from parsed HTML over the person's choice").toBe("l");
    expect(select.options[0]!.selected).toBe(false);
    m.sink.apply(frame(3, sel("s"), { sel: 1 }));
    expect(select.value).toBe("s");
    m.done();
  });

  test("a multiple select keeps every option the person left; CONTROL: once sensed, the frame's set paints", () => {
    const m = mount();
    m.sink.apply(frame(1, sel("", true)));
    const select = m.q<HTMLSelectElement>("select");
    select.options[0]!.selected = true; select.options[2]!.selected = true;
    change(select, "input");
    change(select);
    m.sink.apply(frame(2, sel("m", true)));
    expect([...select.selectedOptions].map((o) => o.value)).toEqual(["s", "l"]);
    m.sink.apply(frame(3, sel("m", true), { sel: 1 }));
    expect([...select.selectedOptions].map((o) => o.value)).toEqual(["m"]);
    m.done();
  });

  test("a frame's data-lar-indeterminate paints the box indeterminate; CONTROL: a frame without it clears the state", () => {
    const m = mount();
    m.sink.apply(frame(1, box(false, ' data-lar-indeterminate=""')));
    expect(m.q<HTMLInputElement>("input").indeterminate).toBe(true);
    m.sink.apply(frame(2, box(true)));
    expect(m.q<HTMLInputElement>("input").indeterminate).toBe(false);
    expect(m.q<HTMLInputElement>("input").checked).toBe(true);
    m.done();
  });
});
