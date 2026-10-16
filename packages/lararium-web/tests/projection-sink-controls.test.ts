/**
 * projection-sink-controls.test — THE THREE PAGE CONTROLS RULED FIRST (page-controls#/the-control-set), over the
 * real sink in real Chromium.
 *
 * `lar-field` keeps the person's text against a disagreeing descriptor, offers the newer version, and lands every
 * value it writes on the person's behalf as one undoable edit on the same node; a toolbar act carries the field's
 * pair and its `want` lands only while the field's revision still reads the one the act reserved. `lar-popover`
 * anchors from the control the person activated, and Escape closes it at once. `lar-disclosure` keeps a
 * `<details>` open state the person set. Each vector stands beside a control that MUST read the other way.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, mkLarControlResult, type LarMsg_ControlEvent,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";
import type { LarFieldElement } from "../src/controls/lar-field.js";

function mount() {
  const host = document.createElement("div");
  host.style.cssText = "margin: 37px 0 0 23px; width: 400px";
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 4096 });
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { sent.push(ev); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;
  const words = (): Array<[string | undefined, string | undefined]> =>
    [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].map((o) => [o.dataset["larFor"], o.dataset["larReason"]]);
  return { host, root, sink, sent, pane, words, done: () => host.remove() };
}
const frame = (rev: number, html: string, sensed: Record<string, number> = {}): LarSurfaceFrame =>
  ({ type: LAR_FRAME, wikiUri: "lar:///wiki/controls", cameraId: LAR_CAMERA_STORY, mountEpoch: 1, keys: [{ key: LAR_KEY_SURFACE, rev, html }], sensedRevision: sensed, surface: "controls" });
const field = (value: string, rev: number, first = "first"): string =>
  `<lar-field data-lar-control="lar-field"><textarea class="body" data-lar-rid="5" data-lar-value="${value}" data-lar-value-rev="${rev}">${first}</textarea></lar-field>`;
const BOLD = `<button class="bold" data-lar-rid="6" data-lar-control="lar-field-operation">bold</button>`;
const insert = (area: HTMLTextAreaElement, text: string): void => {
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
  expect(document.execCommand("insertText", false, text)).toBe(true);
};
const answer = (ev: LarMsg_ControlEvent, extra: Partial<Parameters<typeof mkLarControlResult>[0]> = {}) =>
  mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch, renderId: ev.renderId!, status: "applied", ...extra });

describe("★ lar-field: the descriptor, the newer version, take theirs ★", () => {
  test("a clean field takes the descriptor; an edited field keeps its text and offers the descriptor beside it; CONTROL: a descriptor that agrees clears the offer", () => {
    const m = mount();
    m.sink.apply(frame(1, field("first", 1)));
    const area = m.pane().querySelector("textarea")!;
    expect(area.value).toBe("first");
    m.sink.apply(frame(2, field("island", 2)));
    expect(area.value, "never edited, the field takes the island's value").toBe("island");
    insert(area, " typed");
    m.sink.apply(frame(3, field("peer", 3), { "5": 1 }));
    expect(m.pane().querySelector("textarea")).toBe(area);
    expect(area.value).toBe("island typed");
    const lf = area.closest<LarFieldElement>("lar-field")!;
    expect(lf.newerVersion).toBe("peer");
    expect(lf.shadowRoot!.querySelector<HTMLElement>(".newer")!.hidden).toBe(false);
    m.sink.apply(frame(4, field("island typed", 4), { "5": 1 }));
    expect(lf.newerVersion, "CONTROL: the descriptor caught up with the page").toBeNull();
    m.done();
  });

  test("take theirs replaces the value as one undoable edit on the same node and relays lar:take-theirs once; CONTROL: undo returns the person's text", () => {
    const m = mount();
    m.sink.apply(frame(1, field("first", 1)));
    const area = m.pane().querySelector("textarea")!;
    insert(area, " mine");
    m.sink.apply(frame(2, field("theirs", 2), { "5": 1 }));
    const before = m.sent.length;
    area.closest<LarFieldElement>("lar-field")!.shadowRoot!.querySelector<HTMLButtonElement>('button[part="take-theirs"]')!.click();
    expect(m.pane().querySelector("textarea")).toBe(area);
    expect(area.value).toBe("theirs");
    expect(m.sent.slice(before).map((ev) => [ev.kind, ev.action, ev.renderId, ev.controlType])).toEqual([["lar:act", "lar:take-theirs", "5", "lar-field"]]);
    document.execCommand("undo");
    expect(area.value).toBe("first mine");
    m.done();
  });
});

describe("★ lar-field: the toolbar act and its want ★", () => {
  test("a toolbar click carries the last field's pair and revision, and the want lands as one undo step; CONTROL: the click leg relays nothing beside it", () => {
    const m = mount();
    m.sink.apply(frame(1, field("wrap me", 1, "wrap me") + BOLD));
    const area = m.pane().querySelector("textarea")!;
    area.focus();
    area.setSelectionRange(5, 7);
    m.pane().querySelector<HTMLButtonElement>("button.bold")!.click();
    expect(m.sent.map((ev) => [ev.action, ev.renderId, ev.fieldId, ev.wholeValue, ev.selection, ev.localRev])).toEqual([["lar:edit-operation", "6", "5", "wrap me", { start: 5, end: 7 }, 0]]);
    m.sink.applyResult(answer(m.sent[0]!, { want: { value: "wrap ''me''", selStart: 5, selEnd: 11 } }));
    expect(area.value).toBe("wrap ''me''");
    expect([area.selectionStart, area.selectionEnd]).toEqual([5, 11]);
    expect(m.sent, "the want's own write relays no sense").toHaveLength(1);
    document.execCommand("undo");
    expect(area.value).toBe("wrap me");
    m.done();
  });

  test("a want whose field moved on since the act never lands; CONTROL: the person's later typing stands and its revision stays theirs", () => {
    const m = mount();
    m.sink.apply(frame(1, field("wrap me", 1, "wrap me") + BOLD));
    const area = m.pane().querySelector("textarea")!;
    area.focus();
    area.setSelectionRange(5, 7);
    m.pane().querySelector<HTMLButtonElement>("button.bold")!.click();
    insert(area, " now");                                                   // typed before the answer: revision 2
    const typed = m.sent.at(-1)!;
    expect([typed.kind, typed.localRev]).toEqual(["lar:sense", 2]);
    m.sink.applyResult(answer(m.sent[0]!, { want: { value: "wrap ''me''", selStart: 5, selEnd: 11 } }));
    expect(area.value).toBe("wrap me now");
    insert(area, "!");
    expect(m.sent.at(-1)!.localRev).toBe(3);
    m.done();
  });

  test("a refused or stale toolbar answer paints its words beside the field and hands the reserved revision back; CONTROL: no field stood in, the words stand beside the button and nothing crosses", () => {
    const m = mount();
    m.sink.apply(frame(1, BOLD + field("x", 1, "x")));
    m.pane().querySelector<HTMLButtonElement>("button.bold")!.click();
    expect(m.sent).toHaveLength(0);
    expect(m.words()).toEqual([["6", "selection-unavailable"]]);
    const area = m.pane().querySelector("textarea")!;
    area.focus();
    m.pane().querySelector<HTMLButtonElement>("button.bold")!.click();
    m.sink.applyResult(answer(m.sent[0]!, { status: "stale-target" }));
    expect(m.words()).toContainEqual(["5", "stale-target"]);
    insert(area, "y");
    expect(m.sent.at(-1)!.localRev, "the reservation went back: the next edit reads revision 1").toBe(1);
    m.done();
  });
});

describe("★ lar-popover and lar-disclosure ★", () => {
  const POP = (hidden: boolean): string =>
    `<div data-lar-rid="9" data-lar-on="keydown" data-lar-bubble="yes"><button class="opener" data-lar-rid="7" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">open</button>`
    + `<div class="pop" data-lar-control="lar-popover"${hidden ? ' hidden="true"' : ""}><button data-lar-rid="8" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">item</button></div></div>`;

  test("an open popover anchors from the control the person activated; Escape closes it, returns focus and relays one lar:dismiss; CONTROL: with no popover open, Escape crosses as lar:key", () => {
    const m = mount();
    m.sink.apply(frame(1, POP(true)));
    const opener = m.pane().querySelector<HTMLButtonElement>("button.opener")!;
    opener.click();
    m.sink.apply(frame(2, POP(false)));
    const pop = m.pane().querySelector<HTMLElement>(".pop")!;
    const box = opener.getBoundingClientRect();
    expect([pop.style.position, pop.style.top, pop.style.left]).toEqual(["fixed", `${box.bottom}px`, `${box.left}px`]);
    const item = pop.querySelector("button")!;
    item.focus();
    const before = m.sent.length;
    item.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "Escape", code: "Escape", keyCode: 27 }));
    expect(pop.hidden).toBe(true);
    expect(m.root.activeElement).toBe(opener);
    expect(m.sent.slice(before).map((ev) => [ev.action, ev.renderId, ev.controlType])).toEqual([["lar:dismiss", "7", "lar-popover"]]);
    m.sink.apply(frame(3, POP(true)));
    opener.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "Escape", code: "Escape", keyCode: 27 }));
    expect([m.sent.at(-1)!.action, m.sent.at(-1)!.renderId], "the keyboard binding the climb reaches takes the Escape").toEqual(["lar:key", "9"]);
    m.done();
  });

  test("a details the person opened stays open against a frame that paints it closed; CONTROL: a details the person never touched follows the frame", async () => {
    const m = mount();
    const html = (a: boolean, b: boolean): string =>
      `<details class="a"${a ? " open" : ""}><summary>a</summary>body</details><details class="b"${b ? " open" : ""}><summary>b</summary>body</details>`;
    m.sink.apply(frame(1, html(false, false)));
    const a = m.pane().querySelector<HTMLDetailsElement>("details.a")!;
    const b = m.pane().querySelector<HTMLDetailsElement>("details.b")!;
    a.open = true;                                                          // the person's toggle
    await new Promise((resolve) => setTimeout(resolve, 0));                 // toggle fires in a later task
    m.sink.apply(frame(2, html(false, true)));
    expect(a.open).toBe(true);
    expect(b.open).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    m.sink.apply(frame(3, html(false, false)));
    expect(a.open).toBe(true);
    expect(b.open, "CONTROL: the frame's own opening never read as the person's toggle").toBe(false);
    m.done();
  });
});
