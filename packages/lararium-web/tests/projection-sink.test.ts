/**
 * projection-sink.test — THE PAGE'S REPLICA KEEPS EACH SURFACE'S FRAMES, EVENTS AND VALUES APART.
 *
 * Every island counts its own revisions and its own render-ids. One pane shows whichever surface holds the
 * vessel's projection gate, so the sink orders a frame's keys within a surface and its mount epoch, stamps every
 * returned event with the surface that painted its target, and carries nothing across a switch. Real Chromium,
 * the shipped idiomorph, the keyed `lar:frame` of the camera contract.
 */
import { describe, expect, test, vi } from "vitest";
import { LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_STYLE, LAR_KEY_SURFACE, type LarMsg_ControlEvent } from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 16 });
  const events: string[] = [];
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({
    sendControlEvent: (surface, ev) => {
      if (sent.some((prior) => prior.eventId === ev.eventId)) return;
      sent.push(ev);
      const target = ev.controlId ?? ev.renderId;
      events.push(typeof ev.wholeValue === "string" ? `${surface}:${ev.action}:${target}=${ev.wholeValue}` : `${surface}:${ev.action}:${target}`);
    },
  });
  const pane = (): HTMLElement => host.shadowRoot!.querySelector<HTMLElement>(".lar-projection")!;
  return { host, sink, events, sent, pane, done: () => host.remove() };
}
const frame = (surface: string, rev: number, html: string, sensed: Record<string, number> = {}): LarSurfaceFrame => ({
  type: LAR_FRAME, wikiUri: `lar:///wiki/${surface}`, cameraId: LAR_CAMERA_STORY, mountEpoch: 1, surface,
  keys: [{ key: LAR_KEY_SURFACE, rev, html }, { key: LAR_KEY_STYLE, rev, css: "" }], sensedRevision: sensed,
});
const typeInto = (field: HTMLInputElement, value: string): void => {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};

describe("★ revisions belong to a surface ★", () => {
  test("a switch paints the new surface's first frame though its revision runs lower", () => {
    const m = mount();
    expect(m.sink.apply(frame("lares", 10, `<p id="w">wiki at ten</p>`))).toBe("painted");
    // The daemon island counts from its own beginning: its first frame after the summon carries revision 1.
    expect(m.sink.apply(frame("daemon", 1, `<p id="d">daemon at one</p>`))).toBe("painted");
    expect(m.pane().textContent).toBe("daemon at one");
    expect(m.sink.surface()).toBe("daemon");
    // CONTROL: within one surface a lower revision still drops as stale, and the pane keeps the newer frame.
    expect(m.sink.apply(frame("daemon", 3, `<p id="d">daemon at three</p>`))).toBe("painted");
    expect(m.sink.apply(frame("daemon", 2, `<p id="d">daemon at two</p>`))).toBe("stale-frame");
    expect(m.pane().textContent).toBe("daemon at three");
    // Back to the wiki: its frame paints whatever number the daemon reached, and whatever it last showed.
    expect(m.sink.apply(frame("lares", 2, `<p id="w">wiki, a fresh island</p>`))).toBe("painted");
    expect(m.pane().textContent).toBe("wiki, a fresh island");
    m.done();
  });
});

describe("★ the page carries island hints once per rising number ★", () => {
  test("scroll and focus run once for a hint and run again only when its number rises; CONTROL: no hint does nothing", () => {
    const m = mount();
    const target = document.createElement("div");
    target.id = "hint-target";
    target.scrollIntoView = vi.fn();
    const input = document.createElement("input");
    input.className = "hint-field";
    const hint = (n: number): string => `<span data-lar-scroll-to="#hint-target" data-lar-focus=".hint-field" data-lar-hint="${n}"></span>`;
    m.sink.apply(frame("lares", 1, `${target.outerHTML}${input.outerHTML}`));
    const paintedTarget = m.pane().querySelector<HTMLElement>("#hint-target")!;
    const paintedInput = m.pane().querySelector<HTMLInputElement>(".hint-field")!;
    paintedTarget.scrollIntoView = vi.fn();
    paintedInput.focus = vi.fn();
    expect(paintedTarget.scrollIntoView).not.toHaveBeenCalled();
    expect(paintedInput.focus).not.toHaveBeenCalled();
    m.sink.apply(frame("lares", 2, `${target.outerHTML}${input.outerHTML}${hint(1)}`));
    expect(paintedTarget.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(paintedInput.focus).toHaveBeenCalledTimes(1);
    m.sink.apply(frame("lares", 3, `${target.outerHTML}${input.outerHTML}${hint(1)}`));
    expect(paintedTarget.scrollIntoView, "a repeated number scrolls nothing more").toHaveBeenCalledTimes(1);
    expect(paintedInput.focus, "a repeated number focuses nothing more").toHaveBeenCalledTimes(1);
    m.sink.apply(frame("lares", 4, `${target.outerHTML}${input.outerHTML}${hint(2)}`));
    expect(paintedTarget.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(paintedInput.focus).toHaveBeenCalledTimes(2);
    m.sink.apply(frame("daemon", 1, "<p>another surface</p>"));
    m.sink.apply(frame("lares", 4, `${target.outerHTML}${input.outerHTML}${hint(2)}`));
    expect(paintedTarget.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(paintedInput.focus).toHaveBeenCalledTimes(2);
    m.done();
  });
});

describe("★ an invalid hint selector names itself once ★", () => {
  test("a selector the engine refuses warns once per selector across frames; CONTROL: a valid selector warns nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const m = mount();
      const hint = (n: number, sel: string): string => `<span data-lar-scroll-to="${sel}" data-lar-focus="${sel}" data-lar-hint="${n}"></span>`;
      m.sink.apply(frame("lares", 1, `<p id="ok">fine</p>${hint(1, "#ok")}`));
      expect(warn, "CONTROL: a valid selector warns nothing").not.toHaveBeenCalled();
      m.sink.apply(frame("lares", 2, `<p id="ok">fine</p>${hint(2, "!!bad[")}`));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]!.join(" "))).toContain("!!bad[");
      m.sink.apply(frame("lares", 3, `<p id="ok">fine</p>${hint(3, "!!bad[")}`));
      expect(warn, "the same selector names itself once").toHaveBeenCalledTimes(1);
      m.sink.apply(frame("lares", 4, `<p id="ok">fine</p>${hint(4, "??other[")}`));
      expect(warn, "a different selector names itself").toHaveBeenCalledTimes(2);
      m.done();
    } finally { warn.mockRestore(); }
  });
});

describe("★ an event names the surface that painted its target ★", () => {
  test("Escape relays on a focused button; CONTROL: a bare letter does not", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<button data-lar-rid="7" data-lar-on="click keydown">open</button>`));
    const button = m.pane().querySelector("button")!;
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, composed: true }));
    expect(m.sent.map((ev) => [ev.action, ev.renderId, ev.key?.keyCode])).toEqual([["lar:key", "7", 27]]);
    // CONTROL: ordinary typing is not relayed.
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "a", keyCode: 65, bubbles: true, composed: true }));
    expect(m.sent).toHaveLength(1);
    m.done();
  });

  test("modified Enter relays from a textarea; CONTROL: plain Enter and bare Control do not", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<div data-lar-rid="8" data-lar-on="keydown"><textarea></textarea></div>`));
    const area = m.pane().querySelector("textarea")!;
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, ctrlKey: true, bubbles: true, composed: true }));
    expect(m.sent.map((ev) => [ev.action, ev.renderId, ev.key?.keyCode, ev.modifiers?.ctrl])).toEqual([["lar:key", "8", 13, true]]);
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true, composed: true }));
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", keyCode: 17, ctrlKey: true, bubbles: true, composed: true }));
    expect(m.sent).toHaveLength(1);
    m.done();
  });

  test("a new modal focuses its first button and a held modal does not steal focus", () => {
    const m = mount();
    const html = `<div aria-modal="true" role="alertdialog" tabindex="-1"><button data-lar-rid="9" data-lar-on="click">Keep</button><button data-lar-rid="10" data-lar-on="click">Delete</button></div>`;
    m.sink.apply(frame("lares", 1, html));
    const buttons = m.pane().querySelectorAll("button");
    expect(m.host.shadowRoot!.activeElement).toBe(buttons[0]);
    buttons[1].focus();
    // CONTROL: a repeated paint of the same modal preserves the person's new focus.
    m.sink.apply(frame("lares", 2, html));
    expect(m.host.shadowRoot!.activeElement).toBe(m.pane().querySelectorAll("button")[1]);
    m.done();
  });

  test("a modal turns every painted sibling inert, marked by the frame or not; CONTROL: no modal, nothing inert", () => {
    const m = mount();
    const aside = `<div class="aside"><button data-lar-rid="3" data-lar-on="click">behind</button></div>`;
    const modal = `<div class="wrap"><div class="near">near</div><div aria-modal="true" role="alertdialog" tabindex="-1"><button data-lar-rid="9" data-lar-on="click">Keep</button></div></div>`;
    // CONTROL: the same siblings with no modal stay live.
    m.sink.apply(frame("lares", 1, `${aside}<div class="wrap"><div class="near">near</div></div>`));
    expect(m.pane().querySelectorAll("[inert]")).toHaveLength(0);
    m.sink.apply(frame("lares", 2, `${aside}${modal}`));
    expect(m.pane().querySelector(".aside")!.hasAttribute("inert"), "a sibling of the modal's ancestor").toBe(true);
    expect(m.pane().querySelector(".near")!.hasAttribute("inert"), "the modal's own sibling").toBe(true);
    expect(m.pane().querySelector('[aria-modal="true"]')!.closest("[inert]"), "the modal and its ancestors stay live").toBeNull();
    // The modal leaves: the next frame carries no mark, and the page keeps none.
    m.sink.apply(frame("lares", 3, `${aside}<div class="wrap"><div class="near">near</div></div>`));
    expect(m.pane().querySelectorAll("[inert]")).toHaveLength(0);
    m.done();
  });

  test("closing a modal restores prior render-id focus; CONTROL: missing target stays unfocused", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<button data-lar-rid="5" data-lar-on="click">Origin</button>`));
    const origin = m.pane().querySelector("button")!;
    origin.focus();
    const modal = `<div aria-modal="true"><button>Continue</button></div>`;
    m.sink.apply(frame("lares", 2, modal));
    expect(m.host.shadowRoot!.activeElement?.textContent).toBe("Continue");
    m.sink.apply(frame("lares", 3, `<button data-lar-rid="5" data-lar-on="click">Restored</button>`));
    expect(m.host.shadowRoot!.activeElement).toBe(m.pane().querySelector("button"));

    m.sink.apply(frame("lares", 4, `<button data-lar-rid="6" data-lar-on="click">Origin</button>`));
    m.pane().querySelector("button")!.focus();
    m.sink.apply(frame("lares", 5, modal));
    expect(() => m.sink.apply(frame("lares", 6, `<p>gone</p>`))).not.toThrow();
    expect(m.host.shadowRoot!.activeElement).toBeNull();
    m.done();
  });

  test("clicks and whole-value input carry the shown surface, and follow a switch", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<button data-lar-rid="7" data-lar-on="click">open</button><input data-lar-rid="9" value="a">`));
    m.pane().querySelector<HTMLButtonElement>("button")!.click();
    const field = m.pane().querySelector<HTMLInputElement>("input")!;
    typeInto(field, "typed");
    expect(m.events).toEqual(["lares:lar:click:7", "lares:lar:sense:9=typed"]);

    // The daemon's frame reuses render-id 7 for a different node; its click names the daemon.
    m.sink.apply(frame("daemon", 1, `<button data-lar-rid="7" data-lar-on="click">summoned</button>`));
    m.pane().querySelector<HTMLButtonElement>("button")!.click();
    expect(m.events.at(-1)).toBe("daemon:lar:click:7");
    m.done();
  });

  test("an input past the bound relays nothing; CONTROL: one within the bound relays whole", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="9" value="">`));
    const field = m.pane().querySelector<HTMLInputElement>("input")!;
    field.value = "x".repeat(17);
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    expect(m.events).toEqual([]);
    field.value = "x".repeat(16);
    field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    expect(m.events).toEqual([`lares:lar:commit:9=${"x".repeat(16)}`]);
    m.done();
  });
});

describe("★ nothing leaks across a switch ★", () => {
  test("a field a person types in keeps its value across its own surface's frames and ends with that surface", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="5" value="a">`));
    const typing = m.pane().querySelector<HTMLInputElement>("input")!;
    typing.focus();
    typeInto(typing, "typed by hand");
    // CONTROL: the same surface re-projects before it sensed the edit — the field keeps what the person typed.
    m.sink.apply(frame("lares", 2, `<input data-lar-rid="5" value="b">`));
    expect(m.pane().querySelector<HTMLInputElement>("input")!.value).toBe("typed by hand");
    // The daemon's frame carries its own field under the same render-id: it shows the daemon's value.
    m.sink.apply(frame("daemon", 1, `<input data-lar-rid="5" value="daemon value">`));
    const other = m.pane().querySelector<HTMLInputElement>("input")!;
    expect(other).not.toBe(typing);
    expect(other.value).toBe("daemon value");
    m.done();
  });
});

describe("★ a refused input says so beside its field ★", () => {
  const notice = (m: ReturnType<typeof mount>): HTMLElement | null => m.host.shadowRoot!.querySelector<HTMLElement>('output[role="status"]');
  const shown = (m: ReturnType<typeof mount>): boolean => { const n = notice(m); return n !== null && !n.hidden && (n.textContent ?? "") !== ""; };
  const type = (field: HTMLInputElement, value: string): void => {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  };

  test("an input past the bound raises a visible word naming the bound; CONTROL: one within the bound raises none", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="9" value="">`));
    const field = m.pane().querySelector<HTMLInputElement>("input")!;
    // CONTROL: a value the wiki takes shows no word.
    type(field, "x".repeat(16));
    expect(shown(m)).toBe(false);
    type(field, "x".repeat(17));
    expect(m.events).toEqual([`lares:lar:sense:9=${"x".repeat(16)}`]);     // the overlong value never crossed
    expect(shown(m)).toBe(true);
    expect(notice(m)!.textContent).toBe("This field exceeds 16 characters. Shorten it before saving.");
    expect(notice(m)!.dataset["larFor"]).toBe("9");
    // The word stands outside the painted pane, so no frame's morph removes it.
    expect(m.pane().contains(notice(m))).toBe(false);
    m.done();
  });

  test("the word outlives the surface's next frame and leaves when the field relays within the bound", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="9" value="">`));
    const field = m.pane().querySelector<HTMLInputElement>("input")!;
    field.focus();
    type(field, "x".repeat(17));
    m.sink.apply(frame("lares", 2, `<input data-lar-rid="9" value=""><p>another tiddler changed</p>`));
    expect(shown(m)).toBe(true);
    // CONTROL: another field's accepted input leaves the refused field's word standing.
    m.sink.apply(frame("lares", 3, `<input data-lar-rid="9" value=""><input data-lar-rid="4" value="">`));
    type(m.pane().querySelector<HTMLInputElement>('[data-lar-rid="4"]')!, "short");
    expect(shown(m)).toBe(true);
    type(m.pane().querySelector<HTMLInputElement>('[data-lar-rid="9"]')!, "x".repeat(8));
    expect(shown(m)).toBe(false);
    m.done();
  });

  test("the word ends with its surface, and with its field", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="9" value="">`));
    type(m.pane().querySelector<HTMLInputElement>("input")!, "x".repeat(17));
    expect(shown(m)).toBe(true);
    // Another island's frame: its render-ids name other nodes, so the word about a field of the old surface ends.
    m.sink.apply(frame("daemon", 1, `<input data-lar-rid="9" value="">`));
    expect(shown(m)).toBe(false);
    // A frame of the same surface that no longer carries the field ends the word too.
    type(m.pane().querySelector<HTMLInputElement>("input")!, "y".repeat(17));
    expect(shown(m)).toBe(true);
    m.sink.apply(frame("daemon", 2, `<p>the field left</p>`));
    expect(shown(m)).toBe(false);
    m.done();
  });
});
