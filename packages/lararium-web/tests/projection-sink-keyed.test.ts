/**
 * projection-sink-keyed.test — THE PAGE SINK SPEAKS THE CAMERA CONTRACT (`@lararium/mesh` lar-camera).
 *
 * A frame carries keys, each whole under its own revision within one mount epoch; the page keeps a live control
 * while its own revision runs ahead of the revision the frame says it sensed; every relayed act carries an id,
 * the camera, the shown epoch and the shown key revision; and an answer paints its words beside the control it
 * names. Each vector stands beside a control that MUST read the other way. Real Chromium, the shipped idiomorph.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_MEMBERSHIP, LAR_KEY_STYLE, LAR_KEY_SURFACE, LAR_WHOLE_VALUE_MAX_CHARS,
  mkLarControlResult, type LarFrameKey, type LarMsg_ControlEvent,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

function mount(inputMaxChars = 16) {
  const host = document.createElement("div");
  // An offset host: geometry relative to the host differs from the viewport's, so a read of the wrong origin shows.
  host.style.cssText = "margin: 37px 0 0 23px; width: 400px";
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars });
  const sent: Array<{ surface: string; ev: LarMsg_ControlEvent }> = [];
  sink.arm({ sendControlEvent: (surface, ev) => { sent.push({ surface, ev }); } });
  const root = host.shadowRoot!;
  const pane = (): HTMLElement => root.querySelector<HTMLElement>(".lar-projection")!;
  const sheet = (): string => root.querySelector<HTMLStyleElement>("style.lar-frame-style")?.textContent ?? "<no sheet>";
  const refusals = (): HTMLOutputElement[] => [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')];
  return { host, root, sink, sent, pane, sheet, refusals, done: () => host.remove() };
}

interface FrameSpec {
  readonly epoch?: number;
  readonly rev?: number;
  readonly html?: string;
  readonly css?: { readonly rev: number; readonly css: string };
  readonly members?: { readonly rev: number; readonly members: readonly string[] };
  readonly sensed?: Readonly<Record<string, number>>;
}
function frame(surface: string, spec: FrameSpec): LarSurfaceFrame {
  const keys: LarFrameKey[] = [];
  if (spec.html !== undefined) keys.push({ key: LAR_KEY_SURFACE, rev: spec.rev ?? 1, html: spec.html });
  if (spec.css) keys.push({ key: LAR_KEY_STYLE, rev: spec.css.rev, css: spec.css.css });
  if (spec.members) keys.push({ key: LAR_KEY_MEMBERSHIP, rev: spec.members.rev, members: spec.members.members });
  return { type: LAR_FRAME, wikiUri: `lar:///wiki/${surface}`, cameraId: LAR_CAMERA_STORY, mountEpoch: spec.epoch ?? 1, keys, sensedRevision: spec.sensed ?? {}, surface };
}
const typeInto = (field: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};
const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("★ each key keeps its own revision within one mount epoch ★", () => {
  test("a lower surface revision drops while the same frame's newer style key paints; CONTROL: a higher surface revision paints", () => {
    const m = mount();
    expect(m.sink.apply(frame("lares", { rev: 5, html: `<p>five</p>`, css: { rev: 1, css: "p{color:red}" } }))).toBe("painted");
    // The surface key falls behind; the style key moves ahead. Keys never order each other.
    expect(m.sink.apply(frame("lares", { rev: 4, html: `<p>four</p>`, css: { rev: 2, css: "p{color:blue}" } }))).toBe("painted");
    expect(m.pane().textContent).toBe("five");
    expect(m.sheet()).toBe("p{color:blue}");
    // A frame whose every key falls behind drops whole.
    expect(m.sink.apply(frame("lares", { rev: 3, html: `<p>three</p>`, css: { rev: 1, css: "p{color:red}" } }))).toBe("stale-frame");
    expect(m.sheet()).toBe("p{color:blue}");
    // CONTROL: the surface key moving ahead paints.
    expect(m.sink.apply(frame("lares", { rev: 6, html: `<p>six</p>` }))).toBe("painted");
    expect(m.pane().textContent).toBe("six");
    m.done();
  });

  test("a new mount epoch paints every key whole whatever its numbers; CONTROL: the same numbers under the old epoch drop", () => {
    const m = mount();
    m.sink.apply(frame("lares", { epoch: 1, rev: 9, html: `<p>epoch one at nine</p>`, css: { rev: 9, css: "p{margin:9px}" } }));
    // CONTROL first: the same low numbers under the epoch already shown drop as stale.
    expect(m.sink.apply(frame("lares", { epoch: 1, rev: 1, html: `<p>late</p>`, css: { rev: 1, css: "p{margin:1px}" } }))).toBe("stale-frame");
    expect(m.pane().textContent).toBe("epoch one at nine");
    // A resend mints a new epoch, and its keys paint whole from revision one.
    expect(m.sink.apply(frame("lares", { epoch: 2, rev: 1, html: `<p>epoch two at one</p>`, css: { rev: 1, css: "p{margin:1px}" } }))).toBe("painted");
    expect(m.pane().textContent).toBe("epoch two at one");
    expect(m.sheet()).toBe("p{margin:1px}");
    m.done();
  });

  test("a switch paints the arriving surface whole and an absent style key keeps that surface's own sheet; CONTROL: a surface never shown holds no sheet", () => {
    const m = mount();
    m.sink.apply(frame("alpha", { rev: 4, html: `<p>alpha</p>`, css: { rev: 4, css: ".a{}" } }));
    // CONTROL: beta's first showing carries no style key, and alpha's sheet never leaks into it.
    expect(m.sink.apply(frame("beta", { rev: 1, html: `<p>beta</p>` }))).toBe("painted");
    expect(m.sheet()).toBe("");
    m.sink.apply(frame("beta", { rev: 2, html: `<p>beta</p>`, css: { rev: 1, css: ".b{}" } }));
    expect(m.sheet()).toBe(".b{}");
    // Back to alpha, under the same epoch and LOWER numbers than alpha last showed: the switch paints it whole,
    // and with no style key in the frame the sheet the sink held for alpha returns.
    expect(m.sink.apply(frame("alpha", { rev: 1, html: `<p>alpha again</p>` }))).toBe("painted");
    expect(m.pane().textContent).toBe("alpha again");
    expect(m.sheet()).toBe(".a{}");
    m.done();
  });

  test("the membership key's revision rides every act as seenMembershipRev; CONTROL: an act before any membership key carries none", () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">go</button>` }));
    m.pane().querySelector("button")!.click();
    expect(m.sent[0]!.ev.seenMembershipRev).toBeUndefined();
    m.sink.apply(frame("lares", { rev: 2, html: `<button data-lar-rid="7" data-lar-on="click">go</button>`, members: { rev: 3, members: [LAR_KEY_SURFACE, LAR_KEY_STYLE] } }));
    m.pane().querySelector("button")!.click();
    expect(m.sent[1]!.ev.seenMembershipRev).toBe(3);
    expect(m.sink.members()).toEqual([LAR_KEY_SURFACE, LAR_KEY_STYLE]);
    m.done();
  });

  test("NONSENSE CONTROL: a frame the contract's reader refuses paints nothing", () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 1, html: `<p>kept</p>` }));
    const broken = { ...frame("lares", { rev: 2, html: `<p>broken</p>` }), keys: [{ key: LAR_KEY_SURFACE, rev: 2, html: "<p>x</p>", css: "two payloads" }] } as unknown as LarSurfaceFrame;
    expect(m.sink.apply(broken)).toBe("malformed");
    expect(m.sink.apply({ ...frame("lares", { rev: 3, html: `<p>no surface</p>` }), surface: "" })).toBe("malformed");
    expect(m.pane().textContent).toBe("kept");
    m.done();
  });
});

describe("★ the sensed-revision veto keeps a live control the person moved ahead ★", () => {
  test("a blurred field the person typed in keeps its node, value and selection against a frame that sensed less; CONTROL: a frame that sensed it reconciles", () => {
    const m = mount(64);
    m.sink.apply(frame("lares", { rev: 1, html: `<textarea data-lar-rid="5">first</textarea><button>elsewhere</button>` }));
    const area = m.pane().querySelector("textarea")!;
    area.focus();
    typeInto(area, "first typed");
    area.setSelectionRange(2, 4);
    m.pane().querySelector("button")!.focus();        // the person moved on: focus no longer guards the field
    expect(m.root.activeElement).not.toBe(area);
    // A frame rendered before the keystroke reached the island: newer surface key, older sensed revision.
    m.sink.apply(frame("lares", { rev: 2, html: `<textarea data-lar-rid="5">first</textarea><button>elsewhere</button>`, sensed: { "5": 0 } }));
    expect(m.pane().querySelector("textarea")).toBe(area);
    expect(area.value).toBe("first typed");
    expect([area.selectionStart, area.selectionEnd]).toEqual([2, 4]);
    // CONTROL: the island sensed revision 1, so its value reconciles into the field.
    m.sink.apply(frame("lares", { rev: 3, html: `<textarea data-lar-rid="5">the island's word</textarea><button>elsewhere</button>`, sensed: { "5": 1 } }));
    expect(area.value).toBe("the island's word");
    m.done();
  });

  test("a composing node never morphs, though the frame sensed it; CONTROL: after compositionend the same frame reconciles", () => {
    const m = mount(64);
    m.sink.apply(frame("lares", { rev: 1, html: `<input data-lar-rid="6" value="ka">` }));
    const field = m.pane().querySelector("input")!;
    field.focus();
    typeInto(field, "kan");                                            // localRev 1, sensed below
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, composed: true }));
    field.value = "kanj";
    m.sink.apply(frame("lares", { rev: 2, html: `<input data-lar-rid="6" value="island">`, sensed: { "6": 9 } }));
    expect(field.value).toBe("kanj");
    field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true, data: "kanji" }));
    m.sink.apply(frame("lares", { rev: 3, html: `<input data-lar-rid="6" value="island">`, sensed: { "6": 9 } }));
    expect(field.value).toBe("island");
    m.done();
  });

  test("undo survives an older frame because the node and its value stay; CONTROL: a repaint that writes the value leaves undo nothing typed to return", () => {
    const m = mount(64);
    const html = (text: string) => `<textarea data-lar-rid="5">${text}</textarea>`;
    m.sink.apply(frame("lares", { rev: 1, html: html("first") }));
    const area = m.pane().querySelector("textarea")!;
    area.focus();
    area.setSelectionRange(5, 5);
    expect(document.execCommand("insertText", false, " typed")).toBe(true);   // a real edit: an input event and an undo step
    expect(area.value).toBe("first typed");
    m.sink.apply(frame("lares", { rev: 2, html: html("first"), sensed: {} }));
    area.focus();
    document.execCommand("undo");
    expect(area.value).toBe("first");
    document.execCommand("redo");
    expect(area.value).toBe("first typed");
    // CONTROL: a frame that sensed the edit and carries another value writes the node, and the edit history
    // no longer returns the typed text.
    m.sink.apply(frame("lares", { rev: 3, html: html("rewritten"), sensed: { "5": 99 } }));
    expect(area.value).toBe("rewritten");
    area.focus();
    document.execCommand("undo");
    expect(area.value).not.toBe("first");
    m.done();
  });

  test("the control id reads data-control-id where the template named one; CONTROL: an unnamed field reads its render id", () => {
    const m = mount(64);
    m.sink.apply(frame("lares", { rev: 1, html: `<lar-field data-control-id="character.level"><input id="lvl" value="2"></lar-field><input data-lar-rid="9" value="x">` }));
    const named = m.pane().querySelector<HTMLInputElement>("#lvl")!;
    typeInto(named, "3");
    const bare = m.pane().querySelector<HTMLInputElement>('[data-lar-rid="9"]')!;
    typeInto(bare, "y");
    expect(m.sent.map(({ ev }) => [ev.controlId, ev.renderId])).toEqual([["character.level", undefined], [undefined, "9"]]);
    // The veto reads the named control's revision under its own id: sensed under the render-id space it holds nothing.
    m.sink.apply(frame("lares", { rev: 2, html: `<lar-field data-control-id="character.level"><input id="lvl" value="2"></lar-field><input data-lar-rid="9" value="x">`, sensed: { "character.level": 0, "9": 1 } }));
    expect(named.value).toBe("3");
    expect(bare.value).toBe("x");                                                // CONTROL: sensed at its local revision, it reconciles
    m.done();
  });
});

describe("★ the return leg speaks lar:control-event ★", () => {
  test("a click relays lar:act / lar:click with a minted id, the camera, the shown epoch and key revision, modifiers, button and host-relative geometry", () => {
    const m = mount();
    m.sink.apply(frame("lares", { epoch: 4, rev: 12, html: `<button data-lar-rid="7" data-lar-on="click" style="display:block;margin:10px 0 0 15px;width:80px;height:20px">go</button>` }));
    const button = m.pane().querySelector("button")!;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, shiftKey: true, button: 0 }));
    button.click();
    expect(m.sent).toHaveLength(2);
    const { surface, ev } = m.sent[0]!;
    expect(surface).toBe("lares");
    expect(ev).toMatchObject({ type: "lar:control-event", kind: "lar:act", action: "lar:click", cameraId: LAR_CAMERA_STORY, mountEpoch: 4, seenFrameRev: 12, renderId: "7" });
    expect(ev.modifiers).toEqual({ ctrl: false, meta: false, alt: false, shift: true, button: 0 });
    const rect = button.getBoundingClientRect();
    const hostRect = m.host.getBoundingClientRect();
    expect(ev.geometry).toEqual({ top: rect.top - hostRect.top, left: rect.left - hostRect.left, right: rect.right - hostRect.left, bottom: rect.bottom - hostRect.top, width: rect.width, height: rect.height });
    // CONTROL: the geometry's origin reads the host, never the viewport, and every act mints its own id.
    expect(ev.geometry!.top).not.toBe(rect.top);
    expect(m.sent[1]!.ev.eventId).not.toBe(ev.eventId);
    expect(ev.eventId.length).toBeGreaterThan(0);
    m.done();
  });

  test("Escape and modifier chords relay lar:key with the real chord; CONTROL: a bare letter, a bare modifier and keyCode 229 never cross", () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 2, html: `<div data-lar-rid="8" data-lar-on="keydown"><textarea></textarea></div>` }));
    const area = m.pane().querySelector("textarea")!;
    const key = (init: KeyboardEventInit) => area.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, ...init }));
    key({ key: "Enter", code: "Enter", keyCode: 13, ctrlKey: true });
    key({ key: "Escape", code: "Escape", keyCode: 27 });
    key({ key: "a", code: "KeyA", keyCode: 65 });
    key({ key: "Control", code: "ControlLeft", keyCode: 17, ctrlKey: true });
    key({ key: "Process", code: "KeyA", keyCode: 229, ctrlKey: true });          // an IME's key, wearing a modifier
    expect(m.sent.map(({ ev }) => [ev.kind, ev.action, ev.renderId, ev.key?.key, ev.key?.code, ev.key?.keyCode, ev.modifiers?.ctrl])).toEqual([
      ["lar:act", "lar:key", "8", "Enter", "Enter", 13, true],
      ["lar:act", "lar:key", "8", "Escape", "Escape", 27, false],
    ]);
    m.done();
  });

  test("a key chord in the task after compositionend never crosses; CONTROL: the same chord one task later crosses", async () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 2, html: `<div data-lar-rid="8" data-lar-on="keydown"><input value=""></div>` }));
    const field = m.pane().querySelector("input")!;
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, composed: true }));
    field.value = "日本";
    field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true, data: "日本" }));
    const chord = () => field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "Enter", code: "Enter", keyCode: 13, metaKey: true }));
    chord();
    expect(m.sent.filter(({ ev }) => ev.action === "lar:key")).toHaveLength(0);
    await nextTask();
    chord();
    expect(m.sent.filter(({ ev }) => ev.action === "lar:key")).toHaveLength(1);
    // The composition's whole value crossed once as a sense.
    expect(m.sent.filter(({ ev }) => ev.kind === "lar:sense").map(({ ev }) => ev.wholeValue)).toEqual(["日本"]);
    m.done();
  });

  test("input relays lar:sense and change relays lar:act / lar:commit, each whole with a rising localRev; CONTROL: a composing input relays nothing", () => {
    const m = mount(64);
    m.sink.apply(frame("lares", { epoch: 2, rev: 3, html: `<input data-lar-rid="9" value="a">` }));
    const field = m.pane().querySelector("input")!;
    typeInto(field, "ab");
    typeInto(field, "abc");
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, composed: true }));
    field.value = "abcd";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, isComposing: true }));
    field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true }));
    field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    expect(m.sent.map(({ ev }) => [ev.kind, ev.action, ev.wholeValue, ev.localRev, ev.mountEpoch, ev.seenFrameRev])).toEqual([
      ["lar:sense", "lar:sense", "ab", 1, 2, 3],
      ["lar:sense", "lar:sense", "abc", 2, 2, 3],
      ["lar:sense", "lar:sense", "abcd", 3, 2, 3],                // the composition's end, once
      ["lar:act", "lar:commit", "abcd", 4, 2, 3],
    ]);
    m.done();
  });
});

describe("★ a value past the bound never crosses, and says so beside its control ★", () => {
  test("the input-too-long words stand beside the field, outside the morphed pane; CONTROL: a value within the bound raises none and crosses", () => {
    const m = mount(16);
    m.sink.apply(frame("lares", { rev: 1, html: `<input data-lar-rid="9" value="">` }));
    const field = m.pane().querySelector("input")!;
    typeInto(field, "x".repeat(16));
    expect(m.refusals()).toHaveLength(0);
    typeInto(field, "x".repeat(17));
    expect(m.sent.map(({ ev }) => ev.wholeValue)).toEqual(["x".repeat(16)]);
    const [word] = m.refusals();
    expect(word?.textContent).toBe("This field exceeds 16 characters. Shorten it before saving.");
    expect(word?.dataset["larReason"]).toBe("input-too-long");
    expect(m.pane().contains(word!)).toBe(false);
    expect(field.getAttribute("aria-describedby")).toBe(word!.id);
    m.done();
  });

  test("the bound never exceeds the contract's line, and at the line the words read the canon's own", () => {
    const m = mount(LAR_WHOLE_VALUE_MAX_CHARS * 2);
    m.sink.apply(frame("lares", { rev: 1, html: `<textarea data-lar-rid="9"></textarea>` }));
    typeInto(m.pane().querySelector("textarea")!, "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS + 1));
    expect(m.sent).toHaveLength(0);
    expect(m.refusals()[0]?.textContent).toBe("This field exceeds 65,536 characters. Shorten it before saving.");
    m.done();
  });
});

describe("★ the answer rail paints a refusal beside its control and clears it on applied ★", () => {
  const click = (m: ReturnType<typeof mount>, rid: string): LarMsg_ControlEvent => {
    m.pane().querySelector<HTMLElement>(`[data-lar-rid="${rid}"]`)!.click();
    return m.sent.at(-1)!.ev;
  };
  const answer = (ev: LarMsg_ControlEvent, over: Partial<Parameters<typeof mkLarControlResult>[0]> = {}) =>
    mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch, ...(ev.renderId ? { renderId: ev.renderId } : {}), ...(ev.controlId ? { controlId: ev.controlId } : {}), status: "applied", ...over });

  test("stale-target paints the canon's words beside the control and survives the next frame; a later applied clears it", () => {
    const m = mount();
    const html = `<button data-lar-rid="7" data-lar-on="click">bump</button><button data-lar-rid="8" data-lar-on="click">other</button>`;
    m.sink.apply(frame("lares", { rev: 1, html }));
    const first = click(m, "7");
    expect(m.sink.applyResult(answer(first, { status: "stale-target" }))).toBe("painted");
    expect(m.refusals().map((o) => [o.dataset["larFor"], o.textContent])).toEqual([["7", "This control changed before your action arrived. Review it and try again."]]);
    m.sink.apply(frame("lares", { rev: 2, html }));
    expect(m.refusals()).toHaveLength(1);
    // CONTROL: an applied answer for ANOTHER control leaves the word standing.
    expect(m.sink.applyResult(answer(click(m, "8")))).toBe("cleared");
    expect(m.refusals()).toHaveLength(1);
    expect(m.sink.applyResult(answer(click(m, "7")))).toBe("cleared");
    expect(m.refusals()).toHaveLength(0);
    m.done();
  });

  test("a named refusal paints its words; the word leaves with its control", () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">bump</button>` }));
    m.sink.applyResult(answer(click(m, "7"), { status: "refused", reason: "page-action-unavailable" }));
    expect(m.refusals()[0]?.textContent).toBe("This browser action has no page control here.");
    m.sink.apply(frame("lares", { rev: 2, html: `<p>the control left</p>` }));
    expect(m.refusals()).toHaveLength(0);
    m.done();
  });

  test("a result for another epoch is ignored; CONTROL: the same answer under the shown epoch paints", () => {
    const m = mount();
    m.sink.apply(frame("lares", { epoch: 1, rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">bump</button>` }));
    const late = click(m, "7");
    m.sink.apply(frame("lares", { epoch: 2, rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">bump</button>` }));
    expect(m.sink.applyResult(answer(late, { status: "stale-target", mountEpoch: 1 }))).toBe("ignored");
    expect(m.refusals()).toHaveLength(0);
    expect(m.sink.applyResult(answer(late, { status: "stale-target", mountEpoch: 2 }))).toBe("painted");
    expect(m.refusals()).toHaveLength(1);
    // NONSENSE CONTROL: an answer to an event this page never relayed reaches no control.
    expect(m.sink.applyResult(answer({ ...late, eventId: "never-sent" }, { status: "stale-target", mountEpoch: 2 }))).toBe("ignored");
    m.done();
  });

  test("a switch drops every word of the surface that gave way", () => {
    const m = mount();
    m.sink.apply(frame("alpha", { rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">bump</button>` }));
    m.sink.applyResult(answer(click(m, "7"), { status: "stale-target" }));
    expect(m.refusals()).toHaveLength(1);
    m.sink.apply(frame("beta", { rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">bump</button>` }));
    expect(m.refusals()).toHaveLength(0);
    m.done();
  });
});

describe("★ a loading plate reads the island's breath until a mount's first surface key paints ★", () => {
  const plate = (m: ReturnType<typeof mount>): HTMLElement => m.root.querySelector<HTMLElement>(".lar-loading-plate")!;
  const up = (m: ReturnType<typeof mount>): boolean => !plate(m).hidden;

  test("before any frame the plate reads the breath; the first frame drops it and paints in one apply", () => {
    const m = mount();
    expect(up(m)).toBe(true);
    m.sink.setBreath("lares", { phase: "hydrating", progress: 0.4 });
    expect(plate(m).dataset["larLoading"]).toBe("hydrating");
    expect(plate(m).textContent).toContain("hydrating");
    expect(plate(m).textContent).toContain("40%");
    expect(m.pane().contains(plate(m))).toBe(false);
    expect(m.sink.apply(frame("lares", { rev: 1, html: `<p>painted</p>` }))).toBe("painted");
    expect(up(m)).toBe(false);
    expect(m.pane().textContent).toBe("painted");
    m.done();
  });

  test("a switch keeps the old frame visible under the plate, inert, until the resend's first frame lands", () => {
    const m = mount();
    m.sink.apply(frame("alpha", { rev: 3, html: `<button data-lar-rid="7" data-lar-on="click">alpha</button>` }));
    m.sink.awaitSurface("beta");
    m.sink.setBreath("beta", { phase: "mounting" });
    expect(up(m)).toBe(true);
    expect(plate(m).dataset["larLoading"]).toBe("mounting");
    expect(m.pane().textContent).toBe("alpha");                       // never a blank
    m.pane().querySelector("button")!.click();
    expect(m.sent).toHaveLength(0);                                    // the old surface's nodes reach no island
    // A frame of the arriving surface that carries no surface key holds: still the old frame, still the plate.
    expect(m.sink.apply(frame("beta", { epoch: 2, css: { rev: 1, css: ".b{}" } }))).toBe("held");
    expect([up(m), m.pane().textContent]).toEqual([true, "alpha"]);
    expect(m.sink.apply(frame("beta", { epoch: 2, rev: 1, html: `<button data-lar-rid="7" data-lar-on="click">beta</button>` }))).toBe("painted");
    expect([up(m), m.pane().textContent, m.sheet()]).toEqual([false, "beta", ".b{}"]);
    m.pane().querySelector("button")!.click();
    expect(m.sent.map(({ surface }) => surface)).toEqual(["beta"]);
    m.done();
  });

  test("a resend on the shown surface raises the plate over its old frame until the new epoch's surface key lands", () => {
    const m = mount();
    m.sink.apply(frame("lares", { epoch: 1, rev: 4, html: `<p>epoch one</p>` }));
    expect(m.sink.apply(frame("lares", { epoch: 2, css: { rev: 1, css: "p{}" } }))).toBe("painted");
    expect([up(m), m.pane().textContent]).toEqual([true, "epoch one"]);
    m.sink.apply(frame("lares", { epoch: 2, rev: 1, html: `<p>epoch two</p>` }));
    expect([up(m), m.pane().textContent]).toEqual([false, "epoch two"]);
    m.done();
  });

  test("CONTROL: a later frame of the same epoch, a breath for the painted surface, and a wait on the shown surface never raise the plate", () => {
    const m = mount();
    m.sink.apply(frame("lares", { rev: 1, html: `<p>one</p>` }));
    m.sink.apply(frame("lares", { rev: 2, html: `<p>two</p>`, css: { rev: 1, css: "" } }));
    m.sink.setBreath("lares", { phase: "rendering" });
    m.sink.awaitSurface("lares");
    expect(up(m)).toBe(false);
    m.sink.apply(frame("lares", { rev: 3, css: { rev: 2, css: "p{}" } }));
    expect(up(m)).toBe(false);
    m.done();
  });
});
