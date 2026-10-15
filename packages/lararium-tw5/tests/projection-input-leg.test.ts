/**
 * projection-input-leg.test — a relayed keystroke reaches TW5 where TW5 reads a local one.
 *
 * A projected wiki paints in a shadow root on the main thread while its widgets live in the worker, so an
 * edit only works when the value lands ON THE NODE the widget holds, before that widget's own handler
 * runs — TW5's edit widgets read `domNodes[0].value` inside the handler and never read the event. These
 * tests stand a minimal fake element (the shape TW5's fakedom presents) and drive the leg end to end,
 * with no TW5 boot, no worker, and no browser.
 */
import { describe, test, expect, vi } from "vitest";
import { patchFakeElementForEvents, dispatchProjectedInput, dispatchProjectedEvent } from "../src/tw5-projection.js";
import { hasProjection } from "../src/has-island-watches.js";
import { mkWikiDomInput, mkWikiDomEvent, DOM_INPUT_MAX_CHARS } from "@lararium/mesh";
import type { IslandContext } from "../src/island-context.js";

/** The two members the patch reads off a fakedom element: an attribute bag and a setter. */
class FakeEl {
  attributes: Record<string, string | undefined> = {};
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}
const fakeDoc = { createElement: (_t: string): FakeEl => new FakeEl() };
patchFakeElementForEvents(fakeDoc as unknown as Parameters<typeof patchFakeElementForEvents>[0]);

/** Stand a node that binds a handler, and hand back its render-id plus what the handler saw. */
function boundNode(eventType: string): { rid: string; el: FakeEl; seen: { value: unknown }[] } {
  const el = fakeDoc.createElement("textarea");
  const seen: { value: unknown }[] = [];
  (el as unknown as { addEventListener(t: string, h: (ev: unknown) => void): void })
    .addEventListener(eventType, function (this: unknown, ev: unknown) {
      // What TW5's own handler does: read the value off the NODE, not off the event.
      const target = (ev as { target: { value?: string } }).target;
      seen.push({ value: target.value });
    });
  return { rid: el.attributes["data-lar-rid"]!, el, seen };
}

describe("the projected input leg", () => {
  test("the value lands on the NODE before the handler runs — TW5 reads it where it always reads it", () => {
    const n = boundNode("input");
    dispatchProjectedInput(n.rid, "input", "a tiddler being typed");
    expect(n.seen).toEqual([{ value: "a tiddler being typed" }]);
    expect(n.el).toHaveProperty("value", "a tiddler being typed");
  });

  test("the caret follows the written value — a widget reading a selection reads a coherent one", () => {
    const n = boundNode("input");
    dispatchProjectedInput(n.rid, "input", "abcd");
    expect(n.el).toMatchObject({ selectionStart: 4, selectionEnd: 4 });
  });

  test("only the handlers bound to THAT event type fire", () => {
    const el = fakeDoc.createElement("input");
    const onInput: string[] = [], onChange: string[] = [];
    const add = (el as unknown as { addEventListener(t: string, h: (ev: unknown) => void): void });
    add.addEventListener("input",  () => onInput.push("i"));
    add.addEventListener("change", () => onChange.push("c"));
    const rid = el.attributes["data-lar-rid"]!;
    dispatchProjectedInput(rid, "change", "committed");
    expect(onInput).toEqual([]);
    expect(onChange).toEqual(["c"]);
  });

  test("an unknown render-id answers stale-target", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(dispatchProjectedInput("no-such-rid", "input", "x")).toBe("stale-target");
    expect(dispatchProjectedEvent("no-such-rid", "click", { button: 0 })).toBe("stale-target");
    expect(warning).toHaveBeenCalledWith("[wiki-worker] stale-target: no-such-rid");
    warning.mockRestore();
  });

  test("the caret verbs an edit widget calls answer harmlessly instead of throwing mid-handler", () => {
    const el = fakeDoc.createElement("textarea") as unknown as Record<string, () => void>;
    for (const verb of ["focus", "blur", "select"]) expect(() => el[verb]!()).not.toThrow();
  });

  test("an uncarried synchronous geometry read refuses by capability name", () => {
    const el = fakeDoc.createElement("button") as unknown as { getBoundingClientRect(): unknown };
    expect(() => el.getBoundingClientRect()).toThrow(/CapabilityRefused: DOM geometry requires an event-time rectangle/);
  });
});

describe("the projection cap's door", () => {
  const cap = hasProjection();
  const ctx = {} as IslandContext;

  test("the cap CLAIMS both legs and nothing else", () => {
    const n = boundNode("input");
    expect(cap.onSignal!("wiki:dom-input", mkWikiDomInput({ renderId: n.rid, eventType: "input", value: "hi" }), ctx)).toBe(true);
    expect(cap.onSignal!("wiki:dom-event", mkWikiDomEvent({ renderId: n.rid, eventType: "click", fields: { button: 0 } }), ctx)).toBe(true);
    expect(cap.onSignal!("daemon:place-verb", {}, ctx)).toBe(false);
    expect(n.seen).toEqual([{ value: "hi" }]);
  });

  test("an over-bound value that reached the cap DROPS — claimed, never dispatched", () => {
    const n = boundNode("input");
    // Hand-built, bypassing mkWikiDomInput's throw: this stands in for a sender that never called it.
    const forged = {
      type: "wiki:dom-input",
      renderId: n.rid, eventType: "input", value: "x".repeat(DOM_INPUT_MAX_CHARS + 1),
    };
    expect(cap.onSignal!("wiki:dom-input", forged, ctx)).toBe(true);   // claimed — it falls to no other cap
    expect(n.seen).toEqual([]);                                        // and dispatched to nothing
  });

  test("the CLICK leg still carries its primitive fields onto the event, untouched", () => {
    const el = fakeDoc.createElement("a");
    const seen: Record<string, unknown>[] = [];
    (el as unknown as { addEventListener(t: string, h: (ev: unknown) => void): void })
      .addEventListener("click", (ev) => seen.push(ev as Record<string, unknown>));
    dispatchProjectedEvent(el.attributes["data-lar-rid"]!, "click", { button: 0, metaKey: true });
    expect(seen[0]).toMatchObject({ type: "click", button: 0, metaKey: true });
  });

  test("popup triggers read the click-time geometry carried onto the fake node", () => {
    const el = fakeDoc.createElement("button") as unknown as FakeEl & {
      getBoundingClientRect(): { top: number; left: number; width: number; height: number };
      offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number;
      addEventListener(type: string, handler: (ev: unknown) => void): void;
    };
    let measured: unknown;
    el.addEventListener("click", () => {
      measured = { rect: el.getBoundingClientRect(), left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    });
    dispatchProjectedEvent(el.attributes["data-lar-rid"]!, "click", {
      button: 0, rectLeft: 12, rectTop: 34, rectRight: 112, rectBottom: 54, rectWidth: 100, rectHeight: 20,
    });
    expect(measured).toEqual({
      rect: { top: 34, left: 12, right: 112, bottom: 54, width: 100, height: 20, x: 12, y: 34 },
      left: 12, top: 34, width: 100, height: 20,
    });
  });

});

describe("projected handler refusals", () => {
  test("a throwing event listener is warned and dispatch continues — control: a healthy listener warns nothing", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const thrown = fakeDoc.createElement("button");
    (thrown as unknown as { addEventListener(t: string, h: () => void): void }).addEventListener("click", () => {
      throw new TypeError("no action");
    });
    expect(dispatchProjectedEvent(thrown.attributes["data-lar-rid"]!, "click", {})).toBe("dispatched");
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0]?.[0]).toContain("[wiki-worker] handler refused:");
    expect(warning.mock.calls[0]?.[0]).toContain("TypeError");

    warning.mockClear();
    const healthy = boundNode("click");
    expect(dispatchProjectedEvent(healthy.rid, "click", {})).toBe("dispatched");
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });
});

describe("never-persisted core temporary titles", () => {
  test("core question and alert titles are transient — control: unrelated temporary title persists", async () => {
    const { neverPersists } = await import("../src/island-adaptor.js");
    expect(neverPersists("$:/temp/confirm/1")).toBe(true);
    expect(neverPersists("$:/temp/alerts/alert")).toBe(true);
    expect(neverPersists("$:/temp/other")).toBe(false);
  });
});
