/**
 * projection-sink.test — THE PAGE'S REPLICA KEEPS EACH SURFACE'S FRAMES, EVENTS AND VALUES APART.
 *
 * Every island counts its own revisions and its own render-ids. One pane shows whichever surface holds the
 * vessel's projection gate, so the sink orders frames within a surface, stamps every returned event with the
 * surface that painted its target, and carries nothing across a switch. Real Chromium, the shipped idiomorph.
 */
import { describe, expect, test } from "vitest";
import { createProjectionSink, type ProjectionFrame } from "../src/projection-sink.js";

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { inputMaxChars: 16 });
  const events: string[] = [];
  sink.arm({
    sendDomEvent: (surface, rid, type) => { events.push(`${surface}:${type}:${rid}`); },
    sendDomInput: (surface, rid, type, value) => { events.push(`${surface}:${type}:${rid}=${value}`); },
  });
  const pane = (): HTMLElement => host.shadowRoot!.querySelector<HTMLElement>(".lar-projection")!;
  return { host, sink, events, pane, done: () => host.remove() };
}
const frame = (surface: string, rev: number, html: string): ProjectionFrame => ({ surface, rev, html, css: "" });

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

describe("★ an event names the surface that painted its target ★", () => {
  test("clicks and whole-value input carry the shown surface, and follow a switch", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<button data-lar-rid="7">open</button><input data-lar-rid="9" value="a">`));
    m.pane().querySelector<HTMLButtonElement>("button")!.click();
    const field = m.pane().querySelector<HTMLInputElement>("input")!;
    field.value = "typed";
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    expect(m.events).toEqual(["lares:click:7", "lares:input:9=typed"]);

    // The daemon's frame reuses render-id 7 for a different node; its click names the daemon.
    m.sink.apply(frame("daemon", 1, `<button data-lar-rid="7">summoned</button>`));
    m.pane().querySelector<HTMLButtonElement>("button")!.click();
    expect(m.events.at(-1)).toBe("daemon:click:7");
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
    expect(m.events).toEqual([`lares:change:9=${"x".repeat(16)}`]);
    m.done();
  });
});

describe("★ nothing leaks across a switch ★", () => {
  test("a field a person types in keeps its value across its own surface's frames and ends with that surface", () => {
    const m = mount();
    m.sink.apply(frame("lares", 1, `<input data-lar-rid="5" value="a">`));
    const typing = m.pane().querySelector<HTMLInputElement>("input")!;
    typing.focus();
    typing.value = "typed by hand";
    // CONTROL: the same surface re-projects — the focused field keeps what the person typed.
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
