/**
 * engine-probes.page.test — PROBES 1 AND 5 OF `page-controls#/measure-first`, read in the engine that runs them.
 *
 * The web suite runs once per engine (`vitest.config.ts`: Chromium, Firefox, WebKit). This file holds what a
 * synthetic event cannot answer in any one engine:
 *
 *   - the ENGINE IDENTITY control: the instance the runner names and the engine the page reports agree, so a
 *     config that lists three engines but launches one reads red here, never green by silence;
 *   - probe 1, on the engine's own editing stack: a real keystroke types, an older absolute frame lands, and the
 *     value, caret, focus and undo step the person holds stay theirs (the keyed suite drives the same vectors with
 *     `execCommand`; this one types with the engine's keyboard);
 *   - probe 5: a real Escape closes an open popover, focus returns to the opener, and each control keeps its
 *     accessible role and name for a screen reader in that engine (a hidden panel leaves the accessibility tree).
 *
 * Composition stays synthetic (`CompositionEvent` in the keyed suite): no engine's automation drives a real IME,
 * so the IME rules rest on the page's own event handling, and this file names that limit instead of faking it.
 */
import { describe, expect, test } from "vitest";
import { page, server, userEvent } from "vitest/browser";
import { LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, type LarMsg_ControlEvent } from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

const ENGINE_TOKEN: Record<string, RegExp> = {
  chromium: /Chrome\//,
  firefox: /Firefox\//,
  webkit: /AppleWebKit\/(?!.*Chrome\/)/,
};

function mount() {
  const host = document.createElement("div");
  host.style.cssText = "margin: 37px 0 0 23px; width: 400px";
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 4096 });
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { sent.push(ev); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;
  return { host, root, sink, sent, pane, done: () => host.remove() };
}
const frame = (rev: number, html: string, sensed: Record<string, number> = {}): LarSurfaceFrame =>
  ({ type: LAR_FRAME, wikiUri: "lar:///wiki/engines", cameraId: LAR_CAMERA_STORY, mountEpoch: 1, keys: [{ key: LAR_KEY_SURFACE, rev, html }], sensedRevision: sensed, surface: "engines" });

describe("★ the instance names the engine that runs it ★", () => {
  test("the page reports the engine the runner launched; CONTROL: the other two engines' tokens read absent", () => {
    const named = server.browser;
    expect(Object.keys(ENGINE_TOKEN), `the runner names an engine this file knows (${named})`).toContain(named);
    expect(navigator.userAgent, `the page behind the ${named} instance`).toMatch(ENGINE_TOKEN[named]!);
    const others = Object.keys(ENGINE_TOKEN).filter((e) => e !== named);
    expect(others.length).toBe(2);
    expect(
      others.filter((e) => ENGINE_TOKEN[e]!.test(navigator.userAgent)),
      "CONTROL: no other engine's token matches the same page",
    ).toEqual([]);
  });
});

describe("★ probe 1: a typed value outranks an older absolute frame, on the engine's own keyboard ★", () => {
  const FIELD = (value: string): string => `<textarea class="body" aria-label="body" data-lar-rid="5">${value}</textarea>`;

  test("typing holds the value, the caret, the focus and one undo step against a frame that never sensed it; CONTROL: the frame that names the revision takes the value", async () => {
    const m = mount();
    m.sink.apply(frame(1, FIELD("alpha")));
    const area = m.pane().querySelector<HTMLTextAreaElement>("textarea.body")!;
    area.focus();
    area.setSelectionRange(5, 5);
    await userEvent.keyboard("XY");
    expect(area.value).toBe("alphaXY");
    m.sink.apply(frame(2, FIELD("alpha")));                              // an older absolute frame: the island had not sensed the typing
    expect(area.value, "the person's text").toBe("alphaXY");
    expect([area.selectionStart, area.selectionEnd], "the caret").toEqual([7, 7]);
    expect(m.root.activeElement, "focus").toBe(area);
    document.execCommand("undo");
    expect(area.value, "undo steps back through the person's typing").not.toBe("alphaXY");
    document.execCommand("redo");
    expect(area.value).toBe("alphaXY");
    m.sink.apply(frame(3, FIELD("island"), { "5": 99 }));                   // CONTROL: a frame that sensed the typing paints its own value
    expect(area.value).toBe("island");
    m.done();
  });
});

describe("★ probe 5: Escape closes the popover on the engine's own keyboard, and each control keeps its name ★", () => {
  const POP = (hidden: boolean): string =>
    `<div data-lar-rid="9" data-lar-on="keydown" data-lar-bubble="yes"><button class="opener" data-lar-rid="7" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">open</button>`
    + `<div class="pop" data-lar-control="lar-popover"${hidden ? ' hidden="true"' : ""}><button data-lar-rid="8" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">item</button></div></div>`;

  test("a real Escape closes the open popover, returns focus to the opener and relays one lar:dismiss; the item leaves the accessibility tree; CONTROL: open, the item reads as a button named item", async () => {
    const m = mount();
    m.sink.apply(frame(1, POP(true)));
    const opener = m.pane().querySelector<HTMLButtonElement>("button.opener")!;
    expect(page.getByRole("button", { name: "open" }).elements().length, "the opener reads as a button named open").toBe(1);
    expect(page.getByRole("button", { name: "item" }).elements().length, "a hidden popover stands outside the accessibility tree").toBe(0);
    opener.focus();
    await userEvent.keyboard("{Enter}");
    m.sink.apply(frame(2, POP(false)));
    const item = page.getByRole("button", { name: "item" });
    expect(item.elements().length, "CONTROL: the open popover's item reads as a button named item").toBe(1);
    (item.element() as HTMLElement).focus();
    const before = m.sent.length;
    await userEvent.keyboard("{Escape}");
    expect(m.pane().querySelector<HTMLElement>(".pop")!.hidden).toBe(true);
    expect(m.root.activeElement, "focus returns to the opener").toBe(opener);
    expect(m.sent.slice(before).map((ev) => [ev.action, ev.controlType])).toEqual([["lar:dismiss", "lar-popover"]]);
    expect(page.getByRole("button", { name: "item" }).elements().length, "the dismissed item leaves the accessibility tree").toBe(0);
    m.done();
  });
});
