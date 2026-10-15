/**
 * projection-morph.test — THE PROJECTION MORPHS IN PLACE. `applyProjection` (src/main.ts) re-projects a frame
 * through `Idiomorph.morph(pane, html, { morphStyle: "innerHTML", ignoreActiveValue: true })` so that focus,
 * caret and an in-progress value survive. This pins the contract that call rides, in a real browser, on the
 * idiomorph the vessel ships:
 *
 *   · a node whose id stands in both frames is the SAME node after the morph (identity kept, not rebuilt);
 *   · the focused input keeps the value the person is typing, though the frame carries another;
 *   · CONTROL: an input that is NOT focused takes the frame's value, so the keep is the focus rule, not a no-op.
 */
import { describe, test, expect } from "vitest";
import { Idiomorph } from "idiomorph";

const OPTIONS = { morphStyle: "innerHTML", ignoreActiveValue: true } as const;

function pane(html: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "lar-projection";
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("★ the projection pane morphs in place under the options applyProjection passes ★", () => {
  test("a node standing in both frames keeps its identity, and its text takes the new frame", () => {
    const el = pane(`<section id="s1"><p id="p1">old</p></section>`);
    const before = el.querySelector("#p1");
    Idiomorph.morph(el, `<section id="s1"><p id="p1">new</p><p id="p2">added</p></section>`, OPTIONS);
    const after = el.querySelector("#p1");
    expect(after).toBe(before);
    expect(after?.textContent).toBe("new");
    expect(el.querySelector("#p2")?.textContent).toBe("added");
    el.remove();
  });

  test("the focused input keeps the value being typed; CONTROL: an unfocused input takes the frame's value", () => {
    const el = pane(`<input id="typing" value="a"><input id="idle" value="a">`);
    const typing = el.querySelector<HTMLInputElement>("#typing")!;
    const idle = el.querySelector<HTMLInputElement>("#idle")!;
    typing.focus();
    typing.value = "half-typed";
    idle.value = "stale";
    Idiomorph.morph(el, `<input id="typing" value="from-frame"><input id="idle" value="from-frame">`, OPTIONS);
    expect(el.querySelector("#typing")).toBe(typing);
    expect(typing.value).toBe("half-typed");
    expect(document.activeElement).toBe(typing);
    expect(idle.value).toBe("from-frame");
    el.remove();
  });
});
