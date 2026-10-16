/**
 * projection-morph.test — THE PROJECTION MORPHS IN PLACE. The page sink paints a frame's `lar:surface` key
 * through idiomorph (`morphStyle: "innerHTML"`) inside the host's shadow root, with the sensed-revision veto on
 * `beforeNodeMorphed` / `beforeAttributeUpdated`. This pins the contract that call rides, in a real browser, on
 * the idiomorph the vessel ships:
 *
 *   · a node whose id stands in both frames is the SAME node after the morph (identity kept, not rebuilt);
 *   · the focused input keeps the value the person is typing, though the frame carries another;
 *   · CONTROL: an input the person never moved takes the frame's value, so the keep reads the person's own
 *     revision, never a no-op.
 *
 * Idiomorph's own `ignoreActiveValue` reads `document.activeElement`, which names the shadow HOST, never the field
 * inside it; the last vector pins that, so nobody reaches for the option as if it guarded a projected field.
 */
import { describe, test, expect } from "vitest";
import { Idiomorph } from "idiomorph";
import { LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE } from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 64 });
  sink.arm({ sendControlEvent: () => undefined });
  const pane = (): HTMLElement => host.shadowRoot!.querySelector<HTMLElement>(".lar-projection")!;
  return { host, sink, pane, done: () => host.remove() };
}
const frame = (rev: number, html: string, sensed: Record<string, number> = {}): LarSurfaceFrame => ({
  type: LAR_FRAME, wikiUri: "lar:///wiki/lares", cameraId: LAR_CAMERA_STORY, mountEpoch: 1, surface: "lares",
  keys: [{ key: LAR_KEY_SURFACE, rev, html }], sensedRevision: sensed,
});

describe("★ the projection pane morphs in place under the keyed frame ★", () => {
  test("a node standing in both frames keeps its identity, and its text takes the new frame", () => {
    const m = mount();
    m.sink.apply(frame(1, `<section id="s1"><p id="p1">old</p></section>`));
    const before = m.pane().querySelector("#p1");
    m.sink.apply(frame(2, `<section id="s1"><p id="p1">new</p><p id="p2">added</p></section>`));
    const after = m.pane().querySelector("#p1");
    expect(after).toBe(before);
    expect(after?.textContent).toBe("new");
    expect(m.pane().querySelector("#p2")?.textContent).toBe("added");
    m.done();
  });

  test("the focused input keeps the value being typed; CONTROL: an input the person never moved takes the frame's value", () => {
    const m = mount();
    m.sink.apply(frame(1, `<input id="typing" data-lar-rid="1" value="a"><input id="idle" data-lar-rid="2" value="a">`));
    const typing = m.pane().querySelector<HTMLInputElement>("#typing")!;
    const idle = m.pane().querySelector<HTMLInputElement>("#idle")!;
    typing.focus();
    typing.value = "half-typed";
    typing.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    m.sink.apply(frame(2, `<input id="typing" data-lar-rid="1" value="from-frame"><input id="idle" data-lar-rid="2" value="from-frame">`));
    expect(m.pane().querySelector("#typing")).toBe(typing);
    expect(typing.value).toBe("half-typed");
    expect(m.host.shadowRoot!.activeElement).toBe(typing);
    expect(idle.value).toBe("from-frame");
    m.done();
  });

  test("idiomorph's ignoreActiveValue never sees a field inside a shadow root: the active element reads the host", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const pane = host.attachShadow({ mode: "open" }).appendChild(document.createElement("div"));
    pane.innerHTML = `<input id="typing" value="a">`;
    const typing = pane.querySelector<HTMLInputElement>("#typing")!;
    typing.focus();
    typing.value = "half-typed";
    expect(document.activeElement).toBe(host);
    Idiomorph.morph(pane, `<input id="typing" value="from-frame">`, { morphStyle: "innerHTML", ignoreActiveValue: true });
    expect(typing.value).toBe("from-frame");
    host.remove();
  });
});
